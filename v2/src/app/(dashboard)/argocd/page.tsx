'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useArgoCDApplications, useSyncApplication, useArgoCDProjects } from '@/hooks/use-argocd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  Synced: 'bg-green-500',
  OutOfSync: 'bg-yellow-500',
  Unknown: 'bg-gray-500',
};

const healthColors: Record<string, string> = {
  Healthy: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  Degraded: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  Progressing: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  Suspended: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20',
  Missing: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  Unknown: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20',
};

const healthIcons: Record<string, React.ReactNode> = {
  Healthy: <CheckCircle2 className="h-4 w-4" />,
  Degraded: <AlertCircle className="h-4 w-4" />,
  Progressing: <Clock className="h-4 w-4 animate-spin" />,
  Missing: <XCircle className="h-4 w-4" />,
  Unknown: <AlertCircle className="h-4 w-4" />,
};

export default function ArgoCDPage() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const { data: applications, isLoading, error, refetch, isFetching } = useArgoCDApplications();
  const { data: projects } = useArgoCDProjects();
  const { mutate: syncApp, isPending: isSyncing } = useSyncApplication();

  const filteredApps = useMemo(() => {
    if (!applications) return [];
    return applications.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
        app.namespace.toLowerCase().includes(search.toLowerCase());
      const matchesProject = projectFilter === 'all' || app.project === projectFilter;
      return matchesSearch && matchesProject;
    });
  }, [applications, search, projectFilter]);

  const stats = useMemo(() => ({
    total: applications?.length ?? 0,
    healthy: applications?.filter(a => a.healthStatus === 'Healthy').length ?? 0,
    synced: applications?.filter(a => a.syncStatus === 'Synced').length ?? 0,
    outOfSync: applications?.filter(a => a.syncStatus === 'OutOfSync').length ?? 0,
  }), [applications]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ArgoCD</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            GitOps application deployments
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Apps</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Healthy</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {isLoading ? <Skeleton className="h-8 w-12" /> : stats.healthy}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Synced</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {isLoading ? <Skeleton className="h-8 w-12" /> : stats.synced}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Out of Sync</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {isLoading ? <Skeleton className="h-8 w-12" /> : stats.outOfSync}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or namespace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map(project => (
              <SelectItem key={project} value={project}>{project}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Applications Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-destructive">Failed to load applications</h3>
            <p className="text-muted-foreground mt-2">{(error as Error).message}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredApps && filteredApps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <Card key={app.name} className="hover:shadow-md hover:border-primary/50 transition-all group">
              <Link href={`/argocd/${encodeURIComponent(app.name)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {app.name}
                      </CardTitle>
                      <CardDescription>{app.namespace}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{app.project}</Badge>
                      <div className={`w-2 h-2 rounded-full ${statusColors[app.syncStatus] || statusColors.Unknown}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={healthColors[app.healthStatus] || healthColors.Unknown}
                    >
                      {healthIcons[app.healthStatus] || healthIcons.Unknown}
                      <span className="ml-1">{app.healthStatus}</span>
                    </Badge>
                    <Badge variant="outline">
                      {app.syncStatus}
                    </Badge>
                  </div>

                  {/* Source Info */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="truncate" title={app.source.repoURL}>
                      📂 {app.source.path}
                    </p>
                    <p className="truncate">
                      🎯 {app.source.targetRevision}
                    </p>
                  </div>
                </CardContent>
              </Link>
              
              {/* Actions - outside of Link to prevent nested interactives */}
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      syncApp({ name: app.name });
                    }}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Sync
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`${process.env.NEXT_PUBLIC_ARGOCD_URL}/applications/${app.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No applications found</p>
            {search && <p className="text-sm mt-1">Try adjusting your search</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
