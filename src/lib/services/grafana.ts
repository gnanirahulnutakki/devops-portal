import prisma from '@/lib/prisma';
import { createGrafanaClient, fetchJson } from '@/lib/http-client';
import { getGrafanaCredentials } from './integration-credentials';

/**
 * Check if Grafana is configured (either via env or org settings)
 * Async check that verifies org-scoped credentials or env fallback
 */
export async function isGrafanaConfigured(organizationId: string): Promise<boolean> {
  const creds = await getGrafanaCredentials(organizationId);
  return creds !== null;
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
  // First try integration credentials (org-scoped)
  const integrationCreds = await getGrafanaCredentials(organizationId);
  if (integrationCreds) {
    return {
      baseUrl: integrationCreds.url.replace(/\/$/, ''),
      apiKey: integrationCreds.apiKey,
    };
  }

  // Fallback to org settings in DB
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as Record<string, unknown>) || {};
  const settingsUrl = settings.grafanaUrl as string | undefined;
  const settingsKey = settings.grafanaApiKey as string | undefined;

  if (settingsUrl && settingsKey) {
    return {
      baseUrl: settingsUrl.replace(/\/$/, ''),
      apiKey: settingsKey,
    };
  }

  // Final fallback to env vars
  const envBase = process.env.GRAFANA_URL;
  const envKey = process.env.GRAFANA_API_KEY;
  if (!envBase || !envKey) {
    throw new Error('Grafana is not configured. Set GRAFANA_URL and GRAFANA_API_KEY or configure integration credentials.');
  }

  return { baseUrl: envBase.replace(/\/$/, ''), apiKey: envKey };
}

export async function listDashboards(orgId: string): Promise<GrafanaDashboard[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const dashboards = await fetchJson<GrafanaDashboard[]>(client, '/api/search?type=dash-db');
  // Resolve relative dashboard URLs to absolute URLs so the UI doesn't need the Grafana base URL
  return dashboards.map((d) => ({
    ...d,
    url: d.url.startsWith('http') ? d.url : `${baseUrl}${d.url}`,
  }));
}

export async function listFolders(orgId: string): Promise<GrafanaFolder[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const folders = await fetchJson<GrafanaFolder[]>(client, '/api/folders');
  // Resolve relative folder URLs to absolute URLs so the UI doesn't need to know the Grafana base URL
  return folders.map((f) => ({
    ...f,
    url: f.url.startsWith('http') ? f.url : `${baseUrl}${f.url}`,
  }));
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

