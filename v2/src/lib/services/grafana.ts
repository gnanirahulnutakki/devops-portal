import prisma from '@/lib/prisma';
import { createGrafanaClient, fetchJson } from '@/lib/http-client';

/**
 * Check if Grafana is configured (either via env or org settings)
 * This is a quick check that doesn't require DB access for basic env config
 */
export function isGrafanaConfigured(_organizationId: string): boolean {
  // For now, just check env vars - org-specific config would need DB lookup
  return !!(process.env.GRAFANA_URL && process.env.GRAFANA_API_KEY);
}

export interface GrafanaDashboard {
  id: number;
  uid: string;
  title: string;
  type: string;
  uri: string;
  url: string;
  tags: string[];
  folderTitle?: string;
}

export interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
  url: string;
}

export interface GrafanaAlert {
  uid: string;
  title: string;
  condition: string;
  data: unknown;
  orgId?: number;
  updated?: string;
  ruleGroup?: string;
  folderUid?: string;
  folderTitle?: string;
}

interface GrafanaCreds {
  baseUrl: string;
  apiKey: string;
}

async function getGrafanaCreds(organizationId: string): Promise<GrafanaCreds> {
  // Fetch org settings once; fall back to env
  const envBase = process.env.GRAFANA_URL;
  const envKey = process.env.GRAFANA_API_KEY;
  if (!envBase || !envKey) {
    throw new Error('Grafana is not configured. Set GRAFANA_URL and GRAFANA_API_KEY');
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  const baseUrl = (settings.grafanaUrl as string) || envBase;
  const apiKey = (settings.grafanaApiKey as string) || envKey;

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

export async function listDashboards(orgId: string): Promise<GrafanaDashboard[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(baseUrl, apiKey);
  return fetchJson<GrafanaDashboard[]>(client, '/api/search?type=dash-db');
}

export async function listFolders(orgId: string): Promise<GrafanaFolder[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(baseUrl, apiKey);
  return fetchJson<GrafanaFolder[]>(client, '/api/folders');
}

export async function listAlerts(orgId: string): Promise<GrafanaAlert[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(baseUrl, apiKey);
  // Grafana Alerting (Unified) API
  return fetchJson<GrafanaAlert[]>(client, '/api/ruler/grafana/api/v1/rules');
}

export async function getRenderUrl(orgId: string, params: {
  uid: string;
  panelId?: string;
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
  from?: string;
  to?: string;
  vars?: Record<string, string>;
}): Promise<string> {
  const { baseUrl } = await getGrafanaCreds(orgId);
  const {
    uid,
    panelId = '1',
    width = '1000',
    height = '500',
    theme = 'light',
    from,
    to,
    vars,
  } = params;

  const url = new URL(`${baseUrl}/render/d-solo/${uid}`);
  url.searchParams.set('panelId', panelId);
  url.searchParams.set('width', width);
  url.searchParams.set('height', height);
  url.searchParams.set('theme', theme);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  if (vars) {
    Object.entries(vars).forEach(([key, value]) => {
      url.searchParams.set(`var-${key}`, value);
    });
  }
  return url.toString();
}

export async function proxyRender(orgId: string, renderUrl: string) {
  const { apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(renderUrl, apiKey);
  const res = await client.get('', { cache: 'no-store' });
  const arrayBuffer = await res.arrayBuffer();
  return new Response(Buffer.from(arrayBuffer), {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}

