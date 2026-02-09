import { NextResponse } from 'next/server';
import { 
  withApiHandler, 
  requireApiAuth, 
  successResponse, 
  errorResponse,
  validateQuery,
} from '@/lib/api';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { listRepositoriesSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

export const GET = withApiHandler(
  async (request: Request) => {
    // Auth
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    // Validate query params
    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listRepositoriesSchema);
    if ('error' in queryResult) return queryResult.error;

    const { filter, page, perPage } = queryResult.data;

    // Get GitHub service for user
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
        'GitHub account not connected. Please sign in with GitHub or connect your account in Settings.',
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
      logger.error({ userId: authResult.userId, error: (error as Error).message }, 'GitHub API request failed');
      return errorResponse('GITHUB_API_ERROR', 'Failed to fetch repositories from GitHub', 502);
    }
  },
  { rateLimit: 'general', requireAuth: true }
);
