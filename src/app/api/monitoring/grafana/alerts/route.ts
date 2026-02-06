import { NextResponse } from 'next/server';
import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listAlerts, isGrafanaConfigured } from '@/lib/services/grafana';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';
import { logger } from '@/lib/logger';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const configured = await isGrafanaConfigured(ctx.tenant.organizationId);
      if (!configured) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      try {
        const alerts = await trackIntegrationCall('grafana', 'listAlerts', () =>
          listAlerts(ctx.tenant.organizationId)
        );
        return successResponse(alerts);
      } catch (alertError) {
        // Grafana Unified Alerting API may not be enabled or may use legacy alerting.
        // Return empty array with a warning so the UI can surface the issue.
        logger.warn(
          { error: (alertError as Error).message, orgId: ctx.tenant.organizationId },
          'Grafana alerts fetch failed - Unified Alerting may not be enabled'
        );
        return NextResponse.json({
          data: [],
          warning: 'Grafana Unified Alerting may not be enabled. Legacy alerting is not supported.',
        });
      }
    } catch (error) {
      return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);
