import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { createClusterSchema } from '@/lib/validations/schemas';
import { encrypt } from '@/lib/encryption';

function buildConfig(data: Record<string, any>) {
  const authType = data.authType || 'standard';
  const config: Record<string, any> = { authType };

  if (authType === 'duplo') {
    if (data.duploHost) config.duploHost = data.duploHost;
    if (data.duploToken) config.duploToken = encrypt(data.duploToken);
    if (data.planId) config.planId = data.planId;
    if (data.duploIsAdmin !== undefined) config.isAdmin = data.duploIsAdmin;
  } else if (authType === 'eks') {
    if (data.eksClusterName) config.eksClusterName = data.eksClusterName;
    if (data.eksRegion) config.eksRegion = data.eksRegion;
    if (data.eksEndpoint) config.eksEndpoint = data.eksEndpoint;
    if (data.eksCaData) config.eksCaData = data.eksCaData;
    if (data.eksAccessKeyId) config.eksAccessKeyId = encrypt(data.eksAccessKeyId);
    if (data.eksSecretAccessKey) config.eksSecretAccessKey = encrypt(data.eksSecretAccessKey);
    if (data.eksRoleArn) config.eksRoleArn = data.eksRoleArn;
  }

  return config;
}

function safeClusterResponse(cluster: any) {
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
    // Safe metadata (no secrets)
    ...(authType === 'duplo' && { duploHost: config?.duploHost, planId: config?.planId }),
    ...(authType === 'eks' && { eksClusterName: config?.eksClusterName, eksRegion: config?.eksRegion, eksEndpoint: config?.eksEndpoint }),
    createdAt: cluster.createdAt,
    updatedAt: cluster.updatedAt,
  };
}

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const clusters = await ctx.db.cluster.findMany({
        where: { organizationId: ctx.tenant.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(clusters.map(safeClusterResponse));
    } catch (error) {
      return errorResponse('CLUSTERS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, createClusterSchema);
    if ('error' in validation) return validation.error;

    // Auth-type-specific fields are consumed by buildConfig() below; excluded
    // from clusterData so they don't get persisted as generic cluster columns.
    const { kubeconfig, authType,
      duploHost: _duploHost, duploToken: _duploToken, planId: _planId, duploIsAdmin: _duploIsAdmin,
      eksClusterName: _eksClusterName, eksRegion: _eksRegion, eksEndpoint: _eksEndpoint, eksCaData: _eksCaData,
      eksAccessKeyId: _eksAccessKeyId, eksSecretAccessKey: _eksSecretAccessKey, eksRoleArn: _eksRoleArn,
      ...clusterData
    } = validation.data;

    const config = buildConfig(validation.data);

    try {
      const created = await ctx.db.cluster.create({
        data: {
          ...clusterData,
          region: clusterData.region || '',
          organizationId: ctx.tenant.organizationId,
          kubeconfig: (authType || 'standard') === 'standard' && kubeconfig ? encrypt(kubeconfig) : null,
          config,
        },
      });

      return successResponse(safeClusterResponse(created));
    } catch (error) {
      return errorResponse('CLUSTER_CREATE_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
