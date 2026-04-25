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
      const response = await clients.networking.listIngressForAllNamespaces() as any;
      const list = response.body || response;

      const items = (list.items || []).map((ing: any) => ({
        name: ing.metadata?.name || '',
        namespace: ing.metadata?.namespace || '',
        className: ing.spec?.ingressClassName || '-',
        hosts: (ing.spec?.rules || [])
          .map((rule: any) => rule.host)
          .filter(Boolean)
          .join(', '),
      }));

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_INGRESSES_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
