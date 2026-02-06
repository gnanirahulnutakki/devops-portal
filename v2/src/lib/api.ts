import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { auth } from './auth';
import { logger } from './logger';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';
import { 
  withApiContext, 
  ApiContext, 
  requireRole, 
  logAuditEvent 
} from './api-context';

// =============================================================================
// API Response Helpers
// =============================================================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, meta });
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

export function validationError(error: ZodError): NextResponse<ApiResponse> {
  return errorResponse(
    'VALIDATION_ERROR',
    'Invalid request data',
    400,
    error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }))
  );
}

export function unauthorizedError(message = 'Authentication required'): NextResponse<ApiResponse> {
  return errorResponse('UNAUTHORIZED', message, 401);
}

export function forbiddenError(message = 'Permission denied'): NextResponse<ApiResponse> {
  return errorResponse('FORBIDDEN', message, 403);
}

export function notFoundError(resource: string): NextResponse<ApiResponse> {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404);
}

export function serverError(error: unknown): NextResponse<ApiResponse> {
  logger.error({ error }, 'Internal server error');
  return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}

// =============================================================================
// Request Validation
// =============================================================================

export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse<ApiResponse> }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: validationError(error) };
    }
    return { error: errorResponse('INVALID_JSON', 'Invalid JSON body', 400) };
  }
}

export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse<ApiResponse> } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: validationError(error) };
    }
    return { error: errorResponse('INVALID_PARAMS', 'Invalid query parameters', 400) };
  }
}

// =============================================================================
// Auth Middleware
// =============================================================================

export interface AuthContext {
  userId: string;
  email: string;
  hasGitHub: boolean;
}

export async function requireApiAuth(): Promise<AuthContext | NextResponse<ApiResponse>> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return unauthorizedError();
  }
  
  return {
    userId: session.user.id,
    email: session.user.email || '',
    hasGitHub: session.user.hasGitHubConnection || false,
  };
}

// =============================================================================
// Rate Limiting (Redis-based)
// =============================================================================

const rateLimiters = {
  general: new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_GENERAL || '100'),
      '1 m'
    ),
    analytics: true,
    prefix: 'ratelimit:general',
  }),
  bulk: new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_BULK || '10'),
      '1 m'
    ),
    analytics: true,
    prefix: 'ratelimit:bulk',
  }),
  sync: new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_SYNC || '30'),
      '1 m'
    ),
    analytics: true,
    prefix: 'ratelimit:sync',
  }),
  auth: new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_AUTH || '5'),
      '1 m'
    ),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
};

export type RateLimitType = keyof typeof rateLimiters;

export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = rateLimiters[type];
  const result = await limiter.limit(identifier);
  
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function withRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<NextResponse<ApiResponse> | null> {
  const result = await checkRateLimit(type, identifier);
  
  if (!result.success) {
    const response = errorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later',
      429
    );
    
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
    response.headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());
    
    return response;
  }
  
  return null; // No rate limit hit
}

// =============================================================================
// API Route Handler Wrapper
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (request: Request, context?: any) => Promise<NextResponse>;

export function withApiHandler(
  handler: ApiHandler,
  options: {
    rateLimit?: RateLimitType;
    requireAuth?: boolean;
  } = {}
): ApiHandler {
  return async (request: Request, context?: unknown) => {
    try {
      // Auth check
      if (options.requireAuth) {
        const authResult = await requireApiAuth();
        if (authResult instanceof NextResponse) {
          return authResult;
        }
      }
      
      // Rate limiting
      if (options.rateLimit) {
        const session = await auth();
        const identifier = session?.user?.id || 
          request.headers.get('x-forwarded-for')?.split(',')[0] || 
          'anonymous';
        
        const rateLimitResponse = await withRateLimit(options.rateLimit, identifier);
        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      }
      
      return await handler(request, context);
    } catch (error) {
      return serverError(error);
    }
  };
}
