// =============================================================================
// Queue Statistics API
// Returns real-time queue metrics and health
// =============================================================================

import { NextResponse } from 'next/server';
import { bulkOperationsQueue } from '@/lib/queue';
import { withTenantApiHandler } from '@/lib/api';

/**
 * GET /api/queue/stats
 * Returns queue health and statistics
 */
export const GET = withTenantApiHandler(
  async () => {
    try {
      const queue = bulkOperationsQueue.instance;
      
      // If Redis/Queue is not available, return disabled status
      if (!queue) {
        return NextResponse.json({
          health: {
            status: 'disabled',
            message: 'Queue system not available (Redis not configured)',
          },
          metrics: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      // Get queue stats from BullMQ
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      const workers = await queue.getWorkers();
      
      return NextResponse.json({
        health: {
          status: 'healthy',
          workers: workers.length,
        },
        metrics: counts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve queue statistics' },
        { status: 500 }
      );
    }
  },
  {
    requiredRole: 'USER',
    rateLimit: 'general',
  }
);
