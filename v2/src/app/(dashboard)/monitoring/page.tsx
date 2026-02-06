import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GrafanaDashboardList } from '@/components/monitoring/grafana-dashboard-list';

export const metadata = {
  title: 'Monitoring',
};

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">
          Explore Grafana dashboards and system metrics for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grafana Dashboards</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<DashboardsSkeleton />}> 
            <GrafanaDashboardList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, idx) => (
        <Skeleton key={idx} className="h-12 w-full" />
      ))}
    </div>
  );
}

