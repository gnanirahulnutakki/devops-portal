import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getArgoBaseUrl, listApplications } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const project = url.searchParams.get('project') || undefined;

    try {
      const [applications, baseUrl] = await Promise.all([
        listApplications(ctx.tenant.organizationId, project),
        getArgoBaseUrl(ctx.tenant.organizationId),
      ]);
      const enriched = applications.map((app) => ({
        ...app,
        externalUrl: `${baseUrl}/applications/${app.name}`,
      }));
      return successResponse(enriched);
    } catch (error) {
      return errorResponse(
        'ARGOCD_ERROR',
        'Failed to fetch ArgoCD applications',
        500,
        { message: (error as Error).message }
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'USER',
    audit: {
      action: 'argocd.list',
      resource: 'applications',
      getResourceId: () => 'list',
    },
  }
);
