import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { saveCredentials, parseExpiresAt } from '@/lib/services/integration-credentials';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const createGitHubAccountSchema = z.object({
  name: z.string().min(2).max(100),
  token: z.string().min(10),
  organization: z.string().optional(),
  expiresAt: z.union([z.string().datetime(), z.string().date(), z.null()]).optional(),
});

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const rows = await prisma.integrationCredential.findMany({
        where: { organizationId: ctx.tenant.organizationId, provider: 'GITHUB' },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          lastUsedAt: true,
          lastErrorAt: true,
          lastError: true,
          expiresAt: true,
          rotatedAt: true,
          healthStatus: true,
          lastHealthCheckAt: true,
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
              organization: raw?.organization,
              hasToken: Boolean(raw?.token),
              credentials: undefined,
            };
          } catch {
            return { ...r, organization: undefined, hasToken: false, credentials: undefined };
          }
        })
      );

      return successResponse(enriched);
    } catch (error) {
      return errorResponse('GITHUB_ACCOUNTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createGitHubAccountSchema);
    if ('error' in validation) return validation.error;

    const { name, token, organization, expiresAt } = validation.data;
    const result = await saveCredentials(
      ctx.tenant.organizationId,
      'GITHUB',
      { token, organization },
      name,
      ctx.tenant.userId,
      parseExpiresAt(expiresAt)
    );

    if (!result.success) {
      return errorResponse('GITHUB_ACCOUNT_CREATE_FAILED', result.error || 'Failed to save GitHub account', 500);
    }

    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
