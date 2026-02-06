'use client';

import { usePullRequests } from '@/hooks/use-github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  GitMerge,
  XCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PullRequestsPage() {
  const { data: pullRequests, isLoading, error, refetch } = usePullRequests();

  const openPRs = pullRequests?.filter((pr) => pr.state === 'open') ?? [];
  const mergedPRs = pullRequests?.filter((pr) => pr.state === 'merged') ?? [];
  const closedPRs = pullRequests?.filter((pr) => pr.state === 'closed') ?? [];

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'open':
        return <GitPullRequest className="h-4 w-4 text-green-500" />;
      case 'merged':
        return <GitMerge className="h-4 w-4 text-purple-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <GitPullRequest className="h-4 w-4" />;
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'open':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Open</Badge>;
      case 'merged':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">Merged</Badge>;
      case 'closed':
        return <Badge variant="destructive">Closed</Badge>;
      default:
        return <Badge variant="secondary">{state}</Badge>;
    }
  };

  const PRList = ({ prs }: { prs: typeof pullRequests }) => {
    if (!prs || prs.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <GitPullRequest className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No pull requests found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {prs.map((pr) => (
          <div
            key={pr.id}
            className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex gap-3">
              {getStateIcon(pr.state)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    #{pr.number} {pr.title}
                  </span>
                  {getStateBadge(pr.state)}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <span className="font-medium">{pr.author}</span>
                  <span>wants to merge</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {pr.sourceBranch}
                  </Badge>
                  <span>into</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {pr.targetBranch}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {new Date(pr.updatedAt).toLocaleDateString()}
                  </span>
                  {pr.state === 'open' && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Ready for review
                    </span>
                  )}
                </div>
              </div>
            </div>
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pull Requests</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review and manage pull requests across repositories
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total PRs</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : pullRequests?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <GitPullRequest className="h-4 w-4 text-green-500" />
              Open
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : openPRs.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <GitMerge className="h-4 w-4 text-purple-500" />
              Merged
            </CardDescription>
            <CardTitle className="text-2xl text-purple-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : mergedPRs.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              Closed
            </CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : closedPRs.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* PR List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            All Pull Requests
          </CardTitle>
          <CardDescription>Pull requests across all repositories</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading pull requests</AlertTitle>
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="open" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="open" className="gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  Open ({openPRs.length})
                </TabsTrigger>
                <TabsTrigger value="merged" className="gap-2">
                  <GitMerge className="h-4 w-4" />
                  Merged ({mergedPRs.length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Closed ({closedPRs.length})
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2">
                  All ({pullRequests?.length ?? 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="open">
                <PRList prs={openPRs} />
              </TabsContent>
              <TabsContent value="merged">
                <PRList prs={mergedPRs} />
              </TabsContent>
              <TabsContent value="closed">
                <PRList prs={closedPRs} />
              </TabsContent>
              <TabsContent value="all">
                <PRList prs={pullRequests} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
