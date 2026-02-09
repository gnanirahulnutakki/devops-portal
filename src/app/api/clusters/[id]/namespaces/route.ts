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
      const [namespaceResponse, podResponse] = await Promise.all([
        clients.core.listNamespace(),
        clients.core.listPodForAllNamespaces(),
      ]);
      const namespaces = (namespaceResponse as any).body || namespaceResponse;
      const pods = (podResponse as any).body || podResponse;

      const podsByNamespace: Record<string, number> = {};
      (pods.items || []).forEach((pod: any) => {
        const ns = pod.metadata?.namespace || 'default';
        podsByNamespace[ns] = (podsByNamespace[ns] || 0) + 1;
      });

      const items = (namespaces.items || []).map((ns: any) => ({
        name: ns.metadata?.name || 'unknown',
        status: ns.status?.phase || 'Unknown',
        pods: podsByNamespace[ns.metadata?.name || ''] || 0,
      }));

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_NAMESPACES_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
