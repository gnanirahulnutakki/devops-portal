import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
} from '@/lib/api';
import { evaluateScorecard } from '@/lib/services/scorecards';

// POST /api/scorecards/evaluate — Trigger fresh evaluation
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const body = await request.json().catch(() => ({}));
      const scorecardId = body.scorecardId as string | undefined;

      if (!scorecardId) {
        // Find the first scorecard for this org
        const scorecard = await ctx.db.scorecard.findFirst({
          where: { organizationId: ctx.tenant.organizationId, enabled: true },
        });
        if (!scorecard) {
          return errorResponse(
            'NO_SCORECARD',
            'No scorecard found. Seed a default scorecard first.',
            404
          );
        }
        const results = await evaluateScorecard(
          scorecard.id,
          ctx.tenant.organizationId,
          ctx.tenant.userId,
          ctx.db
        );
        return successResponse({
          scorecardId: scorecard.id,
          results,
          evaluatedAt: new Date().toISOString(),
        });
      }

      const results = await evaluateScorecard(
        scorecardId,
        ctx.tenant.organizationId,
        ctx.tenant.userId,
        ctx.db
      );

      return successResponse({
        scorecardId,
        results,
        evaluatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return errorResponse(
        'SCORECARD_EVALUATE_ERROR',
        'Failed to evaluate scorecard',
        500,
        { message: (error as Error).message }
      );
    }
  },
  {
    rateLimit: 'sync',
    requiredRole: 'READWRITE',
    requiredFeature: 'scorecards',
    audit: {
      action: 'scorecard.evaluate',
      resource: 'scorecard',
      getResourceId: () => 'evaluate',
    },
  }
);
