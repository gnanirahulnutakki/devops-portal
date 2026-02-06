'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useArgoCDApplication,
  useSyncApplication,
  useRefreshApplication,
  useApplicationResources,
  useApplicationHistory,
  type ArgoCDResource,
} from '@/hooks/use-argocd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  GitBranch,
  Package,
  History,
  Loader2,
  Server,
  User,
  Bot,
} from 'lucide-react';

// =============================================================================
// Status Styling
// =============================================================================

const healthColors: Record<string, string> = {
  Healthy: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200',
  Degraded: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
  Progressing: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200',
  Suspended: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200',
  Missing: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200',
  Unknown: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200',
};

const healthIcons: Record<string, React.ReactNode> = {
  Healthy: <CheckCircle2 className="h-4 w-4" />,
  Degraded: <AlertCircle className="h-4 w-4" />,
  Progressing: <Clock className="h-4 w-4 animate-spin" />,
  Missing: <XCircle className="h-4 w-4" />,
  Unknown: <AlertCircle className="h-4 w-4" />,
};

const syncStatusColors: Record<string, string> = {
  Synced: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  OutOfSync: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  Unknown: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20',
};

// =============================================================================
// Resource Status Component
// =============================================================================

function ResourceHealthBadge({ health }: { health?: ArgoCDResource['health'] }) {
  if (!health) return <Badge variant="outline">Unknown</Badge>;
  
  const status = health.status || 'Unknown';
  return (
    <Badge variant="outline" className={healthColors[status] || healthColors.Unknown}>
      {healthIcons[status] || healthIcons.Unknown}
      <span className="ml-1">{status}</span>
    </Badge>
  );
}

// =============================================================================
// Resources Tab
// =============================================================================

function ResourcesTab({ name }: { name: string }) {
  const { data: resources, isLoading, error } = useApplicationResources(name);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold text-destructive">Failed to load resources</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No resources found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This application has no managed resources
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group resources by kind
  const grouped = resources.reduce((acc, resource) => {
    const kind = resource.kind;
    if (!acc[kind]) acc[kind] = [];
    acc[kind].push(resource);
    return acc;
  }, {} as Record<string, ArgoCDResource[]>);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(grouped).map(([kind, items]) => (
          <Badge key={kind} variant="secondary">
            {kind}: {items.length}
          </Badge>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource, idx) => (
              <TableRow key={`${resource.kind}-${resource.name}-${idx}`}>
                <TableCell className="font-mono text-sm">
                  {resource.group ? `${resource.group}/` : ''}
                  {resource.kind}
                </TableCell>
                <TableCell className="font-medium">{resource.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {resource.namespace || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{resource.status || 'Unknown'}</Badge>
                </TableCell>
                <TableCell>
                  <ResourceHealthBadge health={resource.health} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// =============================================================================
// History Tab
// =============================================================================

function HistoryTab({ name }: { name: string }) {
  const { data: history, isLoading, error } = useApplicationHistory(name);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold text-destructive">Failed to load history</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No deployment history</p>
          <p className="text-sm text-muted-foreground mt-1">
            This application hasn&apos;t been deployed yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => (
        <Card key={entry.id} className={index === 0 ? 'border-primary' : ''}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {index === 0 ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <History className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {entry.revision.substring(0, 7)}
                    </span>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {entry.source.path} @ {entry.source.targetRevision}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.deployedAt).toLocaleString()}
                    </span>
                    {entry.initiatedBy && (
                      <span className="flex items-center gap-1">
                        {entry.initiatedBy.automated ? (
                          <>
                            <Bot className="h-3 w-3" />
                            Auto-sync
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3" />
                            {entry.initiatedBy.username || 'Manual'}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                #{entry.id}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function ArgoCDApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const name = params.name as string;
  const [activeTab, setActiveTab] = useState('overview');

  const { data: app, isLoading, error } = useArgoCDApplication(name);
  const { mutate: syncApp, isPending: isSyncing } = useSyncApplication();
  const { mutate: refreshApp, isPending: isRefreshing } = useRefreshApplication();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-destructive">Application not found</h2>
            <p className="text-muted-foreground mt-2">
              {(error as Error)?.message || `Could not find application "${name}"`}
            </p>
            <Button className="mt-4" onClick={() => router.push('/argocd')}>
              Return to Applications
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{app.name}</h1>
            <p className="text-muted-foreground">{app.namespace} / {app.project}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshApp(name)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => syncApp({ name })}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`${process.env.NEXT_PUBLIC_ARGOCD_URL}/applications/${app.name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              ArgoCD
            </a>
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Health Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={`${healthColors[app.healthStatus?.status ?? 'Unknown'] || healthColors.Unknown} text-base px-3 py-1`}
            >
              {healthIcons[app.healthStatus?.status ?? 'Unknown'] || healthIcons.Unknown}
              <span className="ml-2">{app.healthStatus?.status ?? 'Unknown'}</span>
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sync Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={`${syncStatusColors[app.syncStatus?.status ?? 'Unknown'] || syncStatusColors.Unknown} text-base px-3 py-1`}
            >
              {app.syncStatus?.status ?? 'Unknown'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Synced</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {app.reconciledAt ? new Date(app.reconciledAt).toLocaleString() : 'Never'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Server className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <Package className="h-4 w-4" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Source
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Repository</p>
                  <p className="font-mono text-sm truncate" title={app.source.repoURL}>
                    {app.source.repoURL}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Path</p>
                  <p className="font-mono text-sm">{app.source.path}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target Revision</p>
                  <p className="font-mono text-sm">{app.source.targetRevision}</p>
                </div>
              </CardContent>
            </Card>

            {/* Destination */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Destination
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Server</p>
                  <p className="font-mono text-sm truncate" title={app.destination.server}>
                    {app.destination.server}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Namespace</p>
                  <p className="font-mono text-sm">{app.destination.namespace}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(app.createdAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <ResourcesTab name={name} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab name={name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
