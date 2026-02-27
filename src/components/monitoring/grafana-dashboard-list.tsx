"use client";

import useSWR from 'swr';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ExternalLink,
  RefreshCcw,
  Eye,
  AlertCircle,
  Loader2,
  FolderOpen,
  Pencil,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';

interface DashboardItem {
  id: number;
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  tags?: string[];
}

interface ApiResponse {
  success: boolean;
  data?: DashboardItem[];
  error?: {
    code: string;
    message: string;
  };
}

interface FolderGroup {
  folderTitle: string;
  dashboards: DashboardItem[];
}

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch dashboards');
  return data;
};

function DashboardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="flex gap-1 mt-2">
          <div className="h-4 w-12 bg-muted rounded-full" />
          <div className="h-4 w-16 bg-muted rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">Failed to load dashboards</p>
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
    <Card className="col-span-full">
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <p className="font-semibold text-muted-foreground">
            {filtered ? 'No matching dashboards' : 'No dashboards available'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered
              ? 'Try adjusting your search filter'
              : 'Configure Grafana dashboards to view them here'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotConfiguredState() {
  return (
    <Card className="col-span-full border-warning bg-warning/5">
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-warning" />
        <div>
          <p className="font-semibold">Grafana not configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your administrator to configure Grafana integration for this organization.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardCard({
  dash,
  credentialId,
  onPreview,
  onTagClick,
}: {
  dash: DashboardItem;
  credentialId?: string;
  onPreview: (d: DashboardItem) => void;
  onTagClick: (tag: string) => void;
}) {
  let portalUrl: string | null = null;
  let portalEditUrl: string | null = null;
  try {
    const dashUrl = new URL(dash.url);
    const p = new URL(`/grafana${dashUrl.pathname}`, window.location.origin);
    dashUrl.searchParams.forEach((v, k) => p.searchParams.set(k, v));
    if (credentialId) p.searchParams.set('credentialId', credentialId);
    portalUrl = p.toString();

    const e = new URL(p.toString());
    e.searchParams.set('editview', 'dashboard');
    portalEditUrl = e.toString();
  } catch {
    // Ignore; external link will still work
  }

  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight truncate">{dash.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Preview dashboard"
              onClick={() => onPreview(dash)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {portalUrl ? (
              <Button asChild size="icon" variant="ghost" aria-label="Open in portal" title="Open in portal">
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {portalEditUrl ? (
              <Button asChild size="icon" variant="ghost" aria-label="Edit dashboard" title="Edit dashboard">
                <a href={portalEditUrl} target="_blank" rel="noopener noreferrer">
                  <Pencil className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button asChild size="icon" variant="ghost" aria-label="Open in Grafana">
              <a href={dash.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {dash.tags && dash.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dash.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/80"
                onClick={() => onTagClick(tag)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onTagClick(tag)}
              >
                {tag}
              </span>
            ))}
            {dash.tags.length > 5 && (
              <span className="text-xs text-muted-foreground">+{dash.tags.length - 5}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FolderSection({
  folder,
  expanded,
  onToggle,
  credentialId,
  onPreview,
  onTagClick,
}: {
  folder: FolderGroup;
  expanded: boolean;
  onToggle: () => void;
  credentialId?: string;
  onPreview: (d: DashboardItem) => void;
  onTagClick: (tag: string) => void;
}) {
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
          {folder.dashboards.length} {folder.dashboards.length === 1 ? 'dashboard' : 'dashboards'}
        </Badge>
      </button>
      {expanded && (
        <CardContent className="p-4 pt-0 border-t">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 pt-4">
            {folder.dashboards
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((dash) => (
                <DashboardCard
                  key={dash.uid}
                  dash={dash}
                  credentialId={credentialId}
                  onPreview={onPreview}
                  onTagClick={onTagClick}
                />
              ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function GrafanaDashboardList({ credentialId }: { credentialId?: string }) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<DashboardItem | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const query = credentialId ? `?credentialId=${encodeURIComponent(credentialId)}` : '';
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/monitoring/grafana/dashboards${query}`,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const isNotConfigured = error?.message?.includes('not configured') ||
    data?.error?.code === 'GRAFANA_NOT_CONFIGURED';

  const filteredDashboards = useMemo(() => {
    const dashboards: DashboardItem[] = data?.data ?? [];
    if (!filter) return dashboards;
    const q = filter.toLowerCase();
    return dashboards.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      d.folderTitle?.toLowerCase().includes(q) ||
      d.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [data?.data, filter]);

  const folderGroups = useMemo(() => {
    const folderMap = new Map<string, DashboardItem[]>();

    for (const dash of filteredDashboards) {
      const folderTitle = dash.folderTitle || 'General';
      if (!folderMap.has(folderTitle)) {
        folderMap.set(folderTitle, []);
      }
      folderMap.get(folderTitle)!.push(dash);
    }

    const groups: FolderGroup[] = [];
    for (const [folderTitle, dashboards] of folderMap) {
      groups.push({ folderTitle, dashboards });
    }

    groups.sort((a, b) => a.folderTitle.localeCompare(b.folderTitle));
    return groups;
  }, [filteredDashboards]);

  const totalCount = data?.data?.length ?? 0;

  const toggleFolder = useCallback((folderTitle: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderTitle]: !prev[folderTitle],
    }));
  }, []);

  const isFolderExpanded = useCallback(
    (folderTitle: string) => {
      if (filter) return true;
      return !!expandedFolders[folderTitle];
    },
    [filter, expandedFolders]
  );

  const handleTagClick = useCallback((tag: string) => {
    setFilter(tag);
  }, []);

  return (
    <div className="space-y-4">
      {/* Stats */}
      {!isLoading && !error && !isNotConfigured && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{totalCount} dashboards</Badge>
          <Badge variant="outline">{folderGroups.length} folders</Badge>
        </div>
      )}

      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dashboards by name, folder, or tag..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
            disabled={isLoading || isNotConfigured}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => mutate()}
          disabled={isLoading}
          aria-label="Refresh dashboards"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <DashboardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && !isNotConfigured && (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      )}

      {/* Not configured state */}
      {!isLoading && isNotConfigured && (
        <div className="grid gap-3">
          <NotConfiguredState />
        </div>
      )}

      {/* Grouped Folder View */}
      {!isLoading && !error && !isNotConfigured && (
        folderGroups.length === 0 ? (
          <EmptyState filtered={filter.length > 0} />
        ) : (
          <div className="space-y-3">
            {folderGroups.map((folder) => (
              <FolderSection
                key={folder.folderTitle}
                folder={folder}
                expanded={isFolderExpanded(folder.folderTitle)}
                onToggle={() => toggleFolder(folder.folderTitle)}
                credentialId={credentialId}
                onPreview={setSelected}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )
      )}

      <GrafanaPreviewDialog
        dashboard={selected}
        credentialId={credentialId}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function GrafanaPreviewDialog({
  dashboard,
  credentialId,
  onClose,
}: {
  dashboard: DashboardItem | null;
  credentialId?: string;
  onClose: () => void;
}) {
  if (!dashboard) return null;

  const dashUrl = new URL(dashboard.url);
  const proxyUrl = new URL(`/grafana${dashUrl.pathname}`, window.location.origin);
  dashUrl.searchParams.forEach((v, k) => proxyUrl.searchParams.set(k, v));
  if (credentialId) proxyUrl.searchParams.set('credentialId', credentialId);
  const editUrl = new URL(proxyUrl.toString());
  editUrl.searchParams.set('editview', 'dashboard');

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {dashboard.folderTitle ? `${dashboard.folderTitle} / ` : ''}
            {dashboard.title}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            <Button asChild size="sm">
              <a href={proxyUrl.toString()} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open in portal
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href={editUrl.toString()} target="_blank" rel="noopener noreferrer">
                <Pencil className="h-3 w-3 mr-1.5" />
                Edit dashboard
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={dashboard.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open directly
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-md border bg-background">
          <iframe
            src={proxyUrl.toString()}
            className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
            title={`Grafana: ${dashboard.title}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
