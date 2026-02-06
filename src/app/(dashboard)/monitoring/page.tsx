'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GrafanaDashboardList } from '@/components/monitoring/grafana-dashboard-list';
import { GrafanaFolderList } from '@/components/monitoring/grafana-folder-list';
import { GrafanaAlertList } from '@/components/monitoring/grafana-alert-list';
import { LayoutDashboard, FolderOpen, Bell } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">
          Explore Grafana dashboards, folders, and alerts for your organization.
        </p>
      </div>

      <Tabs defaultValue="dashboards">
        <TabsList>
          <TabsTrigger value="dashboards" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboards
          </TabsTrigger>
          <TabsTrigger value="folders" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Folders
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Grafana Dashboards</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ContentSkeleton />}> 
                <GrafanaDashboardList />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Folders</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ContentSkeleton />}>
                <GrafanaFolderList />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ContentSkeleton />}>
                <GrafanaAlertList />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, idx) => (
        <Skeleton key={idx} className="h-12 w-full" />
      ))}
    </div>
  );
}

