import { NextResponse } from 'next/server';
import { requireApiAuth, withApiHandler } from '@/lib/api';
import { getGrafanaRenderUrl, proxyGrafanaRender } from '@/lib/integrations/grafana-render';

export const GET = withApiHandler(async (request: Request) => {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const panelId = searchParams.get('panelId') ?? '1';
  const width = searchParams.get('width') ?? '1000';
  const height = searchParams.get('height') ?? '500';
  const themeParam = searchParams.get('theme');
  const theme: 'light' | 'dark' = themeParam === 'dark' ? 'dark' : 'light';

  if (!uid) {
    return NextResponse.json({ success: false, error: { code: 'UID_REQUIRED', message: 'uid is required' } }, { status: 400 });
  }

  const url = getGrafanaRenderUrl({ uid, panelId, width, height, theme });
  return proxyGrafanaRender(url);
});

