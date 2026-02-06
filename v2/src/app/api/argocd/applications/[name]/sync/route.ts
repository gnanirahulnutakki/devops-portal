import { NextResponse } from 'next/server';
import { 
  withApiHandler, 
  requireApiAuth, 
  successResponse, 
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { getArgoCDService } from '@/lib/integrations/argocd';
import { syncApplicationSchema } from '@/lib/validations/schemas';
import { logAudit } from '@/lib/logger';

export const POST = withApiHandler(
  async (request: Request, { params }: { params: { name: string } }) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const bodyResult = await validateRequest(request, syncApplicationSchema.partial());
    if ('error' in bodyResult) return bodyResult.error;

    const { revision, prune, dryRun } = bodyResult.data;
    const appName = params.name;

    try {
      const argocd = getArgoCDService();
      const result = await argocd.syncApplication(appName, {
        revision,
        prune,
        dryRun,
      });

      // Audit log
      logAudit({
        action: 'argocd.sync',
        resource: 'application',
        resourceId: appName,
        userId: authResult.userId,
        success: true,
        details: { revision, prune, dryRun },
      });

      return successResponse(result);
    } catch (error) {
      logAudit({
        action: 'argocd.sync',
        resource: 'application',
        resourceId: appName,
        userId: authResult.userId,
        success: false,
        details: { error: (error as Error).message },
      });

      return errorResponse(
        'SYNC_FAILED',
        `Failed to sync application ${appName}`,
        500,
        { message: (error as Error).message }
      );
    }
  },
  { rateLimit: 'sync', requireAuth: true }
);
