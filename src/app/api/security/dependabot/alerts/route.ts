import { NextResponse } from 'next/server';
import {
  withApiHandler,
  requireApiAuth,
  successResponse,
  errorResponse,
  validateQuery,
} from '@/lib/api';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { listDependabotAlertsSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

export const GET = withApiHandler(
  async (request: Request) => {
    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const queryResult = validateQuery(url.searchParams, listDependabotAlertsSchema);
    if ('error' in queryResult) return queryResult.error;

    const { repository, state, page, perPage } = queryResult.data;

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
      const alerts = await github.listDependabotAlerts(repository, {
        state,
        page,
        perPage,
      });
      return successResponse(alerts, { page, pageSize: perPage, total: alerts.length });
    } catch (error) {
      const message = (error as Error).message || 'Unknown error';
      logger.error(
        { userId: authResult.userId, repository, state, error: message },
        'Failed to list Dependabot alerts'
      );

      // Most common cause: token scope missing (security_events) or org policy
      return errorResponse(
        'GITHUB_SECURITY_API_ERROR',
        'Failed to fetch Dependabot alerts. Verify token scopes (may require security events access) and repository permissions.',
        502
      );
    }
  },
  { rateLimit: 'general', requireAuth: true }
);

