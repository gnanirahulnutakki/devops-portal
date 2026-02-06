import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  base: {
    service: 'devops-portal',
    version: process.env.npm_package_version || '2.0.0',
  },
  // Add trace context
  mixin() {
    return {
      // OpenTelemetry trace context will be added here by instrumentation
    };
  },
});

// Create child loggers for specific contexts
export function createLogger(context: string) {
  return logger.child({ context });
}

// Audit logging helper
export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  organizationId?: string;
  success: boolean;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function logAudit(event: AuditEvent) {
  logger.info(
    {
      type: 'audit',
      ...event,
    },
    `Audit: ${event.action} on ${event.resource}`
  );
}

// Security event logging
export function logSecurityEvent(
  event: string,
  userId: string | undefined,
  success: boolean,
  details?: Record<string, unknown>
) {
  const level = success ? 'info' : 'warn';
  logger[level](
    {
      type: 'security',
      event,
      userId,
      success,
      ...details,
    },
    `Security: ${event}`
  );
}

export default logger;
