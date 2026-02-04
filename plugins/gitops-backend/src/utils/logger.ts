import winston from 'winston';

/**
 * Structured Logger for GitOps Backend
 * 
 * Features:
 * - JSON format for production (easy parsing by log aggregators)
 * - Pretty print for development
 * - Request context tracking
 * - Performance timing
 */

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}] ${message} ${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'gitops-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: string, userEmail?: string) {
  return logger.child({
    requestId,
    userId,
    userEmail,
  });
}

/**
 * Log API request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
  meta?: Record<string, any>
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, `${method} ${path} ${statusCode} ${durationMs}ms`, {
    type: 'http_request',
    method,
    path,
    statusCode,
    durationMs,
    userId,
    ...meta,
  });
}

/**
 * Log GitHub API call
 */
export function logGitHubCall(
  operation: string,
  repo: string,
  durationMs: number,
  success: boolean,
  meta?: Record<string, any>
) {
  logger.info(`GitHub: ${operation} on ${repo}`, {
    type: 'github_api',
    operation,
    repo,
    durationMs,
    success,
    ...meta,
  });
}

/**
 * Log ArgoCD API call
 */
export function logArgoCDCall(
  operation: string,
  app: string,
  durationMs: number,
  success: boolean,
  meta?: Record<string, any>
) {
  logger.info(`ArgoCD: ${operation} on ${app}`, {
    type: 'argocd_api',
    operation,
    app,
    durationMs,
    success,
    ...meta,
  });
}

/**
 * Log bulk operation progress
 */
export function logBulkOperation(
  operationId: string,
  status: string,
  progress: number,
  meta?: Record<string, any>
) {
  logger.info(`Bulk operation ${operationId}: ${status} (${progress}%)`, {
    type: 'bulk_operation',
    operationId,
    status,
    progress,
    ...meta,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  userId: string,
  success: boolean,
  meta?: Record<string, any>
) {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Security: ${event}`, {
    type: 'security',
    event,
    userId,
    success,
    ...meta,
  });
}

export { logger };
export default logger;
