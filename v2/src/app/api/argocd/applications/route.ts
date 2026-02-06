import { NextResponse } from 'next/server';
import { 
  withApiHandler, 
  requireApiAuth, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { listApplications } from '@/lib/services/argocd';
import { withApiContext, requireRole } from '@/lib/api-context';

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const project = url.searchParams.get('project') || undefined;

    return withApiContext(async (ctx) => {
      try {
        requireRole(ctx, 'READWRITE');
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
    });
  },
  { rateLimit: 'general', requireAuth: true }
);
