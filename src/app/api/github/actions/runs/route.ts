import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';
import { GitHubService } from '@/lib/integrations/github';
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const repository = searchParams.get('repository');
    const branch = searchParams.get('branch') || undefined;

    if (!repository) {
      return errorResponse('VALIDATION_ERROR', 'repository is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token) {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    const service = new GitHubService(token, process.env.GITHUB_ORGANIZATION || '');
    const runs = await service.listWorkflowRuns(repository, branch);
    return successResponse(runs);
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
