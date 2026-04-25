import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getArgoCDClient, getArgoBaseUrl } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const [client, baseUrl] = await Promise.all([
        getArgoCDClient(ctx.tenant.organizationId),
        getArgoBaseUrl(ctx.tenant.organizationId),
      ]);
      const result = await client.get('api/v1/applicationsets').json<{ items?: any[] }>();
      const items = (result.items || []).map((s: any) => ({
        name: s.metadata?.name,
        namespace: s.metadata?.namespace,
        generators: s.spec?.generators?.map((g: any) => Object.keys(g)[0]).filter(Boolean) || [],
        templateProject: s.spec?.template?.spec?.project,
        templateRepoURL: s.spec?.template?.spec?.source?.repoURL,
        appCount: (s.status?.conditions || []).filter((c: any) => c.type === 'ResourcesUpToDate').length,
        resourceVersion: s.metadata?.resourceVersion,
        externalUrl: `${baseUrl}/applicationsets/${s.metadata?.namespace || 'argocd'}/${s.metadata?.name}`,
      }));
      return successResponse(items);
    } catch (error) {
      return errorResponse('ARGOCD_APPLICATIONSETS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
