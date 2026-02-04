/**
 * GitLabService - GitLab API integration for GitOps operations
 * 
 * Supports both GitLab.com and self-hosted GitLab instances.
 * Can use either static token or user OAuth token.
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface GitLabServiceConfig {
  baseUrl?: string; // Default: https://gitlab.com
  token?: string;
  timeout?: number;
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  description?: string;
  default_branch: string;
  visibility: string;
  web_url: string;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  created_at: string;
  last_activity_at: string;
}

export interface GitLabBranch {
  name: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
    author_name: string;
    authored_date: string;
  };
  protected: boolean;
  default: boolean;
}

export interface GitLabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description?: string;
  state: 'opened' | 'closed' | 'merged';
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export class GitLabService {
  private client: AxiosInstance;
  private baseUrl: string;
  private token?: string;

  constructor(config: GitLabServiceConfig) {
    this.baseUrl = config.baseUrl || 'https://gitlab.com';
    this.token = config.token;

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v4`,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { 'PRIVATE-TOKEN': config.token }),
      },
    });

    logger.info('[GitLabService] Initialized', { 
      baseUrl: this.baseUrl,
      hasToken: !!config.token 
    });
  }

  /**
   * Create a new instance with a different token (e.g., user's OAuth token)
   */
  withToken(token: string): GitLabService {
    return new GitLabService({
      baseUrl: this.baseUrl,
      token,
    });
  }

  /**
   * List projects accessible to the user
   */
  async listProjects(options?: {
    membership?: boolean;
    search?: string;
    perPage?: number;
    page?: number;
  }): Promise<GitLabProject[]> {
    const params: Record<string, any> = {
      per_page: options?.perPage || 20,
      page: options?.page || 1,
      order_by: 'last_activity_at',
      sort: 'desc',
    };

    if (options?.membership !== false) {
      params.membership = true;
    }
    if (options?.search) {
      params.search = options.search;
    }

    const response = await this.client.get('/projects', { params });
    return response.data;
  }

  /**
   * Get a specific project by ID or path
   */
  async getProject(projectId: string | number): Promise<GitLabProject> {
    const encodedId = encodeURIComponent(String(projectId));
    const response = await this.client.get(`/projects/${encodedId}`);
    return response.data;
  }

  /**
   * List branches for a project
   */
  async listBranches(projectId: string | number): Promise<GitLabBranch[]> {
    const encodedId = encodeURIComponent(String(projectId));
    const response = await this.client.get(`/projects/${encodedId}/repository/branches`);
    return response.data;
  }

  /**
   * Get repository tree (file/folder listing)
   */
  async getTree(
    projectId: string | number,
    options?: {
      ref?: string;
      path?: string;
      recursive?: boolean;
    }
  ): Promise<GitLabTreeItem[]> {
    const encodedId = encodeURIComponent(String(projectId));
    const params: Record<string, any> = {};
    
    if (options?.ref) params.ref = options.ref;
    if (options?.path) params.path = options.path;
    if (options?.recursive) params.recursive = true;

    const response = await this.client.get(`/projects/${encodedId}/repository/tree`, { params });
    return response.data;
  }

  /**
   * Get file content
   */
  async getFile(
    projectId: string | number,
    filePath: string,
    ref?: string
  ): Promise<GitLabFile> {
    const encodedId = encodeURIComponent(String(projectId));
    const encodedPath = encodeURIComponent(filePath);
    const params = ref ? { ref } : {};

    const response = await this.client.get(
      `/projects/${encodedId}/repository/files/${encodedPath}`,
      { params }
    );
    return response.data;
  }

  /**
   * Get raw file content
   */
  async getRawFile(
    projectId: string | number,
    filePath: string,
    ref?: string
  ): Promise<string> {
    const encodedId = encodeURIComponent(String(projectId));
    const encodedPath = encodeURIComponent(filePath);
    const params = ref ? { ref } : {};

    const response = await this.client.get(
      `/projects/${encodedId}/repository/files/${encodedPath}/raw`,
      { params, responseType: 'text' }
    );
    return response.data;
  }

  /**
   * Create or update a file
   */
  async updateFile(
    projectId: string | number,
    filePath: string,
    content: string,
    options: {
      branch: string;
      commitMessage: string;
      authorEmail?: string;
      authorName?: string;
    }
  ): Promise<GitLabCommit> {
    const encodedId = encodeURIComponent(String(projectId));
    const encodedPath = encodeURIComponent(filePath);

    // Check if file exists
    let fileExists = false;
    try {
      await this.getFile(projectId, filePath, options.branch);
      fileExists = true;
    } catch (error) {
      fileExists = false;
    }

    const payload = {
      branch: options.branch,
      content,
      commit_message: options.commitMessage,
      ...(options.authorEmail && { author_email: options.authorEmail }),
      ...(options.authorName && { author_name: options.authorName }),
    };

    const method = fileExists ? 'put' : 'post';
    const response = await this.client[method](
      `/projects/${encodedId}/repository/files/${encodedPath}`,
      payload
    );
    return response.data;
  }

  /**
   * Delete a file
   */
  async deleteFile(
    projectId: string | number,
    filePath: string,
    options: {
      branch: string;
      commitMessage: string;
    }
  ): Promise<void> {
    const encodedId = encodeURIComponent(String(projectId));
    const encodedPath = encodeURIComponent(filePath);

    await this.client.delete(
      `/projects/${encodedId}/repository/files/${encodedPath}`,
      {
        data: {
          branch: options.branch,
          commit_message: options.commitMessage,
        },
      }
    );
  }

  /**
   * List merge requests
   */
  async listMergeRequests(
    projectId: string | number,
    options?: {
      state?: 'opened' | 'closed' | 'merged' | 'all';
      perPage?: number;
    }
  ): Promise<GitLabMergeRequest[]> {
    const encodedId = encodeURIComponent(String(projectId));
    const params: Record<string, any> = {
      per_page: options?.perPage || 20,
    };
    if (options?.state) params.state = options.state;

    const response = await this.client.get(`/projects/${encodedId}/merge_requests`, { params });
    return response.data;
  }

  /**
   * Create a merge request
   */
  async createMergeRequest(
    projectId: string | number,
    options: {
      sourceBranch: string;
      targetBranch: string;
      title: string;
      description?: string;
      removeSourceBranch?: boolean;
    }
  ): Promise<GitLabMergeRequest> {
    const encodedId = encodeURIComponent(String(projectId));

    const response = await this.client.post(`/projects/${encodedId}/merge_requests`, {
      source_branch: options.sourceBranch,
      target_branch: options.targetBranch,
      title: options.title,
      description: options.description,
      remove_source_branch: options.removeSourceBranch ?? true,
    });
    return response.data;
  }

  /**
   * Accept/merge a merge request
   */
  async acceptMergeRequest(
    projectId: string | number,
    mergeRequestIid: number,
    options?: {
      mergeCommitMessage?: string;
      squash?: boolean;
      shouldRemoveSourceBranch?: boolean;
    }
  ): Promise<GitLabMergeRequest> {
    const encodedId = encodeURIComponent(String(projectId));

    const response = await this.client.put(
      `/projects/${encodedId}/merge_requests/${mergeRequestIid}/merge`,
      {
        merge_commit_message: options?.mergeCommitMessage,
        squash: options?.squash,
        should_remove_source_branch: options?.shouldRemoveSourceBranch,
      }
    );
    return response.data;
  }

  /**
   * List pipelines
   */
  async listPipelines(
    projectId: string | number,
    options?: {
      ref?: string;
      status?: string;
      perPage?: number;
    }
  ): Promise<GitLabPipeline[]> {
    const encodedId = encodeURIComponent(String(projectId));
    const params: Record<string, any> = {
      per_page: options?.perPage || 20,
    };
    if (options?.ref) params.ref = options.ref;
    if (options?.status) params.status = options.status;

    const response = await this.client.get(`/projects/${encodedId}/pipelines`, { params });
    return response.data;
  }

  /**
   * Trigger a new pipeline
   */
  async triggerPipeline(
    projectId: string | number,
    ref: string,
    variables?: Record<string, string>
  ): Promise<GitLabPipeline> {
    const encodedId = encodeURIComponent(String(projectId));

    const response = await this.client.post(`/projects/${encodedId}/pipeline`, {
      ref,
      variables: variables
        ? Object.entries(variables).map(([key, value]) => ({ key, value }))
        : undefined,
    });
    return response.data;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{ id: number; username: string; name: string; email: string }> {
    const response = await this.client.get('/user');
    return response.data;
  }

  /**
   * List groups accessible to the user
   */
  async listGroups(options?: {
    search?: string;
    perPage?: number;
  }): Promise<Array<{ id: number; name: string; path: string; full_path: string }>> {
    const params: Record<string, any> = {
      per_page: options?.perPage || 20,
    };
    if (options?.search) params.search = options.search;

    const response = await this.client.get('/groups', { params });
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.getCurrentUser();
      return { healthy: true, message: 'GitLab connection OK' };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: `GitLab connection failed: ${error.message}` 
      };
    }
  }
}

export default GitLabService;
