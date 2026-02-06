import { createArgoCDClient } from '../http-client';
import { logger } from '../logger';
import type { KyInstance } from 'ky';

// =============================================================================
// Types
// =============================================================================

export interface ArgoCDApplication {
  name: string;
  namespace: string;
  project: string;
  source: {
    repoURL: string;
    path: string;
    targetRevision: string;
  };
  destination: {
    server: string;
    namespace: string;
  };
  syncStatus: {
    status: 'Synced' | 'OutOfSync' | 'Unknown';
    revision: string;
  };
  healthStatus: {
    status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
    message?: string;
  };
  operationState?: {
    phase: string;
    message: string;
    startedAt: string;
    finishedAt?: string;
  };
  createdAt: string;
  reconciledAt?: string;
}

export interface ArgoCDApplicationResource {
  group: string;
  version: string;
  kind: string;
  namespace: string;
  name: string;
  status: string;
  health?: {
    status: string;
    message?: string;
  };
  requiresPruning?: boolean;
}

export interface ArgoCDSyncResult {
  revision: string;
  phase: string;
  message: string;
  resources: Array<{
    group: string;
    version: string;
    kind: string;
    namespace: string;
    name: string;
    status: string;
    message: string;
  }>;
}

export interface ArgoCDHistory {
  id: number;
  revision: string;
  deployedAt: string;
  deployStartedAt: string;
  source: {
    repoURL: string;
    path: string;
    targetRevision: string;
  };
}

// =============================================================================
// ArgoCD Service
// =============================================================================

export class ArgoCDService {
  private client: KyInstance;

  constructor(baseUrl: string, token: string) {
    this.client = createArgoCDClient(baseUrl, token);
  }

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------

  async listApplications(project?: string): Promise<ArgoCDApplication[]> {
    const params = new URLSearchParams();
    if (project) {
      params.set('projects', project);
    }

    const response = await this.client.get('api/v1/applications', {
      searchParams: params,
    });
    const data = await response.json<{ items: any[] }>();

    return (data.items || []).map(this.mapApplication);
  }

  async getApplication(name: string): Promise<ArgoCDApplication> {
    const response = await this.client.get(`api/v1/applications/${name}`);
    const data = await response.json<any>();
    return this.mapApplication(data);
  }

  async getApplicationResources(name: string): Promise<ArgoCDApplicationResource[]> {
    const response = await this.client.get(`api/v1/applications/${name}/resource-tree`);
    const data = await response.json<{ nodes: any[] }>();

    return (data.nodes || []).map(node => ({
      group: node.group || '',
      version: node.version,
      kind: node.kind,
      namespace: node.namespace,
      name: node.name,
      status: node.health?.status || 'Unknown',
      health: node.health,
      requiresPruning: node.requiresPruning,
    }));
  }

  async getApplicationManifests(name: string): Promise<string> {
    const response = await this.client.get(`api/v1/applications/${name}/manifests`);
    const data = await response.json<{ manifests: string[] }>();
    return data.manifests?.join('\n---\n') || '';
  }

