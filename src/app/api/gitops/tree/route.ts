// =============================================================================
// GitOps Studio - Get Repository Tree API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient, fetchJson } from '@/lib/http-client';
import { getDefaultBranchForRepo, getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubBranch {
  commit: {
    sha: string;
  };
}

/**
 * GET /api/gitops/tree?repo=owner/repo&ref=branch&recursive=true
 * Get the file tree for a repository
 * Admin only
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const repo = url.searchParams.get('repo');
    const ref = url.searchParams.get('ref') || 'main';
    const recursive = url.searchParams.get('recursive') === 'true';
    const filter = url.searchParams.get('filter'); // Filter by file pattern, e.g., "values.yaml"

    if (!repo) {
      return errorResponse('VALIDATION_ERROR', 'repo parameter is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);

      // Get the branch to find the tree SHA (fallback to default branch if ref missing)
      let branch: GitHubBranch | null = null;
      let resolvedBranch = ref;
      try {
        branch = await fetchJson<GitHubBranch>(
          client,
          `repos/${repo}/branches/${ref}`
        );
      } catch (err) {
        const defaultBranch = await getDefaultBranchForRepo(token, repo);
        if (!defaultBranch || defaultBranch === ref) {
          throw err;
        }
        resolvedBranch = defaultBranch;
        branch = await fetchJson<GitHubBranch>(
          client,
          `repos/${repo}/branches/${defaultBranch}`
        );
      }

      // Get the tree
      const tree = await fetchJson<GitHubTree>(
        client,
        `repos/${repo}/git/trees/${branch.commit.sha}${recursive ? '?recursive=1' : ''}`
      );

      // Filter items if a filter is provided
      let items = tree.tree;
      
      if (filter) {
        const filterLower = filter.toLowerCase();
        items = items.filter(item => 
          item.path.toLowerCase().includes(filterLower) ||
          item.path.toLowerCase().endsWith(filterLower)
        );
      }

      // Transform the response
      const transformedItems = items.map(item => ({
        path: item.path,
        name: item.path.split('/').pop() || item.path,
        type: item.type === 'blob' ? 'file' : 'directory',
        sha: item.sha,
        size: item.size,
      }));

      // Build a tree structure
      const fileList = transformedItems.filter(i => i.type === 'file');
      const directoryList = transformedItems.filter(i => i.type === 'directory');

      return successResponse({
        sha: tree.sha,
        branch: resolvedBranch,
        truncated: tree.truncated,
        files: fileList,
        directories: directoryList,
        total: {
          files: fileList.length,
          directories: directoryList.length,
        },
      });
    } catch (error) {
      console.error('Failed to fetch tree:', error);
      
      if ((error as Error).message?.includes('404')) {
        return errorResponse('NOT_FOUND', 'Repository or branch not found', 404);
      }
      
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to fetch tree: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.get_tree',
      resource: 'tree',
      getResourceId: (request) => {
        const url = new URL(request.url);
        return `${url.searchParams.get('repo')}:${url.searchParams.get('ref')}`;
      },
    },
  }
);
