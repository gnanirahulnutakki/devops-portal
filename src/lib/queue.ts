import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from './logger';
import { BulkOperationStatus } from '@prisma/client';
import { 
  withWorkerContext, 
  WorkerContext,
  completeBulkOperation,
  updateBulkOperationProgress,
  TenantJobPayload,
} from './worker-context';
import { initQueueMetrics, trackWorkerActivity } from './queue-metrics';
import { getRedis } from './redis';

// =============================================================================
// Queue Configuration
// =============================================================================

function getConnection() {
  // Reuse the shared ioredis client configured from REDIS_URL in src/lib/redis.ts.
  // Avoids drift where the worker tries localhost:6379 while the rest of the app
  // talks to whatever REDIS_URL points at.
  return getRedis();
}

// =============================================================================
// Job Types
// =============================================================================

export interface BulkFileUpdateJob extends TenantJobPayload {
  type: 'BULK_FILE_UPDATE';
  action: 'bulk_file_update';
  operationId: string;
  branches: string[];
  updates: Array<{
    path: string;
    content: string;
    message: string;
  }>;
}

export interface BulkSyncJob extends TenantJobPayload {
  type: 'BULK_SYNC';
  action: 'bulk_sync';
  operationId: string;
  appNames: string[];
  prune: boolean;
}

export interface BulkRestartJob extends TenantJobPayload {
  type: 'BULK_RESTART';
  action: 'bulk_restart';
  operationId: string;
  deploymentIds: string[];
}

export type JobData = BulkFileUpdateJob | BulkSyncJob | BulkRestartJob;

// =============================================================================
// Queues (Lazy Initialized)
// =============================================================================

let _bulkOperationsQueue: Queue<JobData> | null = null;
let _queueEvents: QueueEvents | null = null;

function getBulkOperationsQueue(): Queue<JobData> | null {
  if (_bulkOperationsQueue) return _bulkOperationsQueue;
  
  const connection = getConnection();
  if (!connection) {
    logger.info('Redis not available, queue disabled');
    return null;
  }
  
  _bulkOperationsQueue = new Queue<JobData>('bulk-operations', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
      },
    },
  });
  
  return _bulkOperationsQueue;
}

// Export a getter for backwards compatibility
export const bulkOperationsQueue = {
  get instance() {
    return getBulkOperationsQueue();
  },
  async getJobCounts(...args: Parameters<Queue['getJobCounts']>) {
    const queue = getBulkOperationsQueue();
    if (!queue) return { waiting: 0, active: 0, failed: 0 };
    return queue.getJobCounts(...args);
  },
  async getWorkers() {
    const queue = getBulkOperationsQueue();
    if (!queue) return [];
    return queue.getWorkers();
  },
  async add(...args: Parameters<Queue<JobData>['add']>) {
    const queue = getBulkOperationsQueue();
    if (!queue) throw new Error('Queue not available - Redis not configured');
    return queue.add(...args);
  },
  async getJob(jobId: string) {
    const queue = getBulkOperationsQueue();
    if (!queue) return null;
    return queue.getJob(jobId);
  },
};

// =============================================================================
// Queue Events (Lazy Initialized)
// =============================================================================

function getQueueEvents(): QueueEvents | null {
  if (_queueEvents) return _queueEvents;
  
  const connection = getConnection();
  if (!connection) return null;
  
  _queueEvents = new QueueEvents('bulk-operations', { connection });
  
  _queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info({ jobId, returnvalue }, 'Job completed');
  });

  _queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, 'Job failed');
  });

  _queueEvents.on('progress', async ({ jobId, data }) => {
    logger.debug({ jobId, data }, 'Job progress');
  });
  
  return _queueEvents;
}

// =============================================================================
// Worker
// =============================================================================

async function processJob(job: Job<JobData>) {
  // Use withWorkerContext for tenant isolation and membership validation
  return withWorkerContext(job as Job<TenantJobPayload>, async (ctx) => {
    const { data } = job;
    
    logger.info({ jobId: job.id, type: data.type }, 'Processing job');
    
    // Update operation status to RUNNING (using tenant-scoped db)
    await ctx.db.bulkOperation.update({
      where: { id: data.operationId },
      data: {
        status: BulkOperationStatus.RUNNING,
        startedAt: new Date(),
      },
    });
    
    try {
      let result: unknown;
      
      switch (data.type) {
        case 'BULK_FILE_UPDATE':
          result = await processBulkFileUpdate(job as Job<BulkFileUpdateJob>, data as BulkFileUpdateJob, ctx);
          break;
        case 'BULK_SYNC':
          result = await processBulkSync(job as Job<BulkSyncJob>, data as BulkSyncJob, ctx);
          break;
        case 'BULK_RESTART':
          result = await processBulkRestart(job as Job<BulkRestartJob>, data as BulkRestartJob, ctx);
          break;
        default:
          throw new Error(`Unknown job type: ${(data as JobData).type}`);
      }
      
      // Update operation status to COMPLETED
      await completeBulkOperation(ctx, data.operationId, 'COMPLETED', { result });
      
      return result;
    } catch (error) {
      // Update operation status to FAILED
      await completeBulkOperation(ctx, data.operationId, 'FAILED', undefined, {
        message: (error as Error).message,
      });
      
      throw error;
    }
  });
}

