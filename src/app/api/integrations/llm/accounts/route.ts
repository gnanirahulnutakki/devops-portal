import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { saveCredentials } from '@/lib/services/integration-credentials';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

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
      const rows = await prisma.integrationCredential.findMany({
        where: { organizationId: ctx.tenant.organizationId, provider: 'LLM' },
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
              llmProvider: raw?.provider,
              baseUrl: raw?.baseUrl,
              model: raw?.model,
              hasApiKey: Boolean(raw?.apiKey),
              credentials: undefined,
            };
          } catch {
            return { ...r, llmProvider: undefined, baseUrl: undefined, model: undefined, hasApiKey: false, credentials: undefined };
          }
        })
      );

      return successResponse(enriched);
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
