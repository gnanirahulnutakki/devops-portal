/**
 * Tool Executor — Routes tool calls from Ollama to portal service functions.
 *
 * Each tool handler reuses existing service code with zero modifications.
 * Results are returned as JSON strings for Ollama to interpret into natural language.
 */

import { logger } from '@/lib/logger';
import { listApplications, getApplication, syncApplication } from '@/lib/services/argocd';
import { listAlerts, listDashboards } from '@/lib/services/grafana';
import { loadKubeConfigFromClusterAsync, createKubeClients } from '@/lib/services/kubernetes';
import { getCachedResults } from '@/lib/services/scorecards';
import { createGitHubServiceForUser } from '@/lib/integrations/github';

interface ToolContext {
  orgId: string;
  userId?: string;
  db: any; // TenantPrismaClient
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

const handlers: Record<string, ToolHandler> = {
  // ── ArgoCD ──────────────────────────────────────────────

  async list_argocd_apps(args, ctx) {
    const apps = await listApplications(ctx.orgId, args.project as string | undefined);
    const summary = apps.map((app) => ({
      name: app.name,
      project: app.project,
      syncStatus: app.syncStatus,
      healthStatus: app.healthStatus,
      namespace: app.namespace,
    }));
    return { success: true, data: { total: apps.length, applications: summary } };
  },

  async get_argocd_app(args, ctx) {
    const name = args.name as string;
    const app = await getApplication(ctx.orgId, name);
    return {
      success: true,
      data: {
        name: app.name,
        project: app.project,
        syncStatus: app.syncStatus,
        healthStatus: app.healthStatus,
        namespace: app.namespace,
        repoURL: app.source?.repoURL,
        path: app.source?.path,
        targetRevision: app.source?.targetRevision,
        resources: app.resources?.slice(0, 20), // cap for token limits
      },
    };
  },

  async sync_argocd_app(args, ctx) {
    const name = args.name as string;
    const prune = args.prune === 'true';
    const result = await syncApplication(ctx.orgId, name, { prune });
    return { success: true, data: result };
  },

  // ── Grafana ─────────────────────────────────────────────

  async list_grafana_alerts(_args, ctx) {
    const alerts = await listAlerts(ctx.orgId);
    const summary = alerts.map((alert) => ({
      name: alert.title,
      state: alert.state,
      folder: alert.folderTitle,
      labels: alert.labels,
    }));
    // Highlight firing/pending alerts at the top
    const firing = summary.filter((a) => a.state === 'firing' || a.state === 'pending');
    const normal = summary.filter((a) => a.state !== 'firing' && a.state !== 'pending');
    return {
      success: true,
      data: {
        total: alerts.length,
        firing: firing.length,
        alerts: [...firing, ...normal].slice(0, 50), // cap for token limits
      },
    };
  },

  async list_grafana_dashboards(_args, ctx) {
    const dashboards = await listDashboards(ctx.orgId);
    const summary = dashboards.map((d) => ({
      title: d.title,
      uid: d.uid,
      url: d.url,
      folder: d.folderTitle,
    }));
    return { success: true, data: { total: dashboards.length, dashboards: summary.slice(0, 30) } };
  },

  // ── GitHub ──────────────────────────────────────────────

  async list_github_repos(args, ctx) {
    const github = await createGitHubServiceForUser(ctx.userId || '', ctx.orgId);
    if (!github) {
      return { success: false, error: 'GitHub is not configured. Connect GitHub in Settings > Integrations.' };
    }
    // Try org repos first, fall back to user repos (personal accounts)
    let repos;
    try {
      repos = await github.listRepositories(args.filter as string | undefined);
    } catch {
      repos = await github.getUserRepositories({ sort: 'updated', perPage: 100 });
      if (args.filter) {
        const filter = (args.filter as string).toLowerCase();
        repos = repos.filter((r) => r.fullName.toLowerCase().includes(filter));
      }
    }
    const summary = repos.slice(0, 30).map((r) => ({
      name: r.fullName,
      private: r.private,
      language: r.language,
      updatedAt: r.updatedAt,
      defaultBranch: r.defaultBranch,
    }));
    return { success: true, data: { total: repos.length, repositories: summary } };
  },

  async list_github_prs(args, ctx) {
    const github = await createGitHubServiceForUser(ctx.userId || '', ctx.orgId);
    if (!github) {
      return { success: false, error: 'GitHub is not configured.' };
    }
    const repo = args.repository as string;
    const state = (args.state as 'open' | 'closed' | 'all') || 'open';
    const prs = await github.listPullRequests(repo, state);
    const summary = prs.slice(0, 20).map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user,
      createdAt: pr.createdAt,
      draft: pr.draft,
    }));
    return { success: true, data: { total: prs.length, pullRequests: summary } };
  },

  // ── Portal / Dashboard ─────────────────────────────────

  async get_dashboard_summary(_args, ctx) {
    // Aggregate from multiple sources — best-effort, don't fail on any single one
    const results: Record<string, unknown> = {};

    try {
      const apps = await listApplications(ctx.orgId);
      const outOfSync = apps.filter((a) => a.syncStatus?.status !== 'Synced');
      const degraded = apps.filter((a) => a.healthStatus?.status !== 'Healthy');
      results.argocd = { total: apps.length, outOfSync: outOfSync.length, degraded: degraded.length };
    } catch {
      results.argocd = null;
    }

    try {
      const alerts = await listAlerts(ctx.orgId);
      const firing = alerts.filter((a) => a.state === 'firing');
      results.grafana = { totalRules: alerts.length, firing: firing.length };
    } catch {
      results.grafana = null;
    }

    try {
      const clusters = await ctx.db.cluster.findMany({
        where: { organizationId: ctx.orgId },
        select: { id: true },
      });
      results.clusters = { total: clusters.length };
    } catch {
      results.clusters = null;
    }

    return { success: true, data: results };
  },

  // ── Clusters / Kubernetes ──────────────────────────────

  async list_clusters(_args, ctx) {
    const clusters = await ctx.db.cluster.findMany({
      where: { organizationId: ctx.orgId },
      select: { id: true, name: true, slug: true, provider: true, region: true, environment: true },
    });
    return { success: true, data: { total: clusters.length, clusters } };
  },

  async get_cluster_pods(args, ctx) {
    const clusterId = args.clusterId as string;
    const namespace = (args.namespace as string) || 'default';

    const cluster = await ctx.db.cluster.findUnique({
      where: { id: clusterId, organizationId: ctx.orgId },
    });
    if (!cluster) {
      return { success: false, error: `Cluster ${clusterId} not found` };
    }

    const kc = await loadKubeConfigFromClusterAsync(cluster);
    const clients = createKubeClients(kc);
    const res = await clients.core.listNamespacedPod({ namespace });
    const pods = (res.items || []).slice(0, 50).map((pod) => ({
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      status: pod.status?.phase,
      ready: pod.status?.containerStatuses?.every((c) => c.ready) ?? false,
      restarts: pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) ?? 0,
    }));
    return { success: true, data: { total: res.items?.length || 0, pods } };
  },

  async get_cluster_nodes(args, ctx) {
    const clusterId = args.clusterId as string;

    const cluster = await ctx.db.cluster.findUnique({
      where: { id: clusterId, organizationId: ctx.orgId },
    });
    if (!cluster) {
      return { success: false, error: `Cluster ${clusterId} not found` };
    }

    const kc = await loadKubeConfigFromClusterAsync(cluster);
    const clients = createKubeClients(kc);
    const res = await clients.core.listNode();
    const nodes = (res.items || []).map((node) => ({
      name: node.metadata?.name,
      status: node.status?.conditions?.find((c) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: Object.keys(node.metadata?.labels || {})
        .filter((l) => l.startsWith('node-role.kubernetes.io/'))
        .map((l) => l.replace('node-role.kubernetes.io/', '')),
      kubeletVersion: node.status?.nodeInfo?.kubeletVersion,
      cpu: node.status?.capacity?.cpu,
      memory: node.status?.capacity?.memory,
    }));
    return { success: true, data: { total: nodes.length, nodes } };
  },

  // ── Scorecards ─────────────────────────────────────────

  async list_scorecard_results(_args, ctx) {
    const { results, stale, evaluatedAt } = await getCachedResults(ctx.orgId, ctx.db);
    const summary = results.slice(0, 30).map((r) => ({
      app: r.appName,
      level: r.level,
      passedRules: r.ruleResults.filter((rule) => rule.status === 'PASS').length,
      totalRules: r.ruleResults.length,
      failedChecks: r.ruleResults.filter((rule) => rule.status === 'FAIL').map((rule) => rule.ruleName),
    }));
    return {
      success: true,
      data: { total: results.length, stale, evaluatedAt, scorecards: summary },
    };
  },
};

/**
 * Execute a tool by name with the given arguments.
 * Returns a JSON string suitable for feeding back to the LLM.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const handler = handlers[toolName];
  if (!handler) {
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }

  try {
    const result = await handler(args, ctx);
    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    logger.error({ tool: toolName, error: message }, 'Tool execution error');
    return JSON.stringify({ success: false, error: message });
  }
}
