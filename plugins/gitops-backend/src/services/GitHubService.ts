import { Octokit } from '@octokit/rest';
import type {
  GitHubRepository,
  GitHubBranch,
  GitHubFileTreeEntry,
  GitHubFileContent,
  GitHubUpdateFileRequest,
  GitHubUpdateFileResponse,
  GitHubServiceConfig,
} from '../types';
import { GitHubError } from '../errors';

/**
 * GitHubService
 *
 * Handles all GitHub API operations for the GitOps portal
 * Includes mock data mode for development without GitHub token
 */
export class GitHubService {
  private octokit?: Octokit;
  private config: GitHubServiceConfig;
  private useMockData: boolean;

  constructor(config: GitHubServiceConfig) {
    this.config = config;

    // Force mock mode if GITHUB_USE_MOCK_DATA environment variable is set
    const forceMockMode = process.env.GITHUB_USE_MOCK_DATA === 'true';
    this.useMockData = forceMockMode || !config.token || config.token === 'your_github_personal_access_token';

    if (!this.useMockData) {
      this.octokit = new Octokit({
        auth: config.token,
        retry: {
          enabled: true,
        },
        throttle: {
          onRateLimit: (retryAfter: number, options: any) => {
            console.warn(
              `Request quota exhausted for request ${options.method} ${options.url}`
            );
            return true;
          },
          onSecondaryRateLimit: (retryAfter: number, options: any) => {
            console.warn(
              `Secondary rate limit hit for request ${options.method} ${options.url}`
            );
            return true;
          },
        },
      });
    } else {
      console.log(`[GitHubService] Using mock data mode ${forceMockMode ? '(forced by GITHUB_USE_MOCK_DATA)' : '(no token provided)'}`);
    }
  }

