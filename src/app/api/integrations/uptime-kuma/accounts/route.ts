import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { listCredentials, saveCredentials } from '@/lib/services/integration-credentials';

const createUptimeKumaSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  apiKey: z.string().min(10),
});

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const credentials = await listCredentials(ctx.tenant.organizationId, 'UPTIME_KUMA');
      return successResponse(credentials);
    } catch (error) {
      return errorResponse('UPTIME_KUMA_ACCOUNTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createUptimeKumaSchema);
    if ('error' in validation) return validation.error;

    const { name, url, apiKey } = validation.data;

    const result = await saveCredentials(
      ctx.tenant.organizationId,
      'UPTIME_KUMA',
      { url, apiKey },
      name,
      ctx.tenant.userId
    );

    if (!result.success) {
      return errorResponse('UPTIME_KUMA_ACCOUNT_CREATE_FAILED', result.error || 'Failed to save Uptime Kuma account', 500);
    }

    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
