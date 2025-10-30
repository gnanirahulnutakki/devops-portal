/**
 * GitOps Backend Types
 *
 * Type definitions for the GitOps Management Portal backend
 */

// ============================================================================
// Database Models
// ============================================================================

export interface AuditLog {
  id: string;
  created_at: Date;

  // User information
  user_id: string;
  user_email?: string;
  user_name?: string;

  // Operation details
  operation: 'read' | 'update' | 'commit' | 'sync' | 'delete';
  resource_type: 'repository' | 'branch' | 'file' | 'argocd_app';
  resource_id: string;

  // Repository context
  repository?: string;
  branch?: string;
  file_path?: string;

  // Change details
  old_value?: string;
  new_value?: string;
  diff?: string;

  // Metadata
  commit_sha?: string;
  argocd_app_name?: string;
  sync_status?: string;

  // Request context
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;

  // Status
  status: 'success' | 'failure' | 'pending';
  error_message?: string;
}

export interface BulkOperation {
  id: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;

  // User information
  user_id: string;
  user_email?: string;
  user_name?: string;

  // Operation details
  operation_type: 'bulk_update' | 'bulk_commit' | 'bulk_sync';
  repository: string;
  target_branches: string[];
  file_path?: string;

  // Status tracking
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  total_targets: number;
  successful_count: number;
  failed_count: number;
  pending_count: number;

  // Progress tracking
  progress_percentage: number;
  current_target?: string;

  // Results
  results?: BulkOperationResult[];
  error_message?: string;
  summary?: Record<string, any>;

  // Change details
  change_description?: string;
  commit_message?: string;
  change_preview?: Record<string, any>;

  // ArgoCD sync details
  argocd_apps?: string[];
  sync_results?: ArgoCDSyncResult[];

  // Metadata
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;

  // Rollback information
  can_rollback: boolean;
  rolled_back_by?: string;
  rolled_back_at?: Date;
}

export interface BulkOperationResult {
  branch: string;
  status: 'success' | 'failure' | 'skipped';
  commit_sha?: string;
  error?: string;
  timestamp: Date;
}

export interface ArgoCDSyncResult {
  app_name: string;
  status: 'success' | 'failure';
  sync_status?: string;
  health_status?: string;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// GitHub Types
// ============================================================================

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  private: boolean;
  description?: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubFileTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  content: string; // Base64 encoded
  encoding: 'base64';
  download_url?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface GitHubUpdateFileRequest {
  repository: string;
  branch: string;
  path: string;
  content: string; // Base64 encoded
  message: string;
  sha: string; // Current file SHA (for conflict detection)
  committer?: {
    name: string;
    email: string;
  };
}

export interface GitHubUpdateFileResponse {
  content: GitHubFileContent;
  commit: GitHubCommit;
}

// ============================================================================
// ArgoCD Types
// ============================================================================

export interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    source: {
      repoURL: string;
      targetRevision: string; // Branch name
      path: string; // Chart path
    };
    destination: {
      server: string;
      namespace: string;
    };
    project: string;
    syncPolicy?: {
      automated?: {
        prune: boolean;
        selfHeal: boolean;
      };
    };
  };
  status: {
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown';
      revision?: string;
    };
    health: {
      status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
      message?: string;
    };
    operationState?: {
      phase: 'Running' | 'Succeeded' | 'Failed' | 'Error';
      message?: string;
      startedAt?: string;
      finishedAt?: string;
    };
  };
}

export interface ArgoCDSyncRequest {
  prune?: boolean;
  dryRun?: boolean;
  strategy?: {
    hook?: {
      force: boolean;
    };
  };
  revision?: string;
}

