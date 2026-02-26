import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { updateClusterSchema } from '@/lib/validations/schemas';
import { encrypt } from '@/lib/encryption';

const getClusterId = (request: Request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  return segments[segments.indexOf('clusters') + 1];
};

function mergeConfig(existing: Record<string, any> | null, data: Record<string, any>): Record<string, any> {
  const authType = data.authType || existing?.authType || 'standard';
  const config: Record<string, any> = { ...existing, authType };

  if (authType === 'duplo') {
    if (data.duploHost !== undefined) config.duploHost = data.duploHost;
    if (data.duploToken) config.duploToken = encrypt(data.duploToken);
    if (data.planId !== undefined) config.planId = data.planId;
    if (data.duploIsAdmin !== undefined) config.isAdmin = data.duploIsAdmin;
  } else if (authType === 'eks') {
    if (data.eksClusterName !== undefined) config.eksClusterName = data.eksClusterName;
    if (data.eksRegion !== undefined) config.eksRegion = data.eksRegion;
    if (data.eksEndpoint !== undefined) config.eksEndpoint = data.eksEndpoint;
    if (data.eksCaData !== undefined) config.eksCaData = data.eksCaData;
    if (data.eksAccessKeyId) config.eksAccessKeyId = encrypt(data.eksAccessKeyId);
    if (data.eksSecretAccessKey) config.eksSecretAccessKey = encrypt(data.eksSecretAccessKey);
    if (data.eksRoleArn !== undefined) config.eksRoleArn = data.eksRoleArn;
  }

  return config;
}

function safeResponse(cluster: any) {
  const config = cluster.config as Record<string, any> | null;
  const authType = config?.authType || 'standard';
  return {
    id: cluster.id,
    name: cluster.name,
    slug: cluster.slug,
    provider: cluster.provider,
    region: cluster.region,
    environment: cluster.environment,
    status: cluster.status,
    authType,
    hasKubeconfig: Boolean(cluster.kubeconfig) || authType !== 'standard',
    ...(authType === 'duplo' && { duploHost: config?.duploHost, planId: config?.planId }),
    ...(authType === 'eks' && { eksClusterName: config?.eksClusterName, eksRegion: config?.eksRegion, eksEndpoint: config?.eksEndpoint }),
  };
}

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const clusterId = getClusterId(request);
    if (!clusterId) {
      return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
    }

    const validation = await validateRequest(request, updateClusterSchema);
    if ('error' in validation) return validation.error;

    const { kubeconfig, authType, duploHost, duploToken, planId, duploIsAdmin,
      eksClusterName, eksRegion, eksEndpoint, eksCaData, eksAccessKeyId, eksSecretAccessKey, eksRoleArn,
      ...clusterData } = validation.data;

    const existing = await ctx.db.cluster.findUnique({
      where: { id_organizationId: { id: clusterId, organizationId: ctx.tenant.organizationId } },
    });
    if (!existing) return errorResponse('NOT_FOUND', 'Cluster not found', 404);

    const config = mergeConfig(existing.config as Record<string, any> | null, validation.data);

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
          region: clusterData.region ?? undefined,
          kubeconfig: kubeconfig ? encrypt(kubeconfig) : undefined,
          config,
        },
      });

      return successResponse(safeResponse(updated));
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
