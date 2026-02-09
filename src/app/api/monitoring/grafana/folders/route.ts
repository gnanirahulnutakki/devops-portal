import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listFolders, isGrafanaConfigured } from '@/lib/services/grafana';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const credentialId = url.searchParams.get('credentialId') || undefined;

      const configured = await isGrafanaConfigured(ctx.tenant.organizationId, credentialId);
      if (!configured) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      const folders = await trackIntegrationCall('grafana', 'listFolders', () =>
        listFolders(ctx.tenant.organizationId, credentialId)
      );
      return successResponse(folders);
    } catch (error) {
      return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);
