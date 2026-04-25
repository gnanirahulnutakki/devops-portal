import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateQuery,
  validateRequest,
} from '@/lib/api';
import { createGitHubServiceForUser, GitHubService } from '@/lib/integrations/github';
import { listPullRequestsSchema, createPullRequestSchema, updatePullRequestSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';
import { getCredentials } from '@/lib/services/integration-credentials';

interface GitHubCredentials {
  token: string;
  organization?: string;
}

async function resolveGitHub(userId: string, orgId: string, credentialId?: string) {
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
    return {
      error: errorResponse(
        'GITHUB_NOT_CONFIGURED',
        'GitHub integration is not configured. Add a GitHub account in Settings.',
        500
      ),
    };
  }

  if (!github) {
    return {
      error: errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected. Add a GitHub account in Settings.',
        403
      ),
    };
  }
  return { github };
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listPullRequestsSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, state } = queryResult.data;
    const credentialId = url.searchParams.get('credentialId') || undefined;
    const userId = ctx.tenant.userId;
    const orgId = ctx.tenant.organizationId;

    const result = await resolveGitHub(userId, orgId, credentialId);
    if (result.error) return result.error;

    try {
      if (repository) {
        const pullRequests = await result.github.listPullRequests(repository, state);
        return successResponse(pullRequests);
      }

      const repos = await result.github.getUserRepositories({ sort: 'pushed', perPage: 10 });
      const allPRs = await Promise.allSettled(
        repos.map((repo) => result.github.listPullRequests(repo.fullName, state))
      );
      const pullRequests = allPRs
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof result.github.listPullRequests>>> => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return successResponse(pullRequests);
    } catch (error) {
      logger.error({ userId, repository, error: (error as Error).message }, 'GitHub PR fetch failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch pull requests from GitHub', 502);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const credentialId = url.searchParams.get('credentialId') || undefined;

    const bodyResult = await validateRequest(request, createPullRequestSchema);
    if ('error' in bodyResult) return bodyResult.error;

    const { repository, title, head, base, body } = bodyResult.data;
    const userId = ctx.tenant.userId;
    const orgId = ctx.tenant.organizationId;

    const result = await resolveGitHub(userId, orgId, credentialId);
    if (result.error) return result.error;

    try {
      const pullRequest = await result.github.createPullRequest({ repository, title, head, base, body });
      return successResponse(pullRequest);
    } catch (error) {
      logger.error({ userId, repository, error: (error as Error).message }, 'GitHub PR create failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to create pull request on GitHub', 502);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const credentialId = url.searchParams.get('credentialId') || undefined;

    const bodyResult = await validateRequest(request, updatePullRequestSchema);
    if ('error' in bodyResult) return bodyResult.error;

    const { repository, number, action } = bodyResult.data;
    const userId = ctx.tenant.userId;
    const orgId = ctx.tenant.organizationId;

    const result = await resolveGitHub(userId, orgId, credentialId);
    if (result.error) return result.error;

    try {
      let updates: { draft?: boolean; state?: 'open' | 'closed' } = {};
      if (action === 'draft') updates = { draft: true };
      if (action === 'ready') updates = { draft: false };
      if (action === 'close') updates = { state: 'closed' };
      if (action === 'reopen') updates = { state: 'open' };

      const pullRequest = await result.github.updatePullRequest(repository, number, updates);
      return successResponse(pullRequest);
    } catch (error) {
      logger.error({ userId, repository, number, error: (error as Error).message }, 'GitHub PR update failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to update pull request on GitHub', 502);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
