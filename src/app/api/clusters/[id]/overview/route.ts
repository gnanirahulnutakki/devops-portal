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

      const [versionResponse, nodesResponse, namespacesResponse, podsResponse] = await Promise.all([
        clients.version.getCode(),
        clients.core.listNode(),
        clients.core.listNamespace(),
        clients.core.listPodForAllNamespaces(),
      ]);
      const version = (versionResponse as any).body || versionResponse;
      const nodes = (nodesResponse as any).body || nodesResponse;
      const namespaces = (namespacesResponse as any).body || namespacesResponse;
      const pods = (podsResponse as any).body || podsResponse;

      return successResponse({
        version: version.gitVersion || 'unknown',
        nodes: (nodes.items || []).length,
        namespaces: (namespaces.items || []).length,
        pods: (pods.items || []).length,
      });
    } catch (error) {
      return errorResponse('CLUSTER_OVERVIEW_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
