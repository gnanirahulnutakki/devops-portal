// =============================================================================
// Worker Context - Tenant-aware Background Job Processing
// =============================================================================

import { Job } from 'bullmq';
import { prisma } from './prisma';
import {
  TenantContext,
  createTenantContext,
  withTenantContextAsync,
} from './tenant-context';
import { createTenantPrismaClient, TenantPrismaClient } from './prisma-tenant';
import { logger } from './logger';

/**
 * Worker job payload must include tenant context
 */
export interface TenantJobPayload {
  organizationId: string;
  userId: string;
  action: string;
  [key: string]: unknown;
}

/**
 * Worker context for background jobs
 */
export interface WorkerContext {
  tenant: TenantContext;
  db: TenantPrismaClient;
  job: Job;
}

/**
 * Validate job payload has required tenant fields
 */
export function validateJobPayload(
  data: unknown
): asserts data is TenantJobPayload {
  if (!data || typeof data !== 'object') {
    throw new Error('Job payload must be an object');
  }
  
  const payload = data as Record<string, unknown>;
  
  if (!payload.organizationId || typeof payload.organizationId !== 'string') {
    throw new Error('Job payload must include organizationId');
  }
  
  if (!payload.userId || typeof payload.userId !== 'string') {
    throw new Error('Job payload must include userId');
  }
  
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Job payload must include action');
  }
}

/**
 * Create worker context from job
 */
export async function createWorkerContext(
  job: Job<TenantJobPayload>
): Promise<WorkerContext> {
  const { organizationId, userId } = job.data;
  
  // Fetch organization and membership details
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
    },
    include: {
      organization: true,
    },
  });
  
  if (!membership) {
    throw new Error(
      `User ${userId} does not have membership in organization ${organizationId}`
    );
  }
  
  const tenant = createTenantContext({
    organizationId,
    organizationSlug: membership.organization.slug,
    userId,
    userRole: membership.role,
    requestId: `job-${job.id}`,
  });
  
  const db = createTenantPrismaClient(prisma);
  
  return {
    tenant,
    db,
    job,
  };
}

/**
 * Execute a worker job with tenant context
 * This is the primary wrapper for tenant-aware background jobs
 */
export async function withWorkerContext<T>(
  job: Job<TenantJobPayload>,
  handler: (ctx: WorkerContext) => Promise<T>
): Promise<T> {
  // Validate payload
  validateJobPayload(job.data);
  
  // Create context
  const ctx = await createWorkerContext(job);
  
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      organizationId: ctx.tenant.organizationId,
      userId: ctx.tenant.userId,
      action: job.data.action,
    },
    'Starting job with tenant context'
  );
  
  try {
    // Execute handler with tenant context
    const result = await withTenantContextAsync(ctx.tenant, () => handler(ctx));
    
    logger.info(
      {
        jobId: job.id,
        jobName: job.name,
        organizationId: ctx.tenant.organizationId,
      },
      'Job completed successfully'
    );
    
    return result;
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        jobName: job.name,
        organizationId: ctx.tenant.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Job failed'
    );
    throw error;
  }
}

/**
 * Log audit event from worker context
 */
export async function logWorkerAudit(
  ctx: WorkerContext,
  resource: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      action: ctx.job.data.action,
      resource,
      resourceId,
      details: {
        jobId: ctx.job.id,
        jobName: ctx.job.name,
        ...details,
      },
      success: true,
      userId: ctx.tenant.userId,
      organizationId: ctx.tenant.organizationId,
      ipAddress: null,
      userAgent: 'worker',
    },
  });
}

/**
 * Update bulk operation progress from worker
 */
export async function updateBulkOperationProgress(
  ctx: WorkerContext,
  bulkOperationId: string,
  completedItems: number,
  failedItems: number,
  errors?: Record<string, unknown>
): Promise<void> {
  await ctx.db.bulkOperation.update({
    where: { id: bulkOperationId },
    data: {
      completedItems,
      failedItems,
      ...(errors && { errors }),
      updatedAt: new Date(),
    },
  });
}

/**
 * Complete a bulk operation
 */
export async function completeBulkOperation(
  ctx: WorkerContext,
  bulkOperationId: string,
  status: 'COMPLETED' | 'FAILED',
  output?: Record<string, unknown>,
  errors?: Record<string, unknown>
): Promise<void> {
  await ctx.db.bulkOperation.update({
    where: { id: bulkOperationId },
    data: {
      status,
      output: output ?? {},
      errors: errors ?? {},
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  
  // Log audit
  await logWorkerAudit(ctx, 'BulkOperation', bulkOperationId, {
    status,
    hasErrors: !!errors,
  });
}
