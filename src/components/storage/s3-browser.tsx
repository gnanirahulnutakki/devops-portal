"use client";

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCcw,
  Folder,
  FileText,
  FileCode,
  FileArchive,
  FileImage,
  File,
  Download,
  Upload,
  Trash2,
  ChevronRight,
  Home,
  AlertCircle,
  Loader2,
  Search,
  FolderOpen,
  Lock,
  Copy,
  ChevronDown,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

type UserRole = 'USER' | 'READWRITE' | 'ADMIN';

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  etag?: string;
  isDirectory: boolean;
}

interface S3ListResult {
  objects: S3Object[];
  prefixes: string[];
  continuationToken?: string;
  isTruncated: boolean;
}

interface ApiResponse<T = S3ListResult> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface S3BrowserProps {
  /** User's role in the current organization */
  userRole?: UserRole;
}

// =============================================================================
// Permission Helpers
// =============================================================================

function canUpload(role: UserRole): boolean {
  return role === 'READWRITE' || role === 'ADMIN';
}

function canDelete(role: UserRole): boolean {
  return role === 'ADMIN';
}

// =============================================================================
// Helpers
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Extract the display name from an S3 key, handling edge cases:
 * - Normal: "collector-logs/" → "collector-logs/"
 * - Root "/" prefix: "fid-0/fid//" → "/" (the segment between the last two slashes is empty)
 * - Files: "logs/install/Install.2026-02-04.log" → "Install.2026-02-04.log"
 */
function getDisplayName(key: string, isDirectory: boolean): string {
  if (isDirectory) {
    // Remove trailing slash, split, get last segment, re-add slash
    const withoutTrailing = key.replace(/\/$/, '');
    const parts = withoutTrailing.split('/');
    const last = parts[parts.length - 1];
    // Handle edge case: key like "fid-0/fid//" → after removing trailing slash = "fid-0/fid/"
    // split gives ["fid-0", "fid", ""] → last is "" which means the folder IS "/"
    if (last === '') return '/';
    return last + '/';
  }
  // For files, get the filename
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
}

/**
 * Get file extension or type label for the Type column
 */
function getFileType(key: string, isDirectory: boolean): string {
  if (isDirectory) return 'Folder';
  const parts = key.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '-';
}

/**
 * Get appropriate icon for file type
 */
function getFileIcon(key: string, isDirectory: boolean) {
  if (isDirectory) {
    return <Folder className="h-4 w-4 text-amber-500 shrink-0" />;
  }
  const ext = key.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'log':
    case 'txt':
    case 'md':
    case 'csv':
      return <FileText className="h-4 w-4 text-gray-500 shrink-0" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'xml':
    case 'html':
    case 'css':
    case 'js':
    case 'ts':
    case 'py':
    case 'sh':
    case 'properties':
    case 'conf':
    case 'cfg':
      return <FileCode className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'zip':
    case 'gz':
    case 'tar':
    case 'bz2':
    case 'xz':
    case '7z':
    case 'rar':
      return <FileArchive className="h-4 w-4 text-orange-500 shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'ico':
      return <FileImage className="h-4 w-4 text-purple-500 shrink-0" />;
    default:
      return <File className="h-4 w-4 text-gray-400 shrink-0" />;
  }
}

// =============================================================================
// Component
// =============================================================================

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch');
  return data;
};

