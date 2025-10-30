import type { AuditLog, AuditServiceConfig } from '../types';
/**
 * AuditService
 *
 * Handles audit logging for all GitOps operations
 * Provides compliance and debugging capabilities
 */
export declare class AuditService {
    private db;
    constructor(config: AuditServiceConfig);
    /**
     * Log an operation to the audit trail
     */
    log(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<string>;
    /**
     * Log a successful read operation
     */
    logRead(params: {
        user_id: string;
        user_email?: string;
        user_name?: string;
        resource_type: 'repository' | 'branch' | 'file' | 'argocd_app';
        resource_id: string;
        repository?: string;
        branch?: string;
        file_path?: string;
        ip_address?: string;
        user_agent?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Log a file update operation
     */
    logUpdate(params: {
        user_id: string;
        user_email?: string;
        user_name?: string;
        resource_type: 'file';
        resource_id: string;
        repository: string;
        branch: string;
        file_path: string;
        old_value?: string;
        new_value?: string;
        diff?: string;
        commit_sha?: string;
        status: 'success' | 'failure';
        error_message?: string;
        ip_address?: string;
        user_agent?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Log a commit operation
     */
    logCommit(params: {
        user_id: string;
        user_email?: string;
        user_name?: string;
        resource_type: 'branch';
        resource_id: string;
        repository: string;
        branch: string;
        file_path?: string;
        commit_sha?: string;
        diff?: string;
        status: 'success' | 'failure';
        error_message?: string;
        ip_address?: string;
        user_agent?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Log an ArgoCD sync operation
     */
    logSync(params: {
        user_id: string;
        user_email?: string;
        user_name?: string;
        resource_type: 'argocd_app';
        resource_id: string;
        argocd_app_name: string;
        sync_status?: string;
        status: 'success' | 'failure';
        error_message?: string;
        ip_address?: string;
        user_agent?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Get audit logs with filtering
     */
    getLogs(filters: {
        user_id?: string;
        operation?: 'read' | 'update' | 'commit' | 'sync' | 'delete';
        resource_type?: 'repository' | 'branch' | 'file' | 'argocd_app';
        repository?: string;
        branch?: string;
        status?: 'success' | 'failure' | 'pending';
        start_date?: Date;
        end_date?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: AuditLog[];
        total: number;
    }>;
    /**
     * Get recent activity for a user
     */
    getUserActivity(userId: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get activity for a specific repository
     */
    getRepositoryActivity(repository: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get activity for a specific branch
     */
    getBranchActivity(repository: string, branch: string, limit?: number): Promise<AuditLog[]>;
    /**
     * Get failed operations for troubleshooting
     */
    getFailedOperations(limit?: number): Promise<AuditLog[]>;
    /**
     * Get statistics for a time period
     */
    getStatistics(params: {
        start_date: Date;
        end_date: Date;
        repository?: string;
    }): Promise<{
        total_operations: number;
        successful_operations: number;
        failed_operations: number;
        operations_by_type: Record<string, number>;
        top_users: Array<{
            user_id: string;
            count: number;
        }>;
    }>;
}
//# sourceMappingURL=AuditService.d.ts.map