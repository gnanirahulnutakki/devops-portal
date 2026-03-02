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
  // Metrics auth: require bearer token in production. IP-based checks are
  // spoofable via X-Forwarded-For so we never rely on them for security.
  const authHeader = request.headers.get('authorization');
  const metricsToken = process.env.METRICS_AUTH_TOKEN;

  if (metricsToken) {
    if (authHeader !== `Bearer ${metricsToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    // In production, METRICS_AUTH_TOKEN should always be set.
    // Without it, reject all requests to prevent unauthenticated access.
    return NextResponse.json(
      { error: 'Metrics endpoint not configured. Set METRICS_AUTH_TOKEN.' },
      { status: 503 }
    );
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
