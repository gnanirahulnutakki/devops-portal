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

      const namespace = url.searchParams.get('namespace') || undefined;
      const { clients } = await getKubeClientsForCluster(ctx, clusterId);

      // @kubernetes/client-node v1 takes an options object and returns the
      // V1PodList body directly (no { body, response } wrapper).
      const pods = namespace
        ? await clients.core.listNamespacedPod({ namespace })
        : await clients.core.listPodForAllNamespaces();

      const items = (pods.items || []).map((pod: any) => {
        const containers = pod.spec?.containers || [];
        const statuses = pod.status?.containerStatuses || [];
        const ready = statuses.filter((s: any) => s.ready).length;
        return {
          name: pod.metadata?.name || '',
          namespace: pod.metadata?.namespace || '',
          status: pod.status?.phase || 'Unknown',
          ready: `${ready}/${containers.length}`,
          restarts: statuses.reduce((sum: number, s: any) => sum + (s.restartCount || 0), 0),
          age: pod.metadata?.creationTimestamp || '',
          containers: containers.map((c: any) => c.name),
        };
      });

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_PODS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
