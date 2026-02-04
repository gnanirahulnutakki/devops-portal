import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest } from '../utils/logger';

/**
 * Request logging middleware
 * - Adds request ID to all requests
 * - Logs request/response with timing
 * - Extracts user context from headers/auth
 */
export function requestLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Generate or use existing request ID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    // Extract user info from various sources
    const userId = getUserId(req);
    const userEmail = getUserEmail(req);
    
    // Attach to request for downstream use
    (req as any).requestId = requestId;
    (req as any).userId = userId;
    (req as any).userEmail = userEmail;
    
    // Log on response finish
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      logRequest(
        req.method,
        req.path,
        res.statusCode,
        durationMs,
        userId,
        {
          requestId,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.headers['x-forwarded-for'],
          contentLength: res.getHeader('content-length'),
        }
      );
    });
    
    next();
  };
}

/**
 * Extract user ID from request
 */
function getUserId(req: Request): string {
  // Check Backstage user header (set by auth middleware)
  const backstageUser = req.headers['x-backstage-user'] as string;
  if (backstageUser) {
    try {
      const parsed = JSON.parse(backstageUser);
      return parsed.userEntityRef || parsed.sub || 'unknown';
    } catch {
      return backstageUser;
    }
  }
  
  // Check authorization header for JWT
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.user_id || 'token-user';
    } catch {
      // Not a valid JWT, ignore
    }
  }
  
  // Check custom header
  if (req.headers['x-user-id']) {
    return req.headers['x-user-id'] as string;
  }
  
  // Check query param (for development)
  if (process.env.NODE_ENV !== 'production' && req.query.user_id) {
    return req.query.user_id as string;
  }
  
  return 'anonymous';
}

/**
 * Extract user email from request
 */
function getUserEmail(req: Request): string | undefined {
  const backstageUser = req.headers['x-backstage-user'] as string;
  if (backstageUser) {
    try {
      const parsed = JSON.parse(backstageUser);
      return parsed.email;
    } catch {
      // ignore
    }
  }
  
  if (req.headers['x-user-email']) {
    return req.headers['x-user-email'] as string;
  }
  
  return undefined;
}

/**
 * Get user context from request (for use in route handlers)
 */
export function getUserContext(req: Request): { userId: string; userEmail?: string; requestId: string } {
  return {
    userId: (req as any).userId || 'anonymous',
    userEmail: (req as any).userEmail,
    requestId: (req as any).requestId || 'unknown',
  };
}
