// =============================================================================
// Credential Health BullMQ Worker
// Runs periodic health checks across all organization credentials
// =============================================================================

import { Queue, Worker } from 'bullmq';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { checkAllCredentials } from '@/lib/services/credential-health-orchestrator';
import { getRedis } from '@/lib/redis';

const QUEUE_NAME = 'credential-health';

// =============================================================================
// Lazy-initialized queue & worker
// =============================================================================

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getConnection() {
  // Reuse the shared ioredis client configured from REDIS_URL in src/lib/redis.ts
  // rather than assembling host/port from env vars. Avoids silent drift where the
  // rest of the app talks to one Redis and the worker tries another.
  return getRedis();
}

function getQueue(): Queue | null {
  if (_queue) return _queue;

  const connection = getConnection();
  if (!connection) return null;

  _queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  });

  return _queue;
}

// =============================================================================
// Job Processor
// =============================================================================

async function processHealthCheck(job: any) {
  logger.info({ jobId: job.id }, 'Starting credential health check sweep');

  // Get all organizations
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    try {
      const summary = await checkAllCredentials(org.id);
      logger.info(
        {
          orgId: org.id,
          orgName: org.name,
          total: summary.total,
          healthy: summary.healthy,
          degraded: summary.degraded,
          unhealthy: summary.unhealthy,
        },
        'Credential health check complete for org'
      );
    } catch (error) {
      logger.error(
        { orgId: org.id, error: (error as Error).message },
        'Credential health check failed for org'
      );
    }
  }

  return { organizations: orgs.length };
}

// =============================================================================
// Worker Lifecycle
// =============================================================================

export function startCredentialHealthWorker() {
  if (_worker) return;

  const connection = getConnection();
  if (!connection) {
    logger.info('Redis not available, credential health worker not started');
    return;
  }

  const queue = getQueue();
  if (!queue) return;

  // Add repeatable job (every 30 minutes)
  queue.add(
    'credential-health-sweep',
    {},
    {
      repeat: { every: 30 * 60 * 1000 }, // 30 minutes
      jobId: 'credential-health-repeatable',
    }
  );

  _worker = new Worker(QUEUE_NAME, processHealthCheck, {
    connection,
    concurrency: 1,
  });

  _worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Credential health sweep completed');
  });

  _worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Credential health sweep failed'
    );
  });

  logger.info('Credential health worker started (every 30 minutes)');
}

export async function stopCredentialHealthWorker() {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

// =============================================================================
// On-demand trigger
// =============================================================================

export async function triggerHealthCheck() {
  const queue = getQueue();
  if (!queue) throw new Error('Queue not available');
  return queue.add('credential-health-manual', {}, {
    jobId: `manual-${Date.now()}`,
  });
}