  /**
   * List repositories in the organization
   */
  async listRepositories(filter?: string): Promise<GitHubRepository[]> {
    if (this.useMockData) {
      return this.getMockRepositories(filter);
    }

    try {
      const { data } = await this.octokit!.repos.listForOrg({
        org: this.config.organization,
        per_page: 100,
      });

      let repos = data;
      if (filter) {
        repos = repos.filter(repo =>
          repo.name.toLowerCase().includes(filter.toLowerCase())
        );
      }

      return repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          type: repo.owner.type,
        },
        private: repo.private,
        description: repo.description || undefined,
        default_branch: repo.default_branch,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
      }));
    } catch (error: any) {
      throw new GitHubError(
        `Failed to list repositories: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * List branches for a repository
   */
  async listBranches(repository: string, filter?: string): Promise<GitHubBranch[]> {
    if (this.useMockData) {
      return this.getMockBranches(repository, filter);
    }

    try {
      const { data } = await this.octokit!.repos.listBranches({
        owner: this.config.organization,
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
    } catch (error: any) {
      throw new GitHubError(
        `Failed to list branches for ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get file tree for a repository branch
   */
  async getFileTree(
    repository: string,
    branch: string,
    path: string = ''
  ): Promise<GitHubFileTreeEntry[]> {
    if (this.useMockData) {
      return this.getMockFileTree(repository, branch, path);
    }

    try {
      const { data } = await this.octokit!.repos.getContent({
        owner: this.config.organization,
        repo: repository,
        path: path,
        ref: branch,
      });

      if (!Array.isArray(data)) {
        return [data as any];
      }

      return data.map(entry => ({
        path: entry.path,
        mode: entry.type === 'file' ? '100644' : '040000',
        type: entry.type === 'file' ? 'blob' : 'tree',
        sha: entry.sha,
        size: entry.size,
        url: entry.url,
      }));
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get file tree for ${repository}/${branch}/${path}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get file content
   */
  async getFileContent(
    repository: string,
    branch: string,
    path: string
  ): Promise<GitHubFileContent> {
    if (this.useMockData) {
      return this.getMockFileContent(repository, branch, path);
    }

    try {
      const { data } = await this.octokit!.repos.getContent({
        owner: this.config.organization,
        repo: repository,
        path: path,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new GitHubError(`Path ${path} is not a file`, 400);
      }

      return {
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        url: data.url,
        content: data.content,
        encoding: data.encoding as 'base64',
        download_url: data.download_url || undefined,
      };
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get file content for ${repository}/${branch}/${path}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Update file content and commit
   */
  async updateFile(
    request: GitHubUpdateFileRequest
  ): Promise<GitHubUpdateFileResponse> {
    if (this.useMockData) {
      return this.getMockUpdateFileResponse(request);
    }

    try {
      const { data } = await this.octokit!.repos.createOrUpdateFileContents({
        owner: this.config.organization,
        repo: request.repository,
        path: request.path,
        message: request.message,
        content: request.content,
        sha: request.sha,
        branch: request.branch,
        committer: request.committer,
      });

      return {
        content: {
          name: data.content!.name,
          path: data.content!.path,
          sha: data.content!.sha,
          size: data.content!.size,
          url: data.content!.url,
          content: '',
          encoding: 'base64',
        },
        commit: {
          sha: data.commit.sha,
          message: data.commit.message,
          author: {
            name: data.commit.author.name,
            email: data.commit.author.email,
            date: data.commit.author.date,
          },
          committer: {
            name: data.commit.committer.name,
            email: data.commit.committer.email,
            date: data.commit.committer.date,
          },
          url: data.commit.url,
        },
      };
    } catch (error: any) {
      throw new GitHubError(
        `Failed to update file ${request.path} in ${request.repository}/${request.branch}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Compare two branches and get diff
   */
  async compareBranches(
    repository: string,
    base: string,
    head: string
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockComparison(repository, base, head);
    }

    try {
      const { data } = await this.octokit!.repos.compareCommits({
        owner: this.config.organization,
        repo: repository,
        base: base,
        head: head,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to compare branches ${base}...${head} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    repository: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockPullRequest(repository, title, head, base, body);
    }

    try {
      const { data } = await this.octokit!.pulls.create({
        owner: this.config.organization,
        repo: repository,
        title: title,
        body: body || '',
        head: head,
        base: base,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to create pull request in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Create a new branch from an existing branch
   */
  async createBranch(
    repository: string,
    newBranchName: string,
    fromBranch: string
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockCreateBranch(repository, newBranchName, fromBranch);
    }

    try {
      // First, get the SHA of the from_branch
      const { data: refData } = await this.octokit!.git.getRef({
        owner: this.config.organization,
        repo: repository,
        ref: `heads/${fromBranch}`,
      });

      const sha = refData.object.sha;

      // Create the new branch
      const { data } = await this.octokit!.git.createRef({
        owner: this.config.organization,
        repo: repository,
        ref: `refs/heads/${newBranchName}`,
        sha: sha,
      });

      return {
        ref: data.ref,
        sha: data.object.sha,
        url: data.url,
      };
    } catch (error: any) {
      throw new GitHubError(
        `Failed to create branch ${newBranchName} from ${fromBranch} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * List pull requests
   */
  async listPullRequests(
    repository: string,
    state: 'open' | 'closed' | 'all' = 'open',
    sort: 'created' | 'updated' | 'popularity' | 'long-running' = 'created',
    direction: 'asc' | 'desc' = 'desc'
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockPullRequests(repository, state);
    }

    try {
      const { data } = await this.octokit!.pulls.list({
        owner: this.config.organization,
        repo: repository,
        state: state,
        sort: sort,
        direction: direction,
        per_page: 100,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to list pull requests for ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get pull request details
   */
  async getPullRequest(
    repository: string,
    pullNumber: number
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockPullRequestDetails(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.pulls.get({
        owner: this.config.organization,
        repo: repository,
        pull_number: pullNumber,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get pull request #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get files changed in a pull request
   */
  async getPullRequestFiles(
    repository: string,
    pullNumber: number
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockPullRequestFiles(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.pulls.listFiles({
        owner: this.config.organization,
        repo: repository,
        pull_number: pullNumber,
        per_page: 100,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get files for pull request #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    repository: string,
    pullNumber: number,
    commitTitle?: string,
    commitMessage?: string,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockMergeResult(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.pulls.merge({
        owner: this.config.organization,
        repo: repository,
        pull_number: pullNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to merge pull request #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Add reviewers to a pull request
   */
  async addReviewers(
    repository: string,
    pullNumber: number,
    reviewers: string[],
    teamReviewers?: string[]
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockAddReviewersResult(repository, pullNumber, reviewers);
    }

    try {
      const { data } = await this.octokit!.pulls.requestReviewers({
        owner: this.config.organization,
        repo: repository,
        pull_number: pullNumber,
        reviewers: reviewers,
        team_reviewers: teamReviewers,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to add reviewers to pull request #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Assign pull request to users
   */
  async assignPullRequest(
    repository: string,
    pullNumber: number,
    assignees: string[]
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockAssignResult(repository, pullNumber, assignees);
    }

    try {
      const { data } = await this.octokit!.issues.addAssignees({
        owner: this.config.organization,
        repo: repository,
        issue_number: pullNumber,
        assignees: assignees,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to assign pull request #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get PR comments
   */
  async getPullRequestComments(
    repository: string,
    pullNumber: number
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockComments(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.issues.listComments({
        owner: this.config.organization,
        repo: repository,
        issue_number: pullNumber,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get comments for PR #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Add comment to PR
   */
  async addPullRequestComment(
    repository: string,
    pullNumber: number,
    body: string
  ): Promise<any> {
    if (this.useMockData) {
      return this.getMockAddComment(repository, pullNumber, body);
    }

    try {
      const { data } = await this.octokit!.issues.createComment({
        owner: this.config.organization,
        repo: repository,
        issue_number: pullNumber,
        body,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to add comment to PR #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get PR status checks
   */
  async getPullRequestStatusChecks(
    repository: string,
    pullNumber: number
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockStatusChecks(repository, pullNumber);
    }

    try {
      // First get the PR to get the head SHA
      const pr = await this.getPullRequest(repository, pullNumber);
      const { data } = await this.octokit!.repos.getCombinedStatusForRef({
        owner: this.config.organization,
        repo: repository,
        ref: pr.head.sha,
      });

      // Also get check runs
      const { data: checkRuns } = await this.octokit!.checks.listForRef({
        owner: this.config.organization,
        repo: repository,
        ref: pr.head.sha,
      });

      // Combine statuses and check runs
      const checks = [
        ...data.statuses.map((status: any) => ({
          id: status.id,
          name: status.context,
          context: status.context,
          state: status.state,
          description: status.description,
          target_url: status.target_url,
          created_at: status.created_at,
          updated_at: status.updated_at,
        })),
        ...checkRuns.check_runs.map((check: any) => ({
          id: check.id,
          name: check.name,
          context: check.name,
          state: check.status === 'completed' ? check.conclusion : check.status,
          description: check.output?.title || check.name,
          target_url: check.html_url,
          created_at: check.started_at,
          updated_at: check.completed_at || check.started_at,
          conclusion: check.conclusion,
        })),
      ];

      return checks;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get status checks for PR #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get PR reviews
   */
  async getPullRequestReviews(
    repository: string,
    pullNumber: number
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockReviews(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.pulls.listReviews({
        owner: this.config.organization,
        repo: repository,
        pull_number: pullNumber,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get reviews for PR #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  /**
   * Get PR timeline events
   */
  async getPullRequestTimeline(
    repository: string,
    pullNumber: number
  ): Promise<any[]> {
    if (this.useMockData) {
      return this.getMockTimeline(repository, pullNumber);
    }

    try {
      const { data } = await this.octokit!.issues.listEventsForTimeline({
        owner: this.config.organization,
        repo: repository,
        issue_number: pullNumber,
      });

      return data;
    } catch (error: any) {
      throw new GitHubError(
        `Failed to get timeline for PR #${pullNumber} in ${repository}: ${error.message}`,
        error.status || 500,
        error
      );
    }
  }

  // ==========================================================================
  // Mock Data Methods (for development without GitHub token)
  // ==========================================================================

  private getMockRepositories(filter?: string): GitHubRepository[] {
    const repos = [
      {
        id: 1,
        name: 'rli-use2',
        full_name: 'radiantlogic-saas/rli-use2',
        owner: { login: 'radiantlogic-saas', type: 'Organization' },
        private: true,
        description: 'Production deployment repository for rli-use2 cluster',
        default_branch: 'master',
        created_at: '2023-01-15T10:00:00Z',
        updated_at: '2025-10-28T12:00:00Z',
        pushed_at: '2025-10-28T11:30:00Z',
      },
      {
        id: 2,
        name: 'ensemble',
        full_name: 'radiantlogic-saas/ensemble',
        owner: { login: 'radiantlogic-saas', type: 'Organization' },
        private: true,
        description: 'Development/test deployment repository',
        default_branch: 'master',
        created_at: '2023-01-10T10:00:00Z',
        updated_at: '2025-10-27T15:00:00Z',
        pushed_at: '2025-10-27T14:30:00Z',
      },
    ];

    if (filter) {
      return repos.filter(repo =>
        repo.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return repos;
  }

  private getMockBranches(repository: string, filter?: string): GitHubBranch[] {
    if (repository === 'rli-use2') {
      // Mock rli-use2 branches based on production analysis
      const branches: GitHubBranch[] = [
        {
          name: 'master',
          commit: { sha: 'abc123def456', url: 'https://github.com/...' },
          protected: true,
        },
        // 39 tenant branches from production
        ...['mp02', 'mp04', 'mp06', 'mp08', 'jb01', 'jb02', 'dant', 'idoga', 'eoc', 'sdc'].map(
          tenant => ({
            name: `rli-use2-${tenant}`,
            commit: { sha: `sha${tenant}`, url: 'https://github.com/...' },
            protected: false,
          })
        ),
      ];

      if (filter) {
        return branches.filter(branch =>
          branch.name.toLowerCase().includes(filter.toLowerCase())
        );
      }

      return branches;
    }

    return [
      {
        name: 'master',
        commit: { sha: 'abc123', url: 'https://github.com/...' },
        protected: true,
      },
    ];
  }

  private getMockFileTree(
    repository: string,
    branch: string,
    path: string
  ): GitHubFileTreeEntry[] {
    // Mock standard rli-use2 structure
    if (path === '' || path === '/') {
      return [
        { path: 'app', mode: '040000', type: 'tree', sha: 'sha1', url: '...' },
        { path: 'README.md', mode: '100644', type: 'blob', sha: 'sha2', size: 1234, url: '...' },
      ];
    }

    if (path === 'app') {
      return [
        { path: 'app/charts', mode: '040000', type: 'tree', sha: 'sha3', url: '...' },
      ];
    }

    if (path === 'app/charts') {
      const charts = ['radiantone', 'igrcanalytics', 'observability'];
      return charts.map(chart => ({
        path: `app/charts/${chart}`,
        mode: '040000',
        type: 'tree' as const,
        sha: `sha-${chart}`,
        url: '...',
      }));
    }

    if (path.startsWith('app/charts/radiantone')) {
      return [
        {
          path: 'app/charts/radiantone/Chart.yaml',
          mode: '100644',
          type: 'blob',
          sha: 'sha-chart',
          size: 500,
          url: '...',
        },
        {
          path: 'app/charts/radiantone/values.yaml',
          mode: '100644',
          type: 'blob',
          sha: 'sha-values',
          size: 2500,
          url: '...',
        },
      ];
    }

    return [];
  }

  private getMockFileContent(
    repository: string,
    branch: string,
    path: string
  ): GitHubFileContent {
    let content: string;
    let fileName: string;

    // Mock values.yaml for radiantone chart
    if (path === 'app/charts/radiantone/values.yaml') {
      fileName = 'values.yaml';
      content = `# RadiantOne FID Configuration
# Branch: ${branch}
# Generated by GitOps Portal (Mock Data)

fid:
  image:
    repository: radiantone/fid
    tag: "8.1.2"  # Actual value (no variable substitution)
  replicaCount: 1
  nodeSelector:
    tenantname: duploservices-${branch}

  service:
    type: ClusterIP
    port: 7070

  persistence:
    enabled: true
    storageClass: gp2
    size: 50Gi

zookeeper:
  replicaCount: 2
  persistence:
    enabled: true
    size: 10Gi

metrics:
  enabled: true
  serviceMonitor:
    enabled: false
`;
    } else if (path === 'app/charts/radiantone/Chart.yaml') {
      fileName = 'Chart.yaml';
      content = `apiVersion: v2
name: radiantone
description: RadiantOne FID Helm Chart
type: application
version: 1.0.0
appVersion: "8.1.2"
maintainers:
  - name: RadiantLogic SaaS Team
    email: saas-team@radiantlogic.com
`;
    } else if (path === 'app/charts/radiantone/templates/deployment.yaml') {
      fileName = 'deployment.yaml';
      content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "radiantone.fullname" . }}
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.fid.replicaCount }}
  selector:
    matchLabels:
      {{- include "radiantone.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "radiantone.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: fid
        image: "{{ .Values.fid.image.repository }}:{{ .Values.fid.image.tag }}"
        ports:
        - containerPort: {{ .Values.fid.service.port }}
        volumeMounts:
        - name: data
          mountPath: /data
      nodeSelector:
        {{- toYaml .Values.fid.nodeSelector | nindent 8 }}
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: {{ include "radiantone.fullname" . }}-data
`;
    } else if (path === 'app/charts/radiantone/templates/service.yaml') {
      fileName = 'service.yaml';
      content = `apiVersion: v1
kind: Service
metadata:
  name: {{ include "radiantone.fullname" . }}
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
spec:
  type: {{ .Values.fid.service.type }}
  ports:
  - port: {{ .Values.fid.service.port }}
    targetPort: {{ .Values.fid.service.port }}
    protocol: TCP
    name: http
  selector:
    {{- include "radiantone.selectorLabels" . | nindent 4 }}
`;
    } else if (path === 'app/charts/radiantone/templates/configmap.yaml') {
      fileName = 'configmap.yaml';
      content = `apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "radiantone.fullname" . }}-config
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
data:
  app.properties: |
    server.port={{ .Values.fid.service.port }}
    metrics.enabled={{ .Values.metrics.enabled }}
`;
    } else if (path === 'app/charts/radiantone/templates/secret.yaml') {
      fileName = 'secret.yaml';
      content = `apiVersion: v1
kind: Secret
metadata:
  name: {{ include "radiantone.fullname" . }}-secret
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
type: Opaque
data:
  # Add your secrets here
  admin-password: {{ .Values.fid.adminPassword | b64enc | quote }}
`;
    } else if (path === 'app/charts/radiantone/templates/ingress.yaml') {
      fileName = 'ingress.yaml';
      content = `{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "radiantone.fullname" . }}
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
  - host: {{ .Values.ingress.host }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{ include "radiantone.fullname" . }}
            port:
              number: {{ .Values.fid.service.port }}
{{- end }}
`;
    } else if (path === 'app/charts/radiantone/templates/serviceaccount.yaml') {
      fileName = 'serviceaccount.yaml';
      content = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "radiantone.fullname" . }}
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
`;
    } else {
      // Default mock content for unknown files
      fileName = path.split('/').pop() || 'unknown';
      content = `# Mock file content for: ${path}
# Branch: ${branch}
# This is a placeholder for ${fileName}
`;
    }

    return {
      name: fileName,
      path: path,
      sha: 'mock-sha-' + Date.now(),
      size: content.length,
      url: 'https://github.com/...',
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    };
  }

  private getMockUpdateFileResponse(
    request: GitHubUpdateFileRequest
  ): GitHubUpdateFileResponse {
    return {
      content: {
        name: request.path.split('/').pop() || 'file',
        path: request.path,
        sha: 'new-mock-sha-' + Date.now(),
        size: Buffer.from(request.content, 'base64').length,
        url: 'https://github.com/...',
        content: request.content,
        encoding: 'base64',
      },
      commit: {
        sha: 'commit-sha-' + Date.now(),
        message: request.message,
        author: {
          name: request.committer?.name || 'Mock User',
          email: request.committer?.email || 'mock@example.com',
          date: new Date().toISOString(),
        },
        committer: {
          name: request.committer?.name || 'Mock User',
          email: request.committer?.email || 'mock@example.com',
          date: new Date().toISOString(),
        },
        url: 'https://github.com/...',
      },
    };
  }

  private getMockComparison(repository: string, base: string, head: string): any {
    return {
      status: 'ahead',
      ahead_by: 2,
      behind_by: 0,
      total_commits: 2,
      commits: [
        {
          sha: 'abc123',
          commit: {
            message: `Update values.yaml in ${head}`,
            author: { name: 'Mock User', email: 'mock@example.com', date: new Date().toISOString() },
          },
        },
      ],
      files: [
        {
          sha: 'file123',
          filename: 'app/charts/radiantone/values.yaml',
          status: 'modified',
          additions: 3,
          deletions: 1,
          changes: 4,
          patch: `@@ -1,5 +1,5 @@\n fid:\n   image:\n     repository: radiantone/fid\n-    tag: "8.1.1"\n+    tag: "8.1.2"\n   replicaCount: 1`,
        },
      ],
    };
  }

  private getMockPullRequest(repository: string, title: string, head: string, base: string, body?: string): any {
    return {
      id: Date.now(),
      number: Math.floor(Math.random() * 1000) + 1,
      state: 'open',
      title: title,
      body: body || '',
      user: { login: 'mock-user', avatar_url: 'https://github.com/identicons/mock-user.png' },
      head: { ref: head, sha: 'head-sha-123' },
      base: { ref: base, sha: 'base-sha-456' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${this.config.organization}/${repository}/pull/1`,
      mergeable: true,
      mergeable_state: 'clean',
      merged: false,
    };
  }

  private getMockCreateBranch(repository: string, newBranchName: string, fromBranch: string): any {
    console.log(`[GitHubService] Mock: Creating branch "${newBranchName}" from "${fromBranch}" in ${repository}`);
    return {
      ref: `refs/heads/${newBranchName}`,
      sha: `mock-sha-${Date.now()}`,
      url: `https://api.github.com/repos/${this.config.organization}/${repository}/git/refs/heads/${newBranchName}`,
    };
  }

  private getMockPullRequests(repository: string, state: string): any[] {
    const prs = [
      {
        id: 1,
        number: 42,
        state: 'open',
        title: 'Update FID version to 8.1.2',
        body: 'Updating FID version across tenant branches',
        user: { login: 'developer1', avatar_url: 'https://github.com/identicons/dev1.png' },
        head: { ref: 'feature/update-fid-version', sha: 'head123' },
        base: { ref: 'master', sha: 'base456' },
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        html_url: `https://github.com/${this.config.organization}/${repository}/pull/42`,
        additions: 10,
        deletions: 2,
        changed_files: 3,
      },
      {
        id: 2,
        number: 41,
        state: 'open',
        title: 'Fix nodeSelector configuration',
        body: 'Fixing tenant-specific node selector values',
        user: { login: 'developer2', avatar_url: 'https://github.com/identicons/dev2.png' },
        head: { ref: 'fix/node-selector', sha: 'head789' },
        base: { ref: 'master', sha: 'base456' },
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        html_url: `https://github.com/${this.config.organization}/${repository}/pull/41`,
        additions: 5,
        deletions: 5,
        changed_files: 2,
      },
    ];

    if (state === 'open') {
      return prs.filter(pr => pr.state === 'open');
    } else if (state === 'closed') {
      return [];
    }
    return prs;
  }

  private getMockPullRequestDetails(repository: string, pullNumber: number): any {
    return {
      id: pullNumber,
      number: pullNumber,
      state: 'open',
      title: 'Update FID version to 8.1.2',
      body: 'This PR updates the FID version across all tenant branches.\n\n## Changes\n- Updated fid.image.tag to 8.1.2\n- Updated Chart version\n\n## Testing\n- Tested in dev environment\n- All health checks passing',
      user: { login: 'developer1', avatar_url: 'https://github.com/identicons/dev1.png' },
      head: { ref: 'feature/update-fid-version', sha: 'head123', repo: { name: repository, full_name: `${this.config.organization}/${repository}` } },
      base: { ref: 'master', sha: 'base456', repo: { name: repository, full_name: `${this.config.organization}/${repository}` } },
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      merged_at: null,
      merge_commit_sha: null,
      mergeable: true,
      mergeable_state: 'clean',
      merged: false,
      merged_by: null,
      comments: 2,
      commits: 3,
      additions: 10,
      deletions: 2,
      changed_files: 3,
      assignees: [],
      requested_reviewers: [],
      labels: [],
      html_url: `https://github.com/${this.config.organization}/${repository}/pull/${pullNumber}`,
    };
  }

  private getMockPullRequestFiles(repository: string, pullNumber: number): any[] {
    return [
      {
        sha: 'file1-sha',
        filename: 'app/charts/radiantone/values.yaml',
        status: 'modified',
        additions: 3,
        deletions: 1,
        changes: 4,
        patch: `@@ -1,10 +1,10 @@\n fid:\n   image:\n     repository: radiantone/fid\n-    tag: "8.1.1"\n+    tag: "8.1.2"\n   replicaCount: 1\n   nodeSelector:\n     tenantname: duploservices-rli-use2-mp02`,
      },
      {
        sha: 'file2-sha',
        filename: 'app/charts/radiantone/Chart.yaml',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: `@@ -3,5 +3,5 @@\n description: RadiantOne FID Helm Chart\n type: application\n-version: 1.0.0\n+version: 1.0.1\n appVersion: "8.1.2"`,
      },
    ];
  }

  private getMockMergeResult(repository: string, pullNumber: number): any {
    return {
      sha: 'merge-commit-sha-' + Date.now(),
      merged: true,
      message: 'Pull Request successfully merged',
    };
  }

  private getMockAddReviewersResult(repository: string, pullNumber: number, reviewers: string[]): any {
    return {
      number: pullNumber,
      requested_reviewers: reviewers.map(login => ({
        login,
        id: Date.now(),
        avatar_url: `https://github.com/identicons/${login}.png`,
        type: 'User',
      })),
    };
  }

  private getMockAssignResult(repository: string, pullNumber: number, assignees: string[]): any {
    return {
      number: pullNumber,
      assignees: assignees.map(login => ({
        login,
        id: Date.now(),
        avatar_url: `https://github.com/identicons/${login}.png`,
        type: 'User',
      })),
    };
  }

  private getMockComments(repository: string, pullNumber: number): any[] {
    return [
      {
        id: 1,
        user: {
          login: 'developer1',
          avatar_url: 'https://github.com/identicons/dev1.png',
        },
        body: 'Looks good to me! 👍',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        html_url: `https://github.com/${this.config.organization}/${repository}/pull/${pullNumber}#issuecomment-1`,
      },
      {
        id: 2,
        user: {
          login: 'reviewer1',
          avatar_url: 'https://github.com/identicons/reviewer1.png',
        },
        body: 'Could you also update the documentation for this change?',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
        html_url: `https://github.com/${this.config.organization}/${repository}/pull/${pullNumber}#issuecomment-2`,
      },
    ];
  }

  private getMockAddComment(repository: string, pullNumber: number, body: string): any {
    return {
      id: Date.now(),
      user: {
        login: 'current-user',
        avatar_url: 'https://github.com/identicons/current-user.png',
      },
      body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${this.config.organization}/${repository}/pull/${pullNumber}#issuecomment-${Date.now()}`,
    };
  }

  private getMockStatusChecks(repository: string, pullNumber: number): any[] {
    return [
      {
        id: 1,
        name: 'CI / Build',
        context: 'continuous-integration/jenkins/pr-merge',
        state: 'success',
        description: 'Build passed',
        target_url: 'https://jenkins.example.com/job/build/123',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        name: 'Tests',
        context: 'continuous-integration/jenkins/tests',
        state: 'success',
        description: 'All tests passed',
        target_url: 'https://jenkins.example.com/job/tests/123',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 3,
        name: 'Code Quality',
        context: 'sonarcloud',
        state: 'pending',
        description: 'Code quality analysis in progress',
        target_url: 'https://sonarcloud.io/dashboard?id=project',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        updated_at: new Date(Date.now() - 900000).toISOString(),
      },
    ];
  }

  private getMockReviews(repository: string, pullNumber: number): any[] {
    return [
      {
        id: 1,
        user: {
          login: 'reviewer1',
          avatar_url: 'https://github.com/identicons/reviewer1.png',
        },
        state: 'APPROVED',
        body: 'Great work! Changes look good.',
        submitted_at: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 2,
        user: {
          login: 'reviewer2',
          avatar_url: 'https://github.com/identicons/reviewer2.png',
        },
        state: 'COMMENTED',
        body: 'Just a few minor suggestions.',
        submitted_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }

  private getMockTimeline(repository: string, pullNumber: number): any[] {
    return [
      {
        id: '1',
        type: 'commit',
        user: {
          login: 'developer1',
          avatar_url: 'https://github.com/identicons/dev1.png',
        },
        created_at: new Date(Date.now() - 86400000).toISOString(),
        message: 'Update FID version to 8.1.2',
        commit_id: 'abc123',
      },
      {
        id: '2',
        type: 'comment',
        user: {
          login: 'reviewer1',
          avatar_url: 'https://github.com/identicons/reviewer1.png',
        },
        created_at: new Date(Date.now() - 72000000).toISOString(),
        message: 'Looks good to me!',
      },
      {
        id: '3',
        type: 'review',
        user: {
          login: 'reviewer1',
          avatar_url: 'https://github.com/identicons/reviewer1.png',
        },
        created_at: new Date(Date.now() - 5400000).toISOString(),
        state: 'approved',
      },
      {
        id: '4',
        type: 'commit',
        user: {
          login: 'developer1',
          avatar_url: 'https://github.com/identicons/dev1.png',
        },
        created_at: new Date(Date.now() - 3600000).toISOString(),
        message: 'Address review comments',
        commit_id: 'def456',
      },
    ];
  }
}
