import { NextResponse } from 'next/server';
import { requireApiAuth, successResponse, errorResponse, withApiHandler } from '@/lib/api';
import { listGrafanaDashboards } from '@/lib/integrations/grafana';

// List Grafana dashboards for the current tenant
export const GET = withApiHandler(async () => {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const dashboards = await listGrafanaDashboards();
    return successResponse(dashboards);
  } catch (error) {
    return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
  }
});

