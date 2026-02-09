'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRepositories } from '@/hooks/use-github';
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
  GitBranch,
  Search,
  ExternalLink,
  Lock,
  Globe,
  RefreshCw,
  Star,
  GitFork,
  AlertCircle,
  Github,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function RepositoriesPage() {
  const [repoQuery, setRepoQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('none');
  const { data: session } = useSession();
  const { data: repositories, isLoading, error, refetch } = useRepositories(1, 200);

  // Detect GitHub connection issues from the API error response
  const isNotConnected = error?.message?.includes('not connected') || error?.message?.includes('not configured');
  const filteredRepos = useMemo(() => {
    if (!repositories) return [];
    const query = repoQuery.trim().toLowerCase();
    if (!query) return repositories;
    return repositories.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(query) ||
        repo.name.toLowerCase().includes(query) ||
        (repo.description || '').toLowerCase().includes(query)
    );
  }, [repositories, repoQuery]);
  const selectedRepoData =
    selectedRepo !== 'none' && selectedRepo !== 'all'
      ? repositories?.find((repo) => repo.fullName === selectedRepo)
      : undefined;

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
        <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isNotConnected && (
        <Alert>
          <Github className="h-4 w-4" />
          <AlertTitle>GitHub Not Connected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {session?.user?.hasGitHubConnection
                ? 'GitHub integration is not configured. Contact your administrator.'
                : 'Connect your GitHub account to browse repositories and pull requests.'}
            </span>
            {!session?.user?.hasGitHubConnection && (
              <Button asChild size="sm" variant="outline" className="ml-4 shrink-0">
                <Link href="/settings">Connect GitHub</Link>
              </Button>
            )}
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

      {/* Repository Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository Selector
          </CardTitle>
          <CardDescription>Select a repository or show all</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Search repositories</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Filter repositories..."
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Show</label>
            <Select value={selectedRepo} onValueChange={setSelectedRepo}>
              <SelectTrigger>
                <SelectValue placeholder="Select repository" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a repository</SelectItem>
                <SelectItem value="all">All repositories</SelectItem>
                {filteredRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Repository Details / List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {selectedRepo === 'all'
              ? 'All Repositories'
              : selectedRepoData
                ? 'Repository Overview'
                : 'Repositories'}
          </CardTitle>
          <CardDescription>
            {selectedRepo === 'all'
              ? 'Your accessible repositories from GitHub'
              : selectedRepoData
                ? 'Selected repository summary'
                : 'Select a repository or choose All to display'}
          </CardDescription>
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
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : selectedRepo === 'all' && filteredRepos.length > 0 ? (
            <div className="space-y-3">
              {filteredRepos.map((repo) => (
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
                      <Link
                        href={`/repositories/${encodeURIComponent(repo.fullName)}`}
                        className="font-medium text-lg hover:underline"
                      >
                        {repo.name}
                      </Link>
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
          ) : selectedRepoData ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedRepoData.private ? (
                      <Lock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Globe className="h-4 w-4 text-green-500" />
                    )}
                    <Link
                      href={`/repositories/${encodeURIComponent(selectedRepoData.fullName)}`}
                      className="text-lg font-medium hover:underline"
                    >
                      {selectedRepoData.fullName}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {selectedRepoData.defaultBranch}
                    </Badge>
                  </div>
                  {selectedRepoData.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedRepoData.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">No description provided.</p>
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Badge variant="secondary">{selectedRepoData.private ? 'Private' : 'Public'}</Badge>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4" />0
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="h-4 w-4" />0
                    </span>
                  </div>
                </div>
                <a
                  href={selectedRepoData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Default Branch</CardDescription>
                    <CardTitle className="text-lg">{selectedRepoData.defaultBranch}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Visibility</CardDescription>
                    <CardTitle className="text-lg">{selectedRepoData.private ? 'Private' : 'Public'}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>URL</CardDescription>
                    <CardTitle className="text-sm">
                      <a
                        href={selectedRepoData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rl-blue hover:underline"
                      >
                        Open in GitHub
                      </a>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a repository</p>
              <p className="text-sm mt-1">Choose a repository or select All to list them</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
