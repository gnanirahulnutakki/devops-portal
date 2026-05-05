import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getClusterOrThrow } from '@/app/api/clusters/utils';
import { loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
import * as k8s from '@kubernetes/client-node';

/**
 * GET /api/clusters/[id]/pods/[name]/metrics?namespace=X
 *
 * Returns a point-in-time CPU + memory snapshot from metrics.k8s.io
 * (metrics-server). If metrics-server isn't installed, returns 404
 * with a clear error so the UI can render an "install metrics-server"
 * hint instead of a generic failure.
 *
 * Response:
 * {
 *   data: {
 *     timestamp: ISO8601,
 *     containers: [
 *       { name, cpuMilli, memoryBytes }
 *     ]
 *   }
 * }
 */

function parseCpu(raw: string): number {
  // Returns millicores. Inputs: "12345678n" (nanocores), "100m" (millicores), "1" (cores).
  if (!raw) return 0;
  if (raw.endsWith('n')) return Math.round(parseFloat(raw) / 1_000_000);
  if (raw.endsWith('u')) return Math.round(parseFloat(raw) / 1_000);
  if (raw.endsWith('m')) return Math.round(parseFloat(raw));
  return Math.round(parseFloat(raw) * 1000);
}

function parseMemory(raw: string): number {
  // Returns bytes. Common k8s units: Ki, Mi, Gi, plain bytes.
  if (!raw) return 0;
  const m = raw.match(/^([\d.]+)([A-Za-z]+)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  switch (unit) {
    case 'ki': return n * 1024;
    case 'mi': return n * 1024 * 1024;
    case 'gi': return n * 1024 * 1024 * 1024;
    case 'ti': return n * 1024 * 1024 * 1024 * 1024;
    case 'k': return n * 1000;
    case 'm': return n * 1000 * 1000;
    case 'g': return n * 1000 * 1000 * 1000;
    default: return n;
  }
}

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

      const cluster = await getClusterOrThrow(ctx, clusterId);
      const kubeConfig = await loadKubeConfigFromClusterAsync({
        id: cluster.id,
        name: cluster.name,
        kubeconfig: cluster.kubeconfig,
        config: cluster.config,
      });

      const customApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);

      try {
        // v1 client: options-object signature; body returned directly.
        const obj: any = await customApi.getNamespacedCustomObject({
          group: 'metrics.k8s.io',
          version: 'v1beta1',
          namespace,
          plural: 'pods',
          name: podName,
        });
        const containers = (obj?.containers || []).map((c: any) => ({
          name: c.name,
          cpuMilli: parseCpu(c.usage?.cpu || ''),
          memoryBytes: parseMemory(c.usage?.memory || ''),
        }));

        return successResponse({
          timestamp: obj?.timestamp || new Date().toISOString(),
          containers,
        });
      } catch (err: any) {
        // v1 client surfaces HTTP status in different places; check all of
        // them, plus the embedded message ('404 page not found' / 'NotFound').
        const status =
          err?.code ||
          err?.statusCode ||
          err?.response?.statusCode ||
          err?.body?.code;
        const message: string = err?.message ?? '';
        if (status === 404 || /HTTP-Code:\s*404|404 page not found|"reason":"NotFound"/.test(message)) {
          return errorResponse(
            'METRICS_SERVER_UNAVAILABLE',
            'metrics-server is not installed in this cluster, or this pod has no metrics yet.',
            404,
          );
        }
        throw err;
      }
    } catch (error) {
      return errorResponse('CLUSTER_POD_METRICS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
