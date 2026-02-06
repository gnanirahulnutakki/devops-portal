import { NextResponse } from 'next/server';
import { requireApiAuth, successResponse, errorResponse, withApiHandler } from '@/lib/api';
import { listDashboards } from '@/lib/services/grafana';
import { getOrganizationIdFromHeaders } from '@/lib/api-context';

// List Grafana dashboards for the current tenant
export const GET = withApiHandler(async () => {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const orgId = getOrganizationIdFromHeaders();
    const dashboards = await listDashboards(orgId);
    return successResponse(dashboards);
  } catch (error) {
    return errorResponse('GRAFANA_FETCH_FAILED', (error as Error).message, 500);
  }
});
