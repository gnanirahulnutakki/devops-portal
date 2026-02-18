import { withTenantApiHandler, successResponse, errorResponse, validateQuery } from '@/lib/api';
import { listCodeScanningAlertsSchema } from '@/lib/validations/schemas';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';
import { GitHubService } from '@/lib/integrations/github';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const query = validateQuery(url.searchParams, listCodeScanningAlertsSchema);
    if ('error' in query) return query.error;

    const { repository, state, toolName, page, perPage } = query.data;

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token) {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const service = new GitHubService(token, process.env.GITHUB_ORGANIZATION || '');
      const alerts = await service.listCodeScanningAlerts(repository, {
        state,
        toolName,
        page,
        perPage,
      });
      return successResponse(alerts, { page, pageSize: perPage, total: alerts.length });
    } catch (error) {
      return errorResponse(
        'GITHUB_SECURITY_API_ERROR',
        'Failed to fetch code scanning alerts. Verify token scopes and repository permissions.',
        502,
        { message: (error as Error).message }
      );
    }
  },
  { rateLimit: 'general', requiredRole: 'USER', requiredFeature: 'vulnerability' }
);