  async getApplicationHistory(name: string): Promise<ArgoCDHistory[]> {
    const app = await this.getApplication(name);
    // History is part of the app response in ArgoCD
    const response = await this.client.get(`api/v1/applications/${name}`);
    const data = await response.json<{ status?: { history?: any[] } }>();

    return (data.status?.history || []).map((h, i) => ({
      id: h.id || i,
      revision: h.revision,
      deployedAt: h.deployedAt,
      deployStartedAt: h.deployStartedAt,
      source: {
        repoURL: h.source?.repoURL || '',
        path: h.source?.path || '',
        targetRevision: h.source?.targetRevision || '',
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Sync & Rollback
  // ---------------------------------------------------------------------------

  async syncApplication(
    name: string,
    options: {
      revision?: string;
      prune?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<ArgoCDSyncResult> {
    logger.info({ name, options }, 'Syncing ArgoCD application');

    const response = await this.client.post(`api/v1/applications/${name}/sync`, {
      json: {
        revision: options.revision,
        prune: options.prune || false,
        dryRun: options.dryRun || false,
        strategy: {
          hook: {
            force: false,
          },
        },
      },
    });

    const data = await response.json<any>();

    return {
      revision: data.status?.sync?.revision || '',
      phase: data.status?.operationState?.phase || 'Unknown',
      message: data.status?.operationState?.message || '',
      resources: (data.status?.operationState?.syncResult?.resources || []).map((r: any) => ({
        group: r.group || '',
        version: r.version,
        kind: r.kind,
        namespace: r.namespace,
        name: r.name,
        status: r.status,
        message: r.message || '',
      })),
    };
  }

  async rollbackApplication(
    name: string,
    revisionId: number
  ): Promise<ArgoCDSyncResult> {
    logger.info({ name, revisionId }, 'Rolling back ArgoCD application');

    const response = await this.client.post(`api/v1/applications/${name}/rollback`, {
      json: {
        id: revisionId,
        prune: true,
      },
    });

    const data = await response.json<any>();

    return {
      revision: data.status?.sync?.revision || '',
      phase: data.status?.operationState?.phase || 'Unknown',
      message: data.status?.operationState?.message || '',
      resources: [],
    };
  }

  async refreshApplication(name: string, hard: boolean = false): Promise<void> {
    logger.info({ name, hard }, 'Refreshing ArgoCD application');

    await this.client.get(`api/v1/applications/${name}`, {
      searchParams: {
        refresh: hard ? 'hard' : 'normal',
      },
    });
  }

  async terminateOperation(name: string): Promise<void> {
    logger.info({ name }, 'Terminating ArgoCD operation');

    await this.client.delete(`api/v1/applications/${name}/operation`);
  }

  // ---------------------------------------------------------------------------
  // Diff
  // ---------------------------------------------------------------------------

  async getApplicationDiff(name: string): Promise<{
    hasDiff: boolean;
    diff: string;
  }> {
    const response = await this.client.get(`api/v1/applications/${name}/managed-resources`, {
      searchParams: { diff: 'true' },
    });
    const data = await response.json<{ items: any[] }>();

    const diffs = (data.items || [])
      .filter(item => item.diff)
      .map(item => `--- ${item.kind}/${item.name}\n${item.diff}`)
      .join('\n\n');

    return {
      hasDiff: diffs.length > 0,
      diff: diffs,
    };
  }

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  async listProjects(): Promise<Array<{
    name: string;
    description: string;
    sourceRepos: string[];
    destinations: Array<{ server: string; namespace: string }>;
  }>> {
    const response = await this.client.get('api/v1/projects');
    const data = await response.json<{ items: any[] }>();

    return (data.items || []).map(p => ({
      name: p.metadata?.name || '',
      description: p.spec?.description || '',
      sourceRepos: p.spec?.sourceRepos || [],
      destinations: (p.spec?.destinations || []).map((d: any) => ({
        server: d.server,
        namespace: d.namespace,
      })),
    }));
  }

  // ---------------------------------------------------------------------------
  // Repositories
  // ---------------------------------------------------------------------------

  async listRepositories(): Promise<Array<{
    repo: string;
    type: string;
    connectionState: {
      status: string;
      message?: string;
    };
  }>> {
    const response = await this.client.get('api/v1/repositories');
    const data = await response.json<{ items: any[] }>();

    return (data.items || []).map(r => ({
      repo: r.repo,
      type: r.type || 'git',
      connectionState: {
        status: r.connectionState?.status || 'Unknown',
        message: r.connectionState?.message,
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapApplication = (app: any): ArgoCDApplication => ({
    name: app.metadata?.name || '',
    namespace: app.metadata?.namespace || 'argocd',
    project: app.spec?.project || 'default',
    source: {
      repoURL: app.spec?.source?.repoURL || '',
      path: app.spec?.source?.path || '',
      targetRevision: app.spec?.source?.targetRevision || 'HEAD',
    },
    destination: {
      server: app.spec?.destination?.server || '',
      namespace: app.spec?.destination?.namespace || '',
    },
    syncStatus: {
      status: app.status?.sync?.status || 'Unknown',
      revision: app.status?.sync?.revision || '',
    },
    healthStatus: {
      status: app.status?.health?.status || 'Unknown',
      message: app.status?.health?.message,
    },
    operationState: app.status?.operationState
      ? {
          phase: app.status.operationState.phase,
          message: app.status.operationState.message,
          startedAt: app.status.operationState.startedAt,
          finishedAt: app.status.operationState.finishedAt,
        }
      : undefined,
    createdAt: app.metadata?.creationTimestamp || '',
    reconciledAt: app.status?.reconciledAt,
  });
}

// =============================================================================
// Factory
// =============================================================================

let argoCDServiceInstance: ArgoCDService | null = null;

export function getArgoCDService(): ArgoCDService {
  if (!argoCDServiceInstance) {
    const baseUrl = process.env.ARGOCD_URL;
    const token = process.env.ARGOCD_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('ArgoCD configuration missing: ARGOCD_URL and ARGOCD_TOKEN required');
    }

    argoCDServiceInstance = new ArgoCDService(baseUrl, token);
  }

  return argoCDServiceInstance;
}
