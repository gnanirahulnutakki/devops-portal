'use client';

import { useBranches, usePullRequestFiles, usePullRequests, useRepositories, useUpdatePullRequest, useMergePullRequest } from '@/hooks/use-github';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  GitMerge,
  XCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  FileCode,
  Github,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useMemo, useState } from 'react';

interface GitHubAccount {
  id: string;
  name: string;
  enabled: boolean;
  organization?: string;
  hasToken: boolean;
}

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

export default function PullRequestsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;

  // GitHub account selector
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const [accountsLoading, setAccountsLoading] = useState(true);
  const enabledAccounts = useMemo(() => accounts.filter((a) => a.enabled && a.hasToken), [accounts]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      setAccountsLoading(true);
      try {
        const res = await fetch('/api/integrations/github/accounts', {
          headers: { 'x-organization-id': orgId! },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          const accts = data.data || [];
          setAccounts(accts);
          const firstEnabled = accts.find((a: GitHubAccount) => a.enabled && a.hasToken);
          setSelectedAccount((current) => current || firstEnabled?.id || '');
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orgId]);

  const [repoSearch, setRepoSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [prSearch, setPrSearch] = useState('');

  const { data: repositories } = useRepositories(1, 200, undefined, selectedAccount);
  const repoOptions = useMemo(() => {
    if (!repositories) return [];
    const filtered = repoSearch
      ? repositories.filter((repo) => {
          const q = repoSearch.toLowerCase();
          return repo.fullName.toLowerCase().includes(q) || repo.name.toLowerCase().includes(q);
        })
      : repositories;
    return filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [repositories, repoSearch]);

  // Auto-select if search narrows to a single repo
  useEffect(() => {
    if (repoSearch.trim() && repoOptions.length === 1) {
      setSelectedRepo(repoOptions[0].fullName);
      setSelectedBranch('all');
      setBranchSearch('');
    }
  }, [repoOptions, repoSearch]);

  // Reset branch filter when repo changes
  useEffect(() => {
    setSelectedBranch('all');
    setBranchSearch('');
  }, [selectedRepo]);

  const activeRepo = selectedRepo === 'all' ? undefined : selectedRepo;
  const { data: branches } = useBranches(activeRepo, branchSearch || undefined, selectedAccount);

  const { data: pullRequests, isLoading, error, refetch } = usePullRequests(activeRepo, 'all', selectedAccount);
  const { mutate: updatePr, isPending: updatingPr } = useUpdatePullRequest();
  const { mutate: mergePr, isPending: mergingPr } = useMergePullRequest();

  const filteredPRs = useMemo(() => {
    let list = pullRequests ?? [];
    if (selectedBranch !== 'all') {
      list = list.filter((pr) => pr.targetBranch === selectedBranch);
    }
    if (prSearch.trim()) {
      const q = prSearch.toLowerCase();
      list = list.filter((pr) => pr.title.toLowerCase().includes(q) || pr.author.toLowerCase().includes(q));
    }
    return list;
  }, [pullRequests, prSearch, selectedBranch]);

  const openPRs = filteredPRs.filter((pr) => pr.state === 'open');
  const mergedPRs = filteredPRs.filter((pr) => pr.state === 'merged');
  const closedPRs = filteredPRs.filter((pr) => pr.state === 'closed');

  // helpers moved to module scope

  const PRList = ({ prs }: { prs: typeof filteredPRs }) => {
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
          <PullRequestCard
            key={pr.id}
            pr={pr}
            repository={activeRepo}
            onUpdate={(action) => {
              if (!activeRepo) return;
              updatePr({ repository: activeRepo, number: pr.number, action });
            }}
            onMerge={(method) => {
              if (!activeRepo) return;
              mergePr({ repository: activeRepo, number: pr.number, method });
            }}
            actionsDisabled={updatingPr || mergingPr}
          />
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            {accountsLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : enabledAccounts.length > 0 ? (
              <Select value={selectedAccount || ''} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {enabledAccounts.map((acct) => (
                    <SelectItem key={acct.id} value={acct.id}>
                      {acct.name}{acct.organization ? ` (${acct.organization})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">No GitHub accounts configured</span>
            )}
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total PRs</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : filteredPRs.length}
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Choose repository, branch, and search PRs</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Repository</label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {repoSearch.trim().length > 0 && repoOptions.length > 0 && (
                <div className="rounded-md border bg-card p-2 max-h-40 overflow-auto">
                  {repoOptions.slice(0, 10).map((repo) => (
                    <button
                      key={repo.id}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                      onClick={() => {
                        setSelectedRepo(repo.fullName);
                        setSelectedBranch('all');
                        setBranchSearch('');
                      }}
                    >
                      {repo.fullName}
                    </button>
                  ))}
                </div>
              )}
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="All repositories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All repositories</SelectItem>
                  {repoOptions.map((repo) => (
                    <SelectItem key={repo.id} value={repo.fullName}>
                      {repo.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Target branch</label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search branches..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="pl-10"
                  disabled={!activeRepo}
                />
              </div>
              <Select
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                disabled={!activeRepo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Search PRs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Title or author..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
                  All ({filteredPRs.length})
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
                <PRList prs={filteredPRs} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PullRequestCard({
  pr,
  repository,
  onUpdate,
  onMerge,
  actionsDisabled,
}: {
  pr: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    author: string;
    sourceBranch: string;
    targetBranch: string;
    updatedAt: string;
    url: string;
    draft?: boolean;
  };
  repository?: string;
  onUpdate: (action: 'draft' | 'ready' | 'close' | 'reopen') => void;
  onMerge: (method?: 'merge' | 'squash' | 'rebase') => void;
  actionsDisabled: boolean;
}) {
  const [showFiles, setShowFiles] = useState(false);
  const { data: files, isLoading } = usePullRequestFiles(repository, pr.number);

  const canAct = pr.state === 'open' && !!repository;

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {getStateIcon(pr.state)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                #{pr.number} {pr.title}
              </span>
              {getStateBadge(pr.state)}
              {pr.draft && <Badge variant="secondary">Draft</Badge>}
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiles((prev) => !prev)}
            disabled={!repository}
          >
            {showFiles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1">Files</span>
          </Button>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onMerge('merge')}
          disabled={!canAct || actionsDisabled}
        >
          <GitMerge className="h-4 w-4 mr-1" />
          Merge
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMerge('squash')}
          disabled={!canAct || actionsDisabled}
        >
          Squash
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMerge('rebase')}
          disabled={!canAct || actionsDisabled}
        >
          Rebase
        </Button>
        {canAct && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(pr.draft ? 'ready' : 'draft')}
            disabled={actionsDisabled}
          >
            {pr.draft ? 'Mark Ready' : 'Convert to Draft'}
          </Button>
        )}
        {pr.state === 'open' && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onUpdate('close')}
            disabled={actionsDisabled}
          >
            Close
          </Button>
        )}
        {pr.state === 'closed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate('reopen')}
            disabled={actionsDisabled}
          >
            Reopen
          </Button>
        )}
      </div>

      {showFiles && (
        <div className="mt-4 border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            Files changed
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : files && files.length > 0 ? (
            <div className="space-y-2 text-sm">
              {files.map((file) => (
                <div key={file.filename} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs truncate">{file.filename}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-green-600">+{file.additions}</span>
                    <span className="text-red-600">-{file.deletions}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No files found for this PR.</p>
          )}
        </div>
      )}
    </div>
  );
}
