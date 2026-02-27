/**
 * DORA Metrics Service
 *
 * Computes the four DORA metrics from ArgoCD deployment history:
 *   1. Deployment Frequency — how often code deploys to production
 *   2. Lead Time for Changes — commit to deploy duration
 *   3. Change Failure Rate — percentage of deployments that cause failures
 *   4. Mean Time to Recovery (MTTR) — time to restore service after failure
 *
 * Data sources:
 *   - ArgoCD application history (deploy timestamps, revisions)
 *   - ArgoCD application status (health, sync)
 *   - Deployment model in DB (sync/health status changes)
 */

import { HealthStatus } from '@prisma/client';
import type { TenantPrismaClient } from '@/lib/prisma-tenant';
import { listApplications, getApplicationHistory } from './argocd';
import type { ArgoCDApplication, ArgoCDHistory } from '@/lib/integrations/argocd';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoraLevel = 'elite' | 'high' | 'medium' | 'low';

export interface DoraMetrics {
  /** Period these metrics cover */
  period: { from: string; to: string; days: number };

  deploymentFrequency: {
    /** Total deploys in the period */
    total: number;
    /** Deploys per day */
    perDay: number;
    /** Deploys per week */
    perWeek: number;
    level: DoraLevel;
    /** Daily breakdown for sparkline [{ date, count }] */
    daily: Array<{ date: string; count: number }>;
  };

  leadTimeForChanges: {
    /** Median lead time in seconds */
    medianSeconds: number;
    /** p90 lead time in seconds */
    p90Seconds: number;
    level: DoraLevel;
  };

  changeFailureRate: {
    /** 0..1 ratio of failed deploys to total deploys */
    rate: number;
    /** Absolute count of failures */
    failures: number;
    /** Absolute count of total deploys */
    total: number;
    level: DoraLevel;
  };

  meanTimeToRecovery: {
    /** Average recovery time in seconds */
    meanSeconds: number;
    /** Median recovery time in seconds */
    medianSeconds: number;
    level: DoraLevel;
    /** Number of incidents in the period */
    incidents: number;
  };

