import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getArgoCDClient, getArgoBaseUrl } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const [client, baseUrl] = await Promise.all([
        getArgoCDClient(ctx.tenant.organizationId),
        getArgoBaseUrl(ctx.tenant.organizationId),
      ]);
      const result = await client.get('api/v1/projects').json<{ items?: any[] }>();
      const items = (result.items || []).map((p: any) => ({
        name: p.metadata?.name,
        description: p.spec?.description || '',
        sourceRepos: p.spec?.sourceRepos || [],
        destinations: (p.spec?.destinations || []).map((d: any) => ({
          server: d.server,
          namespace: d.namespace,
          name: d.name,
        })),
        clusterResourceWhitelist: p.spec?.clusterResourceWhitelist || [],
        namespaceResourceBlacklist: p.spec?.namespaceResourceBlacklist || [],
        roles: (p.spec?.roles || []).map((r: any) => ({
          name: r.name,
          description: r.description,
          policies: r.policies?.length || 0,
          groups: r.groups?.length || 0,
        })),
        signatureKeys: (p.spec?.signatureKeys || []).map((k: any) => k.keyID),
        externalUrl: `${baseUrl}/settings/projects/${p.metadata?.name}`,
      }));
      return successResponse(items);
    } catch (error) {
      return errorResponse('ARGOCD_PROJECTS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
