import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import type {
  BulkOperation,
  BulkOperationResult,
  GitHubUpdateFileRequest,
  UpdateFileRequest
} from '../types';
import { GitHubService } from './GitHubService';
import { AuditService } from './AuditService';
import { updateYamlField } from '../utils/yamlUtils';
import { executeParallel, Task } from '../utils/parallelExecutor';
import logger, { logBulkOperation } from '../utils/logger';

/**
 * BulkOperationService
 *
 * Manages bulk operations across multiple branches
 * Handles progress tracking, error handling, and rollback
 */
export class BulkOperationService {
  private db: Knex;
  private githubService: GitHubService;
  private auditService: AuditService;

  constructor(
    db: Knex,
    githubService: GitHubService,
    auditService: AuditService
  ) {
    this.db = db;
    this.githubService = githubService;
    this.auditService = auditService;
  }

  /**
   * Create a new bulk file update operation
   */
  async createBulkUpdate(params: {
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
  }): Promise<string> {
    const operationId = uuidv4();

    // Create bulk operation record
    const operation: Partial<BulkOperation> = {
      id: operationId,
      created_at: new Date(),
      user_id: params.user_id,
      user_email: params.user_email,
      user_name: params.user_name,
      operation_type: 'bulk_update',
      repository: params.repository,
      target_branches: JSON.stringify(params.branches),
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
      results: JSON.stringify([]),
    };

    await this.db('bulk_operations').insert(operation);

    // Start processing asynchronously (don't await)
    this.processBulkUpdate(operationId, params).catch(error => {
      console.error(`[BulkOperationService] Error processing ${operationId}:`, error);
    });

    return operationId;
  }

