import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { listCredentials, saveCredentials } from '@/lib/services/integration-credentials';

const createLlmAccountSchema = z.object({
  name: z.string().min(2).max(100),
  provider: z.string().min(2).max(50),
  apiKey: z.string().min(10),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const credentials = await listCredentials(ctx.tenant.organizationId, 'LLM');
      return successResponse(credentials);
    } catch (error) {
      return errorResponse('LLM_ACCOUNTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createLlmAccountSchema);
    if ('error' in validation) return validation.error;

    const { name, provider, apiKey, baseUrl, model } = validation.data;

    const result = await saveCredentials(
      ctx.tenant.organizationId,
      'LLM',
      { provider, apiKey, baseUrl, model },
      name,
      ctx.tenant.userId
    );

    if (!result.success) {
      return errorResponse('LLM_ACCOUNT_CREATE_FAILED', result.error || 'Failed to save LLM account', 500);
    }

    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
