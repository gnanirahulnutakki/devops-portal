import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { bulkOperationsQueue } from '@/lib/queue';

// =============================================================================
// Health Check Types
// =============================================================================

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
  system?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    nodeVersion: string;
  };
}

// Track process start time for uptime calculation
const startTime = Date.now();

// =============================================================================
// Health Check Endpoint
// =============================================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get('verbose') === 'true';
  
  const checks: Record<string, HealthCheck> = {};
  
  // 1. Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - dbStart;
    checks.database = { 
      status: latency > 1000 ? 'degraded' : 'healthy', 
      latency,
    };
    
    if (verbose) {
      // Get connection pool stats if available
      const poolInfo = await prisma.$queryRaw<Array<{ numbackends: number }>>`
        SELECT numbackends FROM pg_stat_database WHERE datname = current_database()
      `.catch(() => [{ numbackends: 0 }]);
      checks.database.details = {
        connections: poolInfo[0]?.numbackends || 0,
      };
    }
  } catch (error) {
    checks.database = { status: 'unhealthy', error: (error as Error).message };
  }

  // 2. Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - redisStart;
    checks.redis = { 
      status: latency > 500 ? 'degraded' : 'healthy', 
      latency,
    };
    
    if (verbose) {
      const info = await redis.info('memory').catch(() => '');
      const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
      checks.redis.details = {
        usedMemoryBytes: usedMemory ? parseInt(usedMemory) : undefined,
      };
    }
  } catch (error) {
    checks.redis = { status: 'unhealthy', error: (error as Error).message };
  }

  // 3. Queue check
  try {
    const queueStart = Date.now();
    const counts = await bulkOperationsQueue.getJobCounts(
      'waiting',
      'active',
      'failed'
    );
    const workers = await bulkOperationsQueue.getWorkers();
    const latency = Date.now() - queueStart;
    
    let queueStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Unhealthy if jobs waiting but no workers
    if (counts.waiting > 0 && workers.length === 0) {
      queueStatus = 'unhealthy';
    }
    // Degraded if many failed jobs or high queue depth
    else if (counts.failed > 10 || counts.waiting > 50) {
      queueStatus = 'degraded';
    }
    
    checks.queue = {
      status: queueStatus,
      latency,
      details: {
        waiting: counts.waiting,
        active: counts.active,
        failed: counts.failed,
        workers: workers.length,
      },
    };
  } catch (error) {
    checks.queue = { status: 'unhealthy', error: (error as Error).message };
  }

  // 4. Optional: External integrations check (only in verbose mode)
  if (verbose) {
    // ArgoCD check
    if (process.env.ARGOCD_URL) {
      const argoStart = Date.now();
      try {
        const response = await fetch(`${process.env.ARGOCD_URL}/api/v1/session/userinfo`, {
          headers: {
            'Authorization': `Bearer ${process.env.ARGOCD_TOKEN || ''}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        checks.argocd = {
          status: response.ok ? 'healthy' : 'degraded',
          latency: Date.now() - argoStart,
        };
      } catch (error) {
        checks.argocd = { 
          status: 'unhealthy', 
          error: (error as Error).message,
          latency: Date.now() - argoStart,
        };
      }
    }

    // Grafana check
    if (process.env.GRAFANA_URL) {
      const grafanaStart = Date.now();
      try {
        const response = await fetch(`${process.env.GRAFANA_URL}/api/health`, {
          headers: {
            'Authorization': `Bearer ${process.env.GRAFANA_API_KEY || ''}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        checks.grafana = {
          status: response.ok ? 'healthy' : 'degraded',
          latency: Date.now() - grafanaStart,
        };
      } catch (error) {
        checks.grafana = { 
          status: 'unhealthy', 
          error: (error as Error).message,
          latency: Date.now() - grafanaStart,
        };
      }
    }
  }

  // Calculate overall status
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // Add system info in verbose mode
  if (verbose) {
    const memUsage = process.memoryUsage();
    response.system = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      nodeVersion: process.version,
    };
  }

  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { 
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
