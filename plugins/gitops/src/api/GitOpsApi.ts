import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

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
 */
export class GitOpsApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('gitops');
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
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
}
