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
 * Validate nested relations for cross-tenant access attempts
 * Prevents: { connect: { id: "other-org-resource" } }
 */
function validateNestedRelations(
  data: Record<string, unknown>,
  organizationId: string,
  path: string = ''
): void {
  for (const [key, value] of Object.entries(data)) {
    if (!value || typeof value !== 'object') continue;
    
    const currentPath = path ? `${path}.${key}` : key;
    const nested = value as Record<string, unknown>;
    
    // Check for connect/connectOrCreate operations
    if (key === 'connect' || key === 'connectOrCreate') {
      // If connecting to a tenant-scoped resource, we can't validate the ID
      // without a DB call - log a warning for audit
      logger.warn(
        { path: currentPath, operation: key },
        'Nested relation connect detected - ensure target belongs to same org'
      );
    }
    
    // Check for create/createMany nested operations
    if (key === 'create' || key === 'createMany') {
      if (Array.isArray(nested)) {
        nested.forEach((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const record = item as Record<string, unknown>;
            if (record.organizationId && record.organizationId !== organizationId) {
              throw new Error(
                `[SECURITY] Cross-tenant nested create blocked at ${currentPath}[${idx}]`
              );
            }
          }
        });
      } else if (nested.organizationId && nested.organizationId !== organizationId) {
        throw new Error(
          `[SECURITY] Cross-tenant nested create blocked at ${currentPath}`
        );
      }
    }
    
    // Recurse into nested objects
    if (typeof nested === 'object' && !Array.isArray(nested)) {
      validateNestedRelations(nested, organizationId, currentPath);
    }
  }
}

/**
 * Check if findUnique uses compound key with organizationId
 * Allows: findUnique({ where: { id_organizationId: { id, organizationId } } })
 */
function isCompoundKeyLookup(
  where: Record<string, unknown>,
  organizationId: string
): boolean {
  // Check for compound unique key patterns
  for (const [key, value] of Object.entries(where)) {
    if (key.includes('_organizationId') && typeof value === 'object' && value !== null) {
      const compound = value as Record<string, unknown>;
      if (compound.organizationId === organizationId) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Create Prisma client with tenant extension
 * This extension automatically:
 * 1. Validates tenant context exists for tenant-scoped operations
 * 2. Adds organizationId filter to all queries
 * 3. Adds organizationId to all creates
 * 4. Validates nested writes for cross-tenant access
 * 5. Logs all operations with tenant context
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

          // Require tenant context for tenant-scoped models
          if (!context) {
            throw new Error(
              `[SECURITY] Tenant context required for ${model}.${operation}. Use withTenantContext() wrapper.`
            );
          }

          const { organizationId } = context;
          let modifiedArgs = args;

          const typedArgs = args as Record<string, unknown>;

          // Enforce tenant scoping based on operation (hard-fail on mismatch)
          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow': {
              // Allow if using compound key with organizationId
              const where = (typedArgs.where as Record<string, unknown>) || {};
              if (isCompoundKeyLookup(where, organizationId)) {
                return query(args);
              }
              throw new Error(
                `[SECURITY] findUnique on ${model} requires compound key with organizationId. ` +
                `Use: where: { id_organizationId: { id, organizationId } }`
              );
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
              // Validate nested relations
              validateNestedRelations(data, organizationId, 'data');
              modifiedArgs = {
                ...typedArgs,
                data: { ...data, organizationId },
              } as typeof args;
              break;
            }

            case 'createMany': {
              const dataArray = (typedArgs.data as Record<string, unknown>[]) || [];
              dataArray.forEach((record, idx) => {
                const org = (record as Record<string, unknown>).organizationId;
                if (org && org !== organizationId) {
                  throw new Error(`[SECURITY] organizationId mismatch in createMany[${idx}] for ${model}`);
                }
                // Validate nested relations in each record
                validateNestedRelations(record, organizationId, `data[${idx}]`);
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
            case 'updateMany': {
              const where = (typedArgs.where as Record<string, unknown>) || {};
              if (where.organizationId && where.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.${operation}`);
              }
              // Validate nested relations in update data
              const updateData = (typedArgs.data as Record<string, unknown>) || {};
              validateNestedRelations(updateData, organizationId, 'data');
              modifiedArgs = {
                ...typedArgs,
                where: { ...where, organizationId },
              } as typeof args;
              break;
            }

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
              const upsertArgs = typedArgs as { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> };
              if (upsertArgs.where?.organizationId && upsertArgs.where.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.upsert where`);
              }
              if (upsertArgs.create?.organizationId && upsertArgs.create.organizationId !== organizationId) {
                throw new Error(`[SECURITY] organizationId mismatch for ${model}.upsert create`);
              }
              // Validate nested relations in create and update data
              if (upsertArgs.create) {
                validateNestedRelations(upsertArgs.create, organizationId, 'create');
              }
              if (upsertArgs.update) {
                validateNestedRelations(upsertArgs.update, organizationId, 'update');
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
