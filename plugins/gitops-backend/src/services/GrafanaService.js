import fetch from 'node-fetch';
export class GrafanaService {
    constructor(config) {
        this.baseUrl = config.url;
        this.token = config.token;
    }
    /**
     * List all dashboards from Grafana
     */
    async listDashboards() {
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
            const dashboards = await response.json();
            // Transform to our format
            return dashboards.map(dash => ({
                id: dash.uid,
                title: dash.title,
                description: dash.uri,
                tags: dash.tags || [],
                folder: dash.folderTitle || 'General',
                url: `${this.baseUrl}${dash.url}`,
                panels: 0,
                lastUpdated: new Date().toISOString(), // API doesn't provide this in search
            }));
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error fetching Grafana dashboards: ${error.message}`);
            }
            throw new Error('Unknown error fetching Grafana dashboards');
        }
    }
    /**
     * Get dashboard details by UID
     */
    async getDashboard(uid) {
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error fetching Grafana dashboard ${uid}: ${error.message}`);
            }
            throw new Error('Unknown error fetching Grafana dashboard');
        }
    }
    /**
     * List all folders from Grafana
     */
    async listFolders() {
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
            return await response.json();
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error fetching Grafana folders: ${error.message}`);
            }
            throw new Error('Unknown error fetching Grafana folders');
        }
    }
    /**
     * Search dashboards with query
     */
    async searchDashboards(query) {
        try {
            const response = await fetch(`${this.baseUrl}/api/search?type=dash-db&query=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to search dashboards: ${response.status} ${response.statusText}`);
            }
            const dashboards = await response.json();
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error searching Grafana dashboards: ${error.message}`);
            }
            throw new Error('Unknown error searching Grafana dashboards');
        }
    }
}
//# sourceMappingURL=GrafanaService.js.map