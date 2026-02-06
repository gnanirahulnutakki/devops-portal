import { NextResponse } from 'next/server';
import { createGrafanaClient } from '@/lib/http-client';

interface RenderParams {
  uid: string;
  panelId?: string;
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
}

function getEnv() {
  const baseUrl = process.env.GRAFANA_URL;
  const apiKey = process.env.GRAFANA_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('Grafana is not configured. Set GRAFANA_URL and GRAFANA_API_KEY.');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

export function getGrafanaRenderUrl(params: RenderParams): string {
  const { baseUrl } = getEnv();
  const {
    uid,
    panelId = '1',
    width = '1000',
    height = '500',
    theme = 'light',
  } = params;

  const url = new URL(`${baseUrl}/render/d-solo/${uid}`);
  url.searchParams.set('panelId', panelId);
  url.searchParams.set('width', width);
  url.searchParams.set('height', height);
  url.searchParams.set('theme', theme);
  return url.toString();
}

export async function proxyGrafanaRender(renderUrl: string) {
  const { apiKey } = getEnv();
  const client = createGrafanaClient(renderUrl, apiKey);

  const res = await client.get('', { cache: 'no-store' });

  // Stream the image bytes through Next.js
  const arrayBuffer = await res.arrayBuffer();
  return new NextResponse(Buffer.from(arrayBuffer), {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}

