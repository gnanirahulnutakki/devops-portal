import { NextResponse } from 'next/server';
import { requireApiAuth, successResponse, errorResponse, withApiHandler } from '@/lib/api';
import { listDashboards } from '@/lib/services/grafana';
import { withApiContext, requireRole } from '@/lib/api-context';

// List Grafana dashboards for the current tenant
export const GET = withApiHandler(async () => {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withApiContext(async (ctx) => {
    try {
      requireRole(ctx, 'READWRITE');
      const dashboards = await listDashboards(ctx.tenant.organizationId);
      return successResponse(dashboards);
    } catch (error) {
      return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
    }
  });
});
