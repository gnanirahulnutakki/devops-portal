'use client';

import { useArgoCDApplications } from '@/hooks/use-argocd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Rocket,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Server,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function DeploymentsPage() {
  const { data: applications, isLoading, error, refetch } = useArgoCDApplications();

  const getHealthIcon = (health?: string) => {
    switch (health) {
      case 'Healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'Degraded':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Progressing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'Suspended':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthBadge = (health?: string) => {
    switch (health) {
      case 'Healthy':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Healthy</Badge>;
      case 'Degraded':
        return <Badge variant="destructive">Degraded</Badge>;
      case 'Progressing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Progressing</Badge>;
      case 'Suspended':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Suspended</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getSyncBadge = (sync?: string) => {
    switch (sync) {
      case 'Synced':
        return <Badge variant="outline" className="border-green-500 text-green-600">Synced</Badge>;
      case 'OutOfSync':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Out of Sync</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const healthyCount = applications?.filter((a) => a.healthStatus?.status === 'Healthy').length ?? 0;
  const degradedCount = applications?.filter((a) => a.healthStatus?.status === 'Degraded').length ?? 0;
  const progressingCount = applications?.filter((a) => a.healthStatus?.status === 'Progressing').length ?? 0;
  const outOfSyncCount = applications?.filter((a) => a.syncStatus?.status === 'OutOfSync').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Deployments</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage your application deployments
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deployments</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : applications?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Healthy
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : healthyCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              Degraded
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : degradedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              In Progress
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : progressingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Out of Sync
            </CardDescription>
            <CardTitle className="text-2xl text-orange-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : outOfSyncCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Deployment List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            All Deployments
          </CardTitle>
          <CardDescription>Applications managed by ArgoCD</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error loading deployments</AlertTitle>
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : applications && applications.length > 0 ? (
            <div className="space-y-3">
              {applications.map((app) => (
                <Link
                  key={app.name}
                  href={`/argocd/${app.name}`}
                  className="block"
                >
                  <div className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                    <div className="flex gap-3">
                      {getHealthIcon(app.healthStatus?.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-lg">{app.name}</span>
                          {getHealthBadge(app.healthStatus?.status)}
                          {getSyncBadge(app.syncStatus?.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Server className="h-4 w-4" />
                            {app.namespace}
                          </span>
                          <span className="flex items-center gap-1">
                            Project: {app.project}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <span>Cluster: {app.destination?.server || 'default'}</span>
                          {app.syncStatus?.revision && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{app.syncStatus.revision.substring(0, 7)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Rocket className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No deployments found</p>
              <p className="text-sm mt-1">
                Configure ArgoCD credentials to see your deployments
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
