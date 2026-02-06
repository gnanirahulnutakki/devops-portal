import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listApplications } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const project = url.searchParams.get('project') || undefined;

    try {
      const applications = await listApplications(ctx.tenant.organizationId, project);
      return successResponse(applications);
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
