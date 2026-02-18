'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useOrganizationStore } from '@/store/organization-store';
import { MetricCard } from '@/components/dashboard/metric-card';
import { StatusCard } from '@/components/dashboard/status-card';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { GrafanaPanels } from '@/components/dashboard/grafana-panels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  GitBranch,
  GitPullRequest,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ArrowRight,
  Gauge,
  Plug,
  Shield,
  BookOpen,
  Server,
} from 'lucide-react';

interface DashboardSummary {
  metrics: {
    deploymentsTotal: number;
    openPullRequests: number;
    healthyApps: number;
    activeAlerts: number;
  };
  status: {
    argocdSync: {
      synced: number;
      outOfSync: number;
      unknown: number;
      total: number;
    };
    health: {
      healthy: number;
      degraded: number;
      progressing: number;
      other: number;
      total: number;
    };
    syncActivity: {
      success: number;
      failed: number;
      running: number;
    };
  };
  integrations: {
    argocd: boolean;
    grafana: boolean;
    github: boolean;
  };
  recentActivity: Array<{
    id: string;
    type: 'pr_opened' | 'pr_merged' | 'deployment' | 'sync' | 'alert' | 'sync_success';
    title: string;
    description: string;
    user: { name: string; avatar?: string };
    timestamp: string;
    status?: 'success' | 'failed' | 'pending';
  }>;
}

const quickActions = [
  {
    title: 'Add Grafana',
    description: 'Connect Grafana for dashboards, alerts, and insights.',
    href: '/settings/configurations/grafana',
    icon: Gauge,
  },
  {
    title: 'Add ArgoCD',
    description: 'Connect ArgoCD to track deployments and sync status.',
    href: '/settings/configurations/argocd',
    icon: GitBranch,
  },
  {
    title: 'Browse Clusters',
    description: 'View Kubernetes namespaces, pods, and workloads.',
    href: '/clusters',
    icon: Server,
  },
  {
    title: 'Security Scans',
    description: 'Run Trivy scans on container images.',
    href: '/vulnerability',
    icon: Shield,
  },
  {
    title: 'All Configurations',
    description: 'Manage all integration accounts (Grafana, ArgoCD, GitHub, etc.).',
    href: '/settings/configurations',
    icon: Plug,
  },
  {
    title: 'Guides',
    description: 'Step-by-step setup instructions for every feature.',
    href: '/guides',
    icon: BookOpen,
  },
];

export function DashboardClient() {
  const { data: session } = useSession();
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const displayName = useMemo(
    () => session?.user?.name?.split(' ')[0] || 'User',
    [session?.user?.name]
  );

  useEffect(() => {
    if (!currentOrganization?.id) return;
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/summary', {
          headers: { 'x-organization-id': currentOrganization.id },
        });
        const data = await res.json();
        if (res.ok) {
          setSummary(data.data);
        } else {
          setSummary(null);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [currentOrganization?.id]);

  const hasAnyIntegration =
    summary?.integrations.argocd ||
    summary?.integrations.grafana ||
    summary?.integrations.github;

  const showWelcome = !loading && !hasAnyIntegration;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground">
          {showWelcome
            ? 'Get started by connecting your tools, or explore the portal features below.'
            : "Here's what's happening with your deployments today."}
        </p>
      </div>

      {/* ------ Empty / Welcome state ------ */}
      {showWelcome && (
        <div className="space-y-6">
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <div className="rounded-full bg-muted p-4">
                <Plug className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-lg font-semibold">No integrations configured yet</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect Grafana, ArgoCD, or GitHub to populate your dashboard
                  with live data. Everything is configurable from the UI.
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/settings/configurations">
                    <Plug className="h-4 w-4 mr-2" />
                    Add Integration
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/guides">
                    <BookOpen className="h-4 w-4 mr-2" />
                    View Guides
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-3">Quick actions</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href} className="group">
                  <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="rounded-md bg-muted p-2 shrink-0">
                        <a.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1">
                          {a.title}
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------ Normal dashboard (integrations exist) ------ */}
      {!showWelcome && (
        <>
          {/* Metric Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Deployments"
              value={summary?.metrics.deploymentsTotal ?? (loading ? '—' : 0)}
              description={summary?.integrations.argocd ? 'ArgoCD applications' : 'ArgoCD not configured'}
              icon={Rocket}
              trend="neutral"
            />
            <MetricCard
              title="Active PRs"
              value={summary?.metrics.openPullRequests ?? (loading ? '—' : 0)}
              description={summary?.integrations.github ? 'Across recent repos' : 'GitHub not connected'}
              icon={GitPullRequest}
              trend="neutral"
            />
            <MetricCard
              title="Healthy Apps"
              value={
                summary
                  ? `${summary.metrics.healthyApps}/${summary.status.health.total}`
                  : loading
                  ? '—'
                  : '0/0'
              }
              description={summary?.integrations.argocd ? 'ArgoCD health' : 'ArgoCD not configured'}
              icon={CheckCircle2}
              trend="up"
              valueClassName="text-rl-green"
            />
            <MetricCard
              title="Active Alerts"
              value={summary?.metrics.activeAlerts ?? (loading ? '—' : 0)}
              description={summary?.integrations.grafana ? 'Grafana alerts' : 'Grafana not configured'}
              icon={AlertTriangle}
              trend="down"
              valueClassName="text-rl-orange"
            />
          </div>

          {/* Status Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-rl-blue" />
                  ArgoCD Status
                </CardTitle>
                <CardDescription>Application sync status overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <StatusCard label="Synced" value={summary?.status.argocdSync.synced ?? 0} total={summary?.status.argocdSync.total ?? 0} color="green" />
                  <StatusCard label="Out of Sync" value={summary?.status.argocdSync.outOfSync ?? 0} total={summary?.status.argocdSync.total ?? 0} color="orange" />
                  <StatusCard label="Unknown" value={summary?.status.argocdSync.unknown ?? 0} total={summary?.status.argocdSync.total ?? 0} color="gray" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-rl-blue" />
                  Health Status
                </CardTitle>
                <CardDescription>Application health overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <StatusCard label="Healthy" value={summary?.status.health.healthy ?? 0} total={summary?.status.health.total ?? 0} color="green" />
                  <StatusCard label="Degraded" value={summary?.status.health.degraded ?? 0} total={summary?.status.health.total ?? 0} color="orange" />
                  <StatusCard label="Progressing" value={summary?.status.health.progressing ?? 0} total={summary?.status.health.total ?? 0} color="blue" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-rl-blue" />
                  Recent Syncs
                </CardTitle>
                <CardDescription>Last 24 hours activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Successful</span>
                    <span className="text-lg font-semibold text-rl-green">{summary?.status.syncActivity.success ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Failed</span>
                    <span className="text-lg font-semibold text-red-500">{summary?.status.syncActivity.failed ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">In Progress</span>
                    <span className="text-lg font-semibold text-rl-blue">{summary?.status.syncActivity.running ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <GrafanaPanels />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest deployments, syncs, and pull requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <ActivitySkeleton /> : <RecentActivity items={summary?.recentActivity || []} />}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
