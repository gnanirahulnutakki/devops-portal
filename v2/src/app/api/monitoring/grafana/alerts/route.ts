import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listAlerts, isGrafanaConfigured } from '@/lib/services/grafana';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      if (!isGrafanaConfigured(ctx.tenant.organizationId)) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      try {
        const alerts = await listAlerts(ctx.tenant.organizationId);
        return successResponse(alerts);
      } catch {
        // Grafana Alerting API may return different formats or errors
        // Return empty array - UI handles this case
        return successResponse([]);
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
