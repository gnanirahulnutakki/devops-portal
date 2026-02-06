// =============================================================================
// AES-256-GCM Encryption with Key Ring Support
// =============================================================================

import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const _AUTH_TAG_LENGTH = 16; // 128 bits (used by GCM internally)
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Key ring entry with key ID and derived key
 */
interface KeyEntry {
  kid: string;
  key: Buffer;
  createdAt: number;
}

/**
 * Encrypted data format:
 * kid:salt:iv:authTag:ciphertext (all base64 encoded)
 */
interface EncryptedData {
  kid: string;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

// Key ring for key rotation support
const keyRing: Map<string, KeyEntry> = new Map();

/**
 * Initialize key ring from environment
 * Supports multiple keys for rotation: TOKEN_ENCRYPTION_KEY, TOKEN_ENCRYPTION_KEY_1, etc.
 */
export function initializeKeyRing(): void {
  // Primary key (required)
  const primaryKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!primaryKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
  }

  // Add primary key with kid "v1"
  addKeyToRing('v1', primaryKey);

  // Check for additional rotation keys (v2, v3, etc.)
  let keyIndex = 2;
  while (process.env[`TOKEN_ENCRYPTION_KEY_${keyIndex}`]) {
    const key = process.env[`TOKEN_ENCRYPTION_KEY_${keyIndex}`]!;
    addKeyToRing(`v${keyIndex}`, key);
    keyIndex++;
  }

  logger.info({ keyCount: keyRing.size }, 'Encryption key ring initialized');
}

/**
 * Add a key to the key ring
 */
function addKeyToRing(kid: string, masterKey: string): void {
  // Derive a proper 256-bit key from the master key using PBKDF2
  const salt = Buffer.from(kid); // Use kid as salt for deterministic derivation
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
  
  keyRing.set(kid, {
    kid,
    key,
    createdAt: Date.now(),
  });
}

/**
 * Get the current (newest) key for encryption
 */
function getCurrentKey(): KeyEntry {
  if (keyRing.size === 0) {
    initializeKeyRing();
  }
  
  // Get the highest version key
  const keys = Array.from(keyRing.values());
  const currentKey = keys.reduce((a, b) => 
    parseInt(a.kid.replace('v', '')) > parseInt(b.kid.replace('v', '')) ? a : b
  );
  
  return currentKey;
}

/**
 * Get a key by its ID (for decryption of older data)
 */
function getKeyById(kid: string): KeyEntry | undefined {
  if (keyRing.size === 0) {
    initializeKeyRing();
  }
  return keyRing.get(kid);
}

/**
 * Encrypt data using AES-256-GCM with the current key
 * Returns format: kid:salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const keyEntry = getCurrentKey();
  
  // Generate random salt and IV for each encryption
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive a unique encryption key using salt
  const encKey = crypto.pbkdf2Sync(keyEntry.key, salt, 10000, KEY_LENGTH, 'sha256');
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv);
  
  // Encrypt
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Format: kid:salt:iv:authTag:ciphertext
  const encrypted: EncryptedData = {
    kid: keyEntry.kid,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext,
  };
  
  return `${encrypted.kid}:${encrypted.salt}:${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`;
}

/**
 * Decrypt data using the appropriate key from the key ring
 */
export function decrypt(encryptedString: string): string {
  const parts = encryptedString.split(':');
  
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [kid, saltB64, ivB64, authTagB64, ciphertext] = parts;
  
  // Get the key used for encryption
  const keyEntry = getKeyById(kid);
  if (!keyEntry) {
    throw new Error(`Encryption key not found: ${kid}`);
  }
  
  // Decode components
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  
  // Derive the same encryption key
  const encKey = crypto.pbkdf2Sync(keyEntry.key, salt, 10000, KEY_LENGTH, 'sha256');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, encKey, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Re-encrypt data with the current key (for key rotation)
 */
export function reEncrypt(encryptedString: string): string {
  const plaintext = decrypt(encryptedString);
  return encrypt(plaintext);
}

/**
 * Check if encrypted data uses the current key
 */
export function isCurrentKey(encryptedString: string): boolean {
  const parts = encryptedString.split(':');
  if (parts.length < 1) return false;
  
  const kid = parts[0];
  const currentKey = getCurrentKey();
  return kid === currentKey.kid;
}

/**
 * Generate a secure random key for TOKEN_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
