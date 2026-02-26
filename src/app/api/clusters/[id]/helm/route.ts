import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getClusterOrThrow } from '@/app/api/clusters/utils';
import { createKubeClients, loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const segments = new URL(request.url).pathname.split('/').filter(Boolean);
    const clusterId = segments[segments.indexOf('clusters') + 1];

    if (!clusterId) {
      return errorResponse('VALIDATION_ERROR', 'Cluster ID is required', 400);
    }

    let cluster;
    try {
      cluster = await getClusterOrThrow(ctx, clusterId);
    } catch {
      return errorResponse('NOT_FOUND', 'Cluster not found', 404);
    }

    try {
      const kc = await loadKubeConfigFromClusterAsync(cluster);
      const clients = createKubeClients(kc);
      const response = await (clients.core as any).listSecretForAllNamespaces(
        undefined,
        undefined,
        undefined,
        'owner=helm'
      );
      const list = (response as any).body || response;
      const releases = (list.items || []).map((item: any) => {
        const labels = item.metadata?.labels || {};
        return {
          name: labels.name || item.metadata?.name,
          namespace: item.metadata?.namespace,
          revision: labels.version ? Number(labels.version) : undefined,
          status: labels.status || 'unknown',
          chart: labels.chart || undefined,
          updatedAt: item.metadata?.creationTimestamp,
        };
      });

      return successResponse(releases);
    } catch (error) {
      return errorResponse('HELM_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
