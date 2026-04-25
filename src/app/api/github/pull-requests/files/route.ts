import { NextResponse } from 'next/server';
import {
  withApiHandler,
  requireApiAuth,
  successResponse,
  errorResponse,
  validateQuery,
} from '@/lib/api';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { listPullRequestFilesSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listPullRequestFilesSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, number } = queryResult.data;

    let github;
    try {
      github = await createGitHubServiceForUser(authResult.userId);
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'GitHub service initialization failed');
      return errorResponse(
        'GITHUB_NOT_CONFIGURED',
        'GitHub integration is not configured. Contact your administrator.',
        500
      );
    }

    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected. Please connect your GitHub account in Settings.',
        403
      );
    }

    try {
      const files = await github.getPullRequestFiles(repository, number);
      return successResponse(files);
    } catch (error) {
      logger.error({ userId: authResult.userId, repository, number, error: (error as Error).message }, 'GitHub PR files fetch failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch pull request files', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);
