'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Rocket, Clock, AlertTriangle, HeartPulse, RefreshCw, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, Info, BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types matching the API response
// ---------------------------------------------------------------------------

type DoraLevel = 'elite' | 'high' | 'medium' | 'low';

interface DoraMetrics {
  period: { from: string; to: string; days: number };
  deploymentFrequency: {
    total: number; perDay: number; perWeek: number; level: DoraLevel;
    daily: Array<{ date: string; count: number }>;
  };
  leadTimeForChanges: {
    medianSeconds: number; p90Seconds: number; level: DoraLevel;
  };
  changeFailureRate: {
    rate: number; failures: number; total: number; level: DoraLevel;
  };
  meanTimeToRecovery: {
    meanSeconds: number; medianSeconds: number; level: DoraLevel; incidents: number;
  };
  applications: Array<{
    name: string; namespace: string; deploys: number;
    healthStatus: string; syncStatus: string; lastDeployedAt: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const levelColors: Record<DoraLevel, string> = {
  elite: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  high: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const levelLabels: Record<DoraLevel, string> = {
  elite: 'Elite', high: 'High', medium: 'Medium', low: 'Low',
};

const healthColors: Record<string, string> = {
  Healthy: 'text-emerald-600 dark:text-emerald-400',
  Degraded: 'text-red-600 dark:text-red-400',
  Progressing: 'text-blue-600 dark:text-blue-400',
  Suspended: 'text-amber-600 dark:text-amber-400',
  Missing: 'text-red-600 dark:text-red-400',
  Unknown: 'text-muted-foreground',
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Mini sparkline (pure CSS bar chart)
// ---------------------------------------------------------------------------

function Sparkline({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <TooltipProvider>
      <div className="flex items-end gap-px h-10">
        {data.map((d) => (
          <Tooltip key={d.date}>
            <TooltipTrigger asChild>
              <div
                className="flex-1 min-w-[2px] max-w-[8px] bg-primary/70 rounded-t-sm hover:bg-primary transition-colors"
                style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {d.date}: {d.count} deploy{d.count !== 1 ? 's' : ''}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// DORA Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  icon: Icon, title, value, subtitle, level, tooltip,
}: {
  icon: typeof Rocket; title: string; value: string; subtitle: string;
  level: DoraLevel; tooltip: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-4 w-4" />
          {title}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <Badge className={levelColors[level]} variant="secondary">
          {levelLabels[level]}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DoraMetricsPage() {
  const [metrics, setMetrics] = useState<DoraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('30');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitoring/dora?days=${days}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setMetrics(json.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load DORA metrics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            DORA Metrics
          </h1>
          <p className="text-muted-foreground">
            Measure software delivery performance using the four key DORA metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchMetrics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchMetrics}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !metrics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Metrics cards */}
      {metrics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Rocket}
              title="Deploy Frequency"
              value={metrics.deploymentFrequency.perDay >= 1
                ? `${metrics.deploymentFrequency.perDay.toFixed(1)}/day`
                : `${metrics.deploymentFrequency.perWeek.toFixed(1)}/week`}
              subtitle={`${metrics.deploymentFrequency.total} deploys in ${metrics.period.days} days`}
              level={metrics.deploymentFrequency.level}
              tooltip="How often code is deployed to production. Elite teams deploy on-demand, multiple times per day."
            />
            <MetricCard
              icon={Clock}
              title="Lead Time"
              value={formatDuration(metrics.leadTimeForChanges.medianSeconds)}
              subtitle={`p90: ${formatDuration(metrics.leadTimeForChanges.p90Seconds)}`}
              level={metrics.leadTimeForChanges.level}
              tooltip="Median time from sync trigger to sync completion. Elite teams have lead times under one hour."
            />
            <MetricCard
              icon={AlertTriangle}
              title="Change Failure Rate"
              value={formatRate(metrics.changeFailureRate.rate)}
              subtitle={`${metrics.changeFailureRate.failures} failures / ${metrics.changeFailureRate.total} deploys`}
              level={metrics.changeFailureRate.level}
              tooltip="Percentage of deployments that result in degraded service. Elite teams keep this under 5%."
            />
            <MetricCard
              icon={HeartPulse}
              title="MTTR"
              value={formatDuration(metrics.meanTimeToRecovery.meanSeconds)}
              subtitle={`${metrics.meanTimeToRecovery.incidents} recovery events`}
              level={metrics.meanTimeToRecovery.level}
              tooltip="Mean Time to Recovery — how long it takes to restore service after a failure. Elite teams recover in under one hour."
            />
          </div>

          {/* Deployment frequency sparkline */}
          {metrics.deploymentFrequency.daily.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Deployment Activity
                  <span className="text-muted-foreground font-normal">
                    — {metrics.period.days} day trend
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={metrics.deploymentFrequency.daily} />
              </CardContent>
            </Card>
          )}

          {/* Application breakdown */}
          {metrics.applications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Application Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead className="text-center">Deploys</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Sync</TableHead>
                      <TableHead>Last Deploy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.applications
                      .sort((a, b) => b.deploys - a.deploys)
                      .map((app) => (
                        <TableRow key={app.name}>
                          <TableCell className="font-medium">{app.name}</TableCell>
                          <TableCell className="text-muted-foreground">{app.namespace}</TableCell>
                          <TableCell className="text-center">{app.deploys}</TableCell>
                          <TableCell>
                            <span className={healthColors[app.healthStatus] || 'text-muted-foreground'}>
                              {app.healthStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={app.syncStatus === 'Synced' ? 'default' : 'secondary'}>
                              {app.syncStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {app.lastDeployedAt ? timeAgo(app.lastDeployedAt) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* DORA level reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                DORA Performance Levels (2023 State of DevOps Report)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead><Badge className={levelColors.elite} variant="secondary">Elite</Badge></TableHead>
                    <TableHead><Badge className={levelColors.high} variant="secondary">High</Badge></TableHead>
                    <TableHead><Badge className={levelColors.medium} variant="secondary">Medium</Badge></TableHead>
                    <TableHead><Badge className={levelColors.low} variant="secondary">Low</Badge></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Deploy Frequency</TableCell>
                    <TableCell>On-demand</TableCell>
                    <TableCell>Daily–Weekly</TableCell>
                    <TableCell>Weekly–Monthly</TableCell>
                    <TableCell>{'<'} Monthly</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Lead Time</TableCell>
                    <TableCell>{'<'} 1 hour</TableCell>
                    <TableCell>{'<'} 1 day</TableCell>
                    <TableCell>{'<'} 1 week</TableCell>
                    <TableCell>{'>'} 1 week</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Change Failure Rate</TableCell>
                    <TableCell>0–5%</TableCell>
                    <TableCell>5–10%</TableCell>
                    <TableCell>10–15%</TableCell>
                    <TableCell>{'>'} 15%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">MTTR</TableCell>
                    <TableCell>{'<'} 1 hour</TableCell>
                    <TableCell>{'<'} 1 day</TableCell>
                    <TableCell>{'<'} 1 week</TableCell>
                    <TableCell>{'>'} 1 week</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
