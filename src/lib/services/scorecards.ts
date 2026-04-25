/**
 * Service Scorecards — Evaluation Engine
 *
 * Evaluates ArgoCD applications against a set of rules across categories
 * (Reliability, Security, Delivery, Observability, Ownership) to compute
 * a maturity level (BASIC → BRONZE → SILVER → GOLD).
 *
 * Architecture:
 *   1. Batch-first data fetching — all sources queried ONCE before rules run
 *   2. Rule evaluators — pure functions that check pre-fetched data
 *   3. Level computation — cumulative ladder (must pass all lower levels)
 *   4. Results cached in DB with 15-minute TTL
 */

import { prisma } from '@/lib/prisma';
import type { TenantPrismaClient } from '@/lib/prisma-tenant';
import type { ScorecardLevel, RuleCategory, CheckSource } from '@prisma/client';
import { listApplications } from './argocd';
import { computeDoraMetrics, type DoraLevel } from './dora-metrics';
import { isGrafanaConfigured, listAlerts, listDashboards } from './grafana';
import { createGitHubServiceForUser } from '@/lib/integrations/github';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleEvalResult {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  level: ScorecardLevel;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  detail?: string;
}

export interface AppScorecardResult {
  appName: string;
  appNamespace: string;
  appProject: string;
  level: ScorecardLevel;
  score: { total: number; passed: number; warned: number; failed: number };
  ruleResults: RuleEvalResult[];
  evaluatedAt: string;
}

interface PreFetchedData {
  apps: any[];
  appMap: Map<string, any>;
  dora: Awaited<ReturnType<typeof computeDoraMetrics>> | null;
  grafanaAlerts: any[];
  grafanaDashboards: any[];
  grafanaConfigured: boolean;
  securityScans: any[];
  githubData: Map<string, GitHubRepoData>;
}

interface GitHubRepoData {
  dependabotAlerts: any[];
  branchProtected: boolean;
  lastWorkflowConclusion: string | null;
}

