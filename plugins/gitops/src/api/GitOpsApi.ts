import { createApiRef, DiscoveryApi, FetchApi, OAuthApi } from '@backstage/core-plugin-api';

/**
 * GitOps API Reference
 */
export const gitOpsApiRef = createApiRef<GitOpsApi>({
  id: 'plugin.gitops.service',
});

/**
 * Types
 */
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  default_branch: string;
}

export interface Branch {
  name: string;
  protected: boolean;
}

export interface FileTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export interface FileContent {
  content: string;
  sha: string;
  path: string;
  branch: string;
  size: number;
  name: string;
}

export interface UpdateFileRequest {
  branches: string[];
  path: string;
  content?: string; // Optional for field-level updates
  message: string;
  // Field-level editing support
  fieldPath?: string; // YAML path in dot notation (e.g., 'fid.image.tag')
  fieldValue?: string; // New value for the field
}

export interface BulkOperation {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  total_targets: number;
  successful_count: number;
  failed_count: number;
  progress_percentage: number;
  results?: Array<{
    branch: string;
    status: string;
    commit_sha?: string;
    error?: string;
  }>;
}

export interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    source: {
      targetRevision: string;
      path: string;
    };
    destination: {
      namespace: string;
    };
  };
  status: {
    sync: {
      status: string;
    };
    health: {
      status: string;
    };
  };
}

/**
 * GitOps API Client
 *
 * Uses the user's GitHub OAuth token for API calls when available.
 * This enables user-scoped access to repositories based on their GitHub permissions.
 * 
 * Authentication Flow:
 * 1. User logs in via GitHub OAuth in Backstage
 * 2. Backstage stores the OAuth token
 * 3. This API retrieves the token via githubAuthApi.getAccessToken()
 * 4. Token is sent to backend via x-github-token header
 * 5. Backend uses token for GitHub API calls (user sees only repos they have access to)
 */
