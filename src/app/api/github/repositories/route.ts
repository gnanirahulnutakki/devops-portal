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
    const github = await createGitHubServiceForUser(authResult.userId);
    if (!github) {
      return errorResponse(
        'GITHUB_NOT_CONNECTED',
        'GitHub account not connected. Please sign in with GitHub.',
        403
      );
    }

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
  },
  { rateLimit: 'general', requireAuth: true }
);
