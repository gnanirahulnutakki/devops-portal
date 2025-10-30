import type { ArgoCDApplication, ArgoCDSyncRequest, ArgoCDSyncResponse, ArgoCDServiceConfig } from '../types';
/**
 * ArgoCDService
 *
 * Handles all ArgoCD API operations for the GitOps portal
 * Includes mock data mode for development without ArgoCD access
 */
export declare class ArgoCDService {
    private client?;
    private config;
    private useMockData;
    constructor(config: ArgoCDServiceConfig);
    /**
     * List ArgoCD applications
     */
    listApplications(filter?: string): Promise<ArgoCDApplication[]>;
    /**
     * Get a specific ArgoCD application
     */
    getApplication(appName: string): Promise<ArgoCDApplication>;
    /**
     * Sync an ArgoCD application
     */
    syncApplication(appName: string, syncRequest?: ArgoCDSyncRequest): Promise<ArgoCDSyncResponse>;
    /**
     * Sync multiple applications
     */
    syncApplications(appNames: string[], syncRequest?: ArgoCDSyncRequest): Promise<ArgoCDSyncResponse[]>;
    /**
     * Get applications by branch
     * Based on rli-use2 naming convention
     */
    getApplicationsByBranch(branch: string): Promise<ArgoCDApplication[]>;
    /**
     * Get application health status
     */
    getApplicationHealth(appName: string): Promise<{
        health: string;
        sync: string;
    }>;
    private getMockApplications;
    private getMockSyncResponse;
}
//# sourceMappingURL=ArgoCDService.d.ts.map