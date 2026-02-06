// =============================================================================
// Tenant Context - AsyncLocalStorage for Multi-Tenancy
// =============================================================================

import { AsyncLocalStorage } from 'async_hooks';
import { logger } from './logger';

/**
 * Tenant context stored in AsyncLocalStorage
 * This is available throughout the entire request lifecycle
 */
export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  userRole: 'USER' | 'READWRITE' | 'ADMIN';
  requestId: string;
  timestamp: number;
}

// Global AsyncLocalStorage instance for tenant context
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Get current tenant context from AsyncLocalStorage
 * @throws Error if called outside of tenant context
 */
export function getTenantContext(): TenantContext {
  const context = tenantStorage.getStore();
  if (!context) {
    throw new Error(
      'Tenant context not available. Ensure this code runs within withTenantContext().'
    );
  }
  return context;
}

/**
 * Get current tenant context or null if not available
 * Use this for optional tenant context scenarios
 */
export function getTenantContextOrNull(): TenantContext | null {
  return tenantStorage.getStore() ?? null;
}

/**
 * Get organization ID from current context
 * @throws Error if called outside of tenant context
 */
export function getOrganizationId(): string {
  return getTenantContext().organizationId;
}

/**
 * Get user ID from current context
 * @throws Error if called outside of tenant context
 */
export function getUserId(): string {
  return getTenantContext().userId;
}

/**
 * Check if current user has specific role or higher
 */
export function hasRole(requiredRole: 'USER' | 'READWRITE' | 'ADMIN'): boolean {
  const context = getTenantContext();
  const roleHierarchy = { USER: 1, READWRITE: 2, ADMIN: 3 };
  return roleHierarchy[context.userRole] >= roleHierarchy[requiredRole];
}

/**
 * Run a function within tenant context
 * This is the primary way to establish tenant context for any operation
 */
export function withTenantContext<T>(
  context: TenantContext,
  fn: () => T
): T {
  return tenantStorage.run(context, fn);
}

/**
 * Run an async function within tenant context
 */
export async function withTenantContextAsync<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(context, fn);
}

/**
 * Create tenant context from session and organization
 */
export function createTenantContext(params: {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  userRole: 'USER' | 'READWRITE' | 'ADMIN';
  requestId?: string;
}): TenantContext {
  return {
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    userId: params.userId,
    userRole: params.userRole,
    requestId: params.requestId ?? crypto.randomUUID(),
    timestamp: Date.now(),
  };
}

/**
 * Log with tenant context automatically included
 */
export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, unknown>
) {
  const context = getTenantContextOrNull();
  const logData = {
    ...data,
    ...(context && {
      organizationId: context.organizationId,
      userId: context.userId,
      requestId: context.requestId,
    }),
  };
  logger[level](logData, message);
}
