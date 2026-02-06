// =============================================================================
// Application Metrics - Custom Prometheus Metrics
// =============================================================================

import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

// Create a custom registry
export const metricsRegistry = new Registry();

// Add default Node.js metrics
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'devops_portal_',
});

// =============================================================================
// HTTP Request Metrics
// =============================================================================

export const httpRequestsTotal = new Counter({
  name: 'devops_portal_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status', 'organization_id'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'devops_portal_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// =============================================================================
// Authentication Metrics
// =============================================================================

export const authAttemptsTotal = new Counter({
  name: 'devops_portal_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['provider', 'result'] as const,
  registers: [metricsRegistry],
});

export const activeSessionsGauge = new Gauge({
  name: 'devops_portal_active_sessions',
  help: 'Number of active user sessions',
  registers: [metricsRegistry],
});

// =============================================================================
// Tenant Metrics
// =============================================================================

export const tenantOperationsTotal = new Counter({
  name: 'devops_portal_tenant_operations_total',
  help: 'Total tenant-scoped operations',
  labelNames: ['organization_id', 'operation', 'model'] as const,
  registers: [metricsRegistry],
});

export const tenantViolationsTotal = new Counter({
  name: 'devops_portal_tenant_violations_total',
  help: 'Total tenant isolation violations blocked',
  labelNames: ['organization_id', 'violation_type'] as const,
  registers: [metricsRegistry],
});

// =============================================================================
// Queue Metrics
// =============================================================================

export const queueJobsTotal = new Counter({
  name: 'devops_portal_queue_jobs_total',
  help: 'Total jobs processed by queue',
  labelNames: ['queue', 'job_type', 'status'] as const,
  registers: [metricsRegistry],
});

export const queueJobDuration = new Histogram({
  name: 'devops_portal_queue_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue', 'job_type'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

export const queueDepthGauge = new Gauge({
  name: 'devops_portal_queue_depth',
  help: 'Current number of jobs in queue',
  labelNames: ['queue', 'state'] as const,
  registers: [metricsRegistry],
});

export const queueWorkerActiveGauge = new Gauge({
  name: 'devops_portal_queue_workers_active',
  help: 'Number of active queue workers',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

// =============================================================================
// Integration Metrics (ArgoCD, Grafana, S3)
// =============================================================================

export const integrationRequestsTotal = new Counter({
  name: 'devops_portal_integration_requests_total',
  help: 'Total requests to external integrations',
  labelNames: ['integration', 'operation', 'status'] as const,
  registers: [metricsRegistry],
});

export const integrationRequestDuration = new Histogram({
  name: 'devops_portal_integration_request_duration_seconds',
  help: 'Integration request duration in seconds',
  labelNames: ['integration', 'operation'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const integrationErrorsTotal = new Counter({
  name: 'devops_portal_integration_errors_total',
  help: 'Total errors from external integrations',
  labelNames: ['integration', 'error_type'] as const,
  registers: [metricsRegistry],
});

// =============================================================================
// Rate Limiting Metrics
// =============================================================================

export const rateLimitHitsTotal = new Counter({
  name: 'devops_portal_rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['limiter_type', 'organization_id'] as const,
  registers: [metricsRegistry],
});

// =============================================================================
// Business Metrics
// =============================================================================

export const deploymentsTotal = new Counter({
  name: 'devops_portal_deployments_total',
  help: 'Total deployments triggered',
  labelNames: ['organization_id', 'cluster', 'status'] as const,
  registers: [metricsRegistry],
});

export const syncOperationsTotal = new Counter({
  name: 'devops_portal_sync_operations_total',
  help: 'Total ArgoCD sync operations',
  labelNames: ['organization_id', 'project', 'status'] as const,
  registers: [metricsRegistry],
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Record an HTTP request metric
 */
export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  organizationId?: string
) {
  // Normalize path to prevent high cardinality
  const normalizedPath = normalizePath(path);
  
  httpRequestsTotal.inc({
    method,
    path: normalizedPath,
    status: status.toString(),
    organization_id: organizationId || 'none',
  });
  
  httpRequestDuration.observe(
    { method, path: normalizedPath, status: status.toString() },
    durationMs / 1000
  );
}

/**
 * Record an integration request metric
 */
export function recordIntegrationRequest(
  integration: 'argocd' | 'grafana' | 's3' | 'github' | 'prometheus',
  operation: string,
  status: 'success' | 'error',
  durationMs: number
) {
  integrationRequestsTotal.inc({ integration, operation, status });
  integrationRequestDuration.observe({ integration, operation }, durationMs / 1000);
  
  if (status === 'error') {
    integrationErrorsTotal.inc({ integration, error_type: operation });
  }
}

/**
 * Record a queue job metric
 */
export function recordQueueJob(
  queue: string,
  jobType: string,
  status: 'completed' | 'failed' | 'stalled',
  durationMs?: number
) {
  queueJobsTotal.inc({ queue, job_type: jobType, status });
  
  if (durationMs !== undefined) {
    queueJobDuration.observe({ queue, job_type: jobType }, durationMs / 1000);
  }
}

/**
 * Update queue depth gauge
 */
export function updateQueueDepth(
  queue: string,
  waiting: number,
  active: number,
  delayed: number,
  failed: number
) {
  queueDepthGauge.set({ queue, state: 'waiting' }, waiting);
  queueDepthGauge.set({ queue, state: 'active' }, active);
  queueDepthGauge.set({ queue, state: 'delayed' }, delayed);
  queueDepthGauge.set({ queue, state: 'failed' }, failed);
}

/**
 * Record a tenant operation
 */
export function recordTenantOperation(
  organizationId: string,
  operation: string,
  model: string
) {
  tenantOperationsTotal.inc({ organization_id: organizationId, operation, model });
}

/**
 * Record a tenant violation (blocked attempt)
 */
export function recordTenantViolation(
  organizationId: string,
  violationType: 'cross_tenant_access' | 'invalid_org_id' | 'missing_context'
) {
  tenantViolationsTotal.inc({ organization_id: organizationId, violation_type: violationType });
}

/**
 * Record a rate limit hit
 */
export function recordRateLimitHit(
  limiterType: string,
  organizationId?: string
) {
  rateLimitHitsTotal.inc({
    limiter_type: limiterType,
    organization_id: organizationId || 'anonymous',
  });
}

/**
 * Normalize API path to prevent high cardinality
 * e.g., /api/argocd/applications/my-app -> /api/argocd/applications/:name
 */
function normalizePath(path: string): string {
  return path
    // Normalize UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Normalize CUIDs
    .replace(/c[a-z0-9]{24,}/gi, ':id')
    // Normalize ArgoCD app names (after /applications/)
    .replace(/\/applications\/[^/]+/, '/applications/:name')
    // Normalize numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

/**
 * Get all metrics as Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get metrics content type header
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
