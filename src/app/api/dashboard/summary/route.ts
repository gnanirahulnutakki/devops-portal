import { withTenantApiHandler, successResponse } from '@/lib/api';
import { listApplications } from '@/lib/services/argocd';
import { listAlerts, isGrafanaConfigured } from '@/lib/services/grafana';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { logger } from '@/lib/logger';

type ActivityStatus = 'success' | 'failed' | 'pending';

interface ActivityItem {
  id: string;
  type: 'pr_opened' | 'pr_merged' | 'deployment' | 'sync' | 'alert' | 'sync_success';
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  status?: ActivityStatus;
}

function isActiveAlert(state?: string) {
  const normalized = state?.toLowerCase();
  return normalized === 'firing' || normalized === 'pending';
}

function toStatus(phase?: string): ActivityStatus | undefined {
  if (!phase) return undefined;
  const normalized = phase.toLowerCase();
  if (normalized.includes('succeed')) return 'success';
  if (normalized.includes('fail') || normalized.includes('error')) return 'failed';
  if (normalized.includes('run') || normalized.includes('progress')) return 'pending';
  return undefined;
}

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    const { organizationId, userId } = ctx.tenant;

    let argocdApps: Awaited<ReturnType<typeof listApplications>> = [];
    let argocdConfigured = true;
    try {
      argocdApps = await listApplications(organizationId);
    } catch (error) {
      argocdConfigured = false;
      logger.warn({ organizationId, error: (error as Error).message }, 'ArgoCD not configured');
    }

    const grafanaConfigured = await isGrafanaConfigured(organizationId);
    let grafanaAlerts: Awaited<ReturnType<typeof listAlerts>> = [];
    if (grafanaConfigured) {
      try {
        grafanaAlerts = await listAlerts(organizationId);
      } catch (error) {
        logger.warn({ organizationId, error: (error as Error).message }, 'Grafana alerts fetch failed');
      }
    }

    let githubConnected = true;
    let openPullRequests: Array<{
      id: number;
      number: number;
      title: string;
      htmlUrl: string;
      user: { login: string; avatarUrl: string };
      updatedAt: string;
      state: string;
    }> = [];
    try {
      const github = await createGitHubServiceForUser(userId, organizationId);
      if (!github) {
        githubConnected = false;
      } else {
        const repos = await github.getUserRepositories({ sort: 'pushed', perPage: 10 });
        const prResults = await Promise.allSettled(
          repos.map((repo) => github.listPullRequests(repo.fullName, 'open'))
        );
        openPullRequests = prResults.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : []
        );
      }
    } catch (error) {
      githubConnected = false;
      logger.warn({ userId, error: (error as Error).message }, 'GitHub PR fetch failed');
    }

    const deploymentsTotal = argocdApps.length;
    const argocdSync = {
      synced: argocdApps.filter((app) => app.syncStatus.status === 'Synced').length,
      outOfSync: argocdApps.filter((app) => app.syncStatus.status === 'OutOfSync').length,
      unknown: argocdApps.filter((app) => app.syncStatus.status === 'Unknown').length,
      total: deploymentsTotal,
    };

    const health = {
      healthy: argocdApps.filter((app) => app.healthStatus.status === 'Healthy').length,
      degraded: argocdApps.filter((app) => app.healthStatus.status === 'Degraded').length,
      progressing: argocdApps.filter((app) => app.healthStatus.status === 'Progressing').length,
      other: argocdApps.filter((app) =>
        !['Healthy', 'Degraded', 'Progressing'].includes(app.healthStatus.status)
      ).length,
      total: deploymentsTotal,
    };

    const syncActivity = {
      success: argocdApps.filter((app) => app.operationState?.phase?.toLowerCase().includes('succeed')).length,
      failed: argocdApps.filter((app) => app.operationState?.phase?.toLowerCase().includes('fail')).length,
      running: argocdApps.filter((app) => {
        const phase = app.operationState?.phase?.toLowerCase() || '';
        return phase.includes('run') || phase.includes('progress');
      }).length,
    };

    const activeAlerts = grafanaAlerts.filter((alert) => isActiveAlert(alert.state));

    const prActivity: ActivityItem[] = openPullRequests.map((pr) => ({
      id: `pr:${pr.id}`,
      type: pr.state === 'merged' ? 'pr_merged' : 'pr_opened',
      title: pr.title,
      description: `#${pr.number} opened by ${pr.user.login}`,
      user: {
        name: pr.user.login,
        avatar: pr.user.avatarUrl,
      },
      timestamp: pr.updatedAt,
      status: 'pending',
    }));

    const syncItems: ActivityItem[] = argocdApps
      .filter((app) => app.operationState?.startedAt || app.operationState?.finishedAt)
      .map((app) => ({
        id: `sync:${app.name}`,
        type: app.operationState?.phase?.toLowerCase().includes('succeed') ? 'sync_success' : 'sync',
        title: `${app.name} sync`,
        description: app.operationState?.message || `Sync ${app.operationState?.phase || 'status'}`,
        user: { name: 'ArgoCD' },
        timestamp: app.operationState?.finishedAt || app.operationState?.startedAt || app.reconciledAt || app.createdAt,
        status: toStatus(app.operationState?.phase),
      }));

    const alertItems: ActivityItem[] = activeAlerts.map((alert) => ({
      id: `alert:${alert.uid}`,
      type: 'alert',
      title: alert.title,
      description: alert.ruleGroup ? `Rule group: ${alert.ruleGroup}` : 'Grafana alert',
      user: { name: 'Grafana' },
      timestamp: alert.updated || new Date().toISOString(),
      status: 'pending',
    }));

    const recentActivity = [...prActivity, ...syncItems, ...alertItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return successResponse({
      metrics: {
        deploymentsTotal,
        openPullRequests: openPullRequests.length,
        healthyApps: health.healthy,
        activeAlerts: activeAlerts.length,
      },
      status: {
        argocdSync,
        health,
        syncActivity,
      },
      integrations: {
        argocd: argocdConfigured,
        grafana: grafanaConfigured,
        github: githubConnected,
      },
      recentActivity,
    });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
