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
      const response = await clients.core.listNode() as any;
      const list = response.body || response;

      const items = (list.items || []).map((node: any) => {
        const conditions = node.status?.conditions || [];
        const ready = conditions.find((c: any) => c.type === 'Ready')?.status === 'True';
        return {
          name: node.metadata?.name || 'unknown',
          status: ready ? 'Ready' : 'NotReady',
          version: node.status?.nodeInfo?.kubeletVersion || 'unknown',
          cpu: node.status?.allocatable?.cpu || '-',
          memory: node.status?.allocatable?.memory || '-',
          pods: node.status?.allocatable?.pods || '-',
          age: node.metadata?.creationTimestamp || '',
        };
      });

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_NODES_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
