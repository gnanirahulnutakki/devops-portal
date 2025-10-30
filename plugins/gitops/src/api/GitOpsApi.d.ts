import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
/**
 * GitOps API Reference
 */
export declare const gitOpsApiRef: import("@backstage/core-plugin-api").ApiRef<GitOpsApi>;
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
    content?: string;
    message: string;
    fieldPath?: string;
    fieldValue?: string;
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
export declare class GitOpsApi {
    private readonly discoveryApi;
    private readonly fetchApi;
    constructor(options: {
        discoveryApi: DiscoveryApi;
        fetchApi: FetchApi;
    });
    private getBaseUrl;
    private fetch;
    listRepositories(filter?: string): Promise<{
        repositories: Repository[];
        total: number;
    }>;
    listBranches(repository: string, filter?: string): Promise<{
        branches: Branch[];
        total: number;
    }>;
    getFileTree(repository: string, branch: string, path?: string): Promise<{
        entries: FileTreeEntry[];
        path: string;
    }>;
    getFileContent(repository: string, branch: string, path: string): Promise<FileContent>;
    updateFile(repository: string, request: UpdateFileRequest): Promise<{
        operation_id: string;
    }>;
    getBulkOperation(operationId: string): Promise<{
        operation: BulkOperation;
    }>;
    listBulkOperations(filters?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        operations: BulkOperation[];
        total: number;
    }>;
    listArgoCDApplications(filter?: string, branch?: string): Promise<{
        applications: ArgoCDApplication[];
        total: number;
    }>;
    getArgoCDApplication(appName: string): Promise<{
        application: ArgoCDApplication;
    }>;
    syncArgoCDApplications(applications: string[], options?: {
        prune?: boolean;
        dryRun?: boolean;
    }): Promise<any>;
    listAuditLogs(filters?: {
        operation?: string;
        repository?: string;
        branch?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: any[];
        total: number;
    }>;
}
//# sourceMappingURL=GitOpsApi.d.ts.map