// =============================================================================
// Prisma Tenant Extension - Multi-Tenancy with RLS
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { getTenantContext, getTenantContextOrNull } from './tenant-context';
import { logger } from './logger';

// Models that require tenant scoping
const TENANT_SCOPED_MODELS = [
  'Cluster',
  'Deployment',
  'BulkOperation',
  'AuditLog',
  'AlertRule',
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * Check if a model requires tenant scoping
 */
function isTenantScopedModel(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model as TenantScopedModel);
}

/**
 * Deep validator to ensure tenant context is properly applied
 * Prevents accidental cross-tenant data access
 */
function validateTenantInArgs(
  model: string,
  operation: string,
  _args: Record<string, unknown>
): void {
  if (!isTenantScopedModel(model)) return;

  const context = getTenantContextOrNull();
  if (!context) {
    throw new Error(
      `Tenant context required for ${model}.${operation}. Use withTenantContext() wrapper.`
    );
  }

  // HARD FAIL on findUnique - use findFirst with organizationId filter instead
  if (operation === 'findUnique') {
    throw new Error(
      `findUnique is not allowed on tenant-scoped model "${model}". ` +
      `Use findFirst with organizationId filter, or add compound unique constraint.`
    );
  }
}

/**
 * Add organizationId filter to where clause
 */
function addTenantFilter<T extends { where?: unknown }>(
  args: T,
  organizationId: string
): T {
  const where = (args.where ?? {}) as Record<string, unknown>;
  return {
    ...args,
    where: {
      ...where,
      organizationId,
    },
  } as T;
}

/**
 * Add organizationId to create data
 */
function addTenantToData<T extends { data?: unknown }>(
  args: T,
  organizationId: string
): T {
  const data = (args.data ?? {}) as Record<string, unknown>;
  return {
    ...args,
    data: {
      ...data,
      organizationId,
    },
  } as T;
}

/**
 * Create Prisma client with tenant extension
 * This extension automatically:
 * 1. Validates tenant context exists for tenant-scoped operations
 * 2. Adds organizationId filter to all queries
 * 3. Adds organizationId to all creates
 * 4. Logs all operations with tenant context
 */
export function createTenantPrismaClient(basePrisma: PrismaClient) {
  return basePrisma.$extends({
    name: 'tenant-extension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const startTime = Date.now();
          const context = getTenantContextOrNull();
          
          // Skip tenant scoping for non-tenant models or when no context
          if (!isTenantScopedModel(model)) {
            return query(args);
          }

          // Validate tenant context for tenant-scoped models
          validateTenantInArgs(model, operation, args as Record<string, unknown>);
          
          if (!context) {
            throw new Error(
              `Tenant context required for ${model}.${operation}`
            );
          }

          const { organizationId } = context;
          let modifiedArgs = args;

          // Add tenant filtering/scoping based on operation
          // Using type assertions to handle Prisma's complex types
          const typedArgs = args as Record<string, unknown>;
          
          // Only add organizationId for tenant-scoped models
          // Skip models that don't have organizationId field (like UserPreference)
          if (['findFirst', 'findMany', 'findUnique', 'findUniqueOrThrow', 
               'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
               'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
            // Add organizationId to where clause
            const existingWhere = typedArgs.where as Record<string, unknown> || {};
            modifiedArgs = {
              ...typedArgs,
              where: {
                ...existingWhere,
                organizationId,
              },
            } as typeof args;
          } else if (operation === 'create') {
            // Add organizationId to data
            const existingData = typedArgs.data as Record<string, unknown> || {};
            modifiedArgs = {
              ...typedArgs,
              data: {
                ...existingData,
                organizationId,
              },
            } as typeof args;
          } else if (operation === 'createMany') {
            // Add organizationId to each record
            const dataArray = typedArgs.data as Record<string, unknown>[];
            modifiedArgs = {
              ...typedArgs,
              data: dataArray.map((record) => ({
                ...record,
                organizationId,
              })),
            } as typeof args;
          } else if (operation === 'upsert') {
            const existingWhere = typedArgs.where as Record<string, unknown> || {};
            const existingCreate = typedArgs.create as Record<string, unknown> || {};
            modifiedArgs = {
              ...typedArgs,
              where: {
                ...existingWhere,
                organizationId,
              },
              create: {
                ...existingCreate,
                organizationId,
              },
            } as typeof args;
          }

          try {
            const result = await query(modifiedArgs);
            
            // Log successful operations (debug level)
            logger.debug(
              {
                model,
                operation,
                organizationId,
                userId: context.userId,
                requestId: context.requestId,
                durationMs: Date.now() - startTime,
              },
              `Prisma ${model}.${operation} completed`
            );
            
            return result;
          } catch (error) {
            // Log errors
            logger.error(
              {
                model,
                operation,
                organizationId,
                userId: context.userId,
                requestId: context.requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              `Prisma ${model}.${operation} failed`
            );
            throw error;
          }
        },
      },
    },
  });
}

/**
 * Type for the extended Prisma client
 */
export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;

// =============================================================================
// RLS Helper Functions (for raw queries)
// =============================================================================

/**
 * Set RLS context for raw queries
 * Call this at the start of a transaction when using raw SQL
 */
export async function setRLSContext(
  prisma: PrismaClient,
  organizationId: string
): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
}

/**
 * Execute a raw query with RLS context
 */
export async function withRLSContext<T>(
  prisma: PrismaClient,
  fn: () => Promise<T>
): Promise<T> {
  const context = getTenantContext();
  
  return prisma.$transaction(async (tx) => {
    // Set RLS context variable
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${context.organizationId}, true)`;
    
    // Execute the function
    // Note: The function should use 'tx' for queries
    return fn();
  });
}
