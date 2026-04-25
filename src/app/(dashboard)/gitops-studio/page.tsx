'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganizationStore, isAdmin } from '@/store/organization-store';
import { useRepositories } from '@/hooks/use-github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  GitBranch,
  Pencil,
  Save,
  Search,
  Shield,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MonacoEditor } from '@/components/gitops/monaco-editor';
import { CommitDialog } from '@/components/gitops/commit-dialog';

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface FileItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  sha: string;
  size?: number;
}

interface FileContent {
  type: 'file';
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  branch: string;
}

interface PendingChange {
  repo: string;
  repoFullName: string;
  path: string;
  originalContent: string;
  newContent: string;
  sha: string;
  branch: string;
}

export default function GitOpsStudioPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const userIsAdmin = isAdmin(currentOrganization?.role);

  // Repository selection
  const { data: repositories } = useRepositories(1, 100);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('');

  // Branch management
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [loadingBranches, setLoadingBranches] = useState(false);

  // File browser
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [fileFilter, setFileFilter] = useState('');

  // File editor
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Pending changes for bulk operations
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  // Dialogs
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  // Fetch branches when repo changes
  const fetchBranches = useCallback(async (repoFullName: string) => {
    if (!currentOrganization?.id) return;
    
    setLoadingBranches(true);
    try {
      const res = await fetch(`/api/gitops/branches?repo=${encodeURIComponent(repoFullName)}`, {
        headers: {
          'x-organization-id': currentOrganization.id,
        },
      });
      const data = await res.json();
      if (data.data?.branches) {
        setBranches(data.data.branches);
        // Default to main or master branch
        const defaultBranch = data.data.branches.find(
          (b: Branch) => b.name === 'main' || b.name === 'master'
        );
        if (defaultBranch) {
          setSelectedBranch(defaultBranch.name);
        } else if (data.data.branches.length > 0) {
          // Fallback to first branch if main/master doesn't exist
          setSelectedBranch(data.data.branches[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      toast.error('Failed to fetch branches');
    } finally {
      setLoadingBranches(false);
    }
  }, [currentOrganization?.id]);

  // Fetch file tree when repo or branch changes
  const fetchFileTree = useCallback(async (repoFullName: string, branch: string, filter?: string) => {
    if (!currentOrganization?.id) return;
    
    setLoadingTree(true);
    try {
      let url = `/api/gitops/tree?repo=${encodeURIComponent(repoFullName)}&ref=${encodeURIComponent(branch)}&recursive=true`;
      if (filter) {
        url += `&filter=${encodeURIComponent(filter)}`;
      }
      const res = await fetch(url, {
        headers: {
          'x-organization-id': currentOrganization.id,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message || 'Failed to fetch file tree');
        setFileTree([]);
        return;
      }
      if (data.data?.branch && data.data.branch !== branch) {
        setSelectedBranch(data.data.branch);
      }
      if (data.data?.files) {
        setFileTree(data.data.files);
      }
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
      toast.error('Failed to fetch file tree');
    } finally {
      setLoadingTree(false);
    }
  }, [currentOrganization?.id]);

  // Fetch file content
  const fetchFileContent = useCallback(async (repoFullName: string, path: string, branch: string) => {
    if (!currentOrganization?.id) return;
    
    setLoadingFile(true);
    try {
      const res = await fetch(
        `/api/gitops/contents?repo=${encodeURIComponent(repoFullName)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(branch)}`,
        {
          headers: {
            'x-organization-id': currentOrganization.id,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message || 'Failed to fetch file content');
        setSelectedFile(null);
        setEditedContent('');
        return;
      }
      if (data.data?.branch && data.data.branch !== branch) {
        setSelectedBranch(data.data.branch);
      }
      if (data.data?.type === 'file') {
        setSelectedFile(data.data);
        setEditedContent(data.data.content);
        setHasUnsavedChanges(false);
      } else {
        toast.error('Selected path is not a file');
      }
    } catch (err) {
      console.error('Failed to fetch file content:', err);
      toast.error('Failed to fetch file content');
    } finally {
      setLoadingFile(false);
    }
  }, [currentOrganization?.id]);

  // Handle repo selection
  const handleRepoSelect = (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setSelectedRepoFullName(repoFullName);
    setSelectedFile(null);
    setEditedContent('');
    setHasUnsavedChanges(false);
    fetchBranches(repoFullName);
  };

  // Handle branch change
  useEffect(() => {
    if (selectedRepoFullName && selectedBranch) {
      fetchFileTree(selectedRepoFullName, selectedBranch, fileFilter);
    }
  }, [selectedRepoFullName, selectedBranch, fileFilter, fetchFileTree]);

  // Handle file selection
  const handleFileSelect = (file: FileItem) => {
    if (file.type === 'file' && selectedRepoFullName) {
      // Check for unsaved changes
      if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Discard them?')) {
          return;
        }
      }
      fetchFileContent(selectedRepoFullName, file.path, selectedBranch);
    }
  };

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== selectedFile?.content);
  };

  // Stage change for bulk commit
  const handleStageChange = () => {
    if (!selectedFile || !selectedRepoFullName) return;

    // Check if already staged
    const existingIdx = pendingChanges.findIndex(
      (c) => c.repo === selectedRepoFullName && c.path === selectedFile.path
    );

    if (existingIdx >= 0) {
      // Update existing
      const updated = [...pendingChanges];
      updated[existingIdx] = {
        ...updated[existingIdx],
        newContent: editedContent,
      };
      setPendingChanges(updated);
    } else {
      // Add new
      setPendingChanges([
        ...pendingChanges,
        {
          repo: selectedRepoFullName,
          repoFullName: selectedRepoFullName,
          path: selectedFile.path,
          originalContent: selectedFile.content,
          newContent: editedContent,
          sha: selectedFile.sha,
          branch: selectedBranch,
        },
      ]);
    }

    toast.success(`${selectedFile.path} has been staged for commit`);
    setHasUnsavedChanges(false);
  };

  // Remove staged change
  const handleUnstageChange = (index: number) => {
    const updated = [...pendingChanges];
    updated.splice(index, 1);
    setPendingChanges(updated);
  };

  // Commit changes
  const handleCommit = async (message: string, createPR: boolean, baseBranch?: string) => {
    if (pendingChanges.length === 0) {
      toast.error('No changes to commit');
      return;
    }

    try {
      const res = await fetch('/api/gitops/bulk-commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': currentOrganization?.id || '',
        },
        body: JSON.stringify({
          changes: pendingChanges.map((c) => ({
            repo: c.repo,
            path: c.path,
            content: c.newContent,
            sha: c.sha,
            branch: c.branch,
          })),
          message,
          createPRs: createPR,
          baseBranch,
        }),
      });

      const data = await res.json();

      if (data.data?.summary) {
        toast.success(`${data.data.summary.successful}/${data.data.summary.total} files committed`);

        if (data.data.pullRequests?.length > 0) {
          toast.success(`Pull Request #${data.data.pullRequests[0].number} created`);
        }

        // Clear pending changes
        setPendingChanges([]);
        
        // Refresh file tree
        if (selectedRepoFullName) {
          fetchFileTree(selectedRepoFullName, selectedBranch);
        }
      }
    } catch (err) {
      console.error('Failed to commit:', err);
      toast.error('Failed to commit changes');
    }

    setShowCommitDialog(false);
  };

  // Admin check - render after all hooks are called
  if (!userIsAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription>
            GitOps Studio is only available to administrators. Contact your organization admin to gain access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GitOps Studio</h1>
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Edit configuration files and push changes across repositories
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <Button variant="default" onClick={() => setShowCommitDialog(true)}>
              <Save className="h-4 w-4 mr-2" />
              Commit {pendingChanges.length} Change{pendingChanges.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Repository & File Browser */}
        <Card className="col-span-4 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Repository Browser
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Repository Select */}
            <Select value={selectedRepo || ''} onValueChange={handleRepoSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repositories?.map((repo) => (
                  <SelectItem key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Branch Select */}
            {selectedRepo && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={loadingBranches}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        {branch.name}
                        {branch.protected && (
                          <Badge variant="outline" className="text-xs">protected</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* File Filter */}
            {selectedRepo && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Filter files (e.g., values.yaml)"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {/* File Tree */}
            <div className="flex-1 overflow-auto border rounded-lg p-2">
              {loadingTree ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : fileTree.length > 0 ? (
                <div className="space-y-1">
                  {fileTree.map((file) => (
                    <div
                      key={file.path}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm',
                        'hover:bg-gray-100 dark:hover:bg-gray-800',
                        selectedFile?.path === file.path && 'bg-blue-100 dark:bg-blue-900/30'
                      )}
                      onClick={() => handleFileSelect(file)}
                    >
                      <FileIcon filename={file.name} />
                      <span className="truncate flex-1">{file.path}</span>
                      {pendingChanges.some((c) => c.path === file.path) && (
                        <Badge variant="outline" className="text-xs bg-yellow-100">Modified</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : selectedRepo ? (
                <div className="text-center py-8 text-gray-500">
                  <File className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No files found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Select a repository</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor Panel */}
        <Card className="col-span-8 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                {selectedFile ? selectedFile.path : 'File Editor'}
              </CardTitle>
              <CardDescription>
                {selectedFile ? `${selectedBranch} • ${formatBytes(selectedFile.size)}` : 'Select a file to edit'}
              </CardDescription>
            </div>
            {selectedFile && hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Unsaved Changes
                </Badge>
                <Button size="sm" onClick={handleStageChange}>
                  <Plus className="h-4 w-4 mr-1" />
                  Stage
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {loadingFile ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : selectedFile ? (
              <MonacoEditor
                value={editedContent}
                onChange={handleContentChange}
                language={getLanguageFromFilename(selectedFile.name)}
                path={selectedFile.path}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FileCode className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No file selected</p>
                  <p className="text-sm mt-1">Select a file from the browser to edit</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staged Changes Panel */}
      {pendingChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Staged Changes ({pendingChanges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingChanges.map((change, idx) => (
                <Badge
                  key={`${change.repo}:${change.path}`}
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <span className="truncate max-w-xs">{change.path}</span>
                  <span className="text-gray-500">@{change.branch}</span>
                  <button
                    onClick={() => handleUnstageChange(idx)}
                    className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit Dialog */}
      <CommitDialog
        open={showCommitDialog}
        onOpenChange={setShowCommitDialog}
        changes={pendingChanges}
        branches={branches}
        currentBranch={selectedBranch}
        onCommit={handleCommit}
      />
    </div>
  );
}

// Helper: Get file icon
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'yaml':
    case 'yml':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-500" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-gray-500" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

// Helper: Get Monaco language from filename
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

// Helper: Format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
