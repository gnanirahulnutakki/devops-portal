import { Octokit } from '@octokit/rest';
import { GitHubError } from '../errors';
/**
 * GitHubService
 *
 * Handles all GitHub API operations for the GitOps portal
 * Includes mock data mode for development without GitHub token
 */
export class GitHubService {
    constructor(config) {
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
                    onRateLimit: (retryAfter, options) => {
                        console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
                        return true;
                    },
                    onSecondaryRateLimit: (retryAfter, options) => {
                        console.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`);
                        return true;
                    },
                },
            });
        }
        else {
            console.log(`[GitHubService] Using mock data mode ${forceMockMode ? '(forced by GITHUB_USE_MOCK_DATA)' : '(no token provided)'}`);
        }
    }
    /**
     * List repositories in the organization
     */
    async listRepositories(filter) {
        if (this.useMockData) {
            return this.getMockRepositories(filter);
        }
        try {
            const { data } = await this.octokit.repos.listForOrg({
                org: this.config.organization,
                per_page: 100,
            });
            let repos = data;
            if (filter) {
                repos = repos.filter(repo => repo.name.toLowerCase().includes(filter.toLowerCase()));
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
        }
        catch (error) {
            throw new GitHubError(`Failed to list repositories: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * List branches for a repository
     */
    async listBranches(repository, filter) {
        if (this.useMockData) {
            return this.getMockBranches(repository, filter);
        }
        try {
            const { data } = await this.octokit.repos.listBranches({
                owner: this.config.organization,
                repo: repository,
                per_page: 100,
            });
            let branches = data;
            if (filter) {
                branches = branches.filter(branch => branch.name.toLowerCase().includes(filter.toLowerCase()));
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
        catch (error) {
            throw new GitHubError(`Failed to list branches for ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Get file tree for a repository branch
     */
    async getFileTree(repository, branch, path = '') {
        if (this.useMockData) {
            return this.getMockFileTree(repository, branch, path);
        }
        try {
            const { data } = await this.octokit.repos.getContent({
                owner: this.config.organization,
                repo: repository,
                path: path,
                ref: branch,
            });
            if (!Array.isArray(data)) {
                return [data];
            }
            return data.map(entry => ({
                path: entry.path,
                mode: entry.type === 'file' ? '100644' : '040000',
                type: entry.type === 'file' ? 'blob' : 'tree',
                sha: entry.sha,
                size: entry.size,
                url: entry.url,
            }));
        }
        catch (error) {
            throw new GitHubError(`Failed to get file tree for ${repository}/${branch}/${path}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Get file content
     */
    async getFileContent(repository, branch, path) {
        if (this.useMockData) {
            return this.getMockFileContent(repository, branch, path);
        }
        try {
            const { data } = await this.octokit.repos.getContent({
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
                encoding: data.encoding,
                download_url: data.download_url || undefined,
            };
        }
        catch (error) {
            throw new GitHubError(`Failed to get file content for ${repository}/${branch}/${path}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Update file content and commit
     */
    async updateFile(request) {
        if (this.useMockData) {
            return this.getMockUpdateFileResponse(request);
        }
        try {
            const { data } = await this.octokit.repos.createOrUpdateFileContents({
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
                    name: data.content.name,
                    path: data.content.path,
                    sha: data.content.sha,
                    size: data.content.size,
                    url: data.content.url,
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
        }
        catch (error) {
            throw new GitHubError(`Failed to update file ${request.path} in ${request.repository}/${request.branch}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Compare two branches and get diff
     */
    async compareBranches(repository, base, head) {
        if (this.useMockData) {
            return this.getMockComparison(repository, base, head);
        }
        try {
            const { data } = await this.octokit.repos.compareCommits({
                owner: this.config.organization,
                repo: repository,
                base: base,
                head: head,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to compare branches ${base}...${head} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Create a pull request
     */
    async createPullRequest(repository, title, head, base, body) {
        if (this.useMockData) {
            return this.getMockPullRequest(repository, title, head, base, body);
        }
        try {
            const { data } = await this.octokit.pulls.create({
                owner: this.config.organization,
                repo: repository,
                title: title,
                body: body || '',
                head: head,
                base: base,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to create pull request in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * List pull requests
     */
    async listPullRequests(repository, state = 'open', sort = 'created', direction = 'desc') {
        if (this.useMockData) {
            return this.getMockPullRequests(repository, state);
        }
        try {
            const { data } = await this.octokit.pulls.list({
                owner: this.config.organization,
                repo: repository,
                state: state,
                sort: sort,
                direction: direction,
                per_page: 100,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to list pull requests for ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Get pull request details
     */
    async getPullRequest(repository, pullNumber) {
        if (this.useMockData) {
            return this.getMockPullRequestDetails(repository, pullNumber);
        }
        try {
            const { data } = await this.octokit.pulls.get({
                owner: this.config.organization,
                repo: repository,
                pull_number: pullNumber,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to get pull request #${pullNumber} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Get files changed in a pull request
     */
    async getPullRequestFiles(repository, pullNumber) {
        if (this.useMockData) {
            return this.getMockPullRequestFiles(repository, pullNumber);
        }
        try {
            const { data } = await this.octokit.pulls.listFiles({
                owner: this.config.organization,
                repo: repository,
                pull_number: pullNumber,
                per_page: 100,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to get files for pull request #${pullNumber} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Merge a pull request
     */
    async mergePullRequest(repository, pullNumber, commitTitle, commitMessage, mergeMethod = 'merge') {
        if (this.useMockData) {
            return this.getMockMergeResult(repository, pullNumber);
        }
        try {
            const { data } = await this.octokit.pulls.merge({
                owner: this.config.organization,
                repo: repository,
                pull_number: pullNumber,
                commit_title: commitTitle,
                commit_message: commitMessage,
                merge_method: mergeMethod,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to merge pull request #${pullNumber} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Add reviewers to a pull request
     */
    async addReviewers(repository, pullNumber, reviewers, teamReviewers) {
        if (this.useMockData) {
            return this.getMockAddReviewersResult(repository, pullNumber, reviewers);
        }
        try {
            const { data } = await this.octokit.pulls.requestReviewers({
                owner: this.config.organization,
                repo: repository,
                pull_number: pullNumber,
                reviewers: reviewers,
                team_reviewers: teamReviewers,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to add reviewers to pull request #${pullNumber} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    /**
     * Assign pull request to users
     */
    async assignPullRequest(repository, pullNumber, assignees) {
        if (this.useMockData) {
            return this.getMockAssignResult(repository, pullNumber, assignees);
        }
        try {
            const { data } = await this.octokit.issues.addAssignees({
                owner: this.config.organization,
                repo: repository,
                issue_number: pullNumber,
                assignees: assignees,
            });
            return data;
        }
        catch (error) {
            throw new GitHubError(`Failed to assign pull request #${pullNumber} in ${repository}: ${error.message}`, error.status || 500, error);
        }
    }
    // ==========================================================================
    // Mock Data Methods (for development without GitHub token)
    // ==========================================================================
    getMockRepositories(filter) {
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
            return repos.filter(repo => repo.name.toLowerCase().includes(filter.toLowerCase()));
        }
        return repos;
    }
    getMockBranches(repository, filter) {
        if (repository === 'rli-use2') {
            // Mock rli-use2 branches based on production analysis
            const branches = [
                {
                    name: 'master',
                    commit: { sha: 'abc123def456', url: 'https://github.com/...' },
                    protected: true,
                },
                // 39 tenant branches from production
                ...['mp02', 'mp04', 'mp06', 'mp08', 'jb01', 'jb02', 'dant', 'idoga', 'eoc', 'sdc'].map(tenant => ({
                    name: `rli-use2-${tenant}`,
                    commit: { sha: `sha${tenant}`, url: 'https://github.com/...' },
                    protected: false,
                })),
            ];
            if (filter) {
                return branches.filter(branch => branch.name.toLowerCase().includes(filter.toLowerCase()));
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
    getMockFileTree(repository, branch, path) {
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
                type: 'tree',
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
    getMockFileContent(repository, branch, path) {
        let content;
        let fileName;
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
        }
        else if (path === 'app/charts/radiantone/Chart.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/deployment.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/service.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/configmap.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/secret.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/ingress.yaml') {
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
        }
        else if (path === 'app/charts/radiantone/templates/serviceaccount.yaml') {
            fileName = 'serviceaccount.yaml';
            content = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "radiantone.fullname" . }}
  labels:
    {{- include "radiantone.labels" . | nindent 4 }}
`;
        }
        else {
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
    getMockUpdateFileResponse(request) {
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
    getMockComparison(repository, base, head) {
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
    getMockPullRequest(repository, title, head, base, body) {
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
    getMockPullRequests(repository, state) {
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
        }
        else if (state === 'closed') {
            return [];
        }
        return prs;
    }
    getMockPullRequestDetails(repository, pullNumber) {
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
    getMockPullRequestFiles(repository, pullNumber) {
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
    getMockMergeResult(repository, pullNumber) {
        return {
            sha: 'merge-commit-sha-' + Date.now(),
            merged: true,
            message: 'Pull Request successfully merged',
        };
    }
    getMockAddReviewersResult(repository, pullNumber, reviewers) {
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
    getMockAssignResult(repository, pullNumber, assignees) {
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
}
//# sourceMappingURL=GitHubService.js.map