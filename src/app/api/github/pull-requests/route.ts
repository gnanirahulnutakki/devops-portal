import { NextResponse } from 'next/server';
import { 
  withApiHandler, 
  requireApiAuth, 
  successResponse, 
  errorResponse,
  validateQuery,
  validateRequest,
} from '@/lib/api';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { listPullRequestsSchema, createPullRequestSchema, updatePullRequestSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

async function getGitHubForUser(userId: string) {
  try {
    const github = await createGitHubServiceForUser(userId);
    if (!github) {
      return {
        error: errorResponse(
          'GITHUB_NOT_CONNECTED',
          'GitHub account not connected. Please connect your GitHub account in Settings.',
          403
        ),
      };
    }
    return { github };
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'GitHub service initialization failed');
    return {
      error: errorResponse(
        'GITHUB_NOT_CONFIGURED',
        'GitHub integration is not configured. Contact your administrator.',
        500
      ),
    };
  }
}

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listPullRequestsSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, state } = queryResult.data;

    const result = await getGitHubForUser(authResult.userId);
    if (result.error) return result.error;

    try {
      if (repository) {
        // List PRs for a specific repository
        const pullRequests = await result.github.listPullRequests(repository, state);
        return successResponse(pullRequests);
      }

      // No repository specified: list PRs across the user's recent repos
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
      logger.error({ userId: authResult.userId, repository, error: (error as Error).message }, 'GitHub PR fetch failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch pull requests from GitHub', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);

export const POST = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const bodyResult = await validateRequest(request, createPullRequestSchema);
    if ('error' in bodyResult) return bodyResult.error;

    const { repository, title, head, base, body } = bodyResult.data;

    const result = await getGitHubForUser(authResult.userId);
    if (result.error) return result.error;

    try {
      const pullRequest = await result.github.createPullRequest({
        repository,
        title,
        head,
        base,
        body,
      });
      return successResponse(pullRequest);
    } catch (error) {
      logger.error({ userId: authResult.userId, repository, error: (error as Error).message }, 'GitHub PR create failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to create pull request on GitHub', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);

export const PATCH = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const bodyResult = await validateRequest(request, updatePullRequestSchema);
    if ('error' in bodyResult) return bodyResult.error;

    const { repository, number, action } = bodyResult.data;

    const result = await getGitHubForUser(authResult.userId);
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
      logger.error({ userId: authResult.userId, repository, number, error: (error as Error).message }, 'GitHub PR update failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to update pull request on GitHub', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);
