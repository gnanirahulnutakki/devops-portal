import { createApiRef } from '@backstage/core-plugin-api';
/**
 * GitOps API Reference
 */
export const gitOpsApiRef = createApiRef({
    id: 'plugin.gitops.service',
});
/**
 * GitOps API Client
 *
 * Uses the user's GitHub OAuth token for API calls when available.
 * This enables user-scoped access to repositories based on their GitHub permissions.
 */
export class GitOpsApi {
    constructor(options) {
        this.discoveryApi = options.discoveryApi;
        this.fetchApi = options.fetchApi;
        this.githubAuthApi = options.githubAuthApi;
    }
    async getBaseUrl() {
        return await this.discoveryApi.getBaseUrl('gitops');
    }
    /**
     * Get the user's GitHub OAuth token if available
     * Requests repo, read:org, and workflow scopes for full GitOps functionality
     */
    async getGitHubToken() {
        if (!this.githubAuthApi) {
            return undefined;
        }
        try {
            // Request scopes needed for GitOps operations:
            // - repo: Full control of private repositories
            // - read:org: Read org and team membership
            // - workflow: Update GitHub Actions workflows
            const token = await this.githubAuthApi.getAccessToken(['repo', 'read:org', 'workflow']);
            return token;
        }
        catch (error) {
            // User may not be logged in with GitHub, or may have denied scopes
            console.warn('Could not get GitHub OAuth token:', error);
            return undefined;
        }
    }
    async fetch(path, init) {
        const baseUrl = await this.getBaseUrl();
        // Get the user's GitHub OAuth token
        const githubToken = await this.getGitHubToken();
        // Merge headers, adding the GitHub token if available
        const headers = new Headers(init?.headers);
        if (githubToken) {
            headers.set('x-github-token', githubToken);
        }
        const response = await this.fetchApi.fetch(`${baseUrl}${path}`, {
            ...init,
            headers,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
        }
        return await response.json();
    }
    // Repository Operations
    async listRepositories(filter) {
        const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
        return this.fetch(`/repositories${params}`);
    }
    async listBranches(repository, filter) {
        const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
        return this.fetch(`/repositories/${repository}/branches${params}`);
    }
    async getFileTree(repository, branch, path) {
        const params = new URLSearchParams({ branch });
        if (path)
            params.append('path', path);
        return this.fetch(`/repositories/${repository}/tree?${params}`);
    }
    async getFileContent(repository, branch, path) {
        const params = new URLSearchParams({ branch, path });
        return this.fetch(`/repositories/${repository}/content?${params}`);
    }
    async updateFile(repository, request) {
        return this.fetch(`/repositories/${repository}/files/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
    }
    // Bulk Operations
    async getBulkOperation(operationId) {
        return this.fetch(`/bulk-operations/${operationId}`);
    }
    async listBulkOperations(filters) {
        const params = new URLSearchParams();
        if (filters?.status)
            params.append('status', filters.status);
        if (filters?.limit)
            params.append('limit', filters.limit.toString());
        if (filters?.offset)
            params.append('offset', filters.offset.toString());
        const query = params.toString() ? `?${params}` : '';
        return this.fetch(`/bulk-operations${query}`);
    }
    // ArgoCD Operations
    async listArgoCDApplications(filter, branch) {
        const params = new URLSearchParams();
        if (filter)
            params.append('filter', filter);
        if (branch)
            params.append('branch', branch);
        const query = params.toString() ? `?${params}` : '';
        return this.fetch(`/argocd/applications${query}`);
    }
    async getArgoCDApplication(appName) {
        return this.fetch(`/argocd/applications/${appName}`);
    }
    async syncArgoCDApplications(applications, options) {
        return this.fetch('/argocd/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applications,
                prune: options?.prune || false,
                dryRun: options?.dryRun || false,
            }),
        });
    }
    // Audit Logs
    async listAuditLogs(filters) {
        const params = new URLSearchParams();
        if (filters?.operation)
            params.append('operation', filters.operation);
        if (filters?.repository)
            params.append('repository', filters.repository);
        if (filters?.branch)
            params.append('branch', filters.branch);
        if (filters?.limit)
            params.append('limit', filters.limit.toString());
        if (filters?.offset)
            params.append('offset', filters.offset.toString());
        const query = params.toString() ? `?${params}` : '';
        return this.fetch(`/audit-logs${query}`);
    }
}
//# sourceMappingURL=GitOpsApi.js.map
