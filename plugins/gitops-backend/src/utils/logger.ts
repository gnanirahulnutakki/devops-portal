/**
 * Structured Logger for GitOps Backend
 * 
 * Features:
 * - JSON format for production (easy parsing by log aggregators)
 * - Pretty print for development
 * - Request context tracking
 * - Performance timing
 * 
 * Note: Using simple console.log to avoid ESM/CJS interop issues with winston
 */

// Simple logger implementation to avoid winston CJS issues
const LOG_LEVEL_PRIORITY: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = process.env.LOG_LEVEL || 'info';
const currentPriority = LOG_LEVEL_PRIORITY[currentLevel] ?? 2;

function formatLog(level: string, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({ timestamp, level, message, service: 'gitops-backend', ...meta });
  }
  return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
}

function shouldLog(level: string): boolean {
  const levelPriority = LOG_LEVEL_PRIORITY[level] ?? 2;
  return levelPriority <= currentPriority;
}

const logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('error')) console.error(formatLog('error', message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, meta));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('info')) console.log(formatLog('info', message, meta));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('debug')) console.log(formatLog('debug', message, meta));
  },
  log: (level: string, message: string, meta?: Record<string, unknown>) => {
    if (shouldLog(level)) console.log(formatLog(level, message, meta));
  },
  child: (defaultMeta: Record<string, unknown>) => ({
    error: (msg: string, m?: Record<string, unknown>) => logger.error(msg, { ...defaultMeta, ...m }),
    warn: (msg: string, m?: Record<string, unknown>) => logger.warn(msg, { ...defaultMeta, ...m }),
    info: (msg: string, m?: Record<string, unknown>) => logger.info(msg, { ...defaultMeta, ...m }),
    debug: (msg: string, m?: Record<string, unknown>) => logger.debug(msg, { ...defaultMeta, ...m }),
    log: (level: string, msg: string, m?: Record<string, unknown>) => logger.log(level, msg, { ...defaultMeta, ...m }),
  }),
};

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
