import { withTenantApiHandler, successResponse, serverError, validateQuery } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(7),
});

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const validation = validateQuery(url.searchParams, querySchema);
      if ('error' in validation) return validation.error;
      const { days } = validation.data;

      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + days);

      const expiring = await prisma.integrationCredential.findMany({
        where: {
          organizationId: ctx.tenant.organizationId,
          enabled: true,
          expiresAt: {
            not: null,
            lte: expiryThreshold,
          },
        },
        select: {
          id: true,
          provider: true,
          name: true,
          healthStatus: true,
          expiresAt: true,
          lastHealthCheckAt: true,
          // NEVER select `credentials`
        },
        orderBy: { expiresAt: 'asc' },
      });

      return successResponse({
        days,
        count: expiring.length,
        credentials: expiring,
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
