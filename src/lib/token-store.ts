// =============================================================================
// Secure Token Storage - Redis with AES-256-GCM Encryption
// =============================================================================

import { redis } from './redis';
import { encrypt, decrypt, isCurrentKey, reEncrypt } from './encryption';
import { logger } from './logger';

// Token types we store
export type TokenType = 'github' | 'argocd' | 'grafana';

/**
 * Stored token structure
 */
export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Token storage key format: tokens:{type}:{userId}
 */
function getTokenKey(type: TokenType, userId: string): string {
  return `tokens:${type}:${userId}`;
}

/**
 * Store a token securely with encryption
 * Never exposes raw token - always encrypted at rest
 */
export async function storeToken(
  type: TokenType,
  userId: string,
  token: StoredToken
): Promise<void> {
  const key = getTokenKey(type, userId);
  
  // Serialize and encrypt the token
  const serialized = JSON.stringify({
    ...token,
    storedAt: Date.now(),
  });
  const encrypted = encrypt(serialized);
  
  // Store in Redis with optional TTL based on token expiry
  if (token.expiresAt) {
    const ttl = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));
    await redis.setex(key, ttl, encrypted);
  } else {
    // Default 30-day TTL for tokens without expiry
    await redis.setex(key, 60 * 60 * 24 * 30, encrypted);
  }
  
  logger.info(
    { type, userId, hasRefreshToken: !!token.refreshToken },
    'Token stored securely'
  );
}

/**
 * Retrieve a token - decrypts and returns
 * Re-encrypts with current key if using old key (key rotation)
 */
export async function getToken(
  type: TokenType,
  userId: string
): Promise<StoredToken | null> {
  const key = getTokenKey(type, userId);
  const encrypted = await redis.get(key);
  
  if (!encrypted) {
    return null;
  }
  
  try {
    const decrypted = decrypt(encrypted);
    const token = JSON.parse(decrypted) as StoredToken & { storedAt: number };
    
    // Check if token is expired
    if (token.expiresAt && token.expiresAt < Date.now()) {
      logger.warn({ type, userId }, 'Token expired');
      await deleteToken(type, userId);
      return null;
    }
    
    // Re-encrypt with current key if needed (key rotation)
    if (!isCurrentKey(encrypted)) {
      const reEncrypted = reEncrypt(encrypted);
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        await redis.setex(key, ttl, reEncrypted);
      } else {
        await redis.set(key, reEncrypted);
      }
      logger.info({ type, userId }, 'Token re-encrypted with current key');
    }
    
    // Remove internal metadata before returning
    const { storedAt: _storedAt, ...cleanToken } = token;
    return cleanToken;
  } catch (error) {
    logger.error(
      { type, userId, error: error instanceof Error ? error.message : 'Unknown' },
      'Failed to decrypt token'
    );
    return null;
  }
}

/**
 * Check if a token exists (without decrypting)
 */
export async function hasToken(type: TokenType, userId: string): Promise<boolean> {
  const key = getTokenKey(type, userId);
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Delete a token
 */
export async function deleteToken(type: TokenType, userId: string): Promise<void> {
  const key = getTokenKey(type, userId);
  await redis.del(key);
  logger.info({ type, userId }, 'Token deleted');
}

/**
 * Delete all tokens for a user (e.g., on logout)
 */
export async function deleteAllUserTokens(userId: string): Promise<void> {
  const types: TokenType[] = ['github', 'argocd', 'grafana'];
  
  for (const type of types) {
    await deleteToken(type, userId);
  }
  
  logger.info({ userId }, 'All user tokens deleted');
}

/**
 * Refresh a token using its refresh token
 * This is a placeholder - actual implementation depends on the provider
 */
export async function refreshToken(
  type: TokenType,
  userId: string,
  refreshFn: (refreshToken: string) => Promise<StoredToken>
): Promise<StoredToken | null> {
  const currentToken = await getToken(type, userId);
  
  if (!currentToken?.refreshToken) {
    logger.warn({ type, userId }, 'No refresh token available');
    return null;
  }
  
  try {
    const newToken = await refreshFn(currentToken.refreshToken);
    await storeToken(type, userId, newToken);
    return newToken;
  } catch (error) {
    logger.error(
      { type, userId, error: error instanceof Error ? error.message : 'Unknown' },
      'Token refresh failed'
    );
    return null;
  }
}

// =============================================================================
// Convenience Functions for Specific Token Types
// =============================================================================

export const githubTokens = {
  store: (userId: string, token: StoredToken) => storeToken('github', userId, token),
  get: (userId: string) => getToken('github', userId),
  has: (userId: string) => hasToken('github', userId),
  delete: (userId: string) => deleteToken('github', userId),
};

export const argocdTokens = {
  store: (userId: string, token: StoredToken) => storeToken('argocd', userId, token),
  get: (userId: string) => getToken('argocd', userId),
  has: (userId: string) => hasToken('argocd', userId),
  delete: (userId: string) => deleteToken('argocd', userId),
};

export const grafanaTokens = {
  store: (userId: string, token: StoredToken) => storeToken('grafana', userId, token),
  get: (userId: string) => getToken('grafana', userId),
  has: (userId: string) => hasToken('grafana', userId),
  delete: (userId: string) => deleteToken('grafana', userId),
};
