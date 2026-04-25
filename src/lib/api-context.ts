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
 * Headers are set and VALIDATED by middleware (membership checked via JWT)
 * 
 * SECURITY: Middleware has already validated:
 * - User is authenticated
 * - User has membership in the requested organization
 * - Role is set in x-user-role header
 */
export async function getApiContext(): Promise<ApiContext> {
  const headersList = await headers();
  
  const organizationId = headersList.get('x-organization-id');
  const userId = headersList.get('x-user-id');
  const userRole = headersList.get('x-user-role');
  const requestId = headersList.get('x-request-id') ?? crypto.randomUUID();
  
  if (!organizationId) {
    throw new Error('x-organization-id header is required');
  }
  
  if (!userId) {
    throw new Error('x-user-id header is required');
  }
  
  if (!userRole) {
    // Fallback: if middleware didn't set role, do DB lookup
    // This shouldn't happen in normal flow but provides defense-in-depth
    logger.warn({ userId, organizationId }, 'x-user-role header missing, falling back to DB lookup');
    
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId },
      include: { organization: true },
    });
    
    if (!membership) {
      throw new Error('User does not have access to this organization');
    }
    
    const tenant = createTenantContext({
      organizationId,
      organizationSlug: membership.organization.slug,
      userId,
      userRole: membership.role,
      requestId,
    });
    
    const db = createTenantPrismaClient(prisma);
    return { tenant, db, requestId };
  }
  
  // Fast path: Use pre-validated role from middleware
  // Only fetch org slug (minimal DB call, could be cached)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  
  if (!org) {
    throw new Error('Organization not found');
  }
  
  const tenant = createTenantContext({
    organizationId,
    organizationSlug: org.slug,
    userId,
    userRole: userRole as 'USER' | 'READWRITE' | 'ADMIN',
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
