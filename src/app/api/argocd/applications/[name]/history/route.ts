import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getApplicationHistory } from '@/lib/services/argocd';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    // Get app name from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const appName = pathParts[pathParts.indexOf('applications') + 1];

    try {
      const history = await getApplicationHistory(ctx.tenant.organizationId, appName);
      return successResponse(history);
    } catch (error) {
      return errorResponse(
        'HISTORY_FAILED',
        `Failed to get history for application ${appName}`,
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
