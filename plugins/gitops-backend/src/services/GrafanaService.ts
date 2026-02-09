import fetch from 'node-fetch';

export interface GrafanaDashboard {
  id: number;
  uid: string;
  title: string;
  uri: string;
  url: string;
  slug: string;
  type: string;
  tags: string[];
  isStarred: boolean;
  folderId?: number;
  folderUid?: string;
  folderTitle?: string;
  folderUrl?: string;
}

export interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
}

export interface GrafanaDashboardDetail {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  folder?: string;
  url: string;
  panels?: number;
  lastUpdated?: string;
}

interface GrafanaConfig {
  url: string;
  token: string;
}

export class GrafanaService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: GrafanaConfig) {
    this.baseUrl = config.url;
    this.token = config.token;
  }

  /**
   * List all dashboards from Grafana
   */
  async listDashboards(): Promise<GrafanaDashboardDetail[]> {
    try {
      // Use Grafana search API to get all dashboards
      const response = await fetch(`${this.baseUrl}/api/search?type=dash-db`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch dashboards: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const dashboards = await response.json() as GrafanaDashboard[];

      // Transform to our format
      return dashboards.map(dash => ({
        id: dash.uid,
        title: dash.title,
        description: dash.uri,
        tags: dash.tags || [],
        folder: dash.folderTitle || 'General',
        url: `${this.baseUrl}${dash.url}`,
        panels: 0, // We'd need to fetch full dashboard to get panel count
        lastUpdated: new Date().toISOString(), // API doesn't provide this in search
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching Grafana dashboards: ${error.message}`);
      }
      throw new Error('Unknown error fetching Grafana dashboards');
    }
  }

  /**
   * Get dashboard details by UID
   */
  async getDashboard(uid: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboards/uid/${uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching Grafana dashboard ${uid}: ${error.message}`);
      }
      throw new Error('Unknown error fetching Grafana dashboard');
    }
  }

  /**
   * List all folders from Grafana
   */
  async listFolders(): Promise<GrafanaFolder[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/folders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
      }

      return await response.json() as GrafanaFolder[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching Grafana folders: ${error.message}`);
      }
      throw new Error('Unknown error fetching Grafana folders');
    }
  }

  /**
   * Search dashboards with query
   */
  async searchDashboards(query: string): Promise<GrafanaDashboardDetail[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/search?type=dash-db&query=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search dashboards: ${response.status} ${response.statusText}`);
      }

      const dashboards = await response.json() as GrafanaDashboard[];

      return dashboards.map(dash => ({
        id: dash.uid,
        title: dash.title,
        description: dash.uri,
        tags: dash.tags || [],
        folder: dash.folderTitle || 'General',
        url: `${this.baseUrl}${dash.url}`,
        panels: 0,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error searching Grafana dashboards: ${error.message}`);
      }
      throw new Error('Unknown error searching Grafana dashboards');
    }
  }
}
