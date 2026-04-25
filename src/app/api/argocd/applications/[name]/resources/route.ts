import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getApplicationResources } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    // Get app name from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const appName = pathParts[pathParts.indexOf('applications') + 1];

    try {
      const resources = await getApplicationResources(ctx.tenant.organizationId, appName);
      return successResponse(resources);
    } catch (error) {
      return errorResponse(
        'RESOURCES_FAILED',
        `Failed to get resources for application ${appName}`,
        500,
        { message: (error as Error).message }
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'USER',
  }
);
