// =============================================================================
// GitOps Studio - Create Branch API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient, fetchJson } from '@/lib/http-client';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

/**
 * POST /api/gitops/branches/create
 * Create a new branch from an existing ref
 * Admin only
 */
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const body = await request.json();
    const { repo, branchName, fromBranch } = body;

    if (!repo || !branchName || !fromBranch) {
      return errorResponse(
        'VALIDATION_ERROR', 
        'repo, branchName, and fromBranch are required', 
        400
      );
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);

      // Get the SHA of the source branch
      const sourceRef = await fetchJson<GitHubRef>(
        client,
        `repos/${repo}/git/refs/heads/${fromBranch}`
      );

      // Create the new branch
      const response = await client.post(`repos/${repo}/git/refs`, {
        json: {
          ref: `refs/heads/${branchName}`,
          sha: sourceRef.object.sha,
        },
      });

      const newRef = await response.json<GitHubRef>();

      return successResponse({
        success: true,
        branch: {
          name: branchName,
          sha: newRef.object.sha,
          ref: newRef.ref,
        },
      });
    } catch (error) {
      console.error('Failed to create branch:', error);
      
      if ((error as Error).message?.includes('422')) {
        return errorResponse('CONFLICT', 'Branch already exists', 409);
      }
      
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to create branch: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'bulk', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.create_branch',
      resource: 'branch',
      getResourceId: () => 'branch-create',
    },
  }
);
