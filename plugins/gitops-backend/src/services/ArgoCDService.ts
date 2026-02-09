import axios, { AxiosInstance } from 'axios';
import type {
  ArgoCDApplication,
  ArgoCDSyncRequest,
  ArgoCDSyncResponse,
  ArgoCDServiceConfig,
} from '../types';
import { ArgoCDError } from '../errors';

/**
 * ArgoCDService
 *
 * Handles all ArgoCD API operations for the GitOps portal
 * Includes mock data mode for development without ArgoCD access
 */
export class ArgoCDService {
  private client?: AxiosInstance;
  private config: ArgoCDServiceConfig;
  private useMockData: boolean;

  constructor(config: ArgoCDServiceConfig) {
    this.config = config;
    this.useMockData = !config.token || config.token === 'your_argocd_token';

    if (!this.useMockData) {
      this.client = axios.create({
        baseURL: config.url,
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    } else {
      console.log('[ArgoCDService] Using mock data mode (no token provided)');
    }
  }

  /**
   * List ArgoCD applications
   */
  async listApplications(filter?: string): Promise<ArgoCDApplication[]> {
    if (this.useMockData) {
      return this.getMockApplications(filter);
    }

    try {
      const response = await this.client!.get('/api/v1/applications', {
        params: {
          selector: filter,
        },
      });

      return response.data.items || [];
    } catch (error: any) {
      throw new ArgoCDError(
        `Failed to list ArgoCD applications: ${error.message}`,
        error.response?.status || 500,
        error
      );
    }
  }

  /**
   * Get a specific ArgoCD application
   */
  async getApplication(appName: string): Promise<ArgoCDApplication> {
    if (this.useMockData) {
      const apps = this.getMockApplications();
      const app = apps.find(a => a.metadata.name === appName);
      if (!app) {
        throw new ArgoCDError(`Application ${appName} not found`, 404);
      }
      return app;
    }

    try {
      const response = await this.client!.get(
        `/api/v1/applications/${appName}`
      );
      return response.data;
    } catch (error: any) {
      throw new ArgoCDError(
        `Failed to get ArgoCD application ${appName}: ${error.message}`,
        error.response?.status || 500,
        error
      );
    }
  }

  /**
   * Sync an ArgoCD application
   */
  async syncApplication(
    appName: string,
    syncRequest?: ArgoCDSyncRequest
  ): Promise<ArgoCDSyncResponse> {
    if (this.useMockData) {
      return this.getMockSyncResponse(appName);
    }

    try {
      const response = await this.client!.post(
        `/api/v1/applications/${appName}/sync`,
        {
          prune: syncRequest?.prune || false,
          dryRun: syncRequest?.dryRun || false,
          strategy: syncRequest?.strategy,
          revision: syncRequest?.revision,
        }
      );

      return {
        application: appName,
        status: 'Syncing',
        message: 'Sync initiated successfully',
        revision: response.data.revision,
      };
    } catch (error: any) {
      throw new ArgoCDError(
        `Failed to sync ArgoCD application ${appName}: ${error.message}`,
        error.response?.status || 500,
        error
      );
    }
  }

  /**
   * Sync multiple applications
   */
  async syncApplications(
    appNames: string[],
    syncRequest?: ArgoCDSyncRequest
  ): Promise<ArgoCDSyncResponse[]> {
    const results: ArgoCDSyncResponse[] = [];

    for (const appName of appNames) {
      try {
        const result = await this.syncApplication(appName, syncRequest);
        results.push(result);
      } catch (error: any) {
        results.push({
          application: appName,
          status: 'Failed',
          message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get applications by branch
   * Based on rli-use2 naming convention
   */
  async getApplicationsByBranch(branch: string): Promise<ArgoCDApplication[]> {
    const allApps = await this.listApplications();

    // Filter apps that match the branch name
    // Convention: app name starts with branch name
    return allApps.filter(app =>
      app.metadata.name.startsWith(branch) &&
      app.spec.source.targetRevision === branch
    );
  }

  /**
   * Get application health status
   */
  async getApplicationHealth(appName: string): Promise<{
    health: string;
    sync: string;
  }> {
    const app = await this.getApplication(appName);
    return {
      health: app.status.health.status,
      sync: app.status.sync.status,
    };
  }

  // ==========================================================================
  // Mock Data Methods (for development without ArgoCD token)
  // ==========================================================================

  private getMockApplications(filter?: string): ArgoCDApplication[] {
    // Mock rli-use2 ArgoCD applications based on production analysis
    const branches = ['mp02', 'mp04', 'mp06', 'mp08', 'jb01', 'jb02', 'dant', 'idoga'];
    const apps: ArgoCDApplication[] = [];

    branches.forEach(tenant => {
      const branchName = `rli-use2-${tenant}`;
      const namespace = `duploservices-${branchName}`;

      // Main radiantone application
      apps.push({
        metadata: {
          name: branchName,
          namespace: this.config.namespace,
          labels: {
            'app.kubernetes.io/name': 'radiantone',
            'app.kubernetes.io/instance': branchName,
            tenant: tenant,
          },
        },
        spec: {
          source: {
            repoURL: 'https://github.com/radiantlogic-saas/rli-use2',
            targetRevision: branchName,
            path: 'app/charts/radiantone',
          },
          destination: {
            server: 'https://kubernetes.default.svc',
            namespace: namespace,
          },
          project: 'default',
          syncPolicy: {
            automated: {
              prune: false,
              selfHeal: false,
            },
          },
        },
        status: {
          sync: {
            status: Math.random() > 0.3 ? 'Synced' : 'OutOfSync',
            revision: `sha-${tenant}`,
          },
          health: {
            status: Math.random() > 0.2 ? 'Healthy' : 'Progressing',
          },
        },
      });

      // igrcanalytics application (if tenant has it)
      if (['mp02', 'mp04', 'jb01'].includes(tenant)) {
        apps.push({
          metadata: {
            name: `${branchName}-ia`,
            namespace: this.config.namespace,
            labels: {
              'app.kubernetes.io/name': 'igrcanalytics',
              'app.kubernetes.io/instance': branchName,
              tenant: tenant,
            },
          },
          spec: {
            source: {
              repoURL: 'https://github.com/radiantlogic-saas/rli-use2',
              targetRevision: branchName,
              path: 'app/charts/igrcanalytics',
            },
            destination: {
              server: 'https://kubernetes.default.svc',
              namespace: namespace,
            },
            project: 'default',
          },
          status: {
            sync: {
              status: 'Synced',
              revision: `sha-${tenant}-ia`,
            },
            health: {
              status: 'Healthy',
            },
          },
        });
      }

      // observability application
      if (['mp02', 'jb01'].includes(tenant)) {
        apps.push({
          metadata: {
            name: `${branchName}-obs`,
            namespace: this.config.namespace,
            labels: {
              'app.kubernetes.io/name': 'observability',
              'app.kubernetes.io/instance': branchName,
              tenant: tenant,
            },
          },
          spec: {
            source: {
              repoURL: 'https://github.com/radiantlogic-saas/rli-use2',
              targetRevision: branchName,
              path: 'app/charts/observability',
            },
            destination: {
              server: 'https://kubernetes.default.svc',
              namespace: namespace,
            },
            project: 'default',
          },
          status: {
            sync: {
              status: 'Synced',
            },
            health: {
              status: 'Healthy',
            },
          },
        });
      }
    });

    // Apply filter if provided
    if (filter) {
      return apps.filter(app =>
        app.metadata.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return apps;
  }

  private getMockSyncResponse(appName: string): ArgoCDSyncResponse {
    return {
      application: appName,
      status: 'Syncing',
      message: 'Mock sync initiated successfully',
      revision: `mock-revision-${Date.now()}`,
    };
  }
}
