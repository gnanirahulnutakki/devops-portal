'use client';

import { useState } from 'react';
import { useRepositories } from '@/hooks/use-github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  Search,
  ExternalLink,
  Lock,
  Globe,
  RefreshCw,
  Star,
  GitFork,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RepositoriesPage() {
  const [search, setSearch] = useState('');
  const { data: repositories, isLoading, error, refetch } = useRepositories(1, 50, search);

  const needsGitHubConfig = !process.env.NEXT_PUBLIC_GITHUB_ORG;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Repositories</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browse and manage your GitHub repositories
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {needsGitHubConfig && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>GitHub Not Configured</AlertTitle>
          <AlertDescription>
            Set <code className="bg-muted px-1 rounded">GITHUB_TOKEN</code> and{' '}
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_GITHUB_ORG</code> environment
            variables to connect to GitHub.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Repositories</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : repositories?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Public</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                repositories?.filter((r) => !r.private).length ?? 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Private</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                repositories?.filter((r) => r.private).length ?? 0
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recently Updated</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : Math.min(repositories?.length ?? 0, 10)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Repository List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            All Repositories
          </CardTitle>
          <CardDescription>Your accessible repositories from GitHub</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading repositories</AlertTitle>
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : repositories && repositories.length > 0 ? (
            <div className="space-y-3">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {repo.private ? (
                        <Lock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Globe className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium text-lg">{repo.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {repo.defaultBranch}
                      </Badge>
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4" />0
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-4 w-4" />0
                      </span>
                      <Badge variant="secondary">{repo.private ? 'Private' : 'Public'}</Badge>
                    </div>
                  </div>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No repositories found</p>
              <p className="text-sm mt-1">
                Configure GitHub credentials to see your repositories
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
