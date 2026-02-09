'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GrafanaDashboardList } from '@/components/monitoring/grafana-dashboard-list';
import { GrafanaFolderList } from '@/components/monitoring/grafana-folder-list';
import { GrafanaAlertList } from '@/components/monitoring/grafana-alert-list';
import { LayoutDashboard, FolderOpen, Bell } from 'lucide-react';

interface GrafanaAccount {
  id: string;
  name: string;
  enabled: boolean;
}

export default function MonitoringPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const [accounts, setAccounts] = useState<GrafanaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();

  const orgId = currentOrganization?.id;

  const enabledAccounts = useMemo(
    () => accounts.filter((account) => account.enabled),
    [accounts]
  );

  useEffect(() => {
    if (!orgId) return;
    const fetchAccounts = async () => {
      const res = await fetch('/api/integrations/grafana/accounts', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.data || []);
        if (!selectedAccount && data.data?.[0]) {
          setSelectedAccount(data.data[0].id);
        }
      }
    };
    fetchAccounts();
  }, [orgId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground">
          Explore Grafana dashboards, folders, and alerts for your organization.
        </p>
      </div>

      <div className="max-w-sm space-y-2">
        <Label>Grafana Account</Label>
        <Select
          value={selectedAccount}
          onValueChange={(value) => setSelectedAccount(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Grafana account" />
          </SelectTrigger>
          <SelectContent>
            {enabledAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <GrafanaDashboardList credentialId={selectedAccount} />
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
                <GrafanaFolderList credentialId={selectedAccount} />
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
                <GrafanaAlertList credentialId={selectedAccount} />
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

