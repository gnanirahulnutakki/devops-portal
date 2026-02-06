"use client";

import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RefreshCcw, FolderOpen, AlertCircle, Loader2 } from 'lucide-react';

interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
  url: string;
}

interface ApiResponse {
  success: boolean;
  data?: GrafanaFolder[];
  error?: {
    code: string;
    message: string;
  };
}

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch folders');
  return data;
};

function FolderSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 bg-muted rounded" />
        <div className="flex-1">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded mt-2" />
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
          <p className="font-semibold text-destructive">Failed to load folders</p>
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

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <p className="font-semibold text-muted-foreground">No folders found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create folders in Grafana to organize your dashboards
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

export function GrafanaFolderList() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    '/api/monitoring/grafana/folders',
    fetcher,
    { revalidateOnFocus: false }
  );

  const isNotConfigured = error?.message?.includes('not configured') ||
    data?.error?.code === 'GRAFANA_NOT_CONFIGURED';

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <FolderSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error && !isNotConfigured) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isNotConfigured) {
    return <NotConfiguredState />;
  }

  const folders: GrafanaFolder[] = data?.data ?? [];

  if (folders.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{folders.length} folders</Badge>
        <Button
          variant="outline"
          size="sm"
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

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <Card key={folder.uid} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{folder.title}</p>
                <p className="text-xs text-muted-foreground">UID: {folder.uid}</p>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={`${process.env.NEXT_PUBLIC_GRAFANA_URL || ''}${folder.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${folder.title} in Grafana`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
