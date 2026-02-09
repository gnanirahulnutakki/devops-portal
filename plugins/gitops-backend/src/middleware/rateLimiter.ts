import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../utils/logger';

/**
 * Simple in-memory rate limiter
 * 
 * For production, use Redis-based rate limiting for distributed deployments
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skip?: (req: Request) => boolean;  // Skip certain requests
}

const stores: Map<string, Map<string, RateLimitEntry>> = new Map();

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
  } = options;
  
  // Create store for this limiter
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;
  
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key);
      }
    }
  }, windowMs);
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) {
      return next();
    }
    
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = store.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    } else {
      entry.count++;
    }
    
    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
    
    if (entry.count > maxRequests) {
      logSecurityEvent('rate_limit_exceeded', key, false, {
        limiter: name,
        count: entry.count,
        limit: maxRequests,
        path: req.path,
      });
      
      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter: resetSeconds,
        },
      });
      return;
    }
    
    next();
  };
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || 
         (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         'unknown';
}

/**
 * Pre-configured rate limiters
 */

// General API rate limit: 100 requests per minute
export const generalRateLimiter = createRateLimiter('general', {
  windowMs: 60 * 1000,
  maxRequests: 100,
  skip: (req) => req.path === '/health',
});

// Bulk operations rate limit: 10 per minute (expensive operations)
export const bulkOperationsRateLimiter = createRateLimiter('bulk', {
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many bulk operations. Please wait before starting another.',
});

// ArgoCD sync rate limit: 30 per minute
export const syncRateLimiter = createRateLimiter('sync', {
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many sync requests. Please wait before syncing again.',
});

// Auth rate limit: 5 failed attempts per minute
export const authRateLimiter = createRateLimiter('auth', {
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts. Please wait before trying again.',
});
