import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { isGrafanaConfigured, listDashboardPanels } from '@/lib/services/grafana';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const uid = url.searchParams.get('uid');
      const credentialId = url.searchParams.get('credentialId') || undefined;

      if (!uid) {
        return errorResponse('UID_REQUIRED', 'uid is required', 400);
      }

      const configured = await isGrafanaConfigured(ctx.tenant.organizationId, credentialId);
      if (!configured) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      const panels = await trackIntegrationCall('grafana', 'listPanels', () =>
        listDashboardPanels(ctx.tenant.organizationId, uid, credentialId)
      );

      return successResponse(panels);
    } catch (error) {
      return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);
