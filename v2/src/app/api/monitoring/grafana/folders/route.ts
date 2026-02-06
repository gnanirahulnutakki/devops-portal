import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listFolders, isGrafanaConfigured } from '@/lib/services/grafana';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      if (!isGrafanaConfigured(ctx.tenant.organizationId)) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      const folders = await listFolders(ctx.tenant.organizationId);
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
