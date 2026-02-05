/**
 * OrchestratorService - Central Task Management and Workflow Coordination
 *
 * The "brain" of DevOps Portal - coordinates async operations:
 * - Bulk updates across repositories
 * - Deployment orchestration
 * - Long-running tasks with progress tracking
 * - WebSocket real-time updates
 * - Task dependencies and workflows
 *
 * Uses:
 * - PostgreSQL for task persistence
 * - WebSocket for real-time progress updates
 */

import { Knex } from 'knex';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import logger from '../utils/logger';

// Types
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type TaskType =
  | 'bulk_update'
  | 'deployment'
  | 'sync'
  | 'rollback'
  | 'pr_create'
  | 'pr_merge'
  | 'workflow_run'
  | 'custom';

export interface OrchestratorTask {
  id: string;
  taskType: TaskType;
  name: string;
  description?: string;
  userId?: string;
  initiatedBy?: string;
  status: TaskStatus;
  priority: number;
  progressPercentage: number;
  progressMessage?: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  context?: Record<string, unknown>;
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  maxDurationSeconds: number;
  actualDurationSeconds?: number;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  errorCode?: string;
  dependsOn: string[];
  blockedBy: string[];
  workerId?: string;
  cancellationRequested: boolean;
}

export interface CreateTaskInput {
  taskType: TaskType;
  name: string;
  description?: string;
  userId?: string;
  initiatedBy?: string;
  priority?: number;
  inputData?: Record<string, unknown>;
  context?: Record<string, unknown>;
  scheduledAt?: Date;
  maxDurationSeconds?: number;
  maxRetries?: number;
  dependsOn?: string[];
  notifyOnComplete?: boolean;
}

export interface TaskProgress {
  percentage: number;
  message?: string;
  completedItems?: number;
  totalItems?: number;
  failedItems?: number;
}

export interface TaskResult {
  success: boolean;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  errorCode?: string;
}

export interface OrchestratorConfig {
  workers: number;
  defaultTimeout: number; // seconds
  defaultRetries: number;
  taskRetention: number; // days
  cleanupInterval: number; // seconds
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  workers: 3,
  defaultTimeout: 3600, // 1 hour
  defaultRetries: 3,
  taskRetention: 7, // 7 days
  cleanupInterval: 3600, // 1 hour
};

export class OrchestratorService extends EventEmitter {
  private db: Knex;
  private config: OrchestratorConfig;
  private workerId: string;
  private isProcessing: boolean = false;
  private cleanupTimer?: NodeJS.Timeout;
  private processingTasks: Map<string, AbortController> = new Map();

  constructor(db: Knex, config: Partial<OrchestratorConfig> = {}) {
    super();
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;

    logger.info('OrchestratorService initialized', {
      workerId: this.workerId,
      workers: this.config.workers,
      defaultTimeout: this.config.defaultTimeout,
    });
  }

