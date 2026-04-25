import prisma from '@/lib/prisma';
import { createGrafanaClient, fetchJson } from '@/lib/http-client';
import { getGrafanaCredentials } from './integration-credentials';

/**
 * Check if Grafana is configured (either via env or org settings)
 * Async check that verifies org-scoped credentials or env fallback
 */
export async function isGrafanaConfigured(
  organizationId: string,
  credentialId?: string
): Promise<boolean> {
  const creds = await getGrafanaCredentials(organizationId, { credentialId });
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

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
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
  state?: string;
  health?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface GrafanaAnnotation {
  id: number;
  dashboardId?: number;
  panelId?: number;
  time: number; // ms epoch
  timeEnd?: number;
  text: string;
  tags?: string[];
  type?: string;
  newState?: string;
  prevState?: string;
  alertId?: number;
  ruleId?: number;
  userId?: number;
  login?: string;
}

export interface GrafanaAlertmanagerAlert {
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  status?: {
    state?: string;
    silencedBy?: string[];
    inhibitedBy?: string[];
  };
}

interface GrafanaCreds {
  baseUrl: string;
  apiKey: string;
}

async function getGrafanaCreds(
  organizationId: string,
  credentialId?: string
): Promise<GrafanaCreds> {
  // First try integration credentials (org-scoped)
  const integrationCreds = await getGrafanaCredentials(organizationId, { credentialId });
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

export async function listDashboards(
  orgId: string,
  credentialId?: string
): Promise<GrafanaDashboard[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const dashboards = await fetchJson<GrafanaDashboard[]>(client, 'api/search?type=dash-db');
  // Resolve relative dashboard URLs to absolute URLs so the UI doesn't need the Grafana base URL
  return dashboards.map((d) => ({
    ...d,
    url: d.url.startsWith('http') ? d.url : `${baseUrl}${d.url}`,
  }));
}

export async function listFolders(
  orgId: string,
  credentialId?: string
): Promise<GrafanaFolder[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const folders = await fetchJson<GrafanaFolder[]>(client, 'api/folders');
  const slugify = (s: string) =>
    (s || 'folder')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'folder';

  // Resolve relative folder URLs to absolute URLs so the UI doesn't need to know the Grafana base URL
  return folders.map((f) => ({
    ...f,
    url: f.url
      ? (f.url.startsWith('http') ? f.url : `${baseUrl}${f.url}`)
      : `${baseUrl}/dashboards/f/${f.uid}/${slugify(f.title)}`,
  }));
}

export async function listAlerts(
  orgId: string,
  credentialId?: string
): Promise<GrafanaAlert[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  // Grafana Alerting (Unified) - try modern provisioning endpoint first (Grafana 9+)
  try {
    const rules = await fetchJson<any[]>(client, 'api/v1/provisioning/alert-rules');
    if (Array.isArray(rules)) {
      return rules.map((r: any) => ({
        uid: r.uid || r.id || r.title,
        title: r.title || r.name || 'Untitled Alert',
        condition: r.condition || '',
        data: r,
        orgId: r.orgID ?? r.orgId,
        updated: r.updated,
        ruleGroup: r.ruleGroup,
        folderUid: r.folderUID ?? r.folderUid,
        folderTitle: r.folderTitle,
        state: r.state,
        health: r.health,
        labels: r.labels,
        annotations: r.annotations,
      }));
    }
  } catch {
    // fall through to ruler API
  }

  // Grafana Alerting (Unified) API can return nested groups (ruler)
  const payload = await fetchJson<any>(client, 'api/ruler/grafana/api/v1/rules');
  if (Array.isArray(payload)) return payload as GrafanaAlert[];

  const groups: any[] = [];
  if (Array.isArray(payload?.groups)) {
    groups.push(...payload.groups);
  } else if (payload && typeof payload === 'object') {
    Object.values(payload).forEach((ns: any) => {
      if (Array.isArray(ns?.groups)) groups.push(...ns.groups);
    });
  }

  const rules: GrafanaAlert[] = [];
  groups.forEach((group) => {
    (group.rules || []).forEach((rule: any) => {
      rules.push({
        uid: rule.uid || rule.alertUID || rule.name,
        title: rule.title || rule.name || 'Untitled Alert',
        condition: rule.condition || rule.expression || '',
        data: rule.data,
        orgId: rule.orgId,
        updated: rule.updated || rule.updatedAt,
        ruleGroup: group.name || rule.ruleGroup,
        folderUid: rule.folderUid,
        folderTitle: rule.folderTitle,
        state: rule.state,
        health: rule.health,
        labels: rule.labels,
        annotations: rule.annotations,
      });
    });
  });

  return rules;
}

/**
 * Fetch alert events from Grafana annotations API.
 * This is the best way to build "recent alerts" + "noisiest alerts" analytics.
 */
export async function listAlertAnnotations(
  orgId: string,
  params: {
    fromMs: number;
    toMs: number;
    limit?: number;
    credentialId?: string;
  }
): Promise<GrafanaAnnotation[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, params.credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const limit = params.limit ?? 1000;
  const path = `api/annotations?type=alert&from=${encodeURIComponent(
    String(params.fromMs)
  )}&to=${encodeURIComponent(String(params.toMs))}&limit=${encodeURIComponent(String(limit))}`;
  const annotations = await fetchJson<GrafanaAnnotation[]>(client, path);
  return Array.isArray(annotations) ? annotations : [];
}

/**
 * Fetch active alerts from Grafana's embedded Alertmanager API (Unified Alerting).
 * Useful as a fallback when annotation history isn't available.
 */
export async function listAlertmanagerAlerts(
  orgId: string,
  credentialId?: string
): Promise<GrafanaAlertmanagerAlert[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const alerts = await fetchJson<GrafanaAlertmanagerAlert[]>(client, 'api/alertmanager/grafana/api/v2/alerts');
  return Array.isArray(alerts) ? alerts : [];
}

export async function listDashboardPanels(
  orgId: string,
  uid: string,
  credentialId?: string
): Promise<GrafanaPanel[]> {
  const { baseUrl, apiKey } = await getGrafanaCreds(orgId, credentialId);
  const client = createGrafanaClient(baseUrl, apiKey);
  const payload = await fetchJson<any>(client, `api/dashboards/uid/${uid}`);
  const panels = payload?.dashboard?.panels;
  if (!Array.isArray(panels)) return [];
  return panels
    .filter((panel: any) => typeof panel?.id === 'number')
    .map((panel: any) => ({
      id: panel.id,
      title: panel.title || `Panel ${panel.id}`,
      type: panel.type || 'panel',
    }));
}

export async function getRenderUrl(
  orgId: string,
  params: {
  uid: string;
  panelId?: string;
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
  from?: string;
  to?: string;
  vars?: Record<string, string>;
  credentialId?: string;
}): Promise<string> {
  const { baseUrl } = await getGrafanaCreds(orgId, params.credentialId);
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

export async function proxyRender(
  orgId: string,
  renderUrl: string,
  credentialId?: string
) {
  const { apiKey } = await getGrafanaCreds(orgId, credentialId);
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

