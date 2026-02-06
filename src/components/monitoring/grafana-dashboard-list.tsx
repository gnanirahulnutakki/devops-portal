"use client";

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, RefreshCcw, Eye, AlertCircle, Loader2, FolderOpen } from 'lucide-react';

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

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch dashboards');
  return data;
};

// Loading skeleton component
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

// Error state component
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

// Empty state component
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

// Not configured state
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

export function GrafanaDashboardList() {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<DashboardItem | null>(null);
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>('/api/monitoring/grafana/dashboards', fetcher, {
    refreshInterval: 60_000, // refresh every minute
    revalidateOnFocus: false,
  });

  const filtered = useMemo(() => {
    const dashboards: DashboardItem[] = data?.data ?? [];
    if (!filter) return dashboards;
    return dashboards.filter((d) =>
      d.title.toLowerCase().includes(filter.toLowerCase()) ||
      d.folderTitle?.toLowerCase().includes(filter.toLowerCase()) ||
      d.tags?.some((tag) => tag.toLowerCase().includes(filter.toLowerCase()))
    );
  }, [data?.data, filter]);

  // Check for specific error codes
  const isNotConfigured = error?.message?.includes('not configured') || 
    data?.error?.code === 'GRAFANA_NOT_CONFIGURED';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search dashboards by name, folder, or tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
          disabled={isLoading || isNotConfigured}
        />
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

      {/* Dashboard grid */}
      {!isLoading && !error && !isNotConfigured && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <EmptyState filtered={filter.length > 0} />
          ) : (
            filtered.map((dash) => (
              <Card key={dash.uid} className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{dash.folderTitle || 'Root'}</p>
                      <p className="text-base font-semibold leading-tight truncate">{dash.title}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Preview dashboard"
                        onClick={() => setSelected(dash)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
                          onClick={() => setFilter(tag)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setFilter(tag)}
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
            ))
          )}
        </div>
      )}

      <GrafanaPreviewDialog dashboard={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function GrafanaPreviewDialog({
  dashboard,
  onClose,
}: {
  dashboard: DashboardItem | null;
  onClose: () => void;
}) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  if (!dashboard) return null;

  // Detect system theme preference for Grafana render
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = prefersDark ? 'dark' : 'light';

  // Embed via Next.js proxy to avoid exposing API key
  const renderSrc = `/api/monitoring/grafana/render?uid=${dashboard.uid}&panelId=1&width=1200&height=700&theme=${theme}`;

  return (
    <Dialog
      open
      onOpenChange={(open: boolean) => {
        if (!open) {
          setIframeLoading(true);
          setIframeError(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {dashboard.folderTitle ? `${dashboard.folderTitle} / ` : ''}
            {dashboard.title}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <a href={dashboard.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open in Grafana
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {/* Loading overlay */}
          {iframeLoading && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md border bg-muted/30">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading dashboard preview...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md border bg-destructive/5">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Failed to load preview</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The Grafana image renderer may not be installed or the panel could not be rendered.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={dashboard.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    View directly in Grafana
                  </a>
                </Button>
              </div>
            </div>
          )}

          <iframe
            src={renderSrc}
            className={`absolute inset-0 h-full w-full rounded-md border transition-opacity ${
              iframeLoading ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
            onLoad={() => setIframeLoading(false)}
            onError={() => {
              setIframeLoading(false);
              setIframeError(true);
            }}
            // Security: sandbox iframe to prevent script execution
            sandbox="allow-same-origin"
            // Security: don't leak referrer to embedded content
            referrerPolicy="no-referrer"
            title={`Preview: ${dashboard.title}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
