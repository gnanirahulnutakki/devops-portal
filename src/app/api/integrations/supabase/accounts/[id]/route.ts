import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { deleteCredentialById, updateCredentialById, parseExpiresAt } from '@/lib/services/integration-credentials';

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  enabled: z.boolean().optional(),
  url: z.string().url().optional(),
  anonKey: z.string().min(10).optional(),
  serviceRoleKey: z.string().min(10).optional(),
  expiresAt: z.union([z.string().datetime(), z.string().date(), z.null()]).optional(),
});

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const validation = await validateRequest(request, updateSchema);
    if ('error' in validation) return validation.error;

    const { name, enabled, url, anonKey, serviceRoleKey, expiresAt } = validation.data;
    const credentialsPatch =
      url || anonKey || serviceRoleKey
        ? ({ ...(url ? { url } : {}), ...(anonKey ? { anonKey } : {}), ...(serviceRoleKey ? { serviceRoleKey } : {}) } as any)
        : undefined;

    const result = await updateCredentialById(ctx.tenant.organizationId, 'SUPABASE', id, {
      name,
      enabled,
      expiresAt: parseExpiresAt(expiresAt),
      credentialsPatch,
    });
    if (!result.success) {
      return errorResponse('SUPABASE_ACCOUNT_UPDATE_FAILED', result.error || 'Failed to update Supabase account', 500);
    }
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const ok = await deleteCredentialById(ctx.tenant.organizationId, 'SUPABASE', id);
    if (!ok) return errorResponse('NOT_FOUND', 'Supabase account not found', 404);
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

