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
import { listPullRequestsSchema, createPullRequestSchema } from '@/lib/validations/schemas';

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listPullRequestsSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, state } = queryResult.data;

    const github = await createGitHubServiceForUser(authResult.userId);
    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected',
        403
      );
    }

    const pullRequests = await github.listPullRequests(repository, state);

    return successResponse(pullRequests);
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

    const github = await createGitHubServiceForUser(authResult.userId);
    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected',
        403
      );
    }

    const pullRequest = await github.createPullRequest({
      repository,
      title,
      head,
      base,
      body,
    });

    return successResponse(pullRequest);
  },
  { rateLimit: 'general', requireAuth: true }
);
