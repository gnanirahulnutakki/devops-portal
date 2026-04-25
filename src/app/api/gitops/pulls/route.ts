// =============================================================================
// GitOps Studio - Pull Requests API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient, fetchJson } from '@/lib/http-client';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  mergeable: boolean | null;
  mergeable_state: string;
}

/**
 * GET /api/gitops/pulls?repo=owner/repo&state=open
 * List pull requests for a repository
 * Admin only
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const repo = url.searchParams.get('repo');
    const state = url.searchParams.get('state') || 'open';

    if (!repo) {
      return errorResponse('VALIDATION_ERROR', 'repo parameter is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);
      const pulls = await fetchJson<GitHubPullRequest[]>(
        client,
        `repos/${repo}/pulls?state=${state}&per_page=50`
      );

      return successResponse({
        pullRequests: pulls.map(pr => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          url: pr.html_url,
          head: pr.head.ref,
          base: pr.base.ref,
          author: {
            login: pr.user.login,
            avatar: pr.user.avatar_url,
          },
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          mergedAt: pr.merged_at,
          mergeable: pr.mergeable,
          mergeableState: pr.mergeable_state,
        })),
        total: pulls.length,
      });
    } catch (error) {
      console.error('Failed to fetch pull requests:', error);
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to fetch pull requests: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.list_pulls',
      resource: 'pull_requests',
      getResourceId: (request) => {
        const url = new URL(request.url);
        return url.searchParams.get('repo') || 'unknown';
      },
    },
  }
);

/**
 * POST /api/gitops/pulls
 * Create a new pull request
 * Admin only
 */
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const body = await request.json();
    const { repo, title, body: prBody, head, base } = body;

    if (!repo || !title || !head || !base) {
      return errorResponse(
        'VALIDATION_ERROR', 
        'repo, title, head, and base are required', 
        400
      );
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);
      
      const response = await client.post(`repos/${repo}/pulls`, {
        json: {
          title,
          body: prBody || '',
          head,
          base,
        },
      });

      const pr = await response.json<GitHubPullRequest>();

      return successResponse({
        success: true,
        pullRequest: {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          head: pr.head.ref,
          base: pr.base.ref,
          state: pr.state,
        },
      });
    } catch (error) {
      console.error('Failed to create pull request:', error);
      
      if ((error as Error).message?.includes('422')) {
        return errorResponse(
          'VALIDATION_ERROR', 
          'Pull request could not be created. A PR may already exist for this branch.',
          422
        );
      }
      
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to create pull request: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'bulk', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.create_pull',
      resource: 'pull_request',
      getResourceId: () => 'pull-request-create',
    },
  }
);
