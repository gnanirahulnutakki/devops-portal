/**
 * LocalAuthService - Enterprise Username/Password Authentication
 *
 * Features:
 * - bcrypt password hashing (cost factor 12)
 * - JWT session tokens with configurable expiry
 * - Account lockout after failed attempts
 * - Password policy enforcement
 * - Session management with refresh tokens
 * - Three-tier RBAC (user, readwrite, admin)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Knex } from 'knex';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Types
export type UserRole = 'user' | 'readwrite' | 'admin';

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastActiveAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  is2faVerified: boolean;
  rememberDevice: boolean;
  isRevoked: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: LocalUser;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  requires2fa?: boolean;
  sessionId?: string;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: Date;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  maxAge?: number; // Days before password expires
  preventReuse?: number; // Number of previous passwords to check
}

export interface LocalAuthConfig {
  jwtSecret: string;
  jwtExpiresIn: number; // seconds
  refreshExpiresIn: number; // seconds
  refreshThreshold: number; // seconds before expiry to allow refresh
  bcryptCost: number;
  passwordPolicy: PasswordPolicy;
  lockout: {
    maxAttempts: number;
    durationSeconds: number;
  };
  sessionBinding: {
    bindToIp: boolean;
    bindToUserAgent: boolean;
  };
}

const DEFAULT_CONFIG: LocalAuthConfig = {
  jwtSecret: process.env.LOCAL_AUTH_JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiresIn: 86400, // 24 hours
  refreshExpiresIn: 604800, // 7 days
  refreshThreshold: 3600, // 1 hour
  bcryptCost: 12,
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: true,
  },
  lockout: {
    maxAttempts: 5,
    durationSeconds: 900, // 15 minutes
  },
  sessionBinding: {
    bindToIp: false,
    bindToUserAgent: false,
  },
};

// Common passwords to block (top entries - full list should be loaded from file)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'shadow', '123123', '654321', 'superman', 'qazwsx',
  'michael', 'football', 'password1', 'password123', 'batman', 'login', 'admin',
]);

export class LocalAuthService {
  private db: Knex;
  private config: LocalAuthConfig;

  constructor(db: Knex, config: Partial<LocalAuthConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info('LocalAuthService initialized', {
      jwtExpiresIn: this.config.jwtExpiresIn,
      bcryptCost: this.config.bcryptCost,
      lockoutAttempts: this.config.lockout.maxAttempts,
    });
  }

  // ============================================================================
  // Password Management
  // ============================================================================

  /**
   * Hash password with bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptCost);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string, username?: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = this.config.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireDigit && !/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check against common passwords
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common, please choose a stronger password');
    }

    // Check if password contains username
    if (username && password.toLowerCase().includes(username.toLowerCase())) {
      errors.push('Password cannot contain your username');
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Create a new user
   */
  async createUser(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role?: UserRole;
    createdBy?: string;
  }): Promise<{ user?: LocalUser; error?: string }> {
    try {
      // Validate password
      const validation = this.validatePassword(data.password, data.username);
      if (!validation.valid) {
        return { error: validation.errors.join('; ') };
      }

      // Check if username or email already exists
      const existing = await this.db('users')
        .where('username', data.username)
        .orWhere('email', data.email)
        .first();

      if (existing) {
        if (existing.username === data.username) {
          return { error: 'Username already exists' };
        }
        return { error: 'Email already exists' };
      }

      // Hash password
      const passwordHash = await this.hashPassword(data.password);

      // Insert user
      const [user] = await this.db('users')
        .insert({
          username: data.username,
          email: data.email.toLowerCase(),
          password_hash: passwordHash,
          display_name: data.displayName,
          role: data.role || 'user',
          is_active: true,
          email_verified: false,
          password_changed_at: new Date(),
          created_by: data.createdBy,
        })
        .returning('*');

      logger.info('User created', { userId: user.id, username: user.username });

      return { user: this.mapDbUserToUser(user) };
    } catch (error) {
      logger.error('Error creating user', { error });
      return { error: 'Failed to create user' };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<LocalUser | null> {
    const user = await this.db('users').where('id', id).first();
    return user ? this.mapDbUserToUser(user) : null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<LocalUser | null> {
    const user = await this.db('users').where('username', username).first();
    return user ? this.mapDbUserToUser(user) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<LocalUser | null> {
    const user = await this.db('users').where('email', email.toLowerCase()).first();
    return user ? this.mapDbUserToUser(user) : null;
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    updates: Partial<{
      displayName: string;
      email: string;
      role: UserRole;
      isActive: boolean;
    }>,
    updatedBy?: string
  ): Promise<LocalUser | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase();
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updatedBy) updateData.updated_by = updatedBy;

    const [user] = await this.db('users')
      .where('id', id)
      .update(updateData)
      .returning('*');

    return user ? this.mapDbUserToUser(user) : null;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.db('users').where('id', id).delete();
    return deleted > 0;
  }

  /**
   * List users with pagination
   */
  async listUsers(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{ users: LocalUser[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.db('users');
    let countQuery = this.db('users');

    if (options.role) {
      query = query.where('role', options.role);
      countQuery = countQuery.where('role', options.role);
    }

    if (options.isActive !== undefined) {
      query = query.where('is_active', options.isActive);
      countQuery = countQuery.where('is_active', options.isActive);
    }

    if (options.search) {
      const search = `%${options.search}%`;
      query = query.where(builder => {
        builder
          .where('username', 'ilike', search)
          .orWhere('email', 'ilike', search)
          .orWhere('display_name', 'ilike', search);
      });
      countQuery = countQuery.where(builder => {
        builder
          .where('username', 'ilike', search)
          .orWhere('email', 'ilike', search)
          .orWhere('display_name', 'ilike', search);
      });
    }

    const [users, [{ count }]] = await Promise.all([
      query
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      countQuery.count('* as count'),
    ]);

    return {
      users: users.map(u => this.mapDbUserToUser(u)),
      total: parseInt(count as string, 10),
    };
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Login with username/password
   */
  async login(
    usernameOrEmail: string,
    password: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
      rememberDevice?: boolean;
    } = {}
  ): Promise<LoginResult> {
    try {
      // Find user by username or email
      const user = await this.db('users')
        .where('username', usernameOrEmail)
        .orWhere('email', usernameOrEmail.toLowerCase())
        .first();

      if (!user) {
        logger.warn('Login attempt for unknown user', { usernameOrEmail });
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        logger.warn('Login attempt for locked account', { userId: user.id });
        return {
          success: false,
          error: 'Account is locked due to too many failed attempts',
          lockedUntil: new Date(user.locked_until),
        };
      }

      // Check if account is active
      if (!user.is_active) {
        logger.warn('Login attempt for inactive account', { userId: user.id });
        return { success: false, error: 'Account is disabled' };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(password, user.password_hash);

      if (!passwordValid) {
        // Increment failed attempts
        const failedAttempts = (user.failed_login_attempts || 0) + 1;
        const updateData: Record<string, unknown> = {
          failed_login_attempts: failedAttempts,
          last_failed_login: new Date(),
        };

        // Lock account if max attempts exceeded
        if (failedAttempts >= this.config.lockout.maxAttempts) {
          const lockedUntil = new Date(Date.now() + this.config.lockout.durationSeconds * 1000);
          updateData.locked_until = lockedUntil;
          logger.warn('Account locked due to failed attempts', { userId: user.id, failedAttempts });
        }

        await this.db('users').where('id', user.id).update(updateData);

        return {
          success: false,
          error: 'Invalid credentials',
          remainingAttempts: Math.max(0, this.config.lockout.maxAttempts - failedAttempts),
        };
      }

      // Check if 2FA is enabled
      const twoFactor = await this.db('user_2fa')
        .where('user_id', user.id)
        .where('is_enabled', true)
        .first();

      // Clear failed attempts and update last login
      await this.db('users').where('id', user.id).update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login: new Date(),
      });

      // If 2FA is enabled, don't create session yet
      if (twoFactor) {
        logger.info('Login requires 2FA', { userId: user.id });
        return {
          success: true,
          user: this.mapDbUserToUser(user),
          requires2fa: true,
        };
      }

      // Create session
      const session = await this.createSession(user.id, {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceFingerprint: options.deviceFingerprint,
        is2faVerified: false,
        rememberDevice: options.rememberDevice,
      });

      logger.info('User logged in', { userId: user.id, sessionId: session.sessionId });

      return {
        success: true,
        user: this.mapDbUserToUser(user),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        sessionId: session.sessionId,
      };
    } catch (error) {
      logger.error('Login error', { error });
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Create a new session for user
   */
  async createSession(
    userId: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
      is2faVerified?: boolean;
      rememberDevice?: boolean;
    } = {}
  ): Promise<{
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const expiresAt = new Date(Date.now() + this.config.jwtExpiresIn * 1000);

    // Generate JWT
    const accessToken = jwt.sign(
      {
        sub: userId,
        type: 'access',
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      this.config.jwtSecret
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        sub: userId,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000 + this.config.refreshExpiresIn),
      },
      this.config.jwtSecret
    );

    // Hash token for storage
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    // Store session
    const [session] = await this.db('user_sessions')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: options.ipAddress,
        user_agent: options.userAgent?.substring(0, 500),
        device_fingerprint: options.deviceFingerprint,
        is_2fa_verified: options.is2faVerified || false,
        remember_device: options.rememberDevice || false,
      })
      .returning('*');

    return {
      sessionId: session.id,
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Verify JWT token and return session
   */
  async verifyToken(token: string): Promise<{
    valid: boolean;
    user?: LocalUser;
    session?: UserSession;
    error?: string;
  }> {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, this.config.jwtSecret) as {
        sub: string;
        type: string;
        exp: number;
      };

      if (decoded.type !== 'access') {
        return { valid: false, error: 'Invalid token type' };
      }

      // Find session by token hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = await this.db('user_sessions')
        .where('token_hash', tokenHash)
        .where('is_revoked', false)
        .first();

      if (!session) {
        return { valid: false, error: 'Session not found or revoked' };
      }

      if (new Date(session.expires_at) < new Date()) {
        return { valid: false, error: 'Session expired' };
      }

      // Get user
      const user = await this.getUserById(decoded.sub);
      if (!user) {
        return { valid: false, error: 'User not found' };
      }

      if (!user.isActive) {
        return { valid: false, error: 'User is disabled' };
      }

      // Update last active
      await this.db('user_sessions')
        .where('id', session.id)
        .update({ last_active_at: new Date() });

      return {
        valid: true,
        user,
        session: this.mapDbSessionToSession(session),
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      }
      logger.error('Token verification error', { error });
      return { valid: false, error: 'Token verification failed' };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshTokenValue: string,
    options: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<{
    success: boolean;
    accessToken?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshTokenValue, this.config.jwtSecret) as {
        sub: string;
        type: string;
        exp: number;
      };

      if (decoded.type !== 'refresh') {
        return { success: false, error: 'Invalid token type' };
      }

      // Get user
      const user = await this.getUserById(decoded.sub);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or disabled' };
      }

      // Generate new access token
      const expiresAt = new Date(Date.now() + this.config.jwtExpiresIn * 1000);
      const accessToken = jwt.sign(
        {
          sub: user.id,
          type: 'access',
          exp: Math.floor(expiresAt.getTime() / 1000),
        },
        this.config.jwtSecret
      );

      // Create new session record
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      await this.db('user_sessions').insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: options.ipAddress,
        user_agent: options.userAgent?.substring(0, 500),
        is_2fa_verified: true, // Refresh implies 2FA was verified
      });

      logger.info('Token refreshed', { userId: user.id });

      return { success: true, accessToken, expiresAt };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { success: false, error: 'Refresh token expired' };
      }
      logger.error('Token refresh error', { error });
      return { success: false, error: 'Token refresh failed' };
    }
  }

  /**
   * Logout - revoke session
   */
  async logout(token: string, reason = 'logout'): Promise<boolean> {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const updated = await this.db('user_sessions')
        .where('token_hash', tokenHash)
        .update({
          is_revoked: true,
          revoked_at: new Date(),
          revoked_reason: reason,
        });

      return updated > 0;
    } catch (error) {
      logger.error('Logout error', { error });
      return false;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string, reason = 'admin_action', revokedBy?: string): Promise<number> {
    const updated = await this.db('user_sessions')
      .where('user_id', userId)
      .where('is_revoked', false)
      .update({
        is_revoked: true,
        revoked_at: new Date(),
        revoked_reason: reason,
        revoked_by: revokedBy,
      });

    logger.info('All sessions revoked', { userId, count: updated });
    return updated;
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.db('users').where('id', userId).first();
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const valid = await this.verifyPassword(currentPassword, user.password_hash);
      if (!valid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Validate new password
      const validation = this.validatePassword(newPassword, user.username);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join('; ') };
      }

      // Check password history
      if (this.config.passwordPolicy.preventReuse) {
        const history = user.password_history || [];
        for (const oldHash of history.slice(0, this.config.passwordPolicy.preventReuse)) {
          if (await this.verifyPassword(newPassword, oldHash)) {
            return { success: false, error: 'Password was used recently, please choose a different one' };
          }
        }
      }

      // Hash new password
      const newHash = await this.hashPassword(newPassword);

      // Update password and history
      const passwordHistory = [user.password_hash, ...(user.password_history || [])].slice(0, 10);
      await this.db('users').where('id', userId).update({
        password_hash: newHash,
        password_history: JSON.stringify(passwordHistory),
        password_changed_at: new Date(),
        force_password_change: false,
      });

      // Revoke all existing sessions (force re-login)
      await this.revokeAllSessions(userId, 'password_change');

      logger.info('Password changed', { userId });
      return { success: true };
    } catch (error) {
      logger.error('Password change error', { error });
      return { success: false, error: 'Password change failed' };
    }
  }

  /**
   * Admin: Reset user password
   */
  async resetPassword(
    userId: string,
    newPassword: string,
    adminUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.db('users').where('id', userId).first();
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate new password
      const validation = this.validatePassword(newPassword, user.username);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join('; ') };
      }

      // Hash new password
      const newHash = await this.hashPassword(newPassword);

      // Update password and force change on next login
      await this.db('users').where('id', userId).update({
        password_hash: newHash,
        password_changed_at: new Date(),
        force_password_change: true,
        updated_by: adminUserId,
        failed_login_attempts: 0,
        locked_until: null,
      });

      // Revoke all existing sessions
      await this.revokeAllSessions(userId, 'password_reset', adminUserId);

      logger.info('Password reset by admin', { userId, adminUserId });
      return { success: true };
    } catch (error) {
      logger.error('Password reset error', { error });
      return { success: false, error: 'Password reset failed' };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapDbUserToUser(dbUser: any): LocalUser {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      displayName: dbUser.display_name,
      role: dbUser.role,
      isActive: dbUser.is_active,
      emailVerified: dbUser.email_verified,
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
    };
  }

  private mapDbSessionToSession(dbSession: any): UserSession {
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      tokenHash: dbSession.token_hash,
      expiresAt: new Date(dbSession.expires_at),
      lastActiveAt: new Date(dbSession.last_active_at),
      ipAddress: dbSession.ip_address,
      userAgent: dbSession.user_agent,
      deviceFingerprint: dbSession.device_fingerprint,
      is2faVerified: dbSession.is_2fa_verified,
      rememberDevice: dbSession.remember_device,
      isRevoked: dbSession.is_revoked,
    };
  }
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Express middleware for local auth
 */
export function localAuthMiddleware(authService: LocalAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without auth
    }

    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);

    if (result.valid && result.user) {
      // Attach user to request
      (req as any).localUser = result.user;
      (req as any).localSession = result.session;

      // Also set Backstage-compatible headers for PermissionService
      req.headers['x-backstage-user-id'] = result.user.id;
      req.headers['x-backstage-user-email'] = result.user.email;
      req.headers['x-backstage-user-display-name'] = result.user.displayName || result.user.username;
    }

    next();
  };
}

/**
 * Middleware to require local authentication
 */
export function requireLocalAuth(authService: LocalAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const token = authHeader.substring(7);
    const result = await authService.verifyToken(token);

    if (!result.valid) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: result.error || 'Invalid token' },
      });
    }

    (req as any).localUser = result.user;
    (req as any).localSession = result.session;
    next();
  };
}

/**
 * Middleware to require specific local user role
 */
export function requireLocalRole(authService: LocalAuthService, ...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).localUser;

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          requiredRoles: roles,
          userRole: user.role,
        },
      });
    }

    next();
  };
}

export default LocalAuthService;
