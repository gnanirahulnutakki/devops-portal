/**
 * GitOps Backend Types
 *
 * Type definitions for the GitOps Management Portal backend
 */
export interface AuditLog {
    id: string;
    created_at: Date;
    user_id: string;
    user_email?: string;
    user_name?: string;
    operation: 'read' | 'update' | 'commit' | 'sync' | 'delete';
    resource_type: 'repository' | 'branch' | 'file' | 'argocd_app' | 'gitlab_file' | 'gitlab_branch';
    resource_id: string;
    repository?: string;
    branch?: string;
    file_path?: string;
    old_value?: string;
    new_value?: string;
    diff?: string;
    commit_sha?: string;
    argocd_app_name?: string;
    sync_status?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
    status: 'success' | 'failure' | 'pending';
    error_message?: string;
}
export interface BulkOperation {
    id: string;
    created_at: Date;
    started_at?: Date;
    completed_at?: Date;
    user_id: string;
    user_email?: string;
    user_name?: string;
    operation_type: 'bulk_update' | 'bulk_commit' | 'bulk_sync';
    repository: string;
    target_branches: string[];
    file_path?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
    total_targets: number;
    successful_count: number;
    failed_count: number;
    pending_count: number;
    progress_percentage: number;
    current_target?: string;
    results?: BulkOperationResult[];
    error_message?: string;
    summary?: Record<string, any>;
    change_description?: string;
    commit_message?: string;
    change_preview?: Record<string, any>;
    argocd_apps?: string[];
    sync_results?: ArgoCDSyncResult[];
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
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
    content: string;
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
    content: string;
    message: string;
    sha: string;
    committer?: {
        name: string;
        email: string;
    };
}
export interface GitHubUpdateFileResponse {
    content: GitHubFileContent;
    commit: GitHubCommit;
}
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
            targetRevision: string;
            path: string;
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
    content: string;
    sha: string;
    path: string;
    branch: string;
}
export interface UpdateFileRequest {
    repository: string;
    branches: string[];
    path: string;
    content?: string;
    message: string;
    committer?: {
        name: string;
        email: string;
    };
    fieldPath?: string;
    fieldValue?: string;
}
export interface UpdateFileResponse {
    operation_id: string;
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
    applications: string[];
    prune?: boolean;
    dryRun?: boolean;
}
export interface SyncArgoCDAppResponse {
    operation_id: string;
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
    database: any;
}
/**
 * rli-use2 tenant branch pattern
 * Examples: rli-use2-mp02, rli-use2-jb01, rli-use2-dant
 */
export interface TenantBranch {
    name: string;
    tenant_id: string;
    namespace: string;
    argocd_apps: TenantArgoCDApp[];
}
/**
 * ArgoCD applications for a tenant
 * Based on naming convention: {branch} and {branch}-{chart-abbr}
 */
export interface TenantArgoCDApp {
    name: string;
    branch: string;
    chart: 'radiantone' | 'igrcanalytics' | 'observability' | 'eoc' | 'sdc' | 'shared-services';
    chart_path: string;
    namespace: string;
}
/**
 * Chart types available in rli-use2
 */
export type ChartType = 'radiantone' | 'igrcanalytics' | 'observability' | 'eoc' | 'sdc' | 'shared-services';
/**
 * Standard Helm values.yaml structure for radiantone chart
 */
export interface RadiantOneValues {
    fid: {
        image: {
            repository: string;
            tag: string;
        };
        replicaCount: number;
        nodeSelector: {
            tenantname: string;
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
    [key: string]: any;
}
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
        ref: string;
        sha: string;
        repo: {
            name: string;
            full_name: string;
        };
    };
    base: {
        ref: string;
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
    patch?: string;
    previous_filename?: string;
}
export interface CreatePullRequestRequest {
    repository: string;
    title: string;
    body?: string;
    head: string;
    base: string;
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
    reviewers: string[];
    team_reviewers?: string[];
}
export interface AssignPullRequestRequest {
    repository: string;
    pull_number: number;
    assignees: string[];
}
//# sourceMappingURL=index.d.ts.map