// Level ordering for comparisons
const LEVEL_ORDER: Record<ScorecardLevel, number> = {
  BASIC: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

const LEVEL_LIST: ScorecardLevel[] = ['BASIC', 'BRONZE', 'SILVER', 'GOLD'];

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// GitHub repo extraction
// ---------------------------------------------------------------------------

function extractGitHubRepo(repoURL: string): string | null {
  const match = repoURL.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  if (!match) return null;
  return match[1].replace(/\.git$/, '');
}

// ---------------------------------------------------------------------------
// Seed default scorecard
// ---------------------------------------------------------------------------

export async function seedDefaultScorecard(
  organizationId: string,
  db: TenantPrismaClient
): Promise<{ id: string; created: boolean }> {
  // Check if any scorecards exist
  const existing = await db.scorecard.findFirst({
    where: { organizationId },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }

  const scorecard = await db.scorecard.create({
    data: {
      name: 'Default Scorecard',
      description: 'Evaluates services across reliability, delivery, observability, security, and ownership.',
      organizationId,
      rules: {
        create: [
          // BASIC level
          {
            name: 'App Health',
            description: 'Application health status is Healthy',
            category: 'RELIABILITY',
            source: 'ARGOCD',
            level: 'BASIC',
            config: { check: 'health_status' },
            sortOrder: 1,
          },
          {
            name: 'App Synced',
            description: 'Application sync status is Synced',
            category: 'RELIABILITY',
            source: 'ARGOCD',
            level: 'BASIC',
            config: { check: 'sync_status' },
            sortOrder: 2,
          },
          // BRONZE level
          {
            name: 'Deploy Frequency',
            description: 'Deployment frequency is at least medium (weekly)',
            category: 'DELIVERY',
            source: 'DORA',
            level: 'BRONZE',
            config: { check: 'deploy_frequency', minLevel: 'medium' },
            sortOrder: 3,
          },
          {
            name: 'Change Failure Rate',
            description: 'Change failure rate is at most medium (<15%)',
            category: 'DELIVERY',
            source: 'DORA',
            level: 'BRONZE',
            config: { check: 'change_failure_rate', minLevel: 'medium' },
            sortOrder: 4,
          },
          {
            name: 'Has Dashboards',
            description: 'At least 1 Grafana dashboard exists',
            category: 'OBSERVABILITY',
            source: 'GRAFANA',
            level: 'BRONZE',
            config: { check: 'has_dashboards', minCount: 1 },
            sortOrder: 5,
          },
          // SILVER level
          {
            name: 'No Firing Alerts',
            description: 'No Grafana alerts are currently firing',
            category: 'OBSERVABILITY',
            source: 'GRAFANA',
            level: 'SILVER',
            config: { check: 'no_firing_alerts' },
            warnThreshold: { maxFiring: 2 },
            sortOrder: 6,
          },
          {
            name: 'Branch Protection',
            description: 'Default branch has protection rules enabled',
            category: 'OWNERSHIP',
            source: 'GITHUB',
            level: 'SILVER',
            config: { check: 'branch_protection' },
            sortOrder: 7,
          },
          {
            name: 'CI Passing',
            description: 'Last GitHub Actions workflow run succeeded',
            category: 'DELIVERY',
            source: 'GITHUB',
            level: 'SILVER',
            config: { check: 'ci_passing' },
            sortOrder: 8,
          },
          // GOLD level
          {
            name: 'No Critical Dependabot',
            description: 'No open critical Dependabot alerts',
            category: 'SECURITY',
            source: 'GITHUB',
            level: 'GOLD',
            config: { check: 'no_critical_dependabot' },
            sortOrder: 9,
          },
          {
            name: 'No Critical Vulns',
            description: 'No critical vulnerabilities in latest security scan',
            category: 'SECURITY',
            source: 'SECURITY',
            level: 'GOLD',
            config: { check: 'no_critical_vulns' },
            sortOrder: 10,
          },
        ],
      },
    },
  });

  return { id: scorecard.id, created: true };
}

// ---------------------------------------------------------------------------
// Batch data fetching
// ---------------------------------------------------------------------------

async function prefetchData(
  organizationId: string,
  db: TenantPrismaClient,
  userId: string,
  projectFilter?: string | null
): Promise<PreFetchedData> {
  // Fetch all data sources in parallel
  const [appsResult, doraResult, grafanaResult, securityResult, githubSvc] =
    await Promise.allSettled([
      listApplications(organizationId, projectFilter || undefined),
      computeDoraMetrics(organizationId, db),
      fetchGrafanaData(organizationId),
      db.securityScan.findMany({
        where: { organizationId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      }),
      createGitHubServiceForUser(userId, organizationId),
    ]);

  const apps = appsResult.status === 'fulfilled' ? appsResult.value : [];
  const dora = doraResult.status === 'fulfilled' ? doraResult.value : null;
  const grafana =
    grafanaResult.status === 'fulfilled'
      ? grafanaResult.value
      : { alerts: [], dashboards: [], configured: false };
  const scans = securityResult.status === 'fulfilled' ? securityResult.value : [];
  const ghService = githubSvc.status === 'fulfilled' ? githubSvc.value : null;

  // Build app map for quick lookup
  const appMap = new Map<string, any>();
  for (const app of apps) {
    appMap.set(app.name, app);
  }

  // Deduplicate GitHub repos from ArgoCD sources and fetch data
  const githubData = new Map<string, GitHubRepoData>();
  if (ghService) {
    const repoSet = new Set<string>();
    for (const app of apps) {
      const repoURL = app.source?.repoURL || '';
      const repo = extractGitHubRepo(repoURL);
      if (repo) repoSet.add(repo);
    }

    const repoFetches = Array.from(repoSet).map(async (repo) => {
      try {
        const [owner, repoName] = repo.split('/');
        const [depAlerts, branches, runs] = await Promise.allSettled([
          ghService.listDependabotAlerts(repoName, { state: 'open' }),
          ghService.listBranches(repoName),
          ghService.listWorkflowRuns(repoName),
        ]);

        const alerts =
          depAlerts.status === 'fulfilled' ? depAlerts.value : [];
        const branchList =
          branches.status === 'fulfilled' ? branches.value : [];
        const workflowRuns =
          runs.status === 'fulfilled' ? runs.value : [];

        // Check if default branch is protected
        const defaultBranch = branchList.find(
          (b: any) => b.name === 'main' || b.name === 'master'
        );
        const branchProtected = defaultBranch?.protected ?? false;

        // Get last workflow conclusion
        const lastRun = workflowRuns[0];
        const lastWorkflowConclusion = lastRun?.conclusion || null;

        githubData.set(repo, {
          dependabotAlerts: alerts,
          branchProtected,
          lastWorkflowConclusion,
        });
      } catch (err) {
        logger.warn({ repo, err }, 'Failed to fetch GitHub data for repo');
        githubData.set(repo, {
          dependabotAlerts: [],
          branchProtected: false,
          lastWorkflowConclusion: null,
        });
      }
    });

    await Promise.allSettled(repoFetches);
  }

  return {
    apps,
    appMap,
    dora,
    grafanaAlerts: grafana.alerts,
    grafanaDashboards: grafana.dashboards,
    grafanaConfigured: grafana.configured,
    securityScans: scans,
    githubData,
  };
}

async function fetchGrafanaData(organizationId: string) {
  const configured = await isGrafanaConfigured(organizationId);
  if (!configured) {
    return { alerts: [], dashboards: [], configured: false };
  }
  const [alerts, dashboards] = await Promise.allSettled([
    listAlerts(organizationId),
    listDashboards(organizationId),
  ]);
  return {
    alerts: alerts.status === 'fulfilled' ? alerts.value : [],
    dashboards: dashboards.status === 'fulfilled' ? dashboards.value : [],
    configured: true,
  };
}

// ---------------------------------------------------------------------------
// Rule evaluators
// ---------------------------------------------------------------------------

function evaluateRule(
  rule: any,
  app: any,
  data: PreFetchedData
): RuleEvalResult {
  const base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'> = {
    ruleId: rule.id,
    ruleName: rule.name,
    category: rule.category,
    level: rule.level,
  };

  const config = (rule.config as any) || {};
  const check = config.check as string;

  switch (check) {
    case 'health_status':
      return evaluateHealthStatus(base, app);
    case 'sync_status':
      return evaluateSyncStatus(base, app);
    case 'deploy_frequency':
      return evaluateDoraLevel(base, data.dora, 'deploymentFrequency', config.minLevel);
    case 'change_failure_rate':
      return evaluateDoraLevel(base, data.dora, 'changeFailureRate', config.minLevel);
    case 'has_dashboards':
      return evaluateHasDashboards(base, data, config.minCount || 1);
    case 'no_firing_alerts':
      return evaluateNoFiringAlerts(base, data, rule.warnThreshold as any);
    case 'branch_protection':
      return evaluateGitHubCheck(base, app, data, 'branch_protection');
    case 'ci_passing':
      return evaluateGitHubCheck(base, app, data, 'ci_passing');
    case 'no_critical_dependabot':
      return evaluateGitHubCheck(base, app, data, 'no_critical_dependabot');
    case 'no_critical_vulns':
      return evaluateNoCriticalVulns(base, app, data);
    default:
      return { ...base, status: 'WARN', message: `Unknown check: ${check}` };
  }
}

function evaluateHealthStatus(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  app: any
): RuleEvalResult {
  const status = app.healthStatus?.status || 'Unknown';
  if (status === 'Healthy') {
    return { ...base, status: 'PASS', message: 'Healthy' };
  }
  if (status === 'Progressing' || status === 'Suspended') {
    return { ...base, status: 'WARN', message: status };
  }
  return { ...base, status: 'FAIL', message: status, detail: `Health status is ${status}` };
}

function evaluateSyncStatus(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  app: any
): RuleEvalResult {
  const status = app.syncStatus?.status || 'Unknown';
  if (status === 'Synced') {
    return { ...base, status: 'PASS', message: 'Synced' };
  }
  return { ...base, status: 'FAIL', message: status, detail: `Sync status is ${status}` };
}

function evaluateDoraLevel(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  dora: PreFetchedData['dora'],
  metric: 'deploymentFrequency' | 'changeFailureRate',
  minLevel: string
): RuleEvalResult {
  if (!dora) {
    return { ...base, status: 'WARN', message: 'DORA metrics unavailable' };
  }

  const doraLevelOrder: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    elite: 3,
  };

  const actualLevel = dora[metric].level;
  const minLevelNum = doraLevelOrder[minLevel] ?? 1;
  const actualLevelNum = doraLevelOrder[actualLevel] ?? 0;

  if (actualLevelNum >= minLevelNum) {
    return { ...base, status: 'PASS', message: `${actualLevel}` };
  }
  return {
    ...base,
    status: 'FAIL',
    message: `${actualLevel} (need ${minLevel}+)`,
    detail: `Current level: ${actualLevel}`,
  };
}

function evaluateHasDashboards(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  data: PreFetchedData,
  minCount: number
): RuleEvalResult {
  if (!data.grafanaConfigured) {
    return { ...base, status: 'WARN', message: 'Grafana not configured' };
  }
  const count = data.grafanaDashboards.length;
  if (count >= minCount) {
    return { ...base, status: 'PASS', message: `${count} dashboard${count !== 1 ? 's' : ''} found` };
  }
  return {
    ...base,
    status: 'FAIL',
    message: `${count} dashboards (need ${minCount}+)`,
  };
}

function evaluateNoFiringAlerts(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  data: PreFetchedData,
  warnThreshold?: { maxFiring?: number }
): RuleEvalResult {
  if (!data.grafanaConfigured) {
    return { ...base, status: 'WARN', message: 'Grafana not configured' };
  }
  const firingAlerts = data.grafanaAlerts.filter(
    (a: any) => a.state === 'firing' || a.state === 'alerting'
  );
  const firing = firingAlerts.length;
  if (firing === 0) {
    return { ...base, status: 'PASS', message: '0 alerts firing' };
  }
  if (warnThreshold?.maxFiring && firing <= warnThreshold.maxFiring) {
    return { ...base, status: 'WARN', message: `${firing} alert${firing !== 1 ? 's' : ''} firing` };
  }
  return {
    ...base,
    status: 'FAIL',
    message: `${firing} alert${firing !== 1 ? 's' : ''} firing`,
  };
}

function evaluateGitHubCheck(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  app: any,
  data: PreFetchedData,
  check: 'branch_protection' | 'ci_passing' | 'no_critical_dependabot'
): RuleEvalResult {
  const repoURL = app.source?.repoURL || '';
  const repo = extractGitHubRepo(repoURL);

  if (!repo) {
    return { ...base, status: 'WARN', message: 'Not a GitHub repo' };
  }

  const ghData = data.githubData.get(repo);
  if (!ghData) {
    return { ...base, status: 'WARN', message: 'GitHub data unavailable' };
  }

  switch (check) {
    case 'branch_protection':
      if (ghData.branchProtected) {
        return { ...base, status: 'PASS', message: 'Default branch protected' };
      }
      return { ...base, status: 'FAIL', message: 'Default branch not protected' };

    case 'ci_passing':
      if (ghData.lastWorkflowConclusion === null) {
        return { ...base, status: 'WARN', message: 'No workflow runs found' };
      }
      if (ghData.lastWorkflowConclusion === 'success') {
        return { ...base, status: 'PASS', message: 'Last run: success' };
      }
      return {
        ...base,
        status: 'FAIL',
        message: `Last run: ${ghData.lastWorkflowConclusion}`,
      };

    case 'no_critical_dependabot': {
      const criticalAlerts = ghData.dependabotAlerts.filter(
        (a: any) => a.severity === 'critical' && a.state === 'open'
      );
      if (criticalAlerts.length === 0) {
        return { ...base, status: 'PASS', message: '0 critical alerts' };
      }
      return {
        ...base,
        status: 'FAIL',
        message: `${criticalAlerts.length} critical alert${criticalAlerts.length !== 1 ? 's' : ''}`,
      };
    }

    default:
      return { ...base, status: 'WARN', message: `Unknown GitHub check: ${check}` };
  }
}

function evaluateNoCriticalVulns(
  base: Omit<RuleEvalResult, 'status' | 'message' | 'detail'>,
  app: any,
  data: PreFetchedData
): RuleEvalResult {
  if (data.securityScans.length === 0) {
    return { ...base, status: 'WARN', message: 'No security scans found' };
  }

  // Find scans matching this app's image (best effort — check target contains app name)
  const appScans = data.securityScans.filter((s: any) =>
    s.target?.toLowerCase().includes(app.name?.toLowerCase())
  );

  if (appScans.length === 0) {
    // Fall back to looking at all scans for critical vulns
    const latestScan = data.securityScans[0];
    const summary = (latestScan?.summary as any) || {};
    const critical = summary.critical || summary.CRITICAL || 0;
    if (critical === 0) {
      return { ...base, status: 'PASS', message: '0 critical in latest scan' };
    }
    return {
      ...base,
      status: 'FAIL',
      message: `${critical} critical vuln${critical !== 1 ? 's' : ''} in latest scan`,
    };
  }

  const latestScan = appScans[0];
  const summary = (latestScan?.summary as any) || {};
  const critical = summary.critical || summary.CRITICAL || 0;
  if (critical === 0) {
    return { ...base, status: 'PASS', message: '0 critical vulnerabilities' };
  }
  return {
    ...base,
    status: 'FAIL',
    message: `${critical} critical vuln${critical !== 1 ? 's' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Level computation
// ---------------------------------------------------------------------------

function computeLevel(ruleResults: RuleEvalResult[]): ScorecardLevel {
  // Level ladder: must pass ALL rules at a level AND all levels below
  for (const level of LEVEL_LIST) {
    const rulesAtLevel = ruleResults.filter((r) => LEVEL_ORDER[r.level] <= LEVEL_ORDER[level]);
    const allPass = rulesAtLevel.every((r) => r.status === 'PASS' || r.status === 'WARN');
    if (!allPass) {
      // Return the level BELOW this one (the highest fully-passed level)
      const idx = LEVEL_LIST.indexOf(level);
      return idx > 0 ? LEVEL_LIST[idx - 1] : 'BASIC';
    }
  }
  return 'GOLD';
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

export async function evaluateScorecard(
  scorecardId: string,
  organizationId: string,
  userId: string,
  db: TenantPrismaClient
): Promise<AppScorecardResult[]> {
  // Load scorecard with rules
  const scorecard = await db.scorecard.findFirst({
    where: { id: scorecardId, organizationId },
    include: {
      rules: {
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!scorecard) {
    throw new Error('Scorecard not found');
  }

  // Batch-fetch all data
  const data = await prefetchData(
    organizationId,
    db,
    userId,
    scorecard.projectFilter
  );

  if (data.apps.length === 0) {
    return [];
  }

  const results: AppScorecardResult[] = [];

  for (const app of data.apps) {
    const ruleResults: RuleEvalResult[] = [];

    for (const rule of scorecard.rules) {
      const result = evaluateRule(rule, app, data);
      ruleResults.push(result);
    }

    const level = computeLevel(ruleResults);
    const passed = ruleResults.filter((r) => r.status === 'PASS').length;
    const warned = ruleResults.filter((r) => r.status === 'WARN').length;
    const failed = ruleResults.filter((r) => r.status === 'FAIL').length;

    const appResult: AppScorecardResult = {
      appName: app.name,
      appNamespace: app.destination?.namespace || '',
      appProject: app.project || app.spec?.project || '',
      level,
      score: { total: ruleResults.length, passed, warned, failed },
      ruleResults,
      evaluatedAt: new Date().toISOString(),
    };

    results.push(appResult);
  }

  // Persist results (upsert per app)
  await Promise.all(
    results.map((r) =>
      db.scorecardResult.upsert({
        where: {
          scorecardId_appName_appNamespace_organizationId: {
            scorecardId,
            appName: r.appName,
            appNamespace: r.appNamespace,
            organizationId,
          },
        },
        create: {
          scorecardId,
          appName: r.appName,
          appNamespace: r.appNamespace,
          appProject: r.appProject,
          level: r.level,
          score: r.score as any,
          ruleResults: r.ruleResults as any,
          evaluatedAt: new Date(),
          organizationId,
        },
        update: {
          level: r.level,
          score: r.score as any,
          ruleResults: r.ruleResults as any,
          appProject: r.appProject,
          evaluatedAt: new Date(),
        },
      })
    )
  );

  return results;
}

// ---------------------------------------------------------------------------
// Cached results retrieval
// ---------------------------------------------------------------------------

export async function getCachedResults(
  organizationId: string,
  db: TenantPrismaClient,
  scorecardId?: string
): Promise<{
  results: AppScorecardResult[];
  stale: boolean;
  evaluatedAt: string | null;
}> {
  const where: any = { organizationId };
  if (scorecardId) where.scorecardId = scorecardId;

  const dbResults = await db.scorecardResult.findMany({
    where,
    orderBy: { evaluatedAt: 'desc' },
  });

  if (dbResults.length === 0) {
    return { results: [], stale: true, evaluatedAt: null };
  }

  const latestEval = dbResults[0].evaluatedAt;
  const stale = Date.now() - latestEval.getTime() > CACHE_TTL_MS;

  const results: AppScorecardResult[] = dbResults.map((r) => ({
    appName: r.appName,
    appNamespace: r.appNamespace,
    appProject: r.appProject,
    level: r.level,
    score: r.score as any,
    ruleResults: r.ruleResults as any,
    evaluatedAt: r.evaluatedAt.toISOString(),
  }));

  return { results, stale, evaluatedAt: latestEval.toISOString() };
}
