import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listDashboards, isGrafanaConfigured } from '@/lib/services/grafana';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';

// List Grafana dashboards for the current tenant
export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      // Check if Grafana is configured (async - checks org creds + env fallback)
      const configured = await isGrafanaConfigured(ctx.tenant.organizationId);
      if (!configured) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      const dashboards = await trackIntegrationCall('grafana', 'listDashboards', () =>
        listDashboards(ctx.tenant.organizationId)
      );
      return successResponse(dashboards);
    } catch (error) {
      return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);
