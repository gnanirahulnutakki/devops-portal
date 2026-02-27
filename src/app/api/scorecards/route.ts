import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
} from '@/lib/api';

// GET /api/scorecards — List scorecards with their rules
export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const scorecards = await ctx.db.scorecard.findMany({
        where: { organizationId: ctx.tenant.organizationId },
        include: {
          rules: {
            where: { enabled: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { results: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(scorecards);
    } catch (error) {
      return errorResponse(
        'SCORECARDS_FETCH_ERROR',
        'Failed to fetch scorecards',
        500,
        { message: (error as Error).message }
      );
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
    requiredFeature: 'scorecards',
  }
);
