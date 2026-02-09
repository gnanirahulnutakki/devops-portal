// =============================================================================
// GitOps Studio - List Branches API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient, fetchJson } from '@/lib/http-client';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * GET /api/gitops/branches?repo=owner/repo
 * List all branches for a repository
 * Admin only
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const repo = url.searchParams.get('repo');

    if (!repo) {
      return errorResponse('VALIDATION_ERROR', 'repo parameter is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);
      const branches = await fetchJson<GitHubBranch[]>(
        client, 
        `repos/${repo}/branches?per_page=100`
      );

      return successResponse({
        branches: branches.map(b => ({
          name: b.name,
          sha: b.commit.sha,
          protected: b.protected,
        })),
        total: branches.length,
      });
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to fetch branches: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'ADMIN', // Admin only
    audit: {
      action: 'gitops.list_branches',
      resource: 'branches',
      getResourceId: (request) => {
        const url = new URL(request.url);
        return url.searchParams.get('repo') || 'unknown';
      },
    },
  }
);
