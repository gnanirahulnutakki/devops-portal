import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  notFoundError,
} from '@/lib/api';

// GET /api/scorecards/[id] — Get a single scorecard with rules and results
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const id = segments[segments.length - 1];

      const scorecard = await ctx.db.scorecard.findFirst({
        where: { id, organizationId: ctx.tenant.organizationId },
        include: {
          rules: {
            where: { enabled: true },
            orderBy: { sortOrder: 'asc' },
          },
          results: {
            orderBy: { evaluatedAt: 'desc' },
          },
        },
      });

      if (!scorecard) {
        return notFoundError('Scorecard');
      }

      return successResponse(scorecard);
    } catch (error) {
      return errorResponse(
        'SCORECARD_FETCH_ERROR',
        'Failed to fetch scorecard',
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
