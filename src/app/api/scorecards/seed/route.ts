import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
} from '@/lib/api';
import { seedDefaultScorecard } from '@/lib/services/scorecards';

// POST /api/scorecards/seed — Create default scorecard if none exist
export const POST = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const result = await seedDefaultScorecard(
        ctx.tenant.organizationId,
        ctx.db
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        'SCORECARD_SEED_ERROR',
        'Failed to seed default scorecard',
        500,
        { message: (error as Error).message }
      );
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN',
    requiredFeature: 'scorecards',
    audit: {
      action: 'scorecard.seed',
      resource: 'scorecard',
      getResourceId: () => 'default',
    },
  }
);
