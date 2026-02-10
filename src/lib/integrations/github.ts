import { Octokit } from '@octokit/rest';
// GitHub client created via Octokit
import { logger } from '../logger';
import { githubTokens } from '../token-store';
import { prisma } from '@/lib/prisma';
import { getCredentials, GitHubCredentials } from '@/lib/services/integration-credentials';

// =============================================================================
// Types
// =============================================================================

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    type: string;
    avatarUrl?: string;
  };
  private: boolean;
  description?: string;
  defaultBranch: string;
  htmlUrl: string;
  language?: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  createdAt: string;
  updatedAt: string;
  pushedAt?: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: 'base64';
  downloadUrl?: string;
}

export interface GitHubFileTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body?: string;
  htmlUrl: string;
  user: {
    login: string;
    avatarUrl: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  draft: boolean;
  mergeable?: boolean;
  mergeableState?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  mergedAt?: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  event: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  runNumber: number;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type DependabotAlertState = 'open' | 'dismissed' | 'fixed' | 'all';
export type DependabotAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export interface GitHubDependabotAlert {
  number: number;
  state: DependabotAlertState | string;
  severity: DependabotAlertSeverity;
  repository: string; // owner/repo
  packageName?: string;
  ecosystem?: string;
  manifestPath?: string;
  vulnerableVersionRange?: string;
  firstPatchedVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  htmlUrl?: string;
  summary?: string;
}

export interface GitHubCodeScanningAlert {
  number: number;
  state: string;
  ruleId?: string;
  ruleDescription?: string;
  severity?: string;
  toolName?: string;
  createdAt?: string;
  updatedAt?: string;
  htmlUrl?: string;
}

export interface UpdateFileParams {
  repository: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  sha: string;
  committer?: {
    name: string;
    email: string;
  };
}

export interface CreatePullRequestParams {
  repository: string;
  title: string;
  head: string;
  base: string;
  body?: string;
}

// =============================================================================
// GitHub Service
// =============================================================================

export class GitHubService {
  private octokit: Octokit;
  private organization: string;

  constructor(token: string, organization: string) {
    this.octokit = new Octokit({
      auth: token,
      retry: { enabled: true },
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn({ retryAfter, method: options.method, url: options.url }, 'GitHub rate limit hit');
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          logger.warn({ retryAfter, method: options.method, url: options.url }, 'GitHub secondary rate limit hit');
          return true;
        },
      },
    });
    this.organization = organization;
  }

  private resolveOwnerRepo(repository: string): { owner: string; repo: string } {
    if (repository.includes('/')) {
      const [owner, repo] = repository.split('/');
      return { owner, repo };
    }
    if (!this.organization) {
      throw new Error('GITHUB_ORGANIZATION is not configured for repository lookups.');
    }
    return { owner: this.organization, repo: repository };
  }

  // ---------------------------------------------------------------------------
  // Repositories
  // ---------------------------------------------------------------------------

  async listRepositories(filter?: string): Promise<GitHubRepository[]> {
    const { data } = await this.octokit.repos.listForOrg({
      org: this.organization,
      per_page: 100,
      sort: 'updated',
    });

    let repos = data;
    if (filter) {
      repos = repos.filter(repo =>
        repo.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return repos.map(this.mapRepository);
  }

  async getUserRepositories(options: {
    type?: 'all' | 'owner' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
    page?: number;
  } = {}): Promise<GitHubRepository[]> {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      type: options.type || 'all',
      sort: options.sort || 'updated',
      per_page: options.perPage || 50,
      page: options.page || 1,
    });

    return data.map(this.mapRepository);
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  async listBranches(repository: string, filter?: string): Promise<GitHubBranch[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    let branches = data;
    if (filter) {
      branches = branches.filter(branch =>
        branch.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return branches.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url,
      },
      protected: branch.protected,
    }));
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async listWorkflowRuns(repository: string, branch?: string): Promise<GitHubWorkflowRun[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch,
      per_page: 50,
    });

    return (data.workflow_runs || []).map((run) => ({
      id: run.id,
      name: run.name || run.display_title || 'Workflow',
      status: run.status || 'unknown',
      conclusion: run.conclusion || undefined,
      event: run.event,
      branch: run.head_branch || '',
      commitSha: run.head_sha,
      commitMessage: run.head_commit?.message,
      runNumber: run.run_number,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    }));
  }

  async rerunWorkflowRun(repository: string, runId: number): Promise<void> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    await this.octokit.actions.reRunWorkflow({
      owner,
      repo,
      run_id: runId,
    });
  }

  async cancelWorkflowRun(repository: string, runId: number): Promise<void> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    await this.octokit.actions.cancelWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
  }

  // ---------------------------------------------------------------------------
  // Security (Dependabot Alerts)
  // ---------------------------------------------------------------------------

  async listDependabotAlerts(
    repository: string,
    options: {
      state?: DependabotAlertState;
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubDependabotAlert[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const state = options.state || 'open';
    const per_page = options.perPage || 50;
    const page = options.page || 1;

    const res = await this.octokit.request('GET /repos/{owner}/{repo}/dependabot/alerts', {
      owner,
      repo,
      state,
      per_page,
      page,
      headers: {
        accept: 'application/vnd.github+json',
      },
    });

    const data = (res.data || []) as any[];
    return data.map((a) => {
      const advisory = a.security_advisory || {};
      const dep = a.dependency || {};
      const pkg = dep.package || {};
      const sevRaw = String(advisory.severity || 'unknown').toLowerCase();
      const severity: DependabotAlertSeverity =
        sevRaw === 'critical' || sevRaw === 'high' || sevRaw === 'medium' || sevRaw === 'low'
          ? (sevRaw as DependabotAlertSeverity)
          : 'unknown';

      const firstPatchedVersion =
        a.security_vulnerability?.first_patched_version?.identifier ||
        advisory?.patched_versions ||
        undefined;

      return {
        number: a.number,
        state: a.state,
        severity,
        repository: `${owner}/${repo}`,
        packageName: pkg.name,
        ecosystem: pkg.ecosystem,
        manifestPath: dep.manifest_path,
        vulnerableVersionRange: a.security_vulnerability?.vulnerable_version_range,
        firstPatchedVersion,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        htmlUrl: a.html_url,
        summary: advisory.summary,
      };
    });
  }

  async listCodeScanningAlerts(
    repository: string,
    options: {
      state?: 'open' | 'dismissed' | 'fixed';
      toolName?: string;
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubCodeScanningAlert[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const state = options.state || 'open';
    const per_page = options.perPage || 50;
    const page = options.page || 1;

    const res = await this.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts', {
      owner,
      repo,
      state,
      per_page,
      page,
      headers: {
        accept: 'application/vnd.github+json',
      },
    });

    const data = (res.data || []) as any[];
    const mapped = data.map((a) => ({
      number: a.number,
      state: a.state,
      ruleId: a.rule?.id,
      ruleDescription: a.rule?.description,
      severity: a.rule?.severity,
      toolName: a.tool?.name,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      htmlUrl: a.html_url,
    })) as GitHubCodeScanningAlert[];

    if (options.toolName) {
      const toolLower = options.toolName.toLowerCase();
      return mapped.filter((a) => (a.toolName || '').toLowerCase().includes(toolLower));
    }
    return mapped;
  }

  async createBranch(
    repository: string,
    newBranchName: string,
    fromBranch: string
  ): Promise<{ ref: string; sha: string }> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`,
    });

    const { data } = await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: refData.object.sha,
    });

    return {
      ref: data.ref,
      sha: data.object.sha,
    };
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------

  async getFileTree(
    repository: string,
    branch: string,
    path: string = ''
  ): Promise<GitHubFileTreeEntry[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path: path,
      ref: branch,
    });

    if (!Array.isArray(data)) {
      return [this.mapFileTreeEntry(data)];
    }

    return data.map(this.mapFileTreeEntry);
  }

  async getFileContent(
    repository: string,
    branch: string,
    path: string
  ): Promise<GitHubFileContent> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path: path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: data.content || '',
      encoding: 'base64',
      downloadUrl: data.download_url || undefined,
    };
  }

  async updateFile(params: UpdateFileParams): Promise<{
    sha: string;
    commitSha: string;
    commitUrl: string;
  }> {
    const { owner, repo } = this.resolveOwnerRepo(params.repository);
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: params.path,
      message: params.message,
      content: params.content,
      sha: params.sha,
      branch: params.branch,
      committer: params.committer,
    });

    return {
      sha: data.content?.sha ?? '',
      commitSha: data.commit.sha ?? '',
      commitUrl: data.commit.url ?? '',
    };
  }

  // ---------------------------------------------------------------------------
  // Pull Requests
  // ---------------------------------------------------------------------------

  async listPullRequests(
    repository: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubPullRequest[]> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      state: state,
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    return data.map(this.mapPullRequest);
  }

  async getPullRequest(
    repository: string,
    pullNumber: number
  ): Promise<GitHubPullRequest> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return this.mapPullRequest(data);
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<GitHubPullRequest> {
    const { owner, repo } = this.resolveOwnerRepo(params.repository);
    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title: params.title,
      body: params.body || '',
      head: params.head,
      base: params.base,
    });

    return this.mapPullRequest(data);
  }

  async updatePullRequest(
    repository: string,
    pullNumber: number,
    updates: { draft?: boolean; state?: 'open' | 'closed' }
  ): Promise<GitHubPullRequest> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      ...updates,
    });

    return this.mapPullRequest(data);
  }

  async mergePullRequest(
    repository: string,
    pullNumber: number,
    options: {
      commitTitle?: string;
      commitMessage?: string;
      mergeMethod?: 'merge' | 'squash' | 'rebase';
    } = {}
  ): Promise<{ merged: boolean; sha: string; message: string }> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      commit_title: options.commitTitle,
      commit_message: options.commitMessage,
      merge_method: options.mergeMethod || 'merge',
    });

    return {
      merged: data.merged,
      sha: data.sha,
      message: data.message,
    };
  }

  async getPullRequestFiles(
    repository: string,
    pullNumber: number
  ): Promise<Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>> {
    const { owner, repo } = this.resolveOwnerRepo(repository);
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return data.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
    }));
  }

  // ---------------------------------------------------------------------------
  // User
  // ---------------------------------------------------------------------------

  async getAuthenticatedUser(): Promise<{
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatarUrl: string;
    company: string | null;
    location: string | null;
    bio: string | null;
  }> {
    const { data } = await this.octokit.users.getAuthenticated();

    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
      company: data.company,
      location: data.location,
      bio: data.bio,
    };
  }

  async getUserOrganizations(): Promise<Array<{
    id: number;
    login: string;
    description: string | null;
    avatarUrl: string;
  }>> {
    const { data } = await this.octokit.orgs.listForAuthenticatedUser({
      per_page: 100,
    });

    return data.map(org => ({
      id: org.id,
      login: org.login,
      description: org.description,
      avatarUrl: org.avatar_url,
    }));
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapRepository = (repo: any): GitHubRepository => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: {
      login: repo.owner.login,
      type: repo.owner.type,
      avatarUrl: repo.owner.avatar_url,
    },
    private: repo.private,
    description: repo.description || undefined,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    language: repo.language || undefined,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at || undefined,
  });

  private mapFileTreeEntry = (entry: any): GitHubFileTreeEntry => ({
    path: entry.path,
    mode: entry.type === 'file' ? '100644' : '040000',
    type: entry.type === 'file' ? 'blob' : 'tree',
    sha: entry.sha,
    size: entry.size,
    url: entry.url,
  });

  private mapPullRequest = (pr: any): GitHubPullRequest => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? 'merged' : pr.state,
    body: pr.body || undefined,
    htmlUrl: pr.html_url,
    user: {
      login: pr.user.login,
      avatarUrl: pr.user.avatar_url,
    },
    head: {
      ref: pr.head.ref,
      sha: pr.head.sha,
    },
    base: {
      ref: pr.base.ref,
      sha: pr.base.sha,
    },
    draft: pr.draft || false,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changedFiles: pr.changed_files || 0,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.closed_at || undefined,
    mergedAt: pr.merged_at || undefined,
  });
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a GitHubService for a specific user.
 * 
 * Token resolution order:
 * 1. User's OAuth token from Redis (stored at GitHub OAuth sign-in)
 * 2. Shared GITHUB_TOKEN PAT from env (fallback for Keycloak/credentials users)
 * 
 * Returns null only if no token is available at all.
 */
export async function createGitHubServiceForUser(
  userId: string,
  organizationId?: string
): Promise<GitHubService | null> {
  let organization = process.env.GITHUB_ORGANIZATION || '';

  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const credentialId = settings?.github?.credentialId as string | undefined;
    const orgCreds = await getCredentials<GitHubCredentials>(organizationId, 'GITHUB', {
      credentialId,
    });
    if (orgCreds?.organization) {
      organization = orgCreds.organization;
    }
    if (orgCreds?.token && organization) {
      return new GitHubService(orgCreds.token, organization);
    }
  }

  if (!organization) {
    logger.error('GITHUB_ORGANIZATION environment variable is not set');
    throw new Error('GitHub integration is not configured. GITHUB_ORGANIZATION is required.');
  }

  const userToken = await githubTokens.get(userId);
  if (userToken) {
    return new GitHubService(userToken.accessToken, organization);
  }

  const sharedToken = process.env.GITHUB_TOKEN;
  if (sharedToken) {
    logger.info({ userId }, 'Using shared GITHUB_TOKEN PAT (user has no OAuth token)');
    return new GitHubService(sharedToken, organization);
  }

  logger.warn({ userId }, 'No GitHub token found for user and no GITHUB_TOKEN PAT configured');
  return null;
}

export function createGitHubServiceWithToken(token: string): GitHubService {
  const organization = process.env.GITHUB_ORGANIZATION;
  if (!organization) {
    throw new Error('GitHub integration is not configured. GITHUB_ORGANIZATION is required.');
  }
  return new GitHubService(token, organization);
}
