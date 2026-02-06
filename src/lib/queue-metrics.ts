// =============================================================================
// Queue Metrics Collector
// Integrates BullMQ with Prometheus metrics
// =============================================================================

import { Queue, QueueEvents, Job } from 'bullmq';
import { logger } from './logger';
import {
  recordQueueJob,
  updateQueueDepth,
  queueWorkerActiveGauge,
} from './metrics';

// Track job start times for duration calculation
const jobStartTimes = new Map<string, number>();

/**
 * Initialize queue metrics collection for a BullMQ queue
 */
export function initQueueMetrics(
  queue: Queue,
  queueName: string,
  connection: { host: string; port: number }
) {
  const queueEvents = new QueueEvents(queueName, { connection });

  // Track when jobs start (for duration calculation)
  queueEvents.on('active', ({ jobId }) => {
    jobStartTimes.set(jobId, Date.now());
    logger.debug({ jobId, queue: queueName }, 'Job started');
  });

  // Track completed jobs
  queueEvents.on('completed', async ({ jobId }) => {
    const startTime = jobStartTimes.get(jobId);
    const duration = startTime ? Date.now() - startTime : undefined;
    jobStartTimes.delete(jobId);

    // Get job type from the queue
    const job = await queue.getJob(jobId);
    const jobType = (job?.data as { type?: string })?.type || 'unknown';

    recordQueueJob(queueName, jobType, 'completed', duration);
    logger.debug({ jobId, queue: queueName, duration }, 'Job completed');
  });

  // Track failed jobs
  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    const startTime = jobStartTimes.get(jobId);
    const duration = startTime ? Date.now() - startTime : undefined;
    jobStartTimes.delete(jobId);

    const job = await queue.getJob(jobId);
    const jobType = (job?.data as { type?: string })?.type || 'unknown';

    recordQueueJob(queueName, jobType, 'failed', duration);
    logger.warn({ jobId, queue: queueName, failedReason }, 'Job failed');
  });

  // Track stalled jobs
  queueEvents.on('stalled', async ({ jobId }) => {
    const job = await queue.getJob(jobId);
    const jobType = (job?.data as { type?: string })?.type || 'unknown';

    recordQueueJob(queueName, jobType, 'stalled');
    logger.warn({ jobId, queue: queueName }, 'Job stalled');
  });

  // Periodic queue depth updates
  const updateDepth = async () => {
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed'
      );
      updateQueueDepth(
        queueName,
        counts.waiting,
        counts.active,
        counts.delayed,
        counts.failed
      );
    } catch (error) {
      logger.error({ error, queue: queueName }, 'Failed to get queue counts');
    }
  };

  // Update depth every 15 seconds
  const depthInterval = setInterval(updateDepth, 15000);
  updateDepth(); // Initial update

  logger.info({ queue: queueName }, 'Queue metrics initialized');

  // Return cleanup function
  return async () => {
    clearInterval(depthInterval);
    await queueEvents.close();
    jobStartTimes.clear();
  };
}

/**
 * Track worker activity
 */
export function trackWorkerActivity(
  queueName: string,
  activeCount: number
) {
  queueWorkerActiveGauge.set({ queue: queueName }, activeCount);
}

/**
 * Middleware wrapper for tracking job processing
 */
export function withJobMetrics<T>(
  queueName: string,
  processor: (job: Job) => Promise<T>
): (job: Job) => Promise<T> {
  return async (job: Job) => {
    const startTime = Date.now();
    const jobType = (job.data as { type?: string })?.type || 'unknown';

    try {
      const result = await processor(job);
      const duration = Date.now() - startTime;
      recordQueueJob(queueName, jobType, 'completed', duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      recordQueueJob(queueName, jobType, 'failed', duration);
      throw error;
    }
  };
}

// =============================================================================
// Queue Health Check
// =============================================================================

export interface QueueHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  workers: {
    count: number;
  };
  latency?: {
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * Get health status for a queue
 */
export async function getQueueHealth(queue: Queue): Promise<QueueHealth> {
  const counts = await queue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  );

  const workers = await queue.getWorkers();

  // Determine health status based on queue state
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Unhealthy if no workers and jobs waiting
  if (workers.length === 0 && counts.waiting > 0) {
    status = 'unhealthy';
  }
  // Degraded if high failure rate or long queue
  else if (counts.failed > counts.completed * 0.1 || counts.waiting > 100) {
    status = 'degraded';
  }

  return {
    name: queue.name,
    status,
    metrics: {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    },
    workers: {
      count: workers.length,
    },
  };
}

// =============================================================================
// Bulk Operations Queue Specific Metrics
// =============================================================================

export interface BulkOperationMetrics {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageDuration: number;
  operationsByType: Record<string, number>;
}

/**
 * Get aggregated metrics for bulk operations
 */
export async function getBulkOperationMetrics(
  queue: Queue
): Promise<BulkOperationMetrics> {
  const completed = await queue.getCompleted(0, 1000);
  const failed = await queue.getFailed(0, 1000);

  const metrics: BulkOperationMetrics = {
    totalOperations: completed.length + failed.length,
    completedOperations: completed.length,
    failedOperations: failed.length,
    averageDuration: 0,
    operationsByType: {},
  };

  // Calculate average duration and count by type
  let totalDuration = 0;
  let durationCount = 0;

  for (const job of completed) {
    const type = (job.data as { type?: string })?.type || 'unknown';
    metrics.operationsByType[type] = (metrics.operationsByType[type] || 0) + 1;

    if (job.finishedOn && job.processedOn) {
      totalDuration += job.finishedOn - job.processedOn;
      durationCount++;
    }
  }

  for (const job of failed) {
    const type = (job.data as { type?: string })?.type || 'unknown';
    metrics.operationsByType[type] = (metrics.operationsByType[type] || 0) + 1;
  }

  if (durationCount > 0) {
    metrics.averageDuration = totalDuration / durationCount;
  }

  return metrics;
}
