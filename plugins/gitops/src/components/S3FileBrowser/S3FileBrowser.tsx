import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Snackbar,
  CircularProgress,
} from '@material-ui/core';
import { InfoCard, Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import GetAppIcon from '@material-ui/icons/GetApp';
import RefreshIcon from '@material-ui/icons/Refresh';
import SearchIcon from '@material-ui/icons/Search';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';

//Mock S3 data
interface S3Object {
  key: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: string;
  bucket: string;
}

const mockBuckets = [
  'rli-use2-backups',
  'rli-use2-logs',
  'rli-use2-artifacts',
  'rli-use2-config',
];

const mockObjects: S3Object[] = [
  {
    key: 'backups/',
    type: 'folder',
    bucket: 'rli-use2-backups',
  },
  {
    key: 'postgres/',
    type: 'folder',
    bucket: 'rli-use2-backups',
  },
  {
    key: 'backups/radiantone-2025-01-28.tar.gz',
    type: 'file',
    size: 2147483648,  // 2GB
    lastModified: '2025-01-28T02:00:00Z',
    bucket: 'rli-use2-backups',
  },
  {
    key: 'backups/radiantone-2025-01-27.tar.gz',
    type: 'file',
    size: 2097152000, // ~2GB
    lastModified: '2025-01-27T02:00:00Z',
    bucket: 'rli-use2-backups',
  },
  {
    key: 'postgres/db-dump-2025-01-28.sql.gz',
    type: 'file',
    size: 524288000, // 500MB
    lastModified: '2025-01-28T03:00:00Z',
    bucket: 'rli-use2-backups',
  },
  {
    key: 'application/',
    type: 'folder',
    bucket: 'rli-use2-logs',
  },
  {
    key: 'audit/',
    type: 'folder',
    bucket: 'rli-use2-logs',
  },
  {
    key: 'application/backstage-2025-01-28.log',
    type: 'file',
    size: 10485760, // 10MB
    lastModified: '2025-01-28T23:59:59Z',
    bucket: 'rli-use2-logs',
  },
  {
    key: 'audit/gitops-audit-2025-01-28.log',
    type: 'file',
    size: 2097152, // 2MB
    lastModified: '2025-01-28T23:59:59Z',
    bucket: 'rli-use2-logs',
  },
  {
    key: 'helm-charts/',
    type: 'folder',
    bucket: 'rli-use2-artifacts',
  },
  {
    key: 'docker-images/',
    type: 'folder',
    bucket: 'rli-use2-artifacts',
  },
  {
    key: 'helm-charts/radiantone-1.0.0.tgz',
    type: 'file',
    size: 1048576, // 1MB
    lastModified: '2025-01-25T10:00:00Z',
    bucket: 'rli-use2-artifacts',
  },
];

export const S3FileBrowser = () => {
  const [selectedBucket, setSelectedBucket] = useState<string>('rli-use2-backups');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadNotification, setDownloadNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getFilteredObjects = () => {
    let filtered = mockObjects.filter(obj => obj.bucket === selectedBucket);

    // Filter by current path
    if (currentPath) {
      filtered = filtered.filter(obj => obj.key.startsWith(currentPath));
    }

    // Get immediate children only
    filtered = filtered.filter(obj => {
      const relativePath = obj.key.substring(currentPath.length);
      const hasNoSubpath = !relativePath.includes('/') ||
        (obj.type === 'folder' && relativePath.endsWith('/') && relativePath.split('/').length === 2);
      return hasNoSubpath;
    });

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(obj =>
        obj.key.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const handleFolderClick = (folderKey: string) => {
    setCurrentPath(folderKey);
  };

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
  };

  const handleDownload = async (fileKey: string) => {
    try {
      setDownloading(fileKey);
      setDownloadNotification({
        open: true,
        message: `Preparing download for ${fileKey.split('/').pop()}...`,
        severity: 'info',
      });

      // Find the file object to get its size
      const fileObj = mockObjects.find(obj => obj.key === fileKey && obj.type === 'file');

      if (!fileObj || !fileObj.size) {
        throw new Error('File not found or has no size');
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create mock file content (for demo purposes, create a small blob with metadata)
      const mockContent = `Mock S3 File Download
Bucket: ${selectedBucket}
File: ${fileKey}
Size: ${formatFileSize(fileObj.size)}
Last Modified: ${fileObj.lastModified ? formatDate(fileObj.lastModified) : 'Unknown'}

This is a mock download. In production, this would download the actual file from AWS S3.
To implement real S3 downloads:
1. Set up AWS SDK with credentials
2. Use S3.getObject() to retrieve the file
3. Stream the response to the browser

For large files, consider:
- Generating pre-signed URLs for direct browser downloads
- Implementing resumable downloads
- Adding progress tracking
`;

      // Create blob and download link
      const blob = new Blob([mockContent], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileKey.split('/').pop() || 'download.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadNotification({
        open: true,
        message: `Successfully downloaded ${fileKey.split('/').pop()}`,
        severity: 'success',
      });
    } catch (error) {
      setDownloadNotification({
        open: true,
        message: `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    } finally {
      setDownloading(null);
    }
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  if (loading) return <Progress />;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          Mock S3 data active. Configure AWS credentials to access real S3 buckets.
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <InfoCard title="S3 File Browser">
          <Box mb={3}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>S3 Bucket</InputLabel>
                  <Select
                    value={selectedBucket}
                    onChange={e => {
                      setSelectedBucket(e.target.value as string);
                      setCurrentPath('');
                    }}
                  >
                    {mockBuckets.map(bucket => (
                      <MenuItem key={bucket} value={bucket}>
                        {bucket}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search files and folders..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <IconButton title="Refresh">
                  <RefreshIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Box>

          {/* Breadcrumbs */}
          <Box mb={2}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
              <Link
                component="button"
                variant="body1"
                onClick={() => handleBreadcrumbClick('')}
                style={{ cursor: 'pointer' }}
              >
                {selectedBucket}
              </Link>
              {pathParts.map((part, index) => {
                const path = pathParts.slice(0, index + 1).join('/') + '/';
                return (
                  <Link
                    key={path}
                    component="button"
                    variant="body1"
                    onClick={() => handleBreadcrumbClick(path)}
                    style={{ cursor: 'pointer' }}
                  >
                    {part}
                  </Link>
                );
              })}
            </Breadcrumbs>
          </Box>

          {/* File/Folder Table */}
          <Card variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Last Modified</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getFilteredObjects().length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="textSecondary">
                        No files or folders found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  getFilteredObjects().map(obj => {
                    const displayName = obj.key.substring(currentPath.length).replace(/\/$/, '');
                    return (
                      <TableRow key={obj.key} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {obj.type === 'folder' ? (
                              <FolderIcon style={{ marginRight: 8, color: '#1976d2' }} />
                            ) : (
                              <InsertDriveFileIcon style={{ marginRight: 8, color: '#757575' }} />
                            )}
                            {obj.type === 'folder' ? (
                              <Link
                                component="button"
                                variant="body1"
                                onClick={() => handleFolderClick(obj.key)}
                                style={{ cursor: 'pointer', textAlign: 'left' }}
                              >
                                {displayName}
                              </Link>
                            ) : (
                              <Typography>{displayName}</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={obj.type}
                            size="small"
                            color={obj.type === 'folder' ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {obj.size !== undefined ? formatFileSize(obj.size) : '-'}
                        </TableCell>
                        <TableCell>
                          {obj.lastModified ? formatDate(obj.lastModified) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {obj.type === 'file' && (
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(obj.key)}
                              title="Download file"
                              disabled={downloading === obj.key}
                            >
                              {downloading === obj.key ? (
                                <CircularProgress size={20} />
                              ) : (
                                <GetAppIcon />
                              )}
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <Box mt={2}>
            <Typography variant="caption" color="textSecondary">
              Showing {getFilteredObjects().length} item(s) in {currentPath || selectedBucket}
            </Typography>
          </Box>
        </InfoCard>
      </Grid>

      {/* Download Notification */}
      <Snackbar
        open={downloadNotification.open}
        autoHideDuration={6000}
        onClose={() => setDownloadNotification({ ...downloadNotification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setDownloadNotification({ ...downloadNotification, open: false })}
          severity={downloadNotification.severity}
          variant="filled"
        >
          {downloadNotification.message}
        </Alert>
      </Snackbar>
    </Grid>
  );
};