export class GitOpsApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly githubAuthApi?: OAuthApi;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    githubAuthApi?: OAuthApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.githubAuthApi = options.githubAuthApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('gitops');
  }

  /**
   * Get the user's GitHub OAuth token if available.
   * Uses caching to avoid repeated token requests.
   * 
   * Required OAuth scopes:
   * - repo: Full control of private repositories
   * - read:org: Read org and team membership  
   * - workflow: Update GitHub Actions workflows
   * - user: Read user profile data
   */
  private async getGitHubToken(): Promise<string | undefined> {
    if (!this.githubAuthApi) {
      console.debug('[GitOpsApi] No githubAuthApi available - user not logged in with GitHub');
      return undefined;
    }

    // Check cache (tokens are typically valid for 1 hour)
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiry > now) {
      return this.cachedToken;
    }

    try {
      // Request scopes needed for GitOps operations
      const token = await this.githubAuthApi.getAccessToken([
        'repo',
        'read:org', 
        'workflow',
        'user',
        'read:user',
      ]);
      
      if (token) {
        // Cache for 50 minutes (tokens are typically valid for 1 hour)
        this.cachedToken = token;
        this.tokenExpiry = now + (50 * 60 * 1000);
        console.debug('[GitOpsApi] Successfully obtained GitHub OAuth token');
      }
      
      return token;
    } catch (error: any) {
      // This is expected when user hasn't logged in with GitHub
      // or when the OAuth flow hasn't completed yet
      if (error?.message?.includes('not logged in') || 
          error?.message?.includes('No session')) {
        console.debug('[GitOpsApi] User not logged in with GitHub OAuth');
      } else {
        console.warn('[GitOpsApi] Could not get GitHub OAuth token:', error?.message || error);
      }
      return undefined;
    }
  }

  /**
   * Check if the user is authenticated with GitHub
   */
  async isGitHubAuthenticated(): Promise<boolean> {
    const token = await this.getGitHubToken();
    return !!token;
  }

  /**
   * Clear the cached token (useful after logout)
   */
  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.getBaseUrl();

    // Get the user's GitHub OAuth token
    const githubToken = await this.getGitHubToken();

    // Merge headers, adding the GitHub token if available
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    
    if (githubToken) {
      headers.set('x-github-token', githubToken);
      console.debug(`[GitOpsApi] Making request to ${path} with OAuth token`);
    } else {
      console.debug(`[GitOpsApi] Making request to ${path} without OAuth token (using fallback)`);
    }

    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || 
                          errorData.message || 
                          `Request failed with status ${response.status}`;
      
      // Provide more helpful error messages
      if (response.status === 401) {
        if (!githubToken) {
          throw new Error('GitHub authentication required. Please sign in with GitHub.');
        } else {
          throw new Error('GitHub token expired or invalid. Please sign out and sign in again.');
        }
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  // Repository Operations
  async listRepositories(filter?: string): Promise<{ repositories: Repository[]; total: number }> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return this.fetch(`/repositories${params}`);
  }

  async listBranches(repository: string, filter?: string): Promise<{ branches: Branch[]; total: number }> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return this.fetch(`/repositories/${repository}/branches${params}`);
  }

  async getFileTree(repository: string, branch: string, path?: string): Promise<{ entries: FileTreeEntry[]; path: string }> {
    const params = new URLSearchParams({ branch });
    if (path) params.append('path', path);
    return this.fetch(`/repositories/${repository}/tree?${params}`);
  }

  async getFileContent(repository: string, branch: string, path: string): Promise<FileContent> {
    const params = new URLSearchParams({ branch, path });
    return this.fetch(`/repositories/${repository}/content?${params}`);
  }

  async updateFile(repository: string, request: UpdateFileRequest): Promise<{ operation_id: string }> {
    return this.fetch(`/repositories/${repository}/files/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  // Bulk Operations
  async getBulkOperation(operationId: string): Promise<{ operation: BulkOperation }> {
    return this.fetch(`/bulk-operations/${operationId}`);
  }

  async listBulkOperations(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ operations: BulkOperation[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/bulk-operations${query}`);
  }

  // ArgoCD Operations
  async listArgoCDApplications(filter?: string, branch?: string): Promise<{ applications: ArgoCDApplication[]; total: number }> {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (branch) params.append('branch', branch);
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/argocd/applications${query}`);
  }

  async getArgoCDApplication(appName: string): Promise<{ application: ArgoCDApplication }> {
    return this.fetch(`/argocd/applications/${appName}`);
  }

  async syncArgoCDApplications(applications: string[], options?: { prune?: boolean; dryRun?: boolean }): Promise<any> {
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
  async listAuditLogs(filters?: {
    operation?: string;
    repository?: string;
    branch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.operation) params.append('operation', filters.operation);
    if (filters?.repository) params.append('repository', filters.repository);
    if (filters?.branch) params.append('branch', filters.branch);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/audit-logs${query}`);
  }

  // ===========================================================================
  // User-Centric Operations (uses GitHub OAuth token)
  // ===========================================================================

  /**
   * Get the authenticated user's GitHub profile
   */
  async getUserProfile(): Promise<{ user: any }> {
    return this.fetch('/user/profile');
  }

  /**
   * Get repositories the user has access to
   */
  async getUserRepositories(options?: {
    type?: 'all' | 'owner' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    per_page?: number;
    page?: number;
  }): Promise<{ repositories: any[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.sort) params.append('sort', options.sort);
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.page) params.append('page', options.page.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/user/repos${query}`);
  }

  /**
   * Get pull requests involving the user
   */
  async getUserPullRequests(options?: {
    filter?: 'all' | 'created' | 'assigned' | 'review_requested';
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
  }): Promise<{ pullRequests: any[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.filter) params.append('filter', options.filter);
    if (options?.state) params.append('state', options.state);
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/user/pull-requests${query}`);
  }

  /**
   * Get issues involving the user
   */
  async getUserIssues(options?: {
    filter?: 'all' | 'created' | 'assigned';
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
  }): Promise<{ issues: any[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.filter) params.append('filter', options.filter);
    if (options?.state) params.append('state', options.state);
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    const query = params.toString() ? `?${params}` : '';
    return this.fetch(`/user/issues${query}`);
  }

  /**
   * Get organizations the user belongs to
   */
  async getUserOrganizations(): Promise<{ organizations: any[] }> {
    return this.fetch('/user/organizations');
  }

  /**
   * Get the user's dashboard summary
   */
  async getUserDashboard(): Promise<{
    user: any;
    openPullRequests: any[];
    recentIssues: any[];
    repositories: any[];
  }> {
    return this.fetch('/user/dashboard');
  }
}
