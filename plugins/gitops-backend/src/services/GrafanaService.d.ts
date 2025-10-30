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
export declare class GrafanaService {
    private readonly baseUrl;
    private readonly token;
    constructor(config: GrafanaConfig);
    /**
     * List all dashboards from Grafana
     */
    listDashboards(): Promise<GrafanaDashboardDetail[]>;
    /**
     * Get dashboard details by UID
     */
    getDashboard(uid: string): Promise<any>;
    /**
     * List all folders from Grafana
     */
    listFolders(): Promise<GrafanaFolder[]>;
    /**
     * Search dashboards with query
     */
    searchDashboards(query: string): Promise<GrafanaDashboardDetail[]>;
}
export {};
//# sourceMappingURL=GrafanaService.d.ts.map