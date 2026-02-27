'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, PlayCircle, Ban, Github } from 'lucide-react';

interface GitHubAccount {
  id: string;
  name: string;
  enabled: boolean;
  organization?: string;
  hasToken: boolean;
}

interface RepositoryItem {
  fullName: string;
  name: string;
}

interface BranchItem {
  name: string;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  event: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  runNumber: number;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export default function GitHubActionsPage() {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization);
  const orgId = currentOrganization?.id;

  // Account selector
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
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
          if (firstEnabled) setSelectedAccount(firstEnabled.id);
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orgId]);

  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(false);

  const repositoryOptions = useMemo(
    () => repositories.map((repo) => ({ value: repo.fullName, label: repo.name })),
    [repositories]
  );

  const loadRepositories = async () => {
    if (!selectedAccount) return;
    const params = new URLSearchParams();
    params.set('credentialId', selectedAccount);
    const res = await fetch(`/api/github/repositories?${params}`);
    const data = await res.json();
    if (res.ok) {
      setRepositories(data.data || []);
      if (data.data?.[0]) {
        setSelectedRepo(data.data[0].fullName);
      }
    }
  };

  const loadBranches = async (repository: string) => {
    if (!repository) return;
    const params = new URLSearchParams({ repository });
    if (selectedAccount) params.set('credentialId', selectedAccount);
    const res = await fetch(`/api/github/branches?${params}`);
    const data = await res.json();
    if (res.ok) {
      setBranches(data.data || []);
      if (data.data?.[0]) {
        setSelectedBranch(data.data[0].name);
      }
    }
  };

  const loadRuns = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    const params = new URLSearchParams({ repository: selectedRepo });
    if (selectedBranch) params.set('branch', selectedBranch);
    if (selectedAccount) params.set('credentialId', selectedAccount);
    const res = await fetch(`/api/github/actions/runs?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setRuns(data.data || []);
    setLoading(false);
  };

  // Reload repos when account changes
  useEffect(() => {
    if (!selectedAccount) return;
    setRepositories([]);
    setSelectedRepo('');
    setBranches([]);
    setSelectedBranch('');
    setRuns([]);
    loadRepositories();
  }, [selectedAccount]);

  useEffect(() => {
    if (!selectedRepo) return;
    setBranches([]);
    setSelectedBranch('');
    loadBranches(selectedRepo);
  }, [selectedRepo]);

  useEffect(() => {
    loadRuns();
  }, [selectedRepo, selectedBranch]);

  const rerun = async (runId: number) => {
    if (!selectedRepo) return;
    await fetch(`/api/github/actions/runs/${runId}/rerun?repository=${encodeURIComponent(selectedRepo)}`, {
      method: 'POST',
    });
    loadRuns();
  };

  const cancel = async (runId: number) => {
    if (!selectedRepo) return;
    await fetch(`/api/github/actions/runs/${runId}/cancel?repository=${encodeURIComponent(selectedRepo)}`, {
      method: 'POST',
    });
    loadRuns();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GitHub Actions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor workflow runs and manage execution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            {accountsLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : enabledAccounts.length > 0 ? (
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
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
          <Button variant="outline" size="sm" onClick={loadRuns}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Workflow Filters
          </CardTitle>
          <CardDescription>Select a repository and branch to view runs</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select value={selectedRepo} onValueChange={setSelectedRepo}>
            <SelectTrigger>
              <SelectValue placeholder="Select repository" />
            </SelectTrigger>
            <SelectContent>
              {repositoryOptions.map((repo) => (
                <SelectItem key={repo.value} value={repo.value}>
                  {repo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>{loading ? 'Loading runs...' : `${runs.length} runs`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No workflow runs found.</p>
          ) : null}
          {runs.map((run) => (
            <div key={run.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{run.name}</p>
                <p className="text-sm text-muted-foreground">
                  {run.branch} • {run.event} • #{run.runNumber}
                </p>
                <p className="text-xs text-muted-foreground">{run.commitMessage || run.commitSha.slice(0, 7)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{run.status}</Badge>
                {run.conclusion ? <Badge variant="secondary">{run.conclusion}</Badge> : null}
                <Button variant="outline" size="sm" onClick={() => rerun(run.id)}>
                  Rerun
                </Button>
                <Button variant="outline" size="sm" onClick={() => cancel(run.id)}>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(run.htmlUrl, '_blank', 'noopener,noreferrer')}>
                  View
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
