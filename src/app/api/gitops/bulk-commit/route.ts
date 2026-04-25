// =============================================================================
// GitOps Studio - Bulk Commit API
// =============================================================================

import { 
  withTenantApiHandler, 
  successResponse, 
  errorResponse,
} from '@/lib/api';
import { createGitHubClient } from '@/lib/http-client';
import { getGitHubTokenForUser } from '@/app/api/gitops/utils';

interface FileChange {
  repo: string;
  path: string;
  content: string;
  sha?: string; // Required for updates
  branch: string;
}

interface CommitResult {
  repo: string;
  branch: string;
  path: string;
  success: boolean;
  commitSha?: string;
  commitUrl?: string;
  error?: string;
}

interface GitHubContent {
  sha: string;
}

interface GitHubCommitResponse {
  content: {
    sha: string;
  };
  commit: {
    sha: string;
    html_url: string;
  };
}

/**
 * POST /api/gitops/bulk-commit
 * Commit changes to multiple files across different branches/repos
 * Admin only
 */
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const body = await request.json();
    const { changes, message, createPRs, baseBranch } = body as {
      changes: FileChange[];
      message: string;
      createPRs?: boolean;
      baseBranch?: string;
    };

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'changes array is required', 400);
    }

    if (!message) {
      return errorResponse('VALIDATION_ERROR', 'commit message is required', 400);
    }

    const token = await getGitHubTokenForUser(ctx.tenant.userId, ctx.tenant.organizationId);
    if (!token || token === 'mock_token') {
      return errorResponse('NOT_CONFIGURED', 'GitHub token not configured', 400);
    }

    const client = createGitHubClient(token);
    const results: CommitResult[] = [];
    const prs: { repo: string; number: number; url: string }[] = [];

    // Process each file change
    for (const change of changes) {
      try {
        // Get the current file SHA if not provided (for updates)
        let fileSha = change.sha;
        
        if (!fileSha) {
          try {
            const existing = await client.get(
              `repos/${change.repo}/contents/${change.path}`,
              { searchParams: { ref: change.branch } }
            );
            const data = await existing.json<GitHubContent>();
            fileSha = data.sha;
          } catch {
            // File doesn't exist, that's okay for new files
          }
        }

        // Encode content to base64
        const encodedContent = Buffer.from(change.content).toString('base64');

        const requestBody: Record<string, string> = {
          message,
          content: encodedContent,
          branch: change.branch,
        };

        if (fileSha) {
          requestBody.sha = fileSha;
        }

        // Commit the change
        const response = await client.put(
          `repos/${change.repo}/contents/${change.path}`,
          { json: requestBody }
        );

        const data = await response.json<GitHubCommitResponse>();

        results.push({
          repo: change.repo,
          branch: change.branch,
          path: change.path,
          success: true,
          commitSha: data.commit.sha,
          commitUrl: data.commit.html_url,
        });
      } catch (error) {
        results.push({
          repo: change.repo,
          branch: change.branch,
          path: change.path,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    // Create PRs if requested
    if (createPRs && baseBranch) {
      // Group results by repo and branch
      const branchGroups = new Map<string, CommitResult[]>();
      
      for (const result of results.filter(r => r.success)) {
        const key = `${result.repo}:${result.branch}`;
        if (!branchGroups.has(key)) {
          branchGroups.set(key, []);
        }
        branchGroups.get(key)!.push(result);
      }

      // Create a PR for each unique branch that isn't the base branch
      for (const [key, branchResults] of branchGroups) {
        const [repo, branch] = key.split(':');
        
        if (branch === baseBranch) continue;

        try {
          const prResponse = await client.post(`repos/${repo}/pulls`, {
            json: {
              title: message,
              body: `GitOps Studio bulk update\n\nFiles changed:\n${branchResults.map(r => `- ${r.path}`).join('\n')}`,
              head: branch,
              base: baseBranch,
            },
          });

          const pr = await prResponse.json<{ number: number; html_url: string }>();
          prs.push({
            repo,
            number: pr.number,
            url: pr.html_url,
          });
        } catch (error) {
          // PR creation might fail if PR already exists
          console.warn(`Failed to create PR for ${key}:`, error);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return successResponse({
      summary: {
        total: changes.length,
        successful: successCount,
        failed: failCount,
      },
      results,
      pullRequests: prs,
    });
  },
  { 
    rateLimit: 'bulk', 
    requiredRole: 'ADMIN',
    audit: {
      action: 'gitops.bulk_commit',
      resource: 'files',
      getResourceId: () => 'bulk-commit',
    },
  }
);
