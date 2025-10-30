import { v4 as uuidv4 } from 'uuid';
import { updateYamlField } from '../utils/yamlUtils';
/**
 * BulkOperationService
 *
 * Manages bulk operations across multiple branches
 * Handles progress tracking, error handling, and rollback
 */
export class BulkOperationService {
    constructor(db, githubService, auditService) {
        this.db = db;
        this.githubService = githubService;
        this.auditService = auditService;
    }
    /**
     * Create a new bulk file update operation
     */
    async createBulkUpdate(params) {
        const operationId = uuidv4();
        // Create bulk operation record
        const operation = {
            id: operationId,
            created_at: new Date(),
            user_id: params.user_id,
            user_email: params.user_email,
            user_name: params.user_name,
            operation_type: 'bulk_update',
            repository: params.repository,
            target_branches: params.branches,
            file_path: params.file_path,
            status: 'pending',
            total_targets: params.branches.length,
            successful_count: 0,
            failed_count: 0,
            pending_count: params.branches.length,
            progress_percentage: 0,
            commit_message: params.message,
            ip_address: params.ip_address,
            user_agent: params.user_agent,
            can_rollback: false,
            results: [],
        };
        await this.db('bulk_operations').insert(operation);
        // Start processing asynchronously (don't await)
        this.processBulkUpdate(operationId, params).catch(error => {
            console.error(`[BulkOperationService] Error processing ${operationId}:`, error);
        });
        return operationId;
    }
    /**
     * Process bulk file update across all branches
     */
    async processBulkUpdate(operationId, params) {
        // Update status to in_progress
        await this.db('bulk_operations')
            .where('id', operationId)
            .update({
            status: 'in_progress',
            started_at: new Date(),
        });
        const results = [];
        let successCount = 0;
        let failedCount = 0;
        // Process each branch sequentially
        for (let i = 0; i < params.branches.length; i++) {
            const branch = params.branches[i];
            try {
                // Update current target
                await this.db('bulk_operations')
                    .where('id', operationId)
                    .update({
                    current_target: branch,
                    progress_percentage: ((i / params.branches.length) * 100).toFixed(2),
                });
                // Get current file SHA and content
                const fileContent = await this.githubService.getFileContent(params.repository, branch, params.file_path);
                // Determine the content to commit
                let contentToCommit;
                if (params.fieldPath && params.fieldValue !== undefined) {
                    // Field-level update: update only the specified field
                    const currentYaml = Buffer.from(fileContent.content, 'base64').toString('utf-8');
                    const updatedYaml = updateYamlField(currentYaml, params.fieldPath, params.fieldValue);
                    contentToCommit = updatedYaml;
                }
                else if (params.content) {
                    // Full file update
                    contentToCommit = params.content;
                }
                else {
                    throw new Error('Either content or fieldPath/fieldValue must be provided');
                }
                // Update file
                const updateRequest = {
                    repository: params.repository,
                    branch: branch,
                    path: params.file_path,
                    content: Buffer.from(contentToCommit).toString('base64'),
                    message: params.message,
                    sha: fileContent.sha,
                    committer: params.committer,
                };
                const updateResult = await this.githubService.updateFile(updateRequest);
                // Log to audit
                await this.auditService.logCommit({
                    user_id: params.user_id,
                    user_email: params.user_email,
                    user_name: params.user_name,
                    resource_type: 'branch',
                    resource_id: branch,
                    repository: params.repository,
                    branch: branch,
                    file_path: params.file_path,
                    commit_sha: updateResult.commit.sha,
                    status: 'success',
                });
                results.push({
                    branch,
                    status: 'success',
                    commit_sha: updateResult.commit.sha,
                    timestamp: new Date(),
                });
                successCount++;
            }
            catch (error) {
                console.error(`[BulkOperationService] Failed to update ${branch}:`, error.message);
                // Log failure to audit
                await this.auditService.logCommit({
                    user_id: params.user_id,
                    user_email: params.user_email,
                    user_name: params.user_name,
                    resource_type: 'branch',
                    resource_id: branch,
                    repository: params.repository,
                    branch: branch,
                    file_path: params.file_path,
                    status: 'failure',
                    error_message: error.message,
                });
                results.push({
                    branch,
                    status: 'failure',
                    error: error.message,
                    timestamp: new Date(),
                });
                failedCount++;
            }
            // Update progress
            await this.db('bulk_operations')
                .where('id', operationId)
                .update({
                successful_count: successCount,
                failed_count: failedCount,
                pending_count: params.branches.length - i - 1,
                results: JSON.stringify(results),
            });
        }
        // Mark as complete
        const finalStatus = failedCount === 0
            ? 'completed'
            : successCount === 0
                ? 'failed'
                : 'partial';
        await this.db('bulk_operations')
            .where('id', operationId)
            .update({
            status: finalStatus,
            completed_at: new Date(),
            progress_percentage: 100,
            current_target: null,
            can_rollback: successCount > 0,
            summary: JSON.stringify({
                total: params.branches.length,
                successful: successCount,
                failed: failedCount,
                success_rate: ((successCount / params.branches.length) * 100).toFixed(2) + '%',
            }),
        });
    }
    /**
     * Get bulk operation status
     */
    async getOperation(operationId) {
        const operation = await this.db('bulk_operations')
            .where('id', operationId)
            .first();
        if (!operation) {
            return null;
        }
        // Parse JSON fields
        return {
            ...operation,
            target_branches: operation.target_branches,
            results: operation.results || [],
            summary: operation.summary || {},
            change_preview: operation.change_preview || {},
            metadata: operation.metadata || {},
        };
    }
    /**
     * List bulk operations with filters
     */
    async listOperations(filters) {
        let query = this.db('bulk_operations');
        // Apply filters
        if (filters.user_id) {
            query = query.where('user_id', filters.user_id);
        }
        if (filters.status) {
            query = query.where('status', filters.status);
        }
        if (filters.operation_type) {
            query = query.where('operation_type', filters.operation_type);
        }
        // Get total count
        const countResult = await query.clone().count('* as count').first();
        const total = Number(countResult?.count || 0);
        // Get operations with pagination
        const operations = await query
            .orderBy('created_at', 'desc')
            .limit(filters.limit || 20)
            .offset(filters.offset || 0);
        // Parse JSON fields
        const parsedOperations = operations.map(op => ({
            ...op,
            target_branches: op.target_branches,
            results: op.results || [],
            summary: op.summary || {},
            change_preview: op.change_preview || {},
            metadata: op.metadata || {},
        }));
        return { operations: parsedOperations, total };
    }
    /**
     * Get active operations
     */
    async getActiveOperations() {
        const operations = await this.db('bulk_operations')
            .whereIn('status', ['pending', 'in_progress'])
            .orderBy('created_at', 'desc');
        return operations.map(op => ({
            ...op,
            target_branches: op.target_branches,
            results: op.results || [],
            summary: op.summary || {},
            change_preview: op.change_preview || {},
            metadata: op.metadata || {},
        }));
    }
    /**
     * Get user's recent operations
     */
    async getUserOperations(userId, limit = 10) {
        const operations = await this.db('bulk_operations')
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .limit(limit);
        return operations.map(op => ({
            ...op,
            target_branches: op.target_branches,
            results: op.results || [],
            summary: op.summary || {},
            change_preview: op.change_preview || {},
            metadata: op.metadata || {},
        }));
    }
    /**
     * Cancel a pending operation
     */
    async cancelOperation(operationId) {
        const result = await this.db('bulk_operations')
            .where('id', operationId)
            .where('status', 'pending')
            .update({
            status: 'failed',
            error_message: 'Cancelled by user',
            completed_at: new Date(),
        });
        return result > 0;
    }
    /**
     * Get operation statistics
     */
    async getStatistics(params) {
        let baseQuery = this.db('bulk_operations')
            .whereBetween('created_at', [params.start_date, params.end_date]);
        if (params.user_id) {
            baseQuery = baseQuery.where('user_id', params.user_id);
        }
        const operations = await baseQuery.select('*');
        const total_operations = operations.length;
        // By status
        const by_status = {};
        operations.forEach(op => {
            by_status[op.status] = (by_status[op.status] || 0) + 1;
        });
        // By type
        const by_type = {};
        operations.forEach(op => {
            by_type[op.operation_type] = (by_type[op.operation_type] || 0) + 1;
        });
        // Average success rate
        const completedOps = operations.filter(op => ['completed', 'partial', 'failed'].includes(op.status));
        const totalSuccessRate = completedOps.reduce((sum, op) => {
            const rate = op.total_targets > 0
                ? (op.successful_count / op.total_targets) * 100
                : 0;
            return sum + rate;
        }, 0);
        const avg_success_rate = completedOps.length > 0
            ? totalSuccessRate / completedOps.length
            : 0;
        // Total branches updated
        const total_branches_updated = operations.reduce((sum, op) => sum + (op.successful_count || 0), 0);
        return {
            total_operations,
            by_status,
            by_type,
            avg_success_rate,
            total_branches_updated,
        };
    }
}
//# sourceMappingURL=BulkOperationService.js.map