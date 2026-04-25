"use client";

import useSWR from 'swr';
import { useMemo, useState, useCallback } from 'react';
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
  ExternalLink,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderOpen,
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

interface FolderGroup {
  folderTitle: string;
  folderUid: string;
  ruleGroups: Map<string, GrafanaAlert[]>;
  stats: { total: number; alerting: number; normal: number; pending: number };
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

const statePriority: Record<string, number> = {
  alerting: 0,
  error: 0,
  pending: 1,
  nodata: 2,
  normal: 3,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeFolderStats(alerts: GrafanaAlert[]) {
  return {
    total: alerts.length,
    alerting: alerts.filter((a) => a.state === 'alerting' || a.state === 'error').length,
    normal: alerts.filter((a) => a.state === 'normal').length,
    pending: alerts.filter((a) => a.state === 'pending').length,
  };
}

function AlertRow({ alert, credentialId }: { alert: GrafanaAlert; credentialId?: string }) {
  const portalUrl = `/grafana/alerting/grafana/${encodeURIComponent(alert.uid)}/view${credentialId ? `?credentialId=${encodeURIComponent(credentialId)}` : ''}`;
  const portalEditUrl = `/grafana/alerting/grafana/${encodeURIComponent(alert.uid)}/edit${credentialId ? `?credentialId=${encodeURIComponent(credentialId)}` : ''}`;

  return (
    <TableRow
      className={
        alert.state === 'alerting' || alert.state === 'error'
          ? 'bg-red-50/50 dark:bg-red-900/5'
          : undefined
      }
    >
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
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Open alert in portal"
            title="Open in portal"
          >
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Edit alert"
            title="Edit alert"
          >
            <a href={portalEditUrl} target="_blank" rel="noopener noreferrer">
              <Pencil className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
        {alert.updated ? (
          <span title={new Date(alert.updated).toLocaleString()}>
            {timeAgo(alert.updated)}
          </span>
        ) : (
          '-'
        )}
      </TableCell>
    </TableRow>
  );
}

function RuleGroupSection({
  groupName,
  alerts,
  credentialId,
}: {
  groupName: string;
  alerts: GrafanaAlert[];
  credentialId?: string;
}) {
  const sorted = [...alerts].sort((a, b) => {
    const pa = statePriority[a.state || 'nodata'] ?? 2;
    const pb = statePriority[b.state || 'nodata'] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
        <span className="text-sm font-medium text-muted-foreground">
          {groupName}
        </span>
        <Badge variant="secondary" className="text-xs">
          {alerts.length}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alert</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Open</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((alert) => (
            <AlertRow key={alert.uid} alert={alert} credentialId={credentialId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FolderCard({
  folder,
  expanded,
  onToggle,
  credentialId,
}: {
  folder: FolderGroup;
  expanded: boolean;
  onToggle: () => void;
  credentialId?: string;
}) {
  const sortedGroups = [...folder.ruleGroups.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <Card>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-semibold truncate">{folder.folderTitle}</span>
        <Badge variant="secondary" className="ml-auto shrink-0">
          {folder.stats.total} {folder.stats.total === 1 ? 'rule' : 'rules'}
        </Badge>
        {folder.stats.alerting > 0 && (
          <Badge variant="destructive" className="shrink-0">
            {folder.stats.alerting} alerting
          </Badge>
        )}
        {folder.stats.normal > 0 && (
          <Badge variant="outline" className={`shrink-0 ${stateColors.normal}`}>
            {folder.stats.normal} normal
          </Badge>
        )}
        {folder.stats.pending > 0 && (
          <Badge variant="outline" className={`shrink-0 ${stateColors.pending}`}>
            {folder.stats.pending} pending
          </Badge>
        )}
      </button>
      {expanded && (
        <CardContent className="p-0 border-t">
          {sortedGroups.map(([groupName, alerts]) => (
            <RuleGroupSection
              key={groupName}
              groupName={groupName}
              alerts={alerts}
              credentialId={credentialId}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function GrafanaAlertList({ credentialId }: { credentialId?: string }) {
  const [filter, setFilter] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const query = credentialId ? `?credentialId=${encodeURIComponent(credentialId)}` : '';
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/monitoring/grafana/alerts${query}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isNotConfigured = error?.message?.includes('not configured') ||
    data?.error?.code === 'GRAFANA_NOT_CONFIGURED';

  const alertingNotEnabled = data?.warning?.includes('not be enabled');

  const filteredAlerts = useMemo(() => {
    const rawAlerts: GrafanaAlert[] = data?.data ?? [];
    if (!filter) return rawAlerts;
    const q = filter.toLowerCase();
    return rawAlerts.filter(
      (alert) =>
        alert.title.toLowerCase().includes(q) ||
        alert.ruleGroup?.toLowerCase().includes(q) ||
        alert.folderTitle?.toLowerCase().includes(q)
    );
  }, [data?.data, filter]);

  const folderGroups = useMemo(() => {
    const folderMap = new Map<string, { folderUid: string; ruleGroups: Map<string, GrafanaAlert[]> }>();

    for (const alert of filteredAlerts) {
      const folderTitle = alert.folderTitle || 'General';
      const folderUid = alert.folderUid || '';
      const ruleGroup = alert.ruleGroup || 'Default';

      if (!folderMap.has(folderTitle)) {
        folderMap.set(folderTitle, { folderUid, ruleGroups: new Map() });
      }
      const folder = folderMap.get(folderTitle)!;
      if (!folder.ruleGroups.has(ruleGroup)) {
        folder.ruleGroups.set(ruleGroup, []);
      }
      folder.ruleGroups.get(ruleGroup)!.push(alert);
    }

    const groups: FolderGroup[] = [];
    for (const [folderTitle, { folderUid, ruleGroups }] of folderMap) {
      const allAlerts = [...ruleGroups.values()].flat();
      groups.push({
        folderTitle,
        folderUid,
        ruleGroups,
        stats: computeFolderStats(allAlerts),
      });
    }

    // Sort: folders with alerting rules first, then alphabetical
    groups.sort((a, b) => {
      if (a.stats.alerting > 0 && b.stats.alerting === 0) return -1;
      if (a.stats.alerting === 0 && b.stats.alerting > 0) return 1;
      return a.folderTitle.localeCompare(b.folderTitle);
    });

    return groups;
  }, [filteredAlerts]);

  const stats = useMemo(() => {
    const all: GrafanaAlert[] = data?.data ?? [];
    return {
      total: all.length,
      alerting: all.filter((a) => a.state === 'alerting').length,
      normal: all.filter((a) => a.state === 'normal').length,
      pending: all.filter((a) => a.state === 'pending').length,
    };
  }, [data?.data]);

  const toggleFolder = useCallback((folderTitle: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderTitle]: !prev[folderTitle],
    }));
  }, []);

  // When searching, auto-expand all folders that have matches
  const isFolderExpanded = useCallback(
    (folderTitle: string) => {
      if (filter) return true;
      return !!expandedFolders[folderTitle];
    },
    [filter, expandedFolders]
  );

  if (isLoading) {
    return <AlertSkeleton />;
  }

  if (error && !isNotConfigured) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isNotConfigured) {
    return <NotConfiguredState />;
  }

  if (alertingNotEnabled && filteredAlerts.length === 0 && !filter) {
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

      {/* Grouped Folder View */}
      {folderGroups.length === 0 ? (
        <EmptyState filtered={filter.length > 0} />
      ) : (
        <div className="space-y-3">
          {folderGroups.map((folder) => (
            <FolderCard
              key={folder.folderTitle}
              folder={folder}
              expanded={isFolderExpanded(folder.folderTitle)}
              onToggle={() => toggleFolder(folder.folderTitle)}
              credentialId={credentialId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
