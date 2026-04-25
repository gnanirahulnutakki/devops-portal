import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { deleteCredentialById, updateCredentialById, parseExpiresAt } from '@/lib/services/integration-credentials';

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  enabled: z.boolean().optional(),
  url: z.string().url().optional(),
  token: z.string().min(10).optional(),
  insecure: z.boolean().optional(),
  // null clears the expiry, undefined leaves it unchanged.
  expiresAt: z.union([z.string().datetime(), z.string().date(), z.null()]).optional(),
});

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const validation = await validateRequest(request, updateSchema);
    if ('error' in validation) return validation.error;

    const { name, enabled, url, token, insecure, expiresAt } = validation.data;
    const credentialsPatch =
      url || token || typeof insecure === 'boolean'
        ? ({ ...(url ? { url } : {}), ...(token ? { token } : {}), ...(typeof insecure === 'boolean' ? { insecure } : {}) } as any)
        : undefined;

    const result = await updateCredentialById(ctx.tenant.organizationId, 'ARGOCD', id, {
      name,
      enabled,
      expiresAt: parseExpiresAt(expiresAt),
      credentialsPatch,
    });
    if (!result.success) {
      return errorResponse('ARGOCD_ACCOUNT_UPDATE_FAILED', result.error || 'Failed to update ArgoCD account', 500);
    }
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const ok = await deleteCredentialById(ctx.tenant.organizationId, 'ARGOCD', id);
    if (!ok) return errorResponse('NOT_FOUND', 'ArgoCD account not found', 404);
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

