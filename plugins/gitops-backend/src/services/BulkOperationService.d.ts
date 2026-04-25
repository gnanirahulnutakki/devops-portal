import { Knex } from 'knex';
import type { BulkOperation } from '../types';
import { GitHubService } from './GitHubService';
import { AuditService } from './AuditService';
/**
 * BulkOperationService
 *
 * Manages bulk operations across multiple branches
 * Handles progress tracking, error handling, and rollback
 */
export declare class BulkOperationService {
    private db;
    private githubService;
    private auditService;
    constructor(db: Knex, githubService: GitHubService, auditService: AuditService);
    /**
     * Create a new bulk file update operation
     */
    createBulkUpdate(params: {
        user_id: string;
        user_email?: string;
        user_name?: string;
        repository: string;
        branches: string[];
        file_path: string;
        content?: string;
        message: string;
        committer?: {
            name: string;
            email: string;
        };
        ip_address?: string;
        user_agent?: string;
        fieldPath?: string;
        fieldValue?: string;
    }): Promise<string>;
    /**
     * Process bulk file update across all branches (PARALLEL EXECUTION)
     *
     * Uses parallel execution with configurable concurrency for 5-10x faster updates
     */
    private processBulkUpdate;
    /**
     * Get bulk operation status
     */
    getOperation(operationId: string): Promise<BulkOperation | null>;
    /**
     * List bulk operations with filters
     */
    listOperations(filters: {
        user_id?: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
        operation_type?: 'bulk_update' | 'bulk_commit' | 'bulk_sync';
        limit?: number;
        offset?: number;
    }): Promise<{
        operations: BulkOperation[];
        total: number;
    }>;
    /**
     * Get active operations
     */
    getActiveOperations(): Promise<BulkOperation[]>;
    /**
     * Get user's recent operations
     */
    getUserOperations(userId: string, limit?: number): Promise<BulkOperation[]>;
    /**
     * Cancel a pending operation
     */
    cancelOperation(operationId: string): Promise<boolean>;
    /**
     * Get operation statistics
     */
    getStatistics(params: {
        start_date: Date;
        end_date: Date;
        user_id?: string;
    }): Promise<{
        total_operations: number;
        by_status: Record<string, number>;
        by_type: Record<string, number>;
        avg_success_rate: number;
        total_branches_updated: number;
    }>;
}
//# sourceMappingURL=BulkOperationService.d.ts.map