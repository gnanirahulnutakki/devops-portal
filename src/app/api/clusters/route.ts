import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { createClusterSchema } from '@/lib/validations/schemas';
import { encrypt } from '@/lib/encryption';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const clusters = await ctx.db.cluster.findMany({
        where: { organizationId: ctx.tenant.organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          provider: true,
          region: true,
          environment: true,
          status: true,
          kubeconfig: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return successResponse(
        clusters.map((cluster) => ({
          ...cluster,
          kubeconfig: undefined,
          hasKubeconfig: Boolean(cluster.kubeconfig),
          jitUrl: (cluster.config as any)?.jitUrl || undefined,
        }))
      );
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

    const { kubeconfig, jitUrl, ...clusterData } = validation.data;

    try {
      const created = await ctx.db.cluster.create({
        data: {
          ...clusterData,
          region: clusterData.region || '',
          organizationId: ctx.tenant.organizationId,
          kubeconfig: kubeconfig ? encrypt(kubeconfig) : null,
          config: jitUrl ? { jitUrl } : undefined,
        },
      });

      return successResponse({
        id: created.id,
        name: created.name,
        slug: created.slug,
        provider: created.provider,
        region: created.region,
        environment: created.environment,
        status: created.status,
        hasKubeconfig: Boolean(created.kubeconfig),
        jitUrl: (created.config as any)?.jitUrl || undefined,
      });
    } catch (error) {
      return errorResponse('CLUSTER_CREATE_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