export function S3Browser({ userRole = 'USER' }: S3BrowserProps) {
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allItems, setAllItems] = useState<{
    objects: S3Object[];
    prefixes: string[];
  } | null>(null);

  const apiUrl = `/api/storage/s3?prefix=${encodeURIComponent(currentPrefix)}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    onSuccess: () => {
      // Reset accumulated items when prefix changes
      setAllItems(null);
    },
  });

  // Breadcrumb parts - handles "/" folders by not filtering empty segments
  const breadcrumbs = useMemo(() => {
    if (!currentPrefix) return [];
    // Split by "/" but preserve empty segments (which represent "/" folders)
    const segments: { name: string; path: string }[] = [];
    let accumulated = '';
    const parts = currentPrefix.split('/');
    // Last element after split on trailing "/" is always empty, skip it
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      accumulated += part + '/';
      segments.push({
        name: part === '' ? '/' : part,
        path: accumulated,
      });
    }
    return segments;
  }, [currentPrefix]);

  // Combined items (directories first, then files, sorted by name)
  const items = useMemo(() => {
    const source = allItems || data?.data;
    if (!source) return [];

    const result: Array<{
      type: 'directory' | 'file';
      key: string;
      displayName: string;
      fileType: string;
      size?: number;
      lastModified?: string;
    }> = [];

    // Add directories (prefixes) - sorted
    const sortedPrefixes = [...source.prefixes].sort((a, b) => {
      const nameA = getDisplayName(a, true);
      const nameB = getDisplayName(b, true);
      return nameA.localeCompare(nameB);
    });
    sortedPrefixes.forEach((prefix: string) => {
      result.push({
        type: 'directory',
        key: prefix,
        displayName: getDisplayName(prefix, true),
        fileType: 'Folder',
      });
    });

    // Add files - sorted by name, exclude the prefix itself (S3 returns it)
    const sortedObjects = [...source.objects]
      .filter((obj: S3Object) => obj.key !== currentPrefix)
      .sort((a: S3Object, b: S3Object) => {
        const nameA = getDisplayName(a.key, false);
        const nameB = getDisplayName(b.key, false);
        return nameA.localeCompare(nameB);
      });
    sortedObjects.forEach((obj: S3Object) => {
      result.push({
        type: 'file',
        key: obj.key,
        displayName: getDisplayName(obj.key, false),
        fileType: getFileType(obj.key, false),
        size: obj.size,
        lastModified: obj.lastModified,
      });
    });

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      return result.filter((item) =>
        item.displayName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [data, allItems, currentPrefix, search]);

  // Counts
  const totalCount = items.length;
  const dirCount = items.filter((i) => i.type === 'directory').length;
  const fileCount = items.filter((i) => i.type === 'file').length;

  // Navigate to directory
  const navigateTo = useCallback((prefix: string) => {
    setCurrentPrefix(prefix);
    setSearch('');
    setAllItems(null);
  }, []);

  // Load more items
  const loadMore = useCallback(async () => {
    if (!data?.data?.continuationToken) return;
    setLoadingMore(true);
    try {
      const url = `/api/storage/s3?prefix=${encodeURIComponent(currentPrefix)}&continuationToken=${encodeURIComponent(data.data.continuationToken)}`;
      const res = await fetch(url);
      const result = await res.json() as ApiResponse;
      if (result.data) {
        const existing = allItems || data.data;
        setAllItems({
          objects: [...(existing?.objects || []), ...result.data.objects],
          prefixes: [...(existing?.prefixes || []), ...result.data.prefixes],
        });
        // Update SWR cache with new continuation token
        mutate(
          {
            ...data,
            data: {
              ...result.data,
              objects: [...(existing?.objects || []), ...result.data.objects],
              prefixes: [...(existing?.prefixes || []), ...result.data.prefixes],
            },
          },
          false
        );
      }
    } catch (err) {
      toast.error('Failed to load more items', { description: (err as Error).message });
    } finally {
      setLoadingMore(false);
    }
  }, [data, currentPrefix, allItems, mutate]);

  // Copy path to clipboard
  const copyPath = useCallback((key: string) => {
    navigator.clipboard.writeText(key).then(
      () => toast.success('Path copied to clipboard'),
      () => toast.error('Failed to copy path')
    );
  }, []);

  // Download file
  const downloadFile = useCallback(async (key: string) => {
    try {
      const response = await fetch('/api/storage/s3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, operation: 'download' }),
      });

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error?.message || 'Failed to get download URL');
      }

      // Open download URL in new tab
      window.open(result.data.url, '_blank');
      toast.success('Download started', { description: getDisplayName(key, false) });
    } catch (err) {
      toast.error('Download failed', { description: (err as Error).message });
    }
  }, []);

  // Upload file
  const uploadFile = useCallback(async (file: globalThis.File) => {
    if (!canUpload(userRole)) {
      toast.error('Permission denied', { description: 'Upload requires READWRITE role or higher' });
      return;
    }

    setUploading(true);
    try {
      const key = currentPrefix + file.name;

      const response = await fetch('/api/storage/s3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          operation: 'upload',
          contentType: file.type || 'application/octet-stream',
        }),
      });

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error?.message || 'Failed to get upload URL');
      }

      const uploadRes = await fetch(result.data.url, {
        method: 'PUT',
        headers: { 'Content-Type': result.data.contentType },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }

      toast.success('File uploaded', { description: file.name });
      setAllItems(null);
      mutate();
    } catch (err) {
      toast.error('Upload failed', { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }, [currentPrefix, mutate, userRole]);

  // Delete file
  const confirmDelete = useCallback(async () => {
    if (!deleteKey) return;
    if (!canDelete(userRole)) {
      toast.error('Permission denied', { description: 'Delete requires ADMIN role' });
      setDeleteKey(null);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/storage/s3?key=${encodeURIComponent(deleteKey)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error?.message || 'Failed to delete');
      }

      toast.success('File deleted', { description: getDisplayName(deleteKey, false) });
      setDeleteKey(null);
      setAllItems(null);
      mutate();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  }, [deleteKey, mutate, userRole]);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      e.target.value = '';
    }
  }, [uploadFile]);

  // Check for configuration errors
  const isNotConfigured = error?.message?.includes('not configured') ||
    data?.error?.code === 'S3_NOT_CONFIGURED';

  if (isNotConfigured) {
    return (
      <Card className="border-warning bg-warning/5">
        <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-warning" />
          <div>
            <p className="font-semibold">S3 not configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your administrator to configure S3 storage for this organization.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !isNotConfigured) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Failed to load files</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Objects
                {!isLoading && (
                  <span className="text-muted-foreground font-normal text-sm">
                    ({totalCount})
                  </span>
                )}
              </CardTitle>
              {!isLoading && totalCount > 0 && (
                <div className="flex gap-1.5">
                  {dirCount > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {dirCount} {dirCount === 1 ? 'folder' : 'folders'}
                    </Badge>
                  )}
                  {fileCount > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {fileCount} {fileCount === 1 ? 'file' : 'files'}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Copy current path */}
              {currentPrefix && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyPath(currentPrefix)}
                    >
                      <Copy className="h-4 w-4 mr-1.5" />
                      Copy Path
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-mono text-xs">{currentPrefix}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Download - placeholder for multi-select */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
              
              {/* Upload button with role gating */}
              <div className="relative">
                <input
                  type="file"
                  id="file-upload"
                  className="sr-only"
                  onChange={handleFileInput}
                  disabled={uploading || !canUpload(userRole)}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="default"
                        size="sm"
                        asChild
                        disabled={uploading || !canUpload(userRole)}
                        className={!canUpload(userRole) ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <label 
                          htmlFor="file-upload" 
                          className={canUpload(userRole) ? 'cursor-pointer' : 'cursor-not-allowed'}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : !canUpload(userRole) ? (
                            <Lock className="h-4 w-4 mr-2" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Upload
                        </label>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canUpload(userRole) && (
                    <TooltipContent>
                      <p>Requires READWRITE role or higher</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-0.5 text-sm flex-wrap bg-muted/30 rounded-md px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-medium"
              onClick={() => navigateTo('')}
            >
              <Home className="h-3.5 w-3.5 mr-1" />
              Root
            </Button>
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 font-medium max-w-[200px] truncate"
                  onClick={() => navigateTo(crumb.path)}
                  title={crumb.name}
                >
                  {crumb.name}
                </Button>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Find objects by prefix..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {userRole}
            </Badge>
          </div>

          {/* File table */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-muted-foreground">
                {search ? 'No matching objects' : 'This folder is empty'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search
                  ? 'Try adjusting your search prefix'
                  : canUpload(userRole)
                    ? 'Upload files to get started'
                    : 'No objects in this prefix'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Name</TableHead>
                    <TableHead className="w-[10%]">Type</TableHead>
                    <TableHead className="w-[22%]">Last modified</TableHead>
                    <TableHead className="w-[10%]">Size</TableHead>
                    <TableHead className="w-[13%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.key}
                      className={
                        item.type === 'directory'
                          ? 'cursor-pointer hover:bg-muted/50'
                          : undefined
                      }
                      onClick={
                        item.type === 'directory'
                          ? () => navigateTo(item.key)
                          : undefined
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(item.key, item.type === 'directory')}
                          {item.type === 'directory' ? (
                            <button
                              className="text-left font-medium text-primary hover:underline truncate"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateTo(item.key);
                              }}
                              title={item.displayName}
                            >
                              {item.displayName}
                            </button>
                          ) : (
                            <span className="truncate" title={item.displayName}>
                              {item.displayName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.fileType}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.type === 'file' && item.lastModified
                          ? formatDate(item.lastModified)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {item.type === 'file' && item.size !== undefined
                          ? formatBytes(item.size)
                          : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {item.type === 'file' && (
                            <>
                              {/* Copy path */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyPath(item.key)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy path</TooltipContent>
                              </Tooltip>

                              {/* Download */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => downloadFile(item.key)}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download</TooltipContent>
                              </Tooltip>

                              {/* Delete */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-8 w-8 ${
                                        canDelete(userRole)
                                          ? 'text-destructive hover:text-destructive'
                                          : 'text-muted-foreground/40 cursor-not-allowed'
                                      }`}
                                      onClick={() => canDelete(userRole) && setDeleteKey(item.key)}
                                      disabled={!canDelete(userRole)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {canDelete(userRole) ? 'Delete' : 'Requires ADMIN role'}
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {item.type === 'directory' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyPath(item.key);
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy path</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination: Load More */}
          {data?.data?.isTruncated && (
            <div className="flex items-center justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load more objects
              </Button>
            </div>
          )}
        </CardContent>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete file?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{' '}
                <strong className="font-mono text-foreground">
                  {deleteKey && getDisplayName(deleteKey, false)}
                </strong>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteKey(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}
