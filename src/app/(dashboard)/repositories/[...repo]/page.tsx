'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useBranches, usePullRequests } from '@/hooks/use-github';
import { useOrganizationStore } from '@/store/organization-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MonacoEditor } from '@/components/gitops/monaco-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  Folder,
  FileText,
  Download,
  GitCommit,
  GitMerge,
} from 'lucide-react';

interface RepoItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size?: number;
  downloadUrl?: string;
}

interface FileContent {
  type: 'file';
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  branch: string;
  downloadUrl?: string;
}

export default function RepositoryDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoSegments = (params.repo as string[]) || [];
  const repository = decodeURIComponent(repoSegments.join('/'));
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const credentialId = searchParams.get('credentialId') || undefined;

  const { data: branches, isLoading: branchesLoading } = useBranches(repository, undefined, credentialId);
  const { data: pullRequests, isLoading: prsLoading } = usePullRequests(repository, 'open', credentialId);

  const openPRs = useMemo(
    () => (pullRequests ?? []).filter((pr) => pr.state === 'open'),
    [pullRequests]
  );

  const primaryBranch = useMemo(() => {
    if (!branches?.length) return undefined;
    const match = branches.find((b) => b.name === 'main' || b.name === 'master');
    return match?.name || branches[0].name;
  }, [branches]);

  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<RepoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranch) {
        setSelectedBranch(primaryBranch || branches[0].name);
    }
  }, [branches, selectedBranch, primaryBranch]);

  useEffect(() => {
    if (!selectedBranch || !currentOrganization?.id) return;
    setSelectedFile(null);
    const fetchDirectory = async () => {
      setLoadingItems(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/gitops/contents?repo=${encodeURIComponent(repository)}&path=${encodeURIComponent(currentPath)}&ref=${encodeURIComponent(selectedBranch)}`,
          {
            headers: {
              'x-organization-id': currentOrganization.id,
            },
          }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || 'Failed to load files');
          setItems([]);
          return;
        }
        if (data.data?.branch && data.data.branch !== selectedBranch) {
          setSelectedBranch(data.data.branch);
        }
        if (data.data?.type === 'directory') {
          setItems(data.data.items || []);
        }
      } catch {
        setError('Failed to load files');
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchDirectory();
  }, [selectedBranch, currentPath, currentOrganization?.id, repository]);

  const breadcrumbs = useMemo(() => {
    const segments = currentPath ? currentPath.split('/') : [];
    const crumbs = [{ name: repository.split('/').pop() || repository, path: '' }];
    let pathAccumulator = '';
    segments.forEach((segment) => {
      pathAccumulator = pathAccumulator ? `${pathAccumulator}/${segment}` : segment;
      crumbs.push({ name: segment, path: pathAccumulator });
    });
    return crumbs;
  }, [currentPath, repository]);

  const sortedItems = useMemo(() => {
    const dirs = items.filter((item) => item.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
    const files = items.filter((item) => item.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }, [items]);

  const handleFileClick = async (item: RepoItem) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path);
      return;
    }
    if (!currentOrganization?.id) return;
    setLoadingFile(true);
    setSelectedFile(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/gitops/contents?repo=${encodeURIComponent(repository)}&path=${encodeURIComponent(item.path)}&ref=${encodeURIComponent(selectedBranch)}`,
        {
          headers: {
            'x-organization-id': currentOrganization.id,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Failed to load file');
        return;
      }
      if (data.data?.type === 'file') {
        if (data.data.branch && data.data.branch !== selectedBranch) {
          setSelectedBranch(data.data.branch);
        }
        setSelectedFile(data.data);
      }
    } finally {
      setLoadingFile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/repositories')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{repository}</h1>
            <p className="text-muted-foreground">Repository details</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a
            href={`https://github.com/${repository}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in GitHub
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Branches
            </CardTitle>
            <Badge variant="secondary">{branches?.length || 0}</Badge>
          </CardHeader>
          <CardContent>
            {branchesLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : branches && branches.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {branches.map((branch) => (
                  <div
                    key={branch.name}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{branch.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {branch.name === primaryBranch && (
                        <Badge variant="secondary">default</Badge>
                      )}
                      {branch.protected && <Badge variant="outline">protected</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No branches found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="h-5 w-5" />
              Open Pull Requests
            </CardTitle>
            <Badge variant="secondary">{openPRs.length}</Badge>
          </CardHeader>
          <CardContent>
            {prsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : openPRs.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-auto pr-1">
                {openPRs.map((pr) => (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4 text-muted-foreground" />
                        <p className="truncate font-medium">
                          #{pr.number} {pr.title}
                        </p>
                        {pr.draft && <Badge variant="outline">draft</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {pr.sourceBranch} → {pr.targetBranch} • by {pr.author}
                      </p>
                    </div>
                    <Link
                      href="/pull-requests"
                      className="text-sm text-primary hover:underline whitespace-nowrap"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open pull requests.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Repository Browser</CardTitle>
            <CardDescription>Browse files and switch branches</CardDescription>
          </div>
          <div className="w-full md:w-64">
            <Select
              value={selectedBranch}
              onValueChange={(value) => {
                setSelectedBranch(value);
                setCurrentPath('');
                setSelectedFile(null);
              }}
              disabled={branchesLoading || !branches?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <button
                    key={crumb.path || 'root'}
                    onClick={() => setCurrentPath(crumb.path)}
                    className="text-primary hover:underline"
                  >
                    {index > 0 && <span className="text-muted-foreground">/</span>} {crumb.name}
                  </button>
                ))}
              </div>

              {loadingItems ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : sortedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files found.</p>
              ) : (
                <div className="space-y-2">
                  {sortedItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleFileClick(item)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                    >
                      {item.type === 'dir' ? (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between pb-2">
                <div className="text-sm text-muted-foreground">
                  {selectedFile ? selectedFile.path : 'Select a file to view'}
                </div>
                {selectedFile?.downloadUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedFile.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
              <div className="border rounded-md h-[520px]">
                {loadingFile ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : selectedFile ? (
                  <MonacoEditor
                    value={selectedFile.content}
                    onChange={() => {}}
                    language={getLanguageFromFilename(selectedFile.name)}
                    path={selectedFile.path}
                    readOnly
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Choose a file from the list to view its contents.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    md: 'markdown',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
    tf: 'hcl',
    hcl: 'hcl',
  };
  return langMap[ext || ''] || 'plaintext';
}
