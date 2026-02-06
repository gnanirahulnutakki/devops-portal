import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listDashboards, isGrafanaConfigured } from '@/lib/services/grafana';

// List Grafana dashboards for the current tenant
export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      // Check if Grafana is configured
      if (!isGrafanaConfigured(ctx.tenant.organizationId)) {
        return successResponse([], { 
          page: 1, 
          pageSize: 0, 
          total: 0 
        });
      }

      const dashboards = await listDashboards(ctx.tenant.organizationId);
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
