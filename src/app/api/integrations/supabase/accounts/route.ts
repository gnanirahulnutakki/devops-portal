import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { saveCredentials } from '@/lib/services/integration-credentials';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const createSupabaseAccountSchema = z
  .object({
    name: z.string().min(2).max(100),
    url: z.string().url(),
    anonKey: z.string().min(10).optional(),
    serviceRoleKey: z.string().min(10).optional(),
  })
  .refine((data) => data.anonKey || data.serviceRoleKey, {
    message: 'anonKey or serviceRoleKey is required',
    path: ['anonKey'],
  });

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const rows = await prisma.integrationCredential.findMany({
        where: { organizationId: ctx.tenant.organizationId, provider: 'SUPABASE' },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          lastUsedAt: true,
          lastErrorAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
          credentials: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const enriched = await Promise.all(
        rows.map(async (r) => {
          try {
            const raw = JSON.parse(await decrypt(r.credentials)) as any;
            return {
              ...r,
              url: raw?.url,
              hasAnonKey: Boolean(raw?.anonKey),
              hasServiceRoleKey: Boolean(raw?.serviceRoleKey),
              credentials: undefined,
            };
          } catch {
            return { ...r, url: undefined, hasAnonKey: false, hasServiceRoleKey: false, credentials: undefined };
          }
        })
      );

      return successResponse(enriched);
    } catch (error) {
      return errorResponse('SUPABASE_ACCOUNTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createSupabaseAccountSchema);
    if ('error' in validation) return validation.error;

    const { name, url, anonKey, serviceRoleKey } = validation.data;

    const result = await saveCredentials(
      ctx.tenant.organizationId,
      'SUPABASE',
      { url, anonKey, serviceRoleKey },
      name,
      ctx.tenant.userId
    );

    if (!result.success) {
      return errorResponse('SUPABASE_ACCOUNT_CREATE_FAILED', result.error || 'Failed to save Supabase account', 500);
    }

    return successResponse({ success: true });
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN',
  }
);
