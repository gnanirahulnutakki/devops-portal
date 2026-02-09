import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { updateClusterSchema } from '@/lib/validations/schemas';
import { encrypt } from '@/lib/encryption';

const getClusterId = (request: Request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  return segments[segments.indexOf('clusters') + 1];
};

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const clusterId = getClusterId(request);
    if (!clusterId) {
      return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
    }

    const validation = await validateRequest(request, updateClusterSchema);
    if ('error' in validation) return validation.error;

    const { kubeconfig, ...clusterData } = validation.data;

    try {
      const updated = await ctx.db.cluster.update({
        where: {
          id_organizationId: {
            id: clusterId,
            organizationId: ctx.tenant.organizationId,
          },
        },
        data: {
          ...clusterData,
          region: clusterData.region || '',
          kubeconfig: kubeconfig ? encrypt(kubeconfig) : undefined,
        },
      });

      return successResponse({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        provider: updated.provider,
        region: updated.region,
        environment: updated.environment,
        status: updated.status,
        hasKubeconfig: Boolean(updated.kubeconfig),
      });
    } catch (error) {
      return errorResponse('CLUSTER_UPDATE_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);

export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    const clusterId = getClusterId(request);
    if (!clusterId) {
      return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
    }

    try {
      await ctx.db.cluster.delete({
        where: {
          id_organizationId: {
            id: clusterId,
            organizationId: ctx.tenant.organizationId,
          },
        },
      });
      return successResponse({ success: true });
    } catch (error) {
      return errorResponse('CLUSTER_DELETE_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
