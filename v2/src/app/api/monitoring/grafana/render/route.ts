import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api';
import { getRenderUrl, proxyRender } from '@/lib/services/grafana';
import { getOrganizationIdFromHeaders } from '@/lib/api-context';

// Note: Not using withApiHandler because proxyRender returns a raw Response for binary data
export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

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
    return NextResponse.json({ success: false, error: { code: 'UID_REQUIRED', message: 'uid is required' } }, { status: 400 });
  }

  const orgId = await getOrganizationIdFromHeaders();
  const url = await getRenderUrl(orgId, { uid, panelId, width, height, theme, from, to });
  return proxyRender(orgId, url);
}
