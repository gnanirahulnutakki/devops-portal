// =============================================================================
// Prometheus Metrics Endpoint
// Exposes application metrics for Prometheus scraping
// =============================================================================

import { NextResponse } from 'next/server';
import { getMetricsText, getMetricsContentType } from '@/lib/metrics';

/**
 * GET /api/metrics
 * Returns Prometheus-formatted metrics
 * 
 * This endpoint should be:
 * - Protected in production (IP allowlist or auth)
 * - Scraped by Prometheus at regular intervals (15s default)
 */
export async function GET(request: Request) {
  // Optional: Check for metrics authorization token
  const authHeader = request.headers.get('authorization');
  const metricsToken = process.env.METRICS_AUTH_TOKEN;
  
  if (metricsToken && authHeader !== `Bearer ${metricsToken}`) {
    // Check if request is from localhost/internal
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim();
    const isInternal = !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');
    
    if (!isInternal) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const metrics = await getMetricsText();
    
    return new Response(metrics, {
      status: 200,
      headers: {
        'Content-Type': getMetricsContentType(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}
