import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';
import { GitHubService } from '@/lib/integrations/github';
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const { searchParams, pathname } = new URL(request.url);
    const segments = pathname.split('/').filter(Boolean);
    const runId = Number(segments[segments.indexOf('runs') + 1]);
    const repository = searchParams.get('repository');

    if (!repository || !runId) {
      return errorResponse('VALIDATION_ERROR', 'repository and runId are required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token) {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    const service = new GitHubService(token, process.env.GITHUB_ORGANIZATION || '');
    await service.cancelWorkflowRun(repository, runId);
    return successResponse({ success: true });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
