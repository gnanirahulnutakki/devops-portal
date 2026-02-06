// =============================================================================
// Queue Statistics API
// Returns real-time queue metrics and health
// =============================================================================

import { NextResponse } from 'next/server';
import { bulkOperationsQueue } from '@/lib/queue';
import { getQueueHealth, getBulkOperationMetrics } from '@/lib/queue-metrics';
import { withTenantApiHandler } from '@/lib/api';

/**
 * GET /api/queue/stats
 * Returns queue health and statistics
 */
export const GET = withTenantApiHandler(
  async () => {
    try {
      const [health, metrics] = await Promise.all([
        getQueueHealth(bulkOperationsQueue),
        getBulkOperationMetrics(bulkOperationsQueue),
      ]);

      return NextResponse.json({
        health,
        metrics,
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
