import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { getArgoService } from '@/lib/services/argocd';
import { syncApplicationSchema } from '@/lib/validations/schemas';
import { headers } from 'next/headers';

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    // Get app name from URL path
    const headersList = await headers();
    const url = headersList.get('x-url') || request.url;
    const appName = new URL(url).pathname.split('/').slice(-2)[0];

    const bodyResult = await validateRequest(request, syncApplicationSchema.partial());
    if ('error' in bodyResult) return bodyResult.error;

    const { revision, prune, dryRun } = bodyResult.data;

    try {
      const argoService = await getArgoService(ctx.tenant.organizationId);
      if (!argoService) {
        return errorResponse(
          'ARGOCD_NOT_CONFIGURED',
          'ArgoCD is not configured for this organization',
          400
        );
      }

      const result = await argoService.syncApplication(appName, {
        revision,
        prune,
        dryRun,
      });

      return successResponse(result);
    } catch (error) {
      return errorResponse(
        'SYNC_FAILED',
        `Failed to sync application ${appName}`,
        500,
        { message: (error as Error).message }
      );
    }
  },
  { 
    rateLimit: 'sync', 
    requiredRole: 'READWRITE',
    audit: {
      action: 'argocd.sync',
      resource: 'application',
      getResourceId: (req) => new URL(req.url).pathname.split('/').slice(-2)[0],
    },
  }
);
