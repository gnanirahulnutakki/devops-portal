import { ApiContext } from '@/lib/api';
import { createKubeClients, loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';

export async function getClusterOrThrow(ctx: ApiContext, id: string) {
  const cluster = await ctx.db.cluster.findUnique({
    where: {
      id_organizationId: {
        id,
        organizationId: ctx.tenant.organizationId,
      },
    },
  });

  if (!cluster) {
    throw new Error('Cluster not found');
  }

  return cluster;
}

export async function getKubeClientsForCluster(ctx: ApiContext, id: string) {
  const cluster = await getClusterOrThrow(ctx, id);
  const kc = await loadKubeConfigFromClusterAsync({
    id: cluster.id,
    name: cluster.name,
    kubeconfig: cluster.kubeconfig,
    config: cluster.config,
  });
  return {
    cluster,
    clients: createKubeClients(kc),
  };
}
