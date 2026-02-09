import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { z } from 'zod';
import { listCredentials, saveCredentials } from '@/lib/services/integration-credentials';

const createArgocdAccountSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  token: z.string().min(10),
  insecure: z.boolean().optional(),
});

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const credentials = await listCredentials(ctx.tenant.organizationId, 'ARGOCD');
      return successResponse(credentials);
    } catch (error) {
      return errorResponse('ARGOCD_ACCOUNTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createArgocdAccountSchema);
    if ('error' in validation) return validation.error;

    const { name, url, token, insecure } = validation.data;

    const result = await saveCredentials(
      ctx.tenant.organizationId,
      'ARGOCD',
      { url, token, insecure: insecure ?? false },
      name,
      ctx.tenant.userId
    );

    if (!result.success) {
      return errorResponse('ARGOCD_ACCOUNT_CREATE_FAILED', result.error || 'Failed to save ArgoCD account', 500);
    }

    return successResponse({ success: true });
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN',
  }
);
