import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getKubeClientsForCluster } from '@/app/api/clusters/utils';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const clusterId = segments[segments.indexOf('clusters') + 1];
      if (!clusterId) {
        return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
      }

      const { clients } = await getKubeClientsForCluster(ctx, clusterId);
      const response = await clients.core.listServiceForAllNamespaces() as any;
      const services = response.body || response;

      const items = (services.items || []).map((svc: any) => ({
        name: svc.metadata?.name || '',
        namespace: svc.metadata?.namespace || '',
        type: svc.spec?.type || 'ClusterIP',
        clusterIP: svc.spec?.clusterIP || '-',
        ports: (svc.spec?.ports || []).map((p: any) => `${p.port}/${p.protocol}`).join(', '),
      }));

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_SERVICES_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
