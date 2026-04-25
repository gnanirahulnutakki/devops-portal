// =============================================================================
// GitOps Studio - Get/Update File Contents API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient } from '@/lib/http-client';
import { getDefaultBranchForRepo, getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  download_url?: string;
}

interface GitHubCommitResponse {
  content: {
    name: string;
    path: string;
    sha: string;
  };
  commit: {
    sha: string;
    message: string;
    html_url: string;
  };
}

/**
 * GET /api/gitops/contents?repo=owner/repo&path=path/to/file&ref=branch
 * Get file or directory contents
 * Admin only
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const repo = url.searchParams.get('repo');
    const path = url.searchParams.get('path') || '';
    const ref = url.searchParams.get('ref') || 'main';

    if (!repo) {
      return errorResponse('VALIDATION_ERROR', 'repo parameter is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);
      let resolvedBranch = ref;
      let response = await client.get(`repos/${repo}/contents/${path}`, {
        searchParams: { ref },
      });
      if (!response.ok) {
        const defaultBranch = await getDefaultBranchForRepo(token, repo);
        if (defaultBranch && defaultBranch !== ref) {
          resolvedBranch = defaultBranch;
          response = await client.get(`repos/${repo}/contents/${path}`, {
            searchParams: { ref: defaultBranch },
          });
        }
      }
      if (!response.ok) {
        return errorResponse('NOT_FOUND', 'File or directory not found', 404);
      }
      
      const data = await response.json<GitHubContent | GitHubContent[]>();

      // If it's a directory, return list of items
      if (Array.isArray(data)) {
        return successResponse({
          type: 'directory',
          path,
          items: data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            sha: item.sha,
            size: item.size,
            downloadUrl: item.download_url,
          })),
        });
      }

      // If it's a file, decode and return content
      const content = data.content 
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : '';

      return successResponse({
        type: 'file',
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        content,
        branch: resolvedBranch,
        downloadUrl: data.download_url,
      });
    } catch (error) {
      console.error('Failed to fetch contents:', error);
      
      if ((error as Error).message?.includes('404')) {
        return errorResponse('NOT_FOUND', 'File or directory not found', 404);
      }
      
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to fetch contents: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'general', 
    requiredRole: 'USER',
    audit: {
      action: 'gitops.get_contents',
      resource: 'file',
      getResourceId: (request) => {
        const url = new URL(request.url);
        return `${url.searchParams.get('repo')}:${url.searchParams.get('path')}`;
      },
    },
  }
);

/**
 * PUT /api/gitops/contents
 * Create or update a file
 * Admin only
 */
export const PUT = withTenantApiHandler(
  async (request, ctx) => {
    const body = await request.json();
    const { repo, path, content, message, branch, sha } = body;

    if (!repo || !path || content === undefined || !message || !branch) {
      return errorResponse(
        'VALIDATION_ERROR', 
        'repo, path, content, message, and branch are required', 
        400
      );
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    try {
      const client = createGitHubClient(token);
      
      // Encode content to base64
      const encodedContent = Buffer.from(content).toString('base64');

      const requestBody: Record<string, string> = {
        message,
        content: encodedContent,
        branch,
      };

      // If sha is provided, it's an update; otherwise it's a create
      if (sha) {
        requestBody.sha = sha;
      }

      const response = await client.put(`repos/${repo}/contents/${path}`, {
        json: requestBody,
      });

      const data = await response.json<GitHubCommitResponse>();

      return successResponse({
        success: true,
        file: {
          name: data.content.name,
          path: data.content.path,
          sha: data.content.sha,
        },
        commit: {
          sha: data.commit.sha,
          message: data.commit.message,
          url: data.commit.html_url,
        },
      });
    } catch (error) {
      console.error('Failed to update file:', error);
      return errorResponse(
        'GITHUB_ERROR',
        `Failed to update file: ${(error as Error).message}`,
        500
      );
    }
  },
  { 
    rateLimit: 'bulk', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.update_file',
      resource: 'file',
      getResourceId: () => 'file-update',
    },
  }
);