  // ============================================================================
  // Task Lifecycle
  // ============================================================================

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<OrchestratorTask> {
    const [task] = await this.db('orchestrator_tasks')
      .insert({
        task_type: input.taskType,
        name: input.name,
        description: input.description,
        user_id: input.userId,
        initiated_by: input.initiatedBy,
        status: 'pending',
        priority: input.priority || 5,
        progress_percentage: 0,
        total_items: 0,
        completed_items: 0,
        failed_items: 0,
        input_data: input.inputData ? JSON.stringify(input.inputData) : null,
        context: input.context ? JSON.stringify(input.context) : null,
        scheduled_at: input.scheduledAt,
        max_duration_seconds: input.maxDurationSeconds || this.config.defaultTimeout,
        max_retries: input.maxRetries ?? this.config.defaultRetries,
        depends_on: input.dependsOn || [],
        notify_on_complete: input.notifyOnComplete ?? true,
      })
      .returning('*');

    logger.info('Task created', { taskId: task.id, taskType: input.taskType, name: input.name });

    // Emit event for real-time updates
    this.emit('task:created', this.mapDbTaskToTask(task));

    return this.mapDbTaskToTask(task);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<OrchestratorTask | null> {
    const task = await this.db('orchestrator_tasks').where('id', taskId).first();
    return task ? this.mapDbTaskToTask(task) : null;
  }

  /**
   * List tasks with filtering
   */
  async listTasks(options: {
    userId?: string;
    status?: TaskStatus | TaskStatus[];
    taskType?: TaskType | TaskType[];
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ tasks: OrchestratorTask[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.db('orchestrator_tasks');
    let countQuery = this.db('orchestrator_tasks');

    if (options.userId) {
      query = query.where('user_id', options.userId);
      countQuery = countQuery.where('user_id', options.userId);
    }

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query = query.whereIn('status', statuses);
      countQuery = countQuery.whereIn('status', statuses);
    }

    if (options.taskType) {
      const types = Array.isArray(options.taskType) ? options.taskType : [options.taskType];
      query = query.whereIn('task_type', types);
      countQuery = countQuery.whereIn('task_type', types);
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    const [tasks, [{ count }]] = await Promise.all([
      query
        .select('*')
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset),
      countQuery.count('* as count'),
    ]);

    return {
      tasks: tasks.map(t => this.mapDbTaskToTask(t)),
      total: parseInt(count as string, 10),
    };
  }

  /**
   * Update task progress
   */
  async updateProgress(taskId: string, progress: TaskProgress): Promise<void> {
    const updates: Record<string, unknown> = {
      progress_percentage: progress.percentage,
      updated_at: new Date(),
    };

    if (progress.message) updates.progress_message = progress.message;
    if (progress.completedItems !== undefined) updates.completed_items = progress.completedItems;
    if (progress.totalItems !== undefined) updates.total_items = progress.totalItems;
    if (progress.failedItems !== undefined) updates.failed_items = progress.failedItems;

    await this.db('orchestrator_tasks').where('id', taskId).update(updates);

    // Emit progress event
    const task = await this.getTask(taskId);
    if (task) {
      this.emit('task:progress', task);
    }
  }

  /**
   * Start task execution
   */
  async startTask(taskId: string): Promise<boolean> {
    const result = await this.db('orchestrator_tasks')
      .where('id', taskId)
      .where('status', 'pending')
      .update({
        status: 'running',
        started_at: new Date(),
        worker_id: this.workerId,
        updated_at: new Date(),
      });

    if (result > 0) {
      const task = await this.getTask(taskId);
      if (task) {
        this.emit('task:started', task);
      }
      return true;
    }
    return false;
  }

  /**
   * Complete task with result
   */
  async completeTask(taskId: string, result: TaskResult): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) return;

    const now = new Date();
    const actualDuration = task.startedAt
      ? Math.round((now.getTime() - task.startedAt.getTime()) / 1000)
      : 0;

    await this.db('orchestrator_tasks').where('id', taskId).update({
      status: result.success ? 'completed' : 'failed',
      completed_at: now,
      actual_duration_seconds: actualDuration,
      output_data: result.outputData ? JSON.stringify(result.outputData) : null,
      error_message: result.errorMessage,
      error_code: result.errorCode,
      progress_percentage: result.success ? 100 : task.progressPercentage,
      updated_at: now,
    });

    const completedTask = await this.getTask(taskId);
    if (completedTask) {
      this.emit('task:completed', completedTask);

      // Unblock dependent tasks
      await this.unblockDependentTasks(taskId);
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(
    taskId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<boolean> {
    // Signal cancellation to running task
    const controller = this.processingTasks.get(taskId);
    if (controller) {
      controller.abort();
    }

    const result = await this.db('orchestrator_tasks')
      .where('id', taskId)
      .whereIn('status', ['pending', 'queued', 'running', 'paused'])
      .update({
        status: 'cancelled',
        cancellation_requested: true,
        cancellation_requested_at: new Date(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
        completed_at: new Date(),
        updated_at: new Date(),
      });

    if (result > 0) {
      const task = await this.getTask(taskId);
      if (task) {
        this.emit('task:cancelled', task);
      }
      logger.info('Task cancelled', { taskId, cancelledBy, reason });
      return true;
    }
    return false;
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<OrchestratorTask | null> {
    const task = await this.getTask(taskId);
    if (!task || task.status !== 'failed') {
      return null;
    }

    if (task.retryCount >= task.maxRetries) {
      logger.warn('Max retries exceeded', { taskId, retryCount: task.retryCount });
      return null;
    }

    await this.db('orchestrator_tasks').where('id', taskId).update({
      status: 'pending',
      retry_count: task.retryCount + 1,
      last_retry_at: new Date(),
      error_message: null,
      error_code: null,
      progress_percentage: 0,
      completed_items: 0,
      failed_items: 0,
      started_at: null,
      completed_at: null,
      updated_at: new Date(),
    });

    const retriedTask = await this.getTask(taskId);
    if (retriedTask) {
      this.emit('task:retried', retriedTask);
    }

    logger.info('Task queued for retry', { taskId, retryCount: task.retryCount + 1 });
    return retriedTask;
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId: string): Promise<boolean> {
    const result = await this.db('orchestrator_tasks')
      .where('id', taskId)
      .where('status', 'running')
      .update({
        status: 'paused',
        updated_at: new Date(),
      });

    if (result > 0) {
      const task = await this.getTask(taskId);
      if (task) {
        this.emit('task:paused', task);
      }
      return true;
    }
    return false;
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<boolean> {
    const result = await this.db('orchestrator_tasks')
      .where('id', taskId)
      .where('status', 'paused')
      .update({
        status: 'running',
        updated_at: new Date(),
      });

    if (result > 0) {
      const task = await this.getTask(taskId);
      if (task) {
        this.emit('task:resumed', task);
      }
      return true;
    }
    return false;
  }

  // ============================================================================
  // Task Dependencies
  // ============================================================================

  /**
   * Check if task dependencies are satisfied
   */
  async areDependenciesSatisfied(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task || !task.dependsOn.length) return true;

    const dependencies = await this.db('orchestrator_tasks')
      .whereIn('id', task.dependsOn)
      .select('id', 'status');

    return dependencies.every(d => d.status === 'completed');
  }

  /**
   * Get tasks blocked by this task
   */
  async getBlockedTasks(taskId: string): Promise<OrchestratorTask[]> {
    const tasks = await this.db('orchestrator_tasks')
      .whereRaw('? = ANY(depends_on)', [taskId])
      .whereIn('status', ['pending', 'queued']);

    return tasks.map(t => this.mapDbTaskToTask(t));
  }

  /**
   * Unblock tasks waiting on completed task
   */
  private async unblockDependentTasks(completedTaskId: string): Promise<void> {
    const blockedTasks = await this.getBlockedTasks(completedTaskId);

    for (const task of blockedTasks) {
      const satisfied = await this.areDependenciesSatisfied(task.id);
      if (satisfied) {
        logger.info('Task unblocked', { taskId: task.id, completedDependency: completedTaskId });
        this.emit('task:unblocked', task);
      }
    }
  }

  // ============================================================================
  // Task Queue Processing
  // ============================================================================

  /**
   * Get next task to process
   */
  async getNextTask(): Promise<OrchestratorTask | null> {
    // Find pending task with highest priority that has satisfied dependencies
    const tasks = await this.db('orchestrator_tasks')
      .where('status', 'pending')
      .where(builder => {
        builder.whereNull('scheduled_at').orWhere('scheduled_at', '<=', new Date());
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .limit(10);

    for (const dbTask of tasks) {
      const task = this.mapDbTaskToTask(dbTask);
      const satisfied = await this.areDependenciesSatisfied(task.id);
      if (satisfied) {
        return task;
      }
    }

    return null;
  }

  /**
   * Check if task should be cancelled
   */
  async shouldCancel(taskId: string): Promise<boolean> {
    const task = await this.db('orchestrator_tasks')
      .where('id', taskId)
      .select('cancellation_requested')
      .first();

    return task?.cancellation_requested || false;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get task statistics
   */
  async getStatistics(userId?: string): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
    recentCompleted: number;
    recentFailed: number;
    avgDuration: number;
  }> {
    let baseQuery = this.db('orchestrator_tasks');
    if (userId) {
      baseQuery = baseQuery.where('user_id', userId);
    }

    const [
      statusCounts,
      typeCounts,
      recent,
      avgDuration,
    ] = await Promise.all([
      baseQuery.clone().select('status').count('* as count').groupBy('status'),
      baseQuery.clone().select('task_type').count('* as count').groupBy('task_type'),
      baseQuery.clone()
        .where('completed_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .select('status')
        .count('* as count')
        .groupBy('status'),
      baseQuery.clone()
        .where('status', 'completed')
        .avg('actual_duration_seconds as avg')
        .first(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = parseInt(row.count as string, 10);
    }

    const byType: Record<string, number> = {};
    for (const row of typeCounts) {
      byType[row.task_type] = parseInt(row.count as string, 10);
    }

    const recentByStatus: Record<string, number> = {};
    for (const row of recent) {
      recentByStatus[row.status] = parseInt(row.count as string, 10);
    }

    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus: byStatus as Record<TaskStatus, number>,
      byType: byType as Record<TaskType, number>,
      recentCompleted: recentByStatus['completed'] || 0,
      recentFailed: recentByStatus['failed'] || 0,
      avgDuration: avgDuration?.avg ? parseFloat(avgDuration.avg) : 0,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up old completed/failed tasks
   */
  async cleanupOldTasks(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.taskRetention * 24 * 60 * 60 * 1000);

    const deleted = await this.db('orchestrator_tasks')
      .whereIn('status', ['completed', 'failed', 'cancelled', 'timeout'])
      .where('completed_at', '<', cutoff)
      .delete();

    if (deleted > 0) {
      logger.info('Old tasks cleaned up', { deleted, cutoffDate: cutoff });
    }

    return deleted;
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldTasks().catch(err => {
        logger.error('Task cleanup error', { error: err });
      });
    }, this.config.cleanupInterval * 1000);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapDbTaskToTask(db: any): OrchestratorTask {
    return {
      id: db.id,
      taskType: db.task_type,
      name: db.name,
      description: db.description,
      userId: db.user_id,
      initiatedBy: db.initiated_by,
      status: db.status,
      priority: db.priority,
      progressPercentage: db.progress_percentage,
      progressMessage: db.progress_message,
      totalItems: db.total_items,
      completedItems: db.completed_items,
      failedItems: db.failed_items,
      inputData: db.input_data ? JSON.parse(db.input_data) : undefined,
      outputData: db.output_data ? JSON.parse(db.output_data) : undefined,
      context: db.context ? JSON.parse(db.context) : undefined,
      createdAt: new Date(db.created_at),
      scheduledAt: db.scheduled_at ? new Date(db.scheduled_at) : undefined,
      startedAt: db.started_at ? new Date(db.started_at) : undefined,
      completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
      maxDurationSeconds: db.max_duration_seconds,
      actualDurationSeconds: db.actual_duration_seconds,
      retryCount: db.retry_count,
      maxRetries: db.max_retries,
      errorMessage: db.error_message,
      errorCode: db.error_code,
      dependsOn: db.depends_on || [],
      blockedBy: db.blocked_by || [],
      workerId: db.worker_id,
      cancellationRequested: db.cancellation_requested,
    };
  }
}

export default OrchestratorService;
