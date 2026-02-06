import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { redis } from './redis';
import { logger } from './logger';
import { prisma } from './prisma';
import { BulkOperationStatus } from '@prisma/client';

// =============================================================================
// Queue Configuration
// =============================================================================

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// =============================================================================
// Job Types
// =============================================================================

export interface BulkFileUpdateJob {
  type: 'BULK_FILE_UPDATE';
  operationId: string;
  organizationId: string;
  userId: string;
  branches: string[];
  updates: Array<{
    path: string;
    content: string;
    message: string;
  }>;
}

export interface BulkSyncJob {
  type: 'BULK_SYNC';
  operationId: string;
  organizationId: string;
  userId: string;
  appNames: string[];
  prune: boolean;
}

export interface BulkRestartJob {
  type: 'BULK_RESTART';
  operationId: string;
  organizationId: string;
  userId: string;
  deploymentIds: string[];
}

export type JobData = BulkFileUpdateJob | BulkSyncJob | BulkRestartJob;

// =============================================================================
// Queues
// =============================================================================

export const bulkOperationsQueue = new Queue<JobData>('bulk-operations', {
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

// =============================================================================
// Queue Events
// =============================================================================

const queueEvents = new QueueEvents('bulk-operations', { connection });

queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  logger.info({ jobId, returnvalue }, 'Job completed');
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job failed');
});

queueEvents.on('progress', async ({ jobId, data }) => {
  logger.debug({ jobId, data }, 'Job progress');
});

// =============================================================================
// Worker
// =============================================================================

async function processJob(job: Job<JobData>) {
  const { data } = job;
  
  logger.info({ jobId: job.id, type: data.type }, 'Processing job');
  
  // Update operation status to RUNNING
  await prisma.bulkOperation.update({
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
        result = await processBulkFileUpdate(job, data);
        break;
      case 'BULK_SYNC':
        result = await processBulkSync(job, data);
        break;
      case 'BULK_RESTART':
        result = await processBulkRestart(job, data);
        break;
      default:
        throw new Error(`Unknown job type: ${(data as any).type}`);
    }
    
    // Update operation status to COMPLETED
    await prisma.bulkOperation.update({
      where: { id: data.operationId },
      data: {
        status: BulkOperationStatus.COMPLETED,
        completedAt: new Date(),
        output: result as any,
      },
    });
    
    return result;
  } catch (error) {
    // Update operation status to FAILED
    await prisma.bulkOperation.update({
      where: { id: data.operationId },
      data: {
        status: BulkOperationStatus.FAILED,
        completedAt: new Date(),
        errors: { message: (error as Error).message },
      },
    });
    
    throw error;
  }
}

async function processBulkFileUpdate(job: Job<BulkFileUpdateJob>, data: BulkFileUpdateJob) {
  const results: Array<{ branch: string; success: boolean; error?: string }> = [];
  const total = data.branches.length * data.updates.length;
  let completed = 0;
  
  for (const branch of data.branches) {
    for (const update of data.updates) {
      try {
        // TODO: Implement actual GitHub file update
        // const github = await getGitHubServiceForUser(data.userId);
        // await github.updateFile({ branch, ...update });
        
        results.push({ branch, success: true });
        completed++;
        
        await job.updateProgress(Math.round((completed / total) * 100));
        
        // Update progress in database
        await prisma.bulkOperation.update({
          where: { id: data.operationId },
          data: {
            completedItems: completed,
          },
        });
      } catch (error) {
        results.push({ branch, success: false, error: (error as Error).message });
      }
    }
  }
  
  return results;
}

async function processBulkSync(job: Job<BulkSyncJob>, data: BulkSyncJob) {
  const results: Array<{ appName: string; success: boolean; error?: string }> = [];
  let completed = 0;
  
  for (const appName of data.appNames) {
    try {
      // TODO: Implement actual ArgoCD sync
      // const argocd = createArgoCDService();
      // await argocd.syncApplication(appName, { prune: data.prune });
      
      results.push({ appName, success: true });
      completed++;
      
      await job.updateProgress(Math.round((completed / data.appNames.length) * 100));
      
      await prisma.bulkOperation.update({
        where: { id: data.operationId },
        data: {
          completedItems: completed,
        },
      });
    } catch (error) {
      results.push({ appName, success: false, error: (error as Error).message });
    }
  }
  
  return results;
}

async function processBulkRestart(job: Job<BulkRestartJob>, data: BulkRestartJob) {
  const results: Array<{ deploymentId: string; success: boolean; error?: string }> = [];
  let completed = 0;
  
  for (const deploymentId of data.deploymentIds) {
    try {
      // TODO: Implement actual deployment restart
      
      results.push({ deploymentId, success: true });
      completed++;
      
      await job.updateProgress(Math.round((completed / data.deploymentIds.length) * 100));
      
      await prisma.bulkOperation.update({
        where: { id: data.operationId },
        data: {
          completedItems: completed,
        },
      });
    } catch (error) {
      results.push({ deploymentId, success: false, error: (error as Error).message });
    }
  }
  
  return results;
}

// Create worker (only in non-edge runtime)
let worker: Worker<JobData> | null = null;

export function startWorker() {
  if (worker) return;
  
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
  
  logger.info('Bulk operations worker started');
}

export function stopWorker() {
  if (worker) {
    worker.close();
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
    operationId,
    organizationId,
    userId,
    appNames,
    prune,
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
