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
  RefreshCcw,
  Folder,
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
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

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

interface ApiResponse {
  success: boolean;
  data?: S3ListResult;
  error?: {
    code: string;
    message: string;
  };
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
  return new Date(dateString).toLocaleString();
}

function getFileName(key: string): string {
  const parts = key.split('/').filter(Boolean);
  return parts[parts.length - 1] || key;
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

export function S3Browser() {
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const apiUrl = `/api/storage/s3?prefix=${encodeURIComponent(currentPrefix)}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  // Breadcrumb parts
  const breadcrumbs = useMemo(() => {
    if (!currentPrefix) return [];
    const parts = currentPrefix.split('/').filter(Boolean);
    return parts.map((part, idx) => ({
      name: part,
      path: parts.slice(0, idx + 1).join('/') + '/',
    }));
  }, [currentPrefix]);

  // Combined items (directories + files)
  const items = useMemo(() => {
    if (!data?.data) return [];

    const result: Array<{ type: 'directory' | 'file'; key: string; size?: number; lastModified?: string }> = [];

    // Add directories (prefixes)
    data.data.prefixes.forEach((prefix) => {
      result.push({
        type: 'directory',
        key: prefix,
      });
    });

    // Add files
    data.data.objects.forEach((obj) => {
      if (obj.key !== currentPrefix) {
        result.push({
          type: 'file',
          key: obj.key,
          size: obj.size,
          lastModified: obj.lastModified,
        });
      }
    });

    // Filter by search
    if (search) {
      return result.filter((item) =>
        getFileName(item.key).toLowerCase().includes(search.toLowerCase())
      );
    }

    return result;
  }, [data, currentPrefix, search]);

  // Navigate to directory
  const navigateTo = useCallback((prefix: string) => {
    setCurrentPrefix(prefix);
    setSearch('');
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
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get download URL');
      }

      // Open download URL
      window.open(result.data.url, '_blank');
      toast.success('Download started');
    } catch (err) {
      toast.error('Download failed', { description: (err as Error).message });
    }
  }, []);

  // Upload file
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const key = currentPrefix + file.name;

      // Get signed upload URL
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
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get upload URL');
      }

      // Upload to S3
      const uploadRes = await fetch(result.data.url, {
        method: 'PUT',
        headers: {
          'Content-Type': result.data.contentType,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }

      toast.success('File uploaded', { description: file.name });
      mutate();
    } catch (err) {
      toast.error('Upload failed', { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }, [currentPrefix, mutate]);

  // Delete file
  const confirmDelete = useCallback(async () => {
    if (!deleteKey) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/storage/s3?key=${encodeURIComponent(deleteKey)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete');
      }

      toast.success('File deleted');
      setDeleteKey(null);
      mutate();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  }, [deleteKey, mutate]);

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">S3 Browser</CardTitle>
          <div className="flex items-center gap-2">
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
            <div className="relative">
              <input
                type="file"
                id="file-upload"
                className="sr-only"
                onChange={handleFileInput}
                disabled={uploading}
              />
              <Button
                variant="default"
                size="sm"
                asChild
                disabled={uploading}
              >
                <label htmlFor="file-upload" className="cursor-pointer">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload
                </label>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => navigateTo('')}
          >
            <Home className="h-4 w-4" />
          </Button>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.path} className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => navigateTo(crumb.path)}
              >
                {crumb.name}
              </Button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* File table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {search ? 'No files match your search' : 'This folder is empty'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.type === 'directory' ? (
                          <Folder className="h-4 w-4 text-blue-500" />
                        ) : (
                          <File className="h-4 w-4 text-gray-400" />
                        )}
                        {item.type === 'directory' ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-foreground hover:text-primary"
                            onClick={() => navigateTo(item.key)}
                          >
                            {getFileName(item.key)}
                          </Button>
                        ) : (
                          <span>{getFileName(item.key)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.type === 'file' && item.size !== undefined
                        ? formatBytes(item.size)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.type === 'file' && item.lastModified
                        ? formatDate(item.lastModified)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {item.type === 'file' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => downloadFile(item.key)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteKey(item.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination indicator */}
        {data?.data?.isTruncated && (
          <div className="text-center">
            <Badge variant="secondary">More files available</Badge>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteKey && getFileName(deleteKey)}</strong>?
              This action cannot be undone.
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
  );
}
