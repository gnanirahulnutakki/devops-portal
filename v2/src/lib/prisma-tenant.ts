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
// Note: enforcement is done in the main switch; helpers not needed

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
          
          // Skip tenant scoping for non-tenant models
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

          const typedArgs = args as Record<string, unknown>;

          // Enforce tenant scoping based on operation (hard-fail on mismatch)
          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow': {
              throw new Error('[SECURITY] findUnique disallowed in tenant context. Use findFirst with organizationId');
            }

            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              const where = (typedArgs.where as Record<string, unknown>) || {};
              if (where.organizationId && where.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.${operation}`);
              }
              modifiedArgs = {
                ...typedArgs,
                where: { ...where, organizationId },
              } as typeof args;
              break;
            }

            case 'create': {
              const data = (typedArgs.data as Record<string, unknown>) || {};
              if (data.organizationId && data.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.create`);
              }
              modifiedArgs = {
                ...typedArgs,
                data: { ...data, organizationId },
              } as typeof args;
              break;
            }

            case 'createMany': {
              const dataArray = (typedArgs.data as Record<string, unknown>[]) || [];
              dataArray.forEach((record) => {
                const org = (record as any).organizationId;
                if (org && org !== organizationId) {
                  throw new Error(`[SECURITY] organizationId mismatch in createMany for ${model}`);
                }
              });
              modifiedArgs = {
                ...typedArgs,
                data: dataArray.map((record) => ({
                  ...record,
                  organizationId,
                })),
              } as typeof args;
              break;
            }

            case 'update':
            case 'updateMany':
            case 'delete':
            case 'deleteMany': {
              const where = (typedArgs.where as Record<string, unknown>) || {};
              if (where.organizationId && where.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.${operation}`);
              }
              modifiedArgs = {
                ...typedArgs,
                where: { ...where, organizationId },
              } as typeof args;
              break;
            }

            case 'upsert': {
              const upsertArgs = typedArgs as { where?: any; create?: any; update?: any };
              if (upsertArgs.where?.organizationId && upsertArgs.where.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.upsert where`);
              }
              if (upsertArgs.create?.organizationId && upsertArgs.create.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.upsert create`);
              }
              modifiedArgs = {
                ...typedArgs,
                where: { ...(upsertArgs.where || {}), organizationId },
                create: { ...(upsertArgs.create || {}), organizationId },
                update: upsertArgs.update,
              } as typeof args;
              break;
            }

            default: {
              if (!context.organizationId) {
                throw new Error(`[SECURITY] organizationId required for ${model}.${operation}`);
              }
            }
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
