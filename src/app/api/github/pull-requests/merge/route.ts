import { NextResponse } from 'next/server';
import {
  withApiHandler,
  requireApiAuth,
  successResponse,
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { mergePullRequestSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

export const POST = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const bodyResult = await validateRequest(request, mergePullRequestSchema);
    if ('error' in bodyResult) return bodyResult.error;

    const { repository, number, method } = bodyResult.data;

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
      const result = await github.mergePullRequest(repository, number, { mergeMethod: method });
      return successResponse(result);
    } catch (error) {
      logger.error({ userId: authResult.userId, repository, number, error: (error as Error).message }, 'GitHub PR merge failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to merge pull request', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);