async function processBulkFileUpdate(
  job: Job<BulkFileUpdateJob>,
  data: BulkFileUpdateJob,
  ctx: WorkerContext
) {
  const results: Array<{ branch: string; success: boolean; error?: string }> = [];
  const total = data.branches.length * data.updates.length;
  let completed = 0;
  let failed = 0;
  
  for (const branch of data.branches) {
    for (const _update of data.updates) {
      try {
        // TODO: Implement actual GitHub file update using _update
        // const github = await getGitHubServiceForUser(data.userId);
        // await github.updateFile({ branch, ..._update });
        
        results.push({ branch, success: true });
        completed++;
        
        await job.updateProgress(Math.round((completed / total) * 100));
        await updateBulkOperationProgress(ctx, data.operationId, completed, failed);
      } catch (error) {
        results.push({ branch, success: false, error: (error as Error).message });
        failed++;
      }
    }
  }
  
  return results;
}

async function processBulkSync(
  job: Job<BulkSyncJob>,
  data: BulkSyncJob,
  ctx: WorkerContext
) {
  const results: Array<{ appName: string; success: boolean; error?: string }> = [];
  let completed = 0;
  let failed = 0;
  
  for (const appName of data.appNames) {
    try {
      // TODO: Implement actual ArgoCD sync
      // const argocd = createArgoCDService();
      // await argocd.syncApplication(appName, { prune: data.prune });
      
      results.push({ appName, success: true });
      completed++;
      
      await job.updateProgress(Math.round((completed / data.appNames.length) * 100));
      await updateBulkOperationProgress(ctx, data.operationId, completed, failed);
    } catch (error) {
      results.push({ appName, success: false, error: (error as Error).message });
      failed++;
    }
  }
  
  return results;
}

async function processBulkRestart(
  job: Job<BulkRestartJob>,
  data: BulkRestartJob,
  ctx: WorkerContext
) {
  const results: Array<{ deploymentId: string; success: boolean; error?: string }> = [];
  let completed = 0;
  let failed = 0;
  
  for (const deploymentId of data.deploymentIds) {
    try {
      // TODO: Implement actual deployment restart
      
      results.push({ deploymentId, success: true });
      completed++;
      
      await job.updateProgress(Math.round((completed / data.deploymentIds.length) * 100));
      await updateBulkOperationProgress(ctx, data.operationId, completed, failed);
    } catch (error) {
      results.push({ deploymentId, success: false, error: (error as Error).message });
      failed++;
    }
  }
  
  return results;
}

// Create worker (only in non-edge runtime)
let worker: Worker<JobData> | null = null;
let cleanupMetrics: (() => Promise<void>) | null = null;

export function startWorker() {
  if (worker) return;
  
  const connection = getConnection();
  if (!connection) {
    logger.info('Redis not available, worker not started');
    return;
  }
  
  const queue = getBulkOperationsQueue();
  if (!queue) return;
  
  // Initialize queue metrics collection
  cleanupMetrics = initQueueMetrics(queue, 'bulk-operations', connection);
  
  worker = new Worker<JobData>('bulk-operations', processJob, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });
  
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });
  
  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
  });
  
  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'Worker error');
  });
  
  // Track worker activity
  worker.on('active', async () => {
    const workers = await bulkOperationsQueue.getWorkers();
    trackWorkerActivity('bulk-operations', workers.length);
  });
  
  logger.info('Bulk operations worker started');
}

export async function stopWorker() {
  if (cleanupMetrics) {
    await cleanupMetrics();
    cleanupMetrics = null;
  }
  
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Bulk operations worker stopped');
  }
}

// =============================================================================
// Job Helpers
// =============================================================================

export async function enqueueBulkFileUpdate(
  operationId: string,
  organizationId: string,
  userId: string,
  branches: string[],
  updates: BulkFileUpdateJob['updates']
) {
  return bulkOperationsQueue.add('bulk-file-update', {
    type: 'BULK_FILE_UPDATE',
    action: 'bulk_file_update',
    operationId,
    organizationId,
    userId,
    branches,
    updates,
  });
}

export async function enqueueBulkSync(
  operationId: string,
  organizationId: string,
  userId: string,
  appNames: string[],
  prune: boolean
) {
  return bulkOperationsQueue.add('bulk-sync', {
    type: 'BULK_SYNC',
    action: 'bulk_sync',
    operationId,
    organizationId,
    userId,
    appNames,
    prune,
  });
}

export async function enqueueBulkRestart(
  operationId: string,
  organizationId: string,
  userId: string,
  deploymentIds: string[]
) {
  return bulkOperationsQueue.add('bulk-restart', {
    type: 'BULK_RESTART',
    action: 'bulk_restart',
    operationId,
    organizationId,
    userId,
    deploymentIds,
  });
}

export async function getJobStatus(jobId: string) {
  const job = await bulkOperationsQueue.getJob(jobId);
  if (!job) return null;
  
  const state = await job.getState();
  const progress = job.progress;
  
  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
  };
}