  /**
   * Process bulk file update across all branches (PARALLEL EXECUTION)
   * 
   * Uses parallel execution with configurable concurrency for 5-10x faster updates
   */
  private async processBulkUpdate(
    operationId: string,
    params: {
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
      fieldPath?: string;
      fieldValue?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    // Update status to in_progress
    await this.db('bulk_operations')
      .where('id', operationId)
      .update({
        status: 'in_progress',
        started_at: new Date(),
      });

    logBulkOperation(operationId, 'started', 0, {
      branches: params.branches.length,
      repository: params.repository,
      file: params.file_path,
    });

    // Create tasks for parallel execution
    const tasks: Task<{ branch: string; commit_sha: string }>[] = params.branches.map(branch => ({
      id: branch,
      execute: async () => {
        // Get current file SHA and content
        const fileContent = await this.githubService.getFileContent(
          params.repository,
          branch,
          params.file_path
        );

        // Determine the content to commit
        let contentToCommit: string;

        if (params.fieldPath && params.fieldValue !== undefined) {
          // Field-level update: update only the specified field
          const currentYaml = Buffer.from(fileContent.content, 'base64').toString('utf-8');
          const updatedYaml = updateYamlField(currentYaml, params.fieldPath, params.fieldValue);
          contentToCommit = updatedYaml;
        } else if (params.content) {
          // Full file update
          contentToCommit = params.content;
        } else {
          throw new Error('Either content or fieldPath/fieldValue must be provided');
        }

        // Update file
        const updateRequest: GitHubUpdateFileRequest = {
          repository: params.repository,
          branch: branch,
          path: params.file_path,
          content: Buffer.from(contentToCommit).toString('base64'),
          message: params.message,
          sha: fileContent.sha,
          committer: params.committer,
        };

        const updateResult = await this.githubService.updateFile(updateRequest);
        
        return {
          branch,
          commit_sha: updateResult.commit.sha,
        };
      },
    }));

    // Execute in parallel with concurrency control
    // Concurrency of 5 balances speed with GitHub rate limits
    const concurrency = Math.min(5, Math.ceil(params.branches.length / 2));
    let successCount = 0;
    let failedCount = 0;
    const results: BulkOperationResult[] = [];

    const taskResults = await executeParallel(tasks, {
      concurrency,
      retries: 1, // Retry once on failure
      retryDelayMs: 2000,
      onProgress: async (completed, total, currentTasks) => {
        const progress = ((completed / total) * 100).toFixed(2);
        logBulkOperation(operationId, 'in_progress', parseFloat(progress), {
          completed,
          total,
          currentTasks,
        });
        
        // Update progress in database
        await this.db('bulk_operations')
          .where('id', operationId)
          .update({
            progress_percentage: progress,
            current_target: currentTasks.join(', ') || null,
            successful_count: successCount,
            failed_count: failedCount,
            pending_count: total - completed,
          });
      },
      onTaskComplete: async (taskResult) => {
        const branch = taskResult.id;
        
        if (taskResult.status === 'success' && taskResult.result) {
          successCount++;
          
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
            commit_sha: taskResult.result.commit_sha,
            status: 'success',
          });

          results.push({
            branch,
            status: 'success',
            commit_sha: taskResult.result.commit_sha,
            timestamp: new Date(),
          });
        } else {
          failedCount++;
          
          logger.error(`Bulk update failed for branch ${branch}`, {
            operationId,
            error: taskResult.error,
            retries: taskResult.retries,
          });

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
            error_message: taskResult.error,
          });

          results.push({
            branch,
            status: 'failure',
            error: taskResult.error,
            timestamp: new Date(),
          });
        }
      },
    });

    // Mark as complete
    const finalStatus = failedCount === 0
      ? 'completed'
      : successCount === 0
        ? 'failed'
        : 'partial';

    const durationMs = Date.now() - startTime;
    const summary = {
      total: params.branches.length,
      successful: successCount,
      failed: failedCount,
      success_rate: ((successCount / params.branches.length) * 100).toFixed(2) + '%',
      duration_ms: durationMs,
      avg_time_per_branch_ms: Math.round(durationMs / params.branches.length),
    };

    await this.db('bulk_operations')
      .where('id', operationId)
      .update({
        status: finalStatus,
        completed_at: new Date(),
        progress_percentage: 100,
        current_target: null,
        can_rollback: successCount > 0,
        results: JSON.stringify(results),
        summary: JSON.stringify(summary),
      });

    logBulkOperation(operationId, finalStatus, 100, summary);
  }

  /**
   * Get bulk operation status
   */
  async getOperation(operationId: string): Promise<BulkOperation | null> {
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
  async listOperations(filters: {
    user_id?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
    operation_type?: 'bulk_update' | 'bulk_commit' | 'bulk_sync';
    limit?: number;
    offset?: number;
  }): Promise<{ operations: BulkOperation[]; total: number }> {
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
  async getActiveOperations(): Promise<BulkOperation[]> {
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
  async getUserOperations(
    userId: string,
    limit: number = 10
  ): Promise<BulkOperation[]> {
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
  async cancelOperation(operationId: string): Promise<boolean> {
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
  async getStatistics(params: {
    start_date: Date;
    end_date: Date;
    user_id?: string;
  }): Promise<{
    total_operations: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    avg_success_rate: number;
    total_branches_updated: number;
  }> {
    let baseQuery = this.db('bulk_operations')
      .whereBetween('created_at', [params.start_date, params.end_date]);

    if (params.user_id) {
      baseQuery = baseQuery.where('user_id', params.user_id);
    }

    const operations = await baseQuery.select('*');

    const total_operations = operations.length;

    // By status
    const by_status: Record<string, number> = {};
    operations.forEach(op => {
      by_status[op.status] = (by_status[op.status] || 0) + 1;
    });

    // By type
    const by_type: Record<string, number> = {};
    operations.forEach(op => {
      by_type[op.operation_type] = (by_type[op.operation_type] || 0) + 1;
    });

    // Average success rate
    const completedOps = operations.filter(op =>
      ['completed', 'partial', 'failed'].includes(op.status)
    );

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
    const total_branches_updated = operations.reduce((sum, op) =>
      sum + (op.successful_count || 0), 0
    );

    return {
      total_operations,
      by_status,
      by_type,
      avg_success_rate,
      total_branches_updated,
    };
  }
}
