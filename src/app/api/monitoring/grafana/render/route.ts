import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/api';
import { getRenderUrl, proxyRender, isGrafanaConfigured } from '@/lib/services/grafana';
import { withApiContext, requireRole } from '@/lib/api-context';
import { logger } from '@/lib/logger';

// Note: Not using withTenantApiHandler because proxyRender returns a raw Response for binary data
export async function GET(request: Request) {
  try {
    return await withApiContext(async (ctx) => {
      requireRole(ctx, 'USER');

      // Org-scoped rate limiting using dedicated 'render' limiter (20/min default)
      const rateLimitId = `grafana:render:${ctx.tenant.organizationId}`;
      const rateLimit = await checkRateLimit('render', rateLimitId);
      if (!rateLimit.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'RATE_LIMIT_EXCEEDED', 
              message: 'Too many render requests. Try again later.' 
            } 
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': rateLimit.limit.toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            },
          }
        );
      }

      const { searchParams } = new URL(request.url);
      const uid = searchParams.get('uid');
      const panelId = searchParams.get('panelId') ?? '1';
      const width = searchParams.get('width') ?? '1000';
      const height = searchParams.get('height') ?? '500';
      const themeParam = searchParams.get('theme');
      const theme: 'light' | 'dark' = themeParam === 'dark' ? 'dark' : 'light';
      const from = searchParams.get('from') ?? undefined;
      const to = searchParams.get('to') ?? undefined;

      if (!uid) {
        return NextResponse.json(
          { success: false, error: { code: 'UID_REQUIRED', message: 'uid is required' } },
          { status: 400 }
        );
      }

      // Check if Grafana is configured (async - checks org creds + env fallback)
      const configured = await isGrafanaConfigured(ctx.tenant.organizationId);
      if (!configured) {
        return NextResponse.json(
          { success: false, error: { code: 'GRAFANA_NOT_CONFIGURED', message: 'Grafana is not configured' } },
          { status: 400 }
        );
      }

      const url = await getRenderUrl(ctx.tenant.organizationId, {
        uid,
        panelId,
        width,
        height,
        theme,
        from,
        to,
      });

      const response = await proxyRender(ctx.tenant.organizationId, url);

      // Add security headers for rendered images
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Cache-Control', 'private, max-age=60');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    });
  } catch (error) {
    logger.error({ error }, 'Grafana render failed');
    
    if (error instanceof Error) {
      if (error.message.includes('does not have access')) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
      if (error.message.includes('requires') && error.message.includes('role')) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'RENDER_FAILED', message: 'Failed to render panel' } },
      { status: 500 }
    );
  }
}