  /** Per-application breakdown */
  applications: Array<{
    name: string;
    namespace: string;
    deploys: number;
    healthStatus: string;
    syncStatus: string;
    lastDeployedAt: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// DORA Level Classification (2023 State of DevOps Report thresholds)
// ---------------------------------------------------------------------------

function classifyDeployFrequency(perDay: number): DoraLevel {
  if (perDay >= 1) return 'elite';      // On-demand (multiple per day)
  if (perDay >= 1 / 7) return 'high';   // Between once per day and once per week
  if (perDay >= 1 / 30) return 'medium'; // Between once per week and once per month
  return 'low';                          // Less than once per month
}

function classifyLeadTime(medianSeconds: number): DoraLevel {
  const hours = medianSeconds / 3600;
  if (hours < 1) return 'elite';        // Less than one hour
  if (hours < 24) return 'high';        // Less than one day
  if (hours < 24 * 7) return 'medium';  // Less than one week
  return 'low';                          // More than one week
}

function classifyChangeFailureRate(rate: number): DoraLevel {
  if (rate <= 0.05) return 'elite';     // 0-5%
  if (rate <= 0.10) return 'high';      // 5-10%
  if (rate <= 0.15) return 'medium';    // 10-15%
  return 'low';                          // >15%
}

function classifyMTTR(meanSeconds: number): DoraLevel {
  const hours = meanSeconds / 3600;
  if (hours < 1) return 'elite';        // Less than one hour
  if (hours < 24) return 'high';        // Less than one day
  if (hours < 24 * 7) return 'medium';  // Less than one week
  return 'low';                          // More than one week
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export async function computeDoraMetrics(
  organizationId: string,
  db: TenantPrismaClient,
  options: { days?: number } = {},
): Promise<DoraMetrics> {
  const days = options.days || 30;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // ------ Fetch data in parallel ------
  let apps: ArgoCDApplication[] = [];
  try {
    apps = await listApplications(organizationId);
  } catch {
    // ArgoCD not configured — return empty metrics
  }

  const dbDeployments = await db.deployment.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
  });

  // Fetch history for all apps in parallel
  const historyMap = new Map<string, ArgoCDHistory[]>();
  await Promise.all(
    apps.map(async (app) => {
      try {
        const h = await getApplicationHistory(organizationId, app.name);
        historyMap.set(app.name, h);
      } catch {
        historyMap.set(app.name, []);
      }
    }),
  );

  // ------ 1. Deployment Frequency ------
  const allDeploys: Date[] = [];
  const dailyCounts: Record<string, number> = {};

  // Initialize all days in the period
  for (let d = new Date(from); d <= now; d.setDate(d.getDate() + 1)) {
    dailyCounts[dayKey(d)] = 0;
  }

  for (const [, history] of historyMap) {
    for (const h of history) {
      const deployedAt = new Date(h.deployedAt);
      if (deployedAt >= from && deployedAt <= now) {
        allDeploys.push(deployedAt);
        const key = dayKey(deployedAt);
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      }
    }
  }

  const totalDeploys = allDeploys.length;
  const perDay = days > 0 ? totalDeploys / days : 0;
  const perWeek = perDay * 7;

  const daily = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // ------ 2. Lead Time for Changes ------
  // Lead time = deployStartedAt → deployedAt (ArgoCD deploy duration)
  // This measures "time from sync trigger to sync complete"
  const leadTimes: number[] = [];
  for (const [, history] of historyMap) {
    for (const h of history) {
      const deployedAt = new Date(h.deployedAt);
      if (deployedAt < from || deployedAt > now) continue;
      if (h.deployStartedAt) {
        const started = new Date(h.deployStartedAt);
        const diffSeconds = (deployedAt.getTime() - started.getTime()) / 1000;
        if (diffSeconds > 0) leadTimes.push(diffSeconds);
      }
    }
  }

  const medianLeadTime = median(leadTimes);
  const p90LeadTime = percentile(leadTimes, 90);

  // ------ 3. Change Failure Rate ------
  // A "failure" is a deployment to an app that's currently Degraded/Missing/Unknown
  // Or an app that went OutOfSync after a recent deploy
  let failures = 0;
  for (const app of apps) {
    const health = app.healthStatus?.status;
    if (health === 'Degraded' || health === 'Missing') {
      // Count deploys that led to this state
      const appHistory = historyMap.get(app.name) || [];
      const recentDeploys = appHistory.filter(
        (h) => new Date(h.deployedAt) >= from,
      );
      if (recentDeploys.length > 0) failures++;
    }
  }

  // Also count from DB deployments
  const dbFailures = dbDeployments.filter(
    (d) =>
      d.healthStatus === HealthStatus.DEGRADED ||
      d.healthStatus === HealthStatus.MISSING,
  ).length;

  const totalForCFR = Math.max(totalDeploys, 1);
  const combinedFailures = Math.max(failures, dbFailures);
  const changeFailureRate = combinedFailures / totalForCFR;

  // ------ 4. Mean Time to Recovery ------
  // Estimate from audit logs if available, otherwise from current app state
  // For now, use deploy intervals for failed→healthy transitions
  const recoveryTimes: number[] = [];

  for (const app of apps) {
    const appHistory = historyMap.get(app.name) || [];
    const sorted = [...appHistory].sort(
      (a, b) => new Date(a.deployedAt).getTime() - new Date(b.deployedAt).getTime(),
    );

    // Look for consecutive deploys where interval < 2h — likely a fix
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].deployedAt);
      const curr = new Date(sorted[i].deployedAt);
      if (prev < from) continue;
      const diffSeconds = (curr.getTime() - prev.getTime()) / 1000;
      // If there's a redeploy within 2 hours, it's likely a hotfix/recovery
      if (diffSeconds > 0 && diffSeconds < 7200) {
        recoveryTimes.push(diffSeconds);
      }
    }
  }

  const meanRecovery = recoveryTimes.length > 0
    ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
    : 0;
  const medianRecovery = median(recoveryTimes);

  // ------ Application summary ------
  const applicationSummary = apps.map((app) => {
    const appHistory = historyMap.get(app.name) || [];
    const recentDeploys = appHistory.filter(
      (h) => new Date(h.deployedAt) >= from,
    );
    const lastDeploy = appHistory.length > 0
      ? appHistory.sort(
          (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime(),
        )[0]
      : null;

    return {
      name: app.name,
      namespace: app.destination?.namespace || '',
      deploys: recentDeploys.length,
      healthStatus: app.healthStatus?.status || 'Unknown',
      syncStatus: app.syncStatus?.status || 'Unknown',
      lastDeployedAt: lastDeploy?.deployedAt || null,
    };
  });

  return {
    period: {
      from: from.toISOString(),
      to: now.toISOString(),
      days,
    },
    deploymentFrequency: {
      total: totalDeploys,
      perDay,
      perWeek,
      level: classifyDeployFrequency(perDay),
      daily,
    },
    leadTimeForChanges: {
      medianSeconds: medianLeadTime,
      p90Seconds: p90LeadTime,
      level: classifyLeadTime(medianLeadTime),
    },
    changeFailureRate: {
      rate: changeFailureRate,
      failures: combinedFailures,
      total: totalForCFR,
      level: classifyChangeFailureRate(changeFailureRate),
    },
    meanTimeToRecovery: {
      meanSeconds: meanRecovery,
      medianSeconds: medianRecovery,
      level: classifyMTTR(meanRecovery),
      incidents: recoveryTimes.length,
    },
    applications: applicationSummary,
  };
}
