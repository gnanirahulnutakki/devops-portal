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

      const [deploymentsResponse, statefulResponse, daemonResponse, jobsResponse, cronResponse] = await Promise.all([
        clients.apps.listDeploymentForAllNamespaces(),
        clients.apps.listStatefulSetForAllNamespaces(),
        clients.apps.listDaemonSetForAllNamespaces(),
        clients.batch.listJobForAllNamespaces(),
        clients.batch.listCronJobForAllNamespaces?.() ?? Promise.resolve({ items: [] }),
      ]);

      const deployments = (deploymentsResponse as any).body || deploymentsResponse;
      const statefulSets = (statefulResponse as any).body || statefulResponse;
      const daemonSets = (daemonResponse as any).body || daemonResponse;
      const jobs = (jobsResponse as any).body || jobsResponse;
      const cronJobs = (cronResponse as any).body || cronResponse;

      const items = [
        ...(deployments.items || []).map((item: any) => ({
          name: item.metadata?.name || '',
          kind: 'Deployment',
          status: item.status?.readyReplicas ? 'Healthy' : 'Warning',
          namespace: item.metadata?.namespace || '',
        })),
        ...(statefulSets.items || []).map((item: any) => ({
          name: item.metadata?.name || '',
          kind: 'StatefulSet',
          status: item.status?.readyReplicas ? 'Healthy' : 'Warning',
          namespace: item.metadata?.namespace || '',
        })),
        ...(daemonSets.items || []).map((item: any) => ({
          name: item.metadata?.name || '',
          kind: 'DaemonSet',
          status: item.status?.numberReady ? 'Healthy' : 'Warning',
          namespace: item.metadata?.namespace || '',
        })),
        ...(jobs.items || []).map((item: any) => ({
          name: item.metadata?.name || '',
          kind: 'Job',
          status: item.status?.succeeded ? 'Healthy' : item.status?.failed ? 'Failed' : 'Running',
          namespace: item.metadata?.namespace || '',
        })),
        ...(cronJobs.items || []).map((item: any) => ({
          name: item.metadata?.name || '',
          kind: 'CronJob',
          status: 'Scheduled',
          namespace: item.metadata?.namespace || '',
        })),
      ];

      return successResponse(items);
    } catch (error) {
      return errorResponse('CLUSTER_WORKLOADS_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
