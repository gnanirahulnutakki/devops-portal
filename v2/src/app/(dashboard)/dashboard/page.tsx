import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { MetricCard } from '@/components/dashboard/metric-card';
import { StatusCard } from '@/components/dashboard/status-card';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  GitPullRequest,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from 'lucide-react';

export const metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your deployments today.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Deployments"
          value="24"
          description="+2 from last week"
          icon={Rocket}
          trend="up"
          trendValue="8%"
        />
        <MetricCard
          title="Active PRs"
          value="8"
          description="3 need review"
          icon={GitPullRequest}
          trend="neutral"
        />
        <MetricCard
          title="Healthy Apps"
          value="21/24"
          description="87.5% health rate"
          icon={CheckCircle2}
          trend="up"
          trendValue="4%"
          valueClassName="text-rl-green"
        />
        <MetricCard
          title="Active Alerts"
          value="3"
          description="2 critical, 1 warning"
          icon={AlertTriangle}
          trend="down"
          trendValue="25%"
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
              <StatusCard
                label="Synced"
                value={18}
                total={24}
                color="green"
              />
              <StatusCard
                label="Out of Sync"
                value={4}
                total={24}
                color="orange"
              />
              <StatusCard
                label="Unknown"
                value={2}
                total={24}
                color="gray"
              />
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
              <StatusCard
                label="Healthy"
                value={21}
                total={24}
                color="green"
              />
              <StatusCard
                label="Degraded"
                value={2}
                total={24}
                color="orange"
              />
              <StatusCard
                label="Progressing"
                value={1}
                total={24}
                color="blue"
              />
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
                <span className="text-lg font-semibold text-rl-green">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="text-lg font-semibold text-red-500">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <span className="text-lg font-semibold text-rl-blue">2</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest deployments, syncs, and pull requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ActivitySkeleton />}>
            <RecentActivity />
          </Suspense>
        </CardContent>
      </Card>
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