export interface ArgoCDSyncResponse {
  application: string;
  status: string;
  message?: string;
  revision?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ListRepositoriesRequest {
  organization?: string;
  filter?: string;
}

export interface ListRepositoriesResponse {
  repositories: GitHubRepository[];
  total: number;
}

export interface ListBranchesRequest {
  repository: string;
  filter?: string;
}

export interface ListBranchesResponse {
  branches: GitHubBranch[];
  total: number;
}

export interface GetFileTreeRequest {
  repository: string;
  branch: string;
  path?: string;
}

export interface GetFileTreeResponse {
  entries: GitHubFileTreeEntry[];
  path: string;
}

export interface GetFileContentRequest {
  repository: string;
  branch: string;
  path: string;
}

export interface GetFileContentResponse {
  content: string; // Decoded content
  sha: string;
  path: string;
  branch: string;
}

export interface UpdateFileRequest {
  repository: string;
  branches: string[]; // Support bulk update
  path: string;
  content?: string; // Decoded content (optional for field-level updates)
  message: string;
  committer?: {
    name: string;
    email: string;
  };
  // Field-level editing support
  fieldPath?: string; // YAML path in dot notation (e.g., 'fid.image.tag')
  fieldValue?: string; // New value for the field
}

export interface UpdateFileResponse {
  operation_id: string; // Bulk operation ID
  status: 'pending' | 'in_progress';
  total_branches: number;
}

export interface ListArgoCDAppsRequest {
  filter?: string;
  branch?: string;
}

export interface ListArgoCDAppsResponse {
  applications: ArgoCDApplication[];
  total: number;
}

export interface SyncArgoCDAppRequest {
  applications: string[]; // Support bulk sync
  prune?: boolean;
  dryRun?: boolean;
}

export interface SyncArgoCDAppResponse {
  operation_id: string; // Bulk operation ID
  status: 'pending' | 'in_progress';
  total_applications: number;
}

export interface GetBulkOperationRequest {
  operation_id: string;
}

export interface GetBulkOperationResponse {
  operation: BulkOperation;
}

export interface ListAuditLogsRequest {
  user_id?: string;
  operation?: string;
  resource_type?: string;
  repository?: string;
  branch?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ListAuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Service Layer Types
// ============================================================================

export interface GitHubServiceConfig {
  token: string;
  organization: string;
}

export interface ArgoCDServiceConfig {
  url: string;
  token: string;
  namespace: string;
}

export interface AuditServiceConfig {
  database: any; // Knex instance
}

// ============================================================================
// rli-use2 Specific Types (from production analysis)
// ============================================================================

/**
 * rli-use2 tenant branch pattern
 * Examples: rli-use2-mp02, rli-use2-jb01, rli-use2-dant
 */
export interface TenantBranch {
  name: string; // Full branch name (e.g., "rli-use2-mp02")
  tenant_id: string; // Short ID (e.g., "mp02")
  namespace: string; // Kubernetes namespace (e.g., "duploservices-rli-use2-mp02")
  argocd_apps: TenantArgoCDApp[];
}

/**
 * ArgoCD applications for a tenant
 * Based on naming convention: {branch} and {branch}-{chart-abbr}
 */
export interface TenantArgoCDApp {
  name: string; // Application name (e.g., "rli-use2-mp02" or "rli-use2-mp02-ia")
  branch: string; // Git branch it watches
  chart: 'radiantone' | 'igrcanalytics' | 'observability' | 'eoc' | 'sdc' | 'shared-services';
  chart_path: string; // Path in Git (e.g., "app/charts/radiantone")
  namespace: string; // Deployment namespace
}

/**
 * Chart types available in rli-use2
 */
export type ChartType =
  | 'radiantone'        // Main application (no suffix)
  | 'igrcanalytics'     // -ia suffix
  | 'observability'     // -obs suffix
  | 'eoc'               // -eoc suffix
  | 'sdc'               // -sdc suffix
  | 'shared-services';  // -shared-services suffix

/**
 * Standard Helm values.yaml structure for radiantone chart
 */
export interface RadiantOneValues {
  fid: {
    image: {
      repository: string;
      tag: string; // Actual value, e.g., "8.1.2" (not $FID_VERSION)
    };
    replicaCount: number; // Actual value, e.g., 1 (not $FID_NODE_COUNT)
    nodeSelector: {
      tenantname: string; // e.g., "duploservices-rli-use2-mp02"
    };
    service?: {
      type: string;
      port: number;
    };
    persistence?: {
      enabled: boolean;
      storageClass: string;
      size: string;
    };
  };
  zookeeper?: {
    replicaCount: number;
  };
  [key: string]: any; // Other chart-specific values
}

// ============================================================================
// Pull Request Types
// ============================================================================

export interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string; // Branch name
    sha: string;
    repo: {
      name: string;
      full_name: string;
    };
  };
  base: {
    ref: string; // Branch name
    sha: string;
    repo: {
      name: string;
      full_name: string;
    };
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  merged_by: {
    login: string;
  } | null;
  comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  labels: GitHubLabel[];
  html_url: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  type: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface GitHubComparison {
  base_commit: {
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        email: string;
        date: string;
      };
    };
  };
  merge_base_commit: {
    sha: string;
  };
  status: 'ahead' | 'behind' | 'identical' | 'diverged';
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: GitHubCommit[];
  files: GitHubFileDiff[];
}

export interface GitHubFileDiff {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string; // Unified diff format
  previous_filename?: string; // For renamed files
}

export interface CreatePullRequestRequest {
  repository: string;
  title: string;
  body?: string;
  head: string; // Source branch
  base: string; // Target branch
}

export interface ListPullRequestsRequest {
  repository: string;
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity';
  direction?: 'asc' | 'desc';
}

export interface CompareBranchesRequest {
  repository: string;
  base: string;
  head: string;
}

export interface MergePullRequestRequest {
  repository: string;
  pull_number: number;
  commit_title?: string;
  commit_message?: string;
  merge_method?: 'merge' | 'squash' | 'rebase';
}

export interface AddReviewersRequest {
  repository: string;
  pull_number: number;
  reviewers: string[]; // GitHub usernames
  team_reviewers?: string[]; // Team slugs
}

export interface AssignPullRequestRequest {
  repository: string;
  pull_number: number;
  assignees: string[]; // GitHub usernames
}

// ============================================================================
// Error Types
// ============================================================================

export class GitOpsError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GitOpsError';
  }
}

export class GitHubError extends GitOpsError {
  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message, statusCode, 'GITHUB_ERROR', details);
    this.name = 'GitHubError';
  }
}

export class ArgoCDError extends GitOpsError {
  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message, statusCode, 'ARGOCD_ERROR', details);
    this.name = 'ArgoCDError';
  }
}

export class ValidationError extends GitOpsError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GitOpsError {
  constructor(message: string, details?: any) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}
