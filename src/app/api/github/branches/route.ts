import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateQuery,
} from '@/lib/api';
import { createGitHubServiceForUser, GitHubService } from '@/lib/integrations/github';
import { listBranchesSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';
import { getCredentials } from '@/lib/services/integration-credentials';

interface GitHubCredentials {
  token: string;
  organization?: string;
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listBranchesSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, filter } = queryResult.data;
    const credentialId = url.searchParams.get('credentialId') || undefined;
    const userId = ctx.tenant.userId;
    const orgId = ctx.tenant.organizationId;

    let github;
    try {
      if (credentialId) {
        const creds = await getCredentials<GitHubCredentials>(orgId, 'GITHUB', { credentialId });
        if (creds?.token && creds?.organization) {
          github = new GitHubService(creds.token, creds.organization);
        }
      }
      if (!github) {
        github = await createGitHubServiceForUser(userId, orgId);
      }
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'GitHub service initialization failed');
      return errorResponse(
        'GITHUB_NOT_CONFIGURED',
        'GitHub integration is not configured. Add a GitHub account in Settings.',
        500
      );
    }

    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected. Add a GitHub account in Settings.',
        403
      );
    }

    try {
      const branches = await github.listBranches(repository, filter);
      return successResponse(branches);
    } catch (error) {
      logger.error({ userId, repository, error: (error as Error).message }, 'GitHub branches fetch failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch branches from GitHub', 502);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
