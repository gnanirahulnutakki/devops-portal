import { withTenantApiHandler, successResponse, serverError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const credentials = await prisma.integrationCredential.findMany({
        where: {
          organizationId: ctx.tenant.organizationId,
          enabled: true,
        },
        select: {
          id: true,
          provider: true,
          name: true,
          enabled: true,
          healthStatus: true,
          lastHealthCheckAt: true,
          expiresAt: true,
          lastUsedAt: true,
          lastErrorAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
          // NEVER select `credentials` — that's the encrypted blob
        },
        orderBy: { updatedAt: 'desc' },
      });

      return successResponse({
        total: credentials.length,
        healthy: credentials.filter((c) => c.healthStatus === 'healthy').length,
        degraded: credentials.filter((c) => c.healthStatus === 'degraded').length,
        unhealthy: credentials.filter((c) => c.healthStatus === 'unhealthy').length,
        unknown: credentials.filter((c) => !c.healthStatus || c.healthStatus === 'unknown').length,
        credentials,
      });
    } catch (error) {
      return serverError(error);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
    requiredFeature: 'monitoring',
  }
);
