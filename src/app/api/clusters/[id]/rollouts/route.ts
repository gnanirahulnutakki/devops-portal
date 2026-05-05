import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getClusterOrThrow } from '@/app/api/clusters/utils';
import { loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
import * as k8s from '@kubernetes/client-node';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const clusterId = segments[segments.indexOf('clusters') + 1];
      if (!clusterId) return errorResponse('VALIDATION_ERROR', 'cluster id required', 400);
      const namespace = url.searchParams.get('namespace') || undefined;

      const cluster = await getClusterOrThrow(ctx, clusterId);
      const kubeConfig = await loadKubeConfigFromClusterAsync({
        id: cluster.id,
        name: cluster.name,
        kubeconfig: cluster.kubeconfig,
        config: cluster.config,
      });
      const api = kubeConfig.makeApiClient(k8s.CustomObjectsApi);

      try {
        // v1 client: options-object signature; body returned directly.
        const obj: any = namespace
          ? await api.listNamespacedCustomObject({
              group: 'argoproj.io',
              version: 'v1alpha1',
              namespace,
              plural: 'rollouts',
            })
          : await api.listClusterCustomObject({
              group: 'argoproj.io',
              version: 'v1alpha1',
              plural: 'rollouts',
            });

        const items = (obj?.items || []).map((r: any) => {
          const spec = r.spec || {};
          const status = r.status || {};
          const strategy = spec.strategy?.canary ? 'Canary' : (spec.strategy?.blueGreen ? 'BlueGreen' : 'Unknown');
          
          return {
            name: r.metadata.name,
            namespace: r.metadata.namespace,
            strategy,
            status: status.phase || 'Unknown',
            currentStep: status.currentStepIndex || 0,
            totalSteps: spec.strategy?.canary?.steps?.length || 0,
            canary: strategy === 'Canary' ? {
              weight: status.canary?.weight,
              currentPodHash: status.currentPodHash
            } : undefined,
            blueGreen: strategy === 'BlueGreen' ? {
              active: status.blueGreen?.activeSelector,
              preview: status.blueGreen?.previewSelector
            } : undefined,
            replicas: {
              desired: spec.replicas || 0,
              available: status.availableReplicas || 0,
              current: status.replicas || 0,
              updated: status.updatedReplicas || 0
            },
            age: r.metadata.creationTimestamp,
            message: status.message || ''
          };
        });
        return successResponse(items);
      } catch (err: any) {
        // v1 client surfaces HTTP status in different places depending on the
        // failure mode; check all of them, plus the embedded message.
        const status =
          err?.code ||
          err?.statusCode ||
          err?.response?.statusCode ||
          err?.body?.code;
        const message: string = err?.message ?? '';
        if (status === 404 || /HTTP-Code:\s*404|404 page not found/.test(message)) {
          return errorResponse(
            'ROLLOUTS_CRD_NOT_INSTALLED',
            'argo-rollouts CRDs not installed in this cluster',
            404
          );
        }
        throw err;
      }
    } catch (error) {
      return errorResponse('CLUSTER_ROLLOUTS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
