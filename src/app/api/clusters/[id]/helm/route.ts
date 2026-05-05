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
      // Helm v3 stores releases as Secrets with type `helm.sh/release.v1` and
      // label `owner=helm`. v1 client takes an options object; the 4th
      // positional arg in v0.x was fieldSelector — when called positionally
      // against v1, the arg was silently dropped and ALL secrets returned.
      const list = await clients.core.listSecretForAllNamespaces({
        labelSelector: 'owner=helm',
      });
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
