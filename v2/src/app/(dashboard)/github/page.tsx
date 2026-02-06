'use client';

import { useState } from 'react';
import { useRepositories, usePullRequests } from '@/hooks/use-github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  GitPullRequest,
  Search,
  ExternalLink,
  Lock,
  Globe,
  RefreshCw,
} from 'lucide-react';

export default function GitHubPage() {
  const [search, setSearch] = useState('');
  const { data: repositories, isLoading: reposLoading, refetch: refetchRepos } = useRepositories(1, 20, search);
  const { data: pullRequests, isLoading: prsLoading, refetch: refetchPRs } = usePullRequests();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GitHub</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage repositories and pull requests
          </p>
        </div>
        <Button
          onClick={() => {
            refetchRepos();
            refetchPRs();
          }}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Repositories</CardDescription>
            <CardTitle className="text-2xl">
              {reposLoading ? <Skeleton className="h-8 w-16" /> : repositories?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Pull Requests</CardDescription>
            <CardTitle className="text-2xl">
              {prsLoading ? <Skeleton className="h-8 w-16" /> : pullRequests?.filter(pr => pr.state === 'open').length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recently Merged</CardDescription>
            <CardTitle className="text-2xl">
              {prsLoading ? <Skeleton className="h-8 w-16" /> : pullRequests?.filter(pr => pr.state === 'merged').length ?? 0}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repositories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Repositories
            </CardTitle>
            <CardDescription>Your accessible repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {reposLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : repositories && repositories.length > 0 ? (
              <div className="space-y-3">
                {repositories.slice(0, 10).map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {repo.private ? (
                          <Lock className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Globe className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium truncate">{repo.name}</span>
                      </div>
                      {repo.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {repo.defaultBranch}
                        </Badge>
                      </div>
                    </div>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No repositories found</p>
                <p className="text-sm mt-1">Connect your GitHub account to see repositories</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pull Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="h-5 w-5" />
              Pull Requests
            </CardTitle>
            <CardDescription>Open pull requests across repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {prsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pullRequests && pullRequests.length > 0 ? (
              <div className="space-y-3">
                {pullRequests.slice(0, 10).map((pr) => (
                  <div
                    key={pr.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">#{pr.number} {pr.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span>{pr.author}</span>
                        <span>•</span>
                        <span>{pr.sourceBranch} → {pr.targetBranch}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        pr.state === 'open' ? 'default' :
                        pr.state === 'merged' ? 'secondary' : 'outline'
                      }
                    >
                      {pr.state}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <GitPullRequest className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pull requests found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
