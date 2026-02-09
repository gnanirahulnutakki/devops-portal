// =============================================================================
// ArgoCD Application Detail API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getApplication, getApplicationResources, getArgoBaseUrl } from '@/lib/services/argocd';

/**
 * GET /api/argocd/applications/[name]
 * Get detailed information about a specific ArgoCD application
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const name = pathParts[pathParts.length - 1];

    try {
      // Get application details and resources
      const [app, resources, baseUrl] = await Promise.all([
        getApplication(ctx.tenant.organizationId, name),
        getApplicationResources(ctx.tenant.organizationId, name).catch(() => []),
        getArgoBaseUrl(ctx.tenant.organizationId),
      ]);
      
      return successResponse({
        ...app,
        resources,
        externalUrl: `${baseUrl}/applications/${name}`,
      });
    } catch (error) {
      console.error('Failed to fetch ArgoCD application:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          return errorResponse('NOT_FOUND', 'Application not found', 404);
        }
        if (error.message.includes('not configured')) {
          return errorResponse('NOT_CONFIGURED', error.message, 400);
        }
      }
      
      return errorResponse('ARGOCD_ERROR', 'Failed to fetch application details', 500);
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'USER',
    audit: {
      action: 'argocd.get',
      resource: 'application',
      getResourceId: (request) => {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        return pathParts[pathParts.length - 1];
      },
    },
  }
);
