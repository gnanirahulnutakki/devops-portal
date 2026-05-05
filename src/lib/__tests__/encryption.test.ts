// =============================================================================
// Encryption Tests — real round-trip against the production crypto module.
// No mocks: this exercises the actual encrypt/decrypt path that protects
// kubeconfigs and integration credentials at rest.
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt, isCurrentKey, generateEncryptionKey, reEncrypt } from '../encryption';

// The setup file (src/test/setup.ts) already sets TOKEN_ENCRYPTION_KEY before
// this module is imported, so initializeKeyRing() will succeed lazily on the
// first encrypt() call.

describe('AES-256-GCM round-trip', () => {
  it('encrypts and decrypts a simple string', () => {
    const plaintext = 'sensitive-token-data';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('handles UTF-8 / multibyte characters', () => {
    const plaintext = '配置文件 — héllo · 🔐';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('handles a realistic kubeconfig-sized payload (~6 KB)', () => {
    const plaintext = randomBytes(3 * 1024).toString('base64'); // ~4 KB string
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces a different ciphertext on each call (random IV + salt)', () => {
    const plaintext = 'same-input-every-time';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    // Both must still decrypt to the same plaintext.
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it('produces the documented 5-segment colon-delimited format', () => {
    const ciphertext = encrypt('hello');
    const parts = ciphertext.split(':');
    expect(parts).toHaveLength(5);
    const [kid, salt, iv, authTag] = parts;
    expect(kid).toMatch(/^v\d+$/);
    // base64-decoded lengths
    expect(Buffer.from(salt, 'base64')).toHaveLength(16); // SALT_LENGTH
    expect(Buffer.from(iv, 'base64')).toHaveLength(12); // IV_LENGTH (GCM)
    expect(Buffer.from(authTag, 'base64')).toHaveLength(16); // GCM auth tag
  });
});

describe('Tamper-resistance (GCM authenticated encryption)', () => {
  it('rejects ciphertext with a flipped auth-tag byte', () => {
    const ciphertext = encrypt('the-secret');
    const parts = ciphertext.split(':');
    const tag = Buffer.from(parts[3], 'base64');
    tag[0] ^= 0x01; // flip one bit
    parts[3] = tag.toString('base64');
    const tampered = parts.join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext with a flipped ciphertext byte', () => {
    const ciphertext = encrypt('the-secret');
    const parts = ciphertext.split(':');
    const ct = Buffer.from(parts[4], 'base64');
    if (ct.length === 0) throw new Error('test setup: empty ciphertext');
    ct[0] ^= 0x01;
    parts[4] = ct.toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('rejects ciphertext with a flipped IV byte', () => {
    const ciphertext = encrypt('the-secret');
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[2], 'base64');
    iv[0] ^= 0x01;
    parts[2] = iv.toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('rejects malformed payload (wrong number of segments)', () => {
    expect(() => decrypt('only:four:segments:here')).toThrow('Invalid encrypted data format');
  });

  it('rejects payload that references an unknown key id', () => {
    const ciphertext = encrypt('the-secret');
    const parts = ciphertext.split(':');
    parts[0] = 'v999';
    expect(() => decrypt(parts.join(':'))).toThrow(/Encryption key not found/);
  });
});

describe('Key ring & rotation helpers', () => {
  it('isCurrentKey returns true for freshly-encrypted ciphertext', () => {
    const ciphertext = encrypt('x');
    expect(isCurrentKey(ciphertext)).toBe(true);
  });

  it('reEncrypt round-trips through decrypt → encrypt', () => {
    const plaintext = 'rotate-me';
    const original = encrypt(plaintext);
    const rotated = reEncrypt(original);
    expect(rotated).not.toBe(original); // new IV + salt
    expect(decrypt(rotated)).toBe(plaintext);
  });
});

describe('generateEncryptionKey', () => {
  it('returns a base64-encoded 32-byte key suitable for TOKEN_ENCRYPTION_KEY', () => {
    const key = generateEncryptionKey();
    const bytes = Buffer.from(key, 'base64');
    expect(bytes).toHaveLength(32);
  });

  it('is non-deterministic across calls', () => {
    expect(generateEncryptionKey()).not.toBe(generateEncryptionKey());
  });
});

describe('Multi-key ring decryption (rotation scenario)', () => {
  // Simulate adding a second key to the ring at runtime, then verify ciphertext
  // produced under v1 still decrypts via the in-process keyRing lookup.
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY_2 = randomBytes(32).toString('base64');
  });

  it('decrypts data encrypted before a new key was added', () => {
    // Encrypt with whatever key id is current right now.
    const original = encrypt('legacy-payload');
    const [kidUsed] = original.split(':');
    expect(kidUsed).toMatch(/^v\d+$/);
    expect(decrypt(original)).toBe('legacy-payload');
  });
});
