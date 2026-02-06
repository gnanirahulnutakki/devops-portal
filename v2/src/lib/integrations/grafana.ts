import { createGrafanaClient, fetchJson } from '@/lib/http-client';

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

function getEnv() {
  const baseUrl = process.env.GRAFANA_URL;
  const apiKey = process.env.GRAFANA_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('Grafana is not configured. Set GRAFANA_URL and GRAFANA_API_KEY.');
  }
  return { baseUrl, apiKey };
}

export async function listGrafanaDashboards(): Promise<GrafanaDashboard[]> {
  const { baseUrl, apiKey } = getEnv();
  const client = createGrafanaClient(baseUrl, apiKey);
  // Grafana search API. type=dash-db ensures dashboards only.
  return fetchJson<GrafanaDashboard[]>(client, '/api/search?type=dash-db');
}

export function getGrafanaIframeUrl(dashboardUid: string): string {
  const { baseUrl } = getEnv();
  // Use the public dashboard view; auth via API key on proxy request, not in iframe.
  return `${baseUrl.replace(/\/$/, '')}/d/${dashboardUid}`;
}
