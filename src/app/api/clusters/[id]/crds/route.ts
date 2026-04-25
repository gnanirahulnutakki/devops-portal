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
      const response = await clients.apiExt.listCustomResourceDefinition() as any;
      const list = response.body || response;

      const items = (list.items || []).map((crd: any) => ({
        name: crd.metadata?.name || '',
        scope: crd.spec?.scope || '',
        version: crd.spec?.versions?.[0]?.name || '',
        kind: crd.spec?.names?.kind || '',
      }));

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_CRDS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
