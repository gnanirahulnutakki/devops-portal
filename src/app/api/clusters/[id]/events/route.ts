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

      // v1 client: options-object signature; body returned directly.
      const events = namespace
        ? await clients.core.listNamespacedEvent({ namespace })
        : await clients.core.listEventForAllNamespaces();

      const items = (events.items || [])
        .map((e: any) => ({
          name: e.metadata?.name || '',
          namespace: e.metadata?.namespace || '',
          type: e.type || '',
          reason: e.reason || '',
          message: e.message || '',
          object: e.involvedObject ? `${e.involvedObject.kind}/${e.involvedObject.name}` : '',
          count: e.count || 1,
          firstSeen: e.firstTimestamp || e.eventTime || e.metadata?.creationTimestamp || '',
          lastSeen: e.lastTimestamp || e.eventTime || e.metadata?.creationTimestamp || '',
        }))
        .sort((a: any, b: any) => String(b.lastSeen).localeCompare(String(a.lastSeen)));

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_EVENTS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
