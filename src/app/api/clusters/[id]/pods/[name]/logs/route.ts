import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getKubeClientsForCluster } from '@/app/api/clusters/utils';

/**
 * GET /api/clusters/[id]/pods/[name]/logs?namespace=X&container=Y&tailLines=N
 *
 * Returns the recent N lines of logs as a single string in `data.logs`.
 * For live streaming, use the SSE endpoint at logs/stream.
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const clusterId = segments[segments.indexOf('clusters') + 1];
      const podName = segments[segments.indexOf('pods') + 1];
      if (!clusterId || !podName) {
        return errorResponse('VALIDATION_ERROR', 'cluster id and pod name are required', 400);
      }

      const namespace = url.searchParams.get('namespace');
      if (!namespace) {
        return errorResponse('VALIDATION_ERROR', 'namespace query param is required', 400);
      }
      const container = url.searchParams.get('container') || undefined;
      const tailLines = parseInt(url.searchParams.get('tailLines') || '500', 10);

      const { clients } = await getKubeClientsForCluster(ctx, clusterId);

      const response = await (clients.core as any).readNamespacedPodLog(
        podName,
        namespace,
        container,           // container
        false,               // follow
        undefined,           // limitBytes
        undefined,           // pretty
        false,               // previous
        undefined,           // sinceSeconds
        tailLines,           // tailLines
        true,                // timestamps
      );
      const logs = typeof response === 'string' ? response : (response?.body || String(response));

      return successResponse({ logs, tailLines });
    } catch (error) {
      return errorResponse('CLUSTER_POD_LOGS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
