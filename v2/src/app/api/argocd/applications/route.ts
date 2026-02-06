import { NextResponse } from 'next/server';
import { 
  withApiHandler, 
  requireApiAuth, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { getArgoCDService } from '@/lib/integrations/argocd';

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const project = url.searchParams.get('project') || undefined;

    try {
      const argocd = getArgoCDService();
      const applications = await argocd.listApplications(project);

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
  { rateLimit: 'general', requireAuth: true }
);
