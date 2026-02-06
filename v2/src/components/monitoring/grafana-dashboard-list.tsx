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
import { ExternalLink, RefreshCcw, Eye } from 'lucide-react';

interface DashboardItem {
  id: number;
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  tags?: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function GrafanaDashboardList() {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<DashboardItem | null>(null);
  const { data, isLoading, mutate } = useSWR('/api/monitoring/grafana/dashboards', fetcher, {
    refreshInterval: 60_000, // refresh every minute
  });

  const filtered = useMemo(() => {
    const dashboards: DashboardItem[] = data?.data ?? [];
    if (!filter) return dashboards;
    return dashboards.filter((d) =>
      d.title.toLowerCase().includes(filter.toLowerCase()) ||
      d.folderTitle?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data?.data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search dashboards..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="icon" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((dash) => (
          <Card key={dash.uid} className="hover:border-primary transition-colors">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">{dash.folderTitle || 'Root'}</p>
                  <p className="text-base font-semibold leading-tight">{dash.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Preview dashboard"
                    onClick={() => setSelected(dash)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label="Open in Grafana">
                    <a href={dash.url} target="_blank" rel="noreferrer">
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
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
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
        ))}

        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No dashboards found.</p>
        )}
      </div>

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
  if (!dashboard) return null;

  // Embed via Next.js proxy to avoid exposing API key
  const renderSrc = `/api/monitoring/grafana/render?uid=${dashboard.uid}&panelId=1&width=1200&height=700&theme=light`;

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {dashboard.folderTitle ? `${dashboard.folderTitle} / ` : ''}
            {dashboard.title}
          </DialogTitle>
        </DialogHeader>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={renderSrc}
            className="absolute inset-0 h-full w-full rounded-md border"
            loading="lazy"
            allow="fullscreen"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
