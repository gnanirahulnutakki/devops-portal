import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { deleteCredentialById, updateCredentialById } from '@/lib/services/integration-credentials';

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  enabled: z.boolean().optional(),
  token: z.string().min(10).optional(),
  organization: z.string().optional(),
});

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const validation = await validateRequest(request, updateSchema);
    if ('error' in validation) return validation.error;

    const { name, enabled, token, organization } = validation.data;
    const credentialsPatch =
      token || typeof organization === 'string'
        ? ({ ...(token ? { token } : {}), ...(typeof organization === 'string' ? { organization } : {}) } as any)
        : undefined;

    const result = await updateCredentialById(ctx.tenant.organizationId, 'GITHUB', id, {
      name,
      enabled,
      credentialsPatch,
    });
    if (!result.success) {
      return errorResponse('GITHUB_ACCOUNT_UPDATE_FAILED', result.error || 'Failed to update GitHub account', 500);
    }
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    const id = new URL(request.url).pathname.split('/').pop() || '';
    if (!id) return errorResponse('VALIDATION_ERROR', 'id is required', 400);

    const ok = await deleteCredentialById(ctx.tenant.organizationId, 'GITHUB', id);
    if (!ok) return errorResponse('NOT_FOUND', 'GitHub account not found', 404);
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

