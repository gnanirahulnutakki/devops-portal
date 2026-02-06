// =============================================================================
// Queue Metrics Tests (Unit Tests)
// =============================================================================

import { describe, it, expect } from 'vitest';

describe('Queue Health Status', () => {
  function determineQueueHealth(stats: {
    waiting: number;
    active: number;
    failed: number;
    workers: number;
  }): 'healthy' | 'degraded' | 'unhealthy' {
    // No workers = unhealthy
    if (stats.workers === 0 && (stats.waiting > 0 || stats.active > 0)) {
      return 'unhealthy';
    }
    
    // High failure rate = degraded
    const total = stats.waiting + stats.active;
    if (total > 0 && stats.failed > total * 0.1) {
      return 'degraded';
    }
    
    // High backlog = degraded
    if (stats.waiting > 100) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  it('reports healthy when queue is operating normally', () => {
    const status = determineQueueHealth({
      waiting: 5,
      active: 2,
      failed: 0,
      workers: 3,
    });
    expect(status).toBe('healthy');
  });

  it('reports unhealthy when no workers but jobs waiting', () => {
    const status = determineQueueHealth({
      waiting: 10,
      active: 0,
      failed: 0,
      workers: 0,
    });
    expect(status).toBe('unhealthy');
  });

  it('reports degraded when backlog is high', () => {
    const status = determineQueueHealth({
      waiting: 500,
      active: 10,
      failed: 5,
      workers: 3,
    });
    expect(status).toBe('degraded');
  });

  it('reports degraded when failure rate is high', () => {
    const status = determineQueueHealth({
      waiting: 10,
      active: 5,
      failed: 10, // > 10% of total
      workers: 3,
    });
    expect(status).toBe('degraded');
  });
});

describe('Job Processing Metrics', () => {
  interface JobMetrics {
    jobId: string;
    name: string;
    startTime: number;
    endTime?: number;
    status: 'pending' | 'active' | 'completed' | 'failed';
    attempts: number;
    error?: string;
  }

  function calculateProcessingTime(job: JobMetrics): number | null {
    if (!job.endTime) return null;
    return job.endTime - job.startTime;
  }

  function calculateSuccessRate(jobs: JobMetrics[]): number {
    if (jobs.length === 0) return 0;
    const completed = jobs.filter(j => j.status === 'completed').length;
    return completed / jobs.length;
  }

  it('calculates processing time correctly', () => {
    const job: JobMetrics = {
      jobId: 'job-1',
      name: 'test',
      startTime: 1000,
      endTime: 1500,
      status: 'completed',
      attempts: 1,
    };
    expect(calculateProcessingTime(job)).toBe(500);
  });

  it('returns null for incomplete jobs', () => {
    const job: JobMetrics = {
      jobId: 'job-1',
      name: 'test',
      startTime: 1000,
      status: 'active',
      attempts: 1,
    };
    expect(calculateProcessingTime(job)).toBeNull();
  });

  it('calculates success rate correctly', () => {
    const jobs: JobMetrics[] = [
      { jobId: '1', name: 't', startTime: 0, status: 'completed', attempts: 1 },
      { jobId: '2', name: 't', startTime: 0, status: 'completed', attempts: 1 },
      { jobId: '3', name: 't', startTime: 0, status: 'failed', attempts: 2 },
      { jobId: '4', name: 't', startTime: 0, status: 'completed', attempts: 1 },
    ];
    expect(calculateSuccessRate(jobs)).toBe(0.75);
  });

  it('handles empty job list', () => {
    expect(calculateSuccessRate([])).toBe(0);
  });
});

describe('Queue Depth Alerts', () => {
  interface AlertThresholds {
    warning: number;
    critical: number;
  }

  function checkQueueDepthAlert(
    depth: number,
    thresholds: AlertThresholds
  ): 'ok' | 'warning' | 'critical' {
    if (depth >= thresholds.critical) return 'critical';
    if (depth >= thresholds.warning) return 'warning';
    return 'ok';
  }

  const thresholds = { warning: 50, critical: 200 };

  it('returns ok for low queue depth', () => {
    expect(checkQueueDepthAlert(10, thresholds)).toBe('ok');
  });

  it('returns warning for moderate queue depth', () => {
    expect(checkQueueDepthAlert(75, thresholds)).toBe('warning');
  });

  it('returns critical for high queue depth', () => {
    expect(checkQueueDepthAlert(250, thresholds)).toBe('critical');
  });

  it('returns critical at exactly critical threshold', () => {
    expect(checkQueueDepthAlert(200, thresholds)).toBe('critical');
  });
});

describe('Worker Activity', () => {
  function calculateWorkerUtilization(params: {
    activeJobs: number;
    totalWorkers: number;
    concurrencyPerWorker: number;
  }): number {
    const maxCapacity = params.totalWorkers * params.concurrencyPerWorker;
    if (maxCapacity === 0) return 0;
    return Math.min(params.activeJobs / maxCapacity, 1);
  }

  it('calculates utilization correctly', () => {
    const utilization = calculateWorkerUtilization({
      activeJobs: 15,
      totalWorkers: 3,
      concurrencyPerWorker: 10,
    });
    expect(utilization).toBe(0.5);
  });

  it('caps utilization at 100%', () => {
    const utilization = calculateWorkerUtilization({
      activeJobs: 50,
      totalWorkers: 3,
      concurrencyPerWorker: 10,
    });
    expect(utilization).toBe(1);
  });

  it('handles zero workers', () => {
    const utilization = calculateWorkerUtilization({
      activeJobs: 10,
      totalWorkers: 0,
      concurrencyPerWorker: 10,
    });
    expect(utilization).toBe(0);
  });
});
