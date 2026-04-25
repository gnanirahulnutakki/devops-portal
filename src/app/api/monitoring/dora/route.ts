import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { computeDoraMetrics } from '@/lib/services/dora-metrics';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';

/**
 * GET /api/monitoring/dora?days=30
 *
 * Returns DORA metrics computed from ArgoCD deployment history.
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 365);

    const metrics = await trackIntegrationCall(
      'argocd',
      'computeDoraMetrics',
      () => computeDoraMetrics(ctx.tenant.organizationId, ctx.db, { days }),
    );

    return successResponse(metrics);
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
    requiredFeature: 'monitoring',
    audit: {
      action: 'monitoring.dora',
      resource: 'metrics',
      getResourceId: () => 'dora',
    },
  },
);
