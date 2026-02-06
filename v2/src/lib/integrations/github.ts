import { Octokit } from '@octokit/rest';
import { createGitHubClient } from '../http-client';
import { logger } from '../logger';
import { getGitHubToken } from '../redis';

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
    const { data } = await this.octokit.repos.listBranches({
      owner: this.organization,
      repo: repository,
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

  async createBranch(
    repository: string,
    newBranchName: string,
    fromBranch: string
  ): Promise<{ ref: string; sha: string }> {
    const { data: refData } = await this.octokit.git.getRef({
      owner: this.organization,
      repo: repository,
      ref: `heads/${fromBranch}`,
    });

    const { data } = await this.octokit.git.createRef({
      owner: this.organization,
      repo: repository,
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
    const { data } = await this.octokit.repos.getContent({
      owner: this.organization,
      repo: repository,
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
    const { data } = await this.octokit.repos.getContent({
      owner: this.organization,
      repo: repository,
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
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.organization,
      repo: params.repository,
      path: params.path,
      message: params.message,
      content: params.content,
      sha: params.sha,
      branch: params.branch,
      committer: params.committer,
    });

    return {
      sha: data.content!.sha,
      commitSha: data.commit.sha,
      commitUrl: data.commit.url,
    };
  }

  // ---------------------------------------------------------------------------
  // Pull Requests
  // ---------------------------------------------------------------------------

  async listPullRequests(
    repository: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubPullRequest[]> {
    const { data } = await this.octokit.pulls.list({
      owner: this.organization,
      repo: repository,
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
    const { data } = await this.octokit.pulls.get({
      owner: this.organization,
      repo: repository,
      pull_number: pullNumber,
    });

    return this.mapPullRequest(data);
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<GitHubPullRequest> {
    const { data } = await this.octokit.pulls.create({
      owner: this.organization,
      repo: params.repository,
      title: params.title,
      body: params.body || '',
      head: params.head,
      base: params.base,
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
    const { data } = await this.octokit.pulls.merge({
      owner: this.organization,
      repo: repository,
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
    const { data } = await this.octokit.pulls.listFiles({
      owner: this.organization,
      repo: repository,
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
    state: pr.state,
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

export async function createGitHubServiceForUser(userId: string): Promise<GitHubService | null> {
  const token = await getGitHubToken(userId);
  if (!token) {
    logger.warn({ userId }, 'No GitHub token found for user');
    return null;
  }

  const organization = process.env.GITHUB_ORGANIZATION || '';
  return new GitHubService(token.accessToken, organization);
}

export function createGitHubServiceWithToken(token: string): GitHubService {
  const organization = process.env.GITHUB_ORGANIZATION || '';
  return new GitHubService(token, organization);
}
