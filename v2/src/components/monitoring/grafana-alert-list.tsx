"use client";

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCcw,
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface GrafanaAlert {
  uid: string;
  title: string;
  condition: string;
  data: unknown;
  orgId?: number;
  updated?: string;
  ruleGroup?: string;
  folderUid?: string;
  folderTitle?: string;
  state?: string;
  health?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface ApiResponse {
  success: boolean;
  data?: GrafanaAlert[];
  warning?: string;
  error?: {
    code: string;
    message: string;
  };
}

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch alerts');
  return data;
};

function AlertSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">Failed to load alerts</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <BellOff className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <p className="font-semibold text-muted-foreground">
            {filtered ? 'No matching alerts' : 'No alert rules configured'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered
              ? 'Try adjusting your search filter'
              : 'Create alert rules in Grafana to see them here'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotConfiguredState() {
  return (
    <Card className="border-warning bg-warning/5">
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-warning" />
        <div>
          <p className="font-semibold">Grafana not configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your administrator to configure Grafana integration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertingNotEnabledState() {
  return (
    <Card className="border-muted">
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <p className="font-semibold text-muted-foreground">Grafana Alerting not enabled</p>
          <p className="text-sm text-muted-foreground mt-1">
            The Unified Alerting feature may not be enabled in Grafana,
            or you may be using legacy alerting.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const stateColors: Record<string, string> = {
  normal: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  alerting: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  pending: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  nodata: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20',
  error: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

const stateIcons: Record<string, React.ReactNode> = {
  normal: <CheckCircle2 className="h-3 w-3" />,
  alerting: <AlertCircle className="h-3 w-3" />,
  pending: <Bell className="h-3 w-3" />,
  nodata: <BellOff className="h-3 w-3" />,
  error: <XCircle className="h-3 w-3" />,
};

export function GrafanaAlertList() {
  const [filter, setFilter] = useState('');
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    '/api/monitoring/grafana/alerts',
    fetcher,
    { revalidateOnFocus: false }
  );

  const isNotConfigured = error?.message?.includes('not configured') ||
    data?.error?.code === 'GRAFANA_NOT_CONFIGURED';

  const alertingNotEnabled = data?.warning?.includes('not be enabled');

  const alerts = useMemo(() => {
    const rawAlerts: GrafanaAlert[] = data?.data ?? [];
    if (!filter) return rawAlerts;
    return rawAlerts.filter(
      (alert: GrafanaAlert) =>
        alert.title.toLowerCase().includes(filter.toLowerCase()) ||
        alert.ruleGroup?.toLowerCase().includes(filter.toLowerCase()) ||
        alert.folderTitle?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data?.data, filter]);

  const stats = useMemo(() => {
    const all: GrafanaAlert[] = data?.data ?? [];
    return {
      total: all.length,
      alerting: all.filter((a: GrafanaAlert) => a.state === 'alerting').length,
      normal: all.filter((a: GrafanaAlert) => a.state === 'normal').length,
      pending: all.filter((a: GrafanaAlert) => a.state === 'pending').length,
    };
  }, [data?.data]);

  if (isLoading) {
    return <AlertSkeleton />;
  }

  if (error && !isNotConfigured) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isNotConfigured) {
    return <NotConfiguredState />;
  }

  if (alertingNotEnabled && alerts.length === 0) {
    return <AlertingNotEnabledState />;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{stats.total} total</Badge>
        {stats.alerting > 0 && (
          <Badge variant="destructive">{stats.alerting} alerting</Badge>
        )}
        {stats.normal > 0 && (
          <Badge variant="outline" className={stateColors.normal}>
            {stats.normal} normal
          </Badge>
        )}
        {stats.pending > 0 && (
          <Badge variant="outline" className={stateColors.pending}>
            {stats.pending} pending
          </Badge>
        )}
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => mutate()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Alert Table */}
      {alerts.length === 0 ? (
        <EmptyState filtered={filter.length > 0} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Rule Group</TableHead>
                <TableHead>Folder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert: GrafanaAlert) => (
                <TableRow key={alert.uid}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.condition || alert.uid}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={stateColors[alert.state || 'nodata'] || stateColors.nodata}
                    >
                      {stateIcons[alert.state || 'nodata'] || stateIcons.nodata}
                      <span className="ml-1 capitalize">{alert.state || 'Unknown'}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {alert.ruleGroup || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {alert.folderTitle || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
