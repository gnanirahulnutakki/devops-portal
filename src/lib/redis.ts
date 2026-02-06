import Redis from 'ioredis';
import { logger } from './logger';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// =============================================================================
// Token Storage (Encrypted)
// =============================================================================

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const TOKEN_PREFIX = 'token:github:';
const TOKEN_TTL = 8 * 60 * 60; // 8 hours

export async function storeGitHubToken(userId: string, token: StoredToken): Promise<void> {
  const key = `${TOKEN_PREFIX}${userId}`;
  const encrypted = encrypt(JSON.stringify(token));
  await redis.setex(key, TOKEN_TTL, encrypted);
}

export async function getGitHubToken(userId: string): Promise<StoredToken | null> {
  const key = `${TOKEN_PREFIX}${userId}`;
  const encrypted = await redis.get(key);
  
  if (!encrypted) return null;
  
  try {
    const decrypted = decrypt(encrypted);
    const token = JSON.parse(decrypted) as StoredToken;
    
    // Check if expired
    if (token.expiresAt < Date.now()) {
      await redis.del(key);
      return null;
    }
    
    return token;
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt GitHub token');
    await redis.del(key);
    return null;
  }
}

export async function deleteGitHubToken(userId: string): Promise<void> {
  const key = `${TOKEN_PREFIX}${userId}`;
  await redis.del(key);
}

export async function hasGitHubToken(userId: string): Promise<boolean> {
  const key = `${TOKEN_PREFIX}${userId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export default redis;
