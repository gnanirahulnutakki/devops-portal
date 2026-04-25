import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateQuery,
} from '@/lib/api';
import { createGitHubServiceForUser, GitHubService } from '@/lib/integrations/github';
import { listRepositoriesSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';
import { getCredentials } from '@/lib/services/integration-credentials';

interface GitHubCredentials {
  token: string;
  organization?: string;
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    // Validate query params
    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listRepositoriesSchema);
    if ('error' in queryResult) return queryResult.error;

    const { filter, page, perPage } = queryResult.data;
    const credentialId = url.searchParams.get('credentialId') || undefined;
    const orgId = ctx.tenant.organizationId;
    const userId = ctx.tenant.userId;

    // Get GitHub service — try specific credential first, then org default
    let github;
    try {
      if (credentialId) {
        // Use the specific credential requested by the account selector
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
        'GitHub integration is not configured. Add a GitHub account in Settings > Configurations.',
        500
      );
    }

    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected. Add a GitHub account in Settings > Configurations.',
        403
      );
    }

    try {
      // Fetch repositories
      const repositories = await github.getUserRepositories({
        sort: 'updated',
        perPage,
        page,
      });

      // Filter if provided
      const filtered = filter
        ? repositories.filter(repo =>
            repo.name.toLowerCase().includes(filter.toLowerCase()) ||
            repo.fullName.toLowerCase().includes(filter.toLowerCase())
          )
        : repositories;

      return successResponse(filtered, {
        page,
        pageSize: perPage,
        total: filtered.length,
      });
    } catch (error) {
      logger.error({ userId, error: (error as Error).message }, 'GitHub API request failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch repositories from GitHub', 502);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
