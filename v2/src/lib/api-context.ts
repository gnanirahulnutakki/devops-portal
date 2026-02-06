// =============================================================================
// API Context - Request-scoped tenant context for API routes
// =============================================================================

import { headers } from 'next/headers';
import { prisma } from './prisma';
import {
  TenantContext,
  createTenantContext,
  withTenantContextAsync,
} from './tenant-context';
import { createTenantPrismaClient, TenantPrismaClient } from './prisma-tenant';
import { logger } from './logger';

/**
 * API context available in route handlers
 */
export interface ApiContext {
  tenant: TenantContext;
  db: TenantPrismaClient;
  requestId: string;
}

/**
 * Get organization ID from request headers (lightweight, no DB lookup)
 * Use for routes that just need the org ID without full context
 */
export async function getOrganizationIdFromHeaders(): Promise<string> {
  const headersList = await headers();
  const organizationId = headersList.get('x-organization-id');
  
  if (!organizationId) {
    throw new Error('x-organization-id header is required');
  }
  
  return organizationId;
}

/**
 * Get organization context from request headers
 * Headers are set by middleware after validation
 */
export async function getApiContext(): Promise<ApiContext> {
  const headersList = await headers();
  
  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const requestId = headersList.get('x-request-id') ?? crypto.randomUUID();
  
  if (!organizationId) {
    throw new Error('x-organization-id header is required');
  }
  
  if (!userId) {
    throw new Error('x-user-id header is required');
  }
  
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
    logger.warn(
      { userId, organizationId },
      'User does not have membership in organization'
    );
    throw new Error('User does not have access to this organization');
  }
  
  const tenant = createTenantContext({
    organizationId,
    organizationSlug: membership.organization.slug,
    userId,
    userRole: membership.role,
    requestId,
  });
  
  // Create tenant-scoped Prisma client
  const db = createTenantPrismaClient(prisma);
  
  return {
    tenant,
    db,
    requestId,
  };
}

/**
 * Execute an API handler with tenant context
 * This is the primary wrapper for tenant-aware API routes
 */
export async function withApiContext<T>(
  handler: (ctx: ApiContext) => Promise<T>
): Promise<T> {
  const ctx = await getApiContext();
  
  return withTenantContextAsync(ctx.tenant, () => handler(ctx));
}

/**
 * Require specific role for an API operation
 */
export function requireRole(
  ctx: ApiContext,
  requiredRole: 'USER' | 'READWRITE' | 'ADMIN'
): void {
  const roleHierarchy = { USER: 1, READWRITE: 2, ADMIN: 3 };
  
  if (roleHierarchy[ctx.tenant.userRole] < roleHierarchy[requiredRole]) {
    throw new Error(
      `This operation requires ${requiredRole} role. Current role: ${ctx.tenant.userRole}`
    );
  }
}

/**
 * Log an audit event within API context
 */
export async function logAuditEvent(
  ctx: ApiContext,
  action: string,
  resource: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      action,
      resource,
      resourceId,
      details: details ?? {},
      success: true,
      userId: ctx.tenant.userId,
      organizationId: ctx.tenant.organizationId,
      ipAddress: null,
      userAgent: null,
    },
  });
}
