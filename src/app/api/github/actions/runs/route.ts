import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';
import { GitHubService } from '@/lib/integrations/github';
import { getCredentials } from '@/lib/services/integration-credentials';

interface GitHubCredentials {
  token: string;
  organization?: string;
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const repository = searchParams.get('repository');
    const branch = searchParams.get('branch') || undefined;
    const credentialId = searchParams.get('credentialId') || undefined;

    if (!repository) {
      return errorResponse('VALIDATION_ERROR', 'repository is required', 400);
    }

    const userId = ctx.tenant.userId;
    const orgId = ctx.tenant.organizationId;

    let service: GitHubService | null = null;

    if (credentialId) {
      const creds = await getCredentials<GitHubCredentials>(orgId, 'GITHUB', { credentialId });
      if (creds?.token && creds?.organization) {
        service = new GitHubService(creds.token, creds.organization);
      }
    }

    if (!service) {
      const token = await getGitHubTokenForUser(userId, orgId);
      if (!token) {
        return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
      }
      // Extract org from credential or repository name
      const org = repository.split('/')[0] || '';
      service = new GitHubService(token, org);
    }

    const runs = await service.listWorkflowRuns(repository, branch);
    return successResponse(runs);
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
