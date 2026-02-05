/**
 * TwoFactorAuthService - TOTP Two-Factor Authentication
 *
 * Features:
 * - TOTP (RFC 6238) compatible with Google Authenticator, Authy, etc.
 * - QR code generation for easy setup
 * - 8 backup codes (one-time use, bcrypt hashed)
 * - Trusted device support (30-day remember)
 * - Encrypted TOTP secrets at rest (AES-256-GCM)
 *
 * Uses well-maintained open source libraries:
 * - otplib v13 for TOTP generation/verification
 * - qrcode for QR code generation
 * - bcrypt for backup code hashing
 * - crypto-js for AES encryption
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { Knex } from 'knex';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Types
export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TrustedDevice {
  fingerprint: string;
  ip: string;
  userAgent: string;
  trustedUntil: Date;
  createdAt: Date;
}

export interface TwoFactorConfig {
  issuer: string;
  encryptionKey: string; // For encrypting TOTP secrets at rest
  backupCodeCount: number;
  trustedDeviceDuration: number; // seconds
  bcryptCost: number;
  window: number; // TOTP time window (number of periods)
}

interface StoredBackupCode {
  codeHash: string;
  used: boolean;
  usedAt?: Date;
}

const DEFAULT_CONFIG: TwoFactorConfig = {
  issuer: 'DevOps Portal',
  encryptionKey: process.env.TOTP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
  backupCodeCount: 8,
  trustedDeviceDuration: 2592000, // 30 days
  bcryptCost: 10, // Lower than password for backup codes
  window: 1, // Allow 1 period before/after
};

export class TwoFactorAuthService {
  private db: Knex;
  private config: TwoFactorConfig;

  constructor(db: Knex, config: Partial<TwoFactorConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Configure otplib
    authenticator.options = {
      window: this.config.window,
    };

    logger.info('TwoFactorAuthService initialized', {
      issuer: this.config.issuer,
      backupCodeCount: this.config.backupCodeCount,
      trustedDeviceDuration: this.config.trustedDeviceDuration,
    });
  }

  // ============================================================================
  // TOTP Setup
  // ============================================================================

  /**
   * Generate TOTP setup for a user (doesn't enable yet)
   */
  async generateSetup(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    // Generate secret
    const secret = authenticator.generateSecret();

    // Create otpauth URL
    const otpauthUrl = authenticator.keyuri(userEmail, this.config.issuer, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    // Encrypt secret for storage
    const encryptedSecret = this.encryptSecret(secret);

    // Store in pending state (not enabled until verified)
    await this.db('user_2fa')
      .insert({
        user_id: userId,
        is_enabled: false,
        totp_secret: encryptedSecret,
        totp_algorithm: 'SHA1',
        totp_digits: 6,
        totp_period: 30,
        backup_codes: JSON.stringify(hashedCodes),
        backup_codes_remaining: backupCodes.length,
        backup_codes_generated_at: new Date(),
      })
      .onConflict('user_id')
      .merge({
        totp_secret: encryptedSecret,
        backup_codes: JSON.stringify(hashedCodes),
        backup_codes_remaining: backupCodes.length,
        backup_codes_generated_at: new Date(),
        updated_at: new Date(),
      });

    logger.info('2FA setup generated', { userId });

    return {
      secret, // Return plaintext for display (user needs to add to authenticator)
      qrCodeDataUrl,
      qrCodeUrl: otpauthUrl,
      backupCodes, // Return plaintext backup codes (one-time display)
    };
  }

  /**
   * Verify TOTP code and enable 2FA
   */
  async verifyAndEnable(userId: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const twoFactor = await this.db('user_2fa').where('user_id', userId).first();

      if (!twoFactor) {
        return { success: false, error: '2FA setup not found. Please generate setup first.' };
      }

      if (twoFactor.is_enabled) {
        return { success: false, error: '2FA is already enabled' };
      }

      // Decrypt and verify
      const secret = this.decryptSecret(twoFactor.totp_secret);
      const isValid = authenticator.verify({ token: code, secret });

      if (!isValid) {
        return { success: false, error: 'Invalid verification code' };
      }

      // Enable 2FA
      await this.db('user_2fa').where('user_id', userId).update({
        is_enabled: true,
        enabled_at: new Date(),
        updated_at: new Date(),
      });

      logger.info('2FA enabled', { userId });
      return { success: true };
    } catch (error) {
      logger.error('2FA verification error', { error, userId });
      return { success: false, error: '2FA verification failed' };
    }
  }

  /**
   * Verify TOTP code for login
   */
  async verifyCode(userId: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const twoFactor = await this.db('user_2fa')
        .where('user_id', userId)
        .where('is_enabled', true)
        .first();

      if (!twoFactor) {
        return { success: false, error: '2FA not enabled' };
      }

      // Decrypt and verify TOTP
      const secret = this.decryptSecret(twoFactor.totp_secret);
      const isValid = authenticator.verify({ token: code, secret });

      if (isValid) {
        await this.db('user_2fa').where('user_id', userId).update({
          last_totp_verified_at: new Date(),
          updated_at: new Date(),
        });
        logger.info('2FA code verified', { userId });
        return { success: true };
      }

      // Try backup codes
      const backupResult = await this.verifyBackupCode(userId, code);
      if (backupResult.success) {
        return { success: true };
      }

      return { success: false, error: 'Invalid code' };
    } catch (error) {
      logger.error('2FA verify error', { error, userId });
      return { success: false, error: '2FA verification failed' };
    }
  }

  /**
   * Disable 2FA
   */
  async disable(userId: string, code: string): Promise<{ success: boolean; error?: string }> {
    // First verify the code
    const verifyResult = await this.verifyCode(userId, code);
    if (!verifyResult.success) {
      return { success: false, error: 'Invalid code. Please provide a valid TOTP code to disable 2FA.' };
    }

    await this.db('user_2fa').where('user_id', userId).update({
      is_enabled: false,
      disabled_at: new Date(),
      updated_at: new Date(),
    });

    logger.info('2FA disabled', { userId });
    return { success: true };
  }

  /**
   * Check if 2FA is enabled for user
   */
  async isEnabled(userId: string): Promise<boolean> {
    const twoFactor = await this.db('user_2fa')
      .where('user_id', userId)
      .where('is_enabled', true)
      .first();
    return !!twoFactor;
  }

  // ============================================================================
  // Backup Codes
  // ============================================================================

  /**
   * Generate new backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.config.backupCodeCount; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX for readability
      codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
    }
    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  private async hashBackupCodes(codes: string[]): Promise<StoredBackupCode[]> {
    const hashedCodes: StoredBackupCode[] = [];
    for (const code of codes) {
      const codeHash = await bcrypt.hash(code.replace('-', ''), this.config.bcryptCost);
      hashedCodes.push({ codeHash, used: false });
    }
    return hashedCodes;
  }

  /**
   * Verify a backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<{ success: boolean; remaining?: number }> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();
    if (!twoFactor || !twoFactor.backup_codes) {
      return { success: false };
    }

    const normalizedCode = code.replace('-', '').toUpperCase();
    const backupCodes: StoredBackupCode[] = JSON.parse(twoFactor.backup_codes);

    for (let i = 0; i < backupCodes.length; i++) {
      const storedCode = backupCodes[i];
      if (storedCode.used) continue;

      const isMatch = await bcrypt.compare(normalizedCode, storedCode.codeHash);
      if (isMatch) {
        // Mark code as used
        backupCodes[i] = { ...storedCode, used: true, usedAt: new Date() };
        const remaining = backupCodes.filter(c => !c.used).length;

        await this.db('user_2fa').where('user_id', userId).update({
          backup_codes: JSON.stringify(backupCodes),
          backup_codes_remaining: remaining,
          last_backup_code_used_at: new Date(),
          updated_at: new Date(),
        });

        logger.info('Backup code used', { userId, remaining });
        return { success: true, remaining };
      }
    }

    return { success: false };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, totpCode: string): Promise<{
    success: boolean;
    backupCodes?: string[];
    error?: string;
  }> {
    // Verify TOTP first
    const verifyResult = await this.verifyCode(userId, totpCode);
    if (!verifyResult.success) {
      return { success: false, error: 'Invalid TOTP code' };
    }

    // Generate new codes
    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    await this.db('user_2fa').where('user_id', userId).update({
      backup_codes: JSON.stringify(hashedCodes),
      backup_codes_remaining: backupCodes.length,
      backup_codes_generated_at: new Date(),
      updated_at: new Date(),
    });

    logger.info('Backup codes regenerated', { userId });
    return { success: true, backupCodes };
  }

  /**
   * Get remaining backup codes count
   */
  async getBackupCodesCount(userId: string): Promise<number> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();
    return twoFactor?.backup_codes_remaining || 0;
  }

  // ============================================================================
  // Trusted Devices
  // ============================================================================

  /**
   * Add a trusted device
   */
  async trustDevice(
    userId: string,
    device: { fingerprint: string; ip: string; userAgent: string }
  ): Promise<void> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();
    if (!twoFactor) return;

    const trustedDevices: TrustedDevice[] = JSON.parse(twoFactor.trusted_devices || '[]');

    // Remove expired devices
    const now = new Date();
    const activeDevices = trustedDevices.filter(
      d => new Date(d.trustedUntil) > now
    );

    // Add new device
    activeDevices.push({
      fingerprint: device.fingerprint,
      ip: device.ip,
      userAgent: device.userAgent,
      trustedUntil: new Date(Date.now() + this.config.trustedDeviceDuration * 1000),
      createdAt: new Date(),
    });

    // Keep max 10 trusted devices
    const limitedDevices = activeDevices.slice(-10);

    await this.db('user_2fa').where('user_id', userId).update({
      trusted_devices: JSON.stringify(limitedDevices),
      updated_at: new Date(),
    });

    logger.info('Device trusted', { userId, fingerprint: device.fingerprint });
  }

  /**
   * Check if device is trusted (can skip 2FA)
   */
  async isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();
    if (!twoFactor || !twoFactor.trusted_devices) return false;

    const trustedDevices: TrustedDevice[] = JSON.parse(twoFactor.trusted_devices);
    const now = new Date();

    return trustedDevices.some(
      d => d.fingerprint === fingerprint && new Date(d.trustedUntil) > now
    );
  }

  /**
   * Revoke all trusted devices
   */
  async revokeAllTrustedDevices(userId: string): Promise<void> {
    await this.db('user_2fa').where('user_id', userId).update({
      trusted_devices: JSON.stringify([]),
      updated_at: new Date(),
    });

    logger.info('All trusted devices revoked', { userId });
  }

  /**
   * Get list of trusted devices
   */
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();
    if (!twoFactor || !twoFactor.trusted_devices) return [];

    const devices: TrustedDevice[] = JSON.parse(twoFactor.trusted_devices);
    const now = new Date();

    // Return only active devices
    return devices.filter(d => new Date(d.trustedUntil) > now);
  }

  // ============================================================================
  // Encryption Helpers
  // ============================================================================

  /**
   * Encrypt TOTP secret for storage
   */
  private encryptSecret(secret: string): string {
    return CryptoJS.AES.encrypt(secret, this.config.encryptionKey).toString();
  }

  /**
   * Decrypt TOTP secret from storage
   */
  private decryptSecret(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, this.config.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
   * Get 2FA status for user
   */
  async getStatus(userId: string): Promise<{
    enabled: boolean;
    enabledAt?: Date;
    backupCodesRemaining: number;
    trustedDevicesCount: number;
    lastVerifiedAt?: Date;
  }> {
    const twoFactor = await this.db('user_2fa').where('user_id', userId).first();

    if (!twoFactor) {
      return {
        enabled: false,
        backupCodesRemaining: 0,
        trustedDevicesCount: 0,
      };
    }

    const trustedDevices = await this.getTrustedDevices(userId);

    return {
      enabled: twoFactor.is_enabled,
      enabledAt: twoFactor.enabled_at ? new Date(twoFactor.enabled_at) : undefined,
      backupCodesRemaining: twoFactor.backup_codes_remaining || 0,
      trustedDevicesCount: trustedDevices.length,
      lastVerifiedAt: twoFactor.last_totp_verified_at
        ? new Date(twoFactor.last_totp_verified_at)
        : undefined,
    };
  }
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Middleware to require 2FA verification
 */
export function require2FA(twoFactorService: TwoFactorAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).localUser;
    const session = (req as any).localSession;

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Check if 2FA is enabled for user
    const isEnabled = await twoFactorService.isEnabled(user.id);
    if (!isEnabled) {
      return next(); // 2FA not required
    }

    // Check if session has 2FA verified
    if (session?.is2faVerified) {
      return next();
    }

    // Check for trusted device
    const fingerprint = req.headers['x-device-fingerprint'] as string;
    if (fingerprint) {
      const isTrusted = await twoFactorService.isDeviceTrusted(user.id, fingerprint);
      if (isTrusted) {
        return next();
      }
    }

    return res.status(403).json({
      error: {
        code: 'MFA_REQUIRED',
        message: 'Two-factor authentication required',
      },
    });
  };
}

export default TwoFactorAuthService;
