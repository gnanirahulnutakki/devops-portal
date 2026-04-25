import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
} from '@/lib/api';
import { getCachedResults } from '@/lib/services/scorecards';

// GET /api/scorecards/results — Get cached evaluation results
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const scorecardId = url.searchParams.get('scorecardId') || undefined;

      const { results, stale, evaluatedAt } = await getCachedResults(
        ctx.tenant.organizationId,
        ctx.db,
        scorecardId
      );

      return successResponse({ results, stale, evaluatedAt });
    } catch (error) {
      return errorResponse(
        'SCORECARD_RESULTS_ERROR',
        'Failed to fetch scorecard results',
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
