import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getArgoService } from '@/lib/services/argocd';

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    // Get app name from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const appName = pathParts[pathParts.indexOf('applications') + 1];

    try {
      const argoService = await getArgoService(ctx.tenant.organizationId);
      if (!argoService) {
        return errorResponse(
          'ARGOCD_NOT_CONFIGURED',
          'ArgoCD is not configured for this organization',
          400
        );
      }

      await argoService.refreshApplication(appName);
      return successResponse({ refreshed: true, application: appName });
    } catch (error) {
      return errorResponse(
        'REFRESH_FAILED',
        `Failed to refresh application ${appName}`,
        500,
        { message: (error as Error).message }
      );
    }
  },
  { 
    rateLimit: 'sync', 
    requiredRole: 'READWRITE',
    audit: {
      action: 'argocd.refresh',
      resource: 'application',
      getResourceId: (req) => {
        const pathParts = new URL(req.url).pathname.split('/');
        return pathParts[pathParts.indexOf('applications') + 1];
      },
    },
  }
);
