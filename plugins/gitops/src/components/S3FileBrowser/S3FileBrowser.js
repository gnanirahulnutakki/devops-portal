import React, { useState } from 'react';
import { Grid, Card, Select, MenuItem, FormControl, InputLabel, Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Chip, TextField, InputAdornment, Breadcrumbs, Link, Snackbar, CircularProgress, } from '@material-ui/core';
import { InfoCard, Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import GetAppIcon from '@material-ui/icons/GetApp';
import RefreshIcon from '@material-ui/icons/Refresh';
import SearchIcon from '@material-ui/icons/Search';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
const mockBuckets = [
    'rli-use2-backups',
    'rli-use2-logs',
    'rli-use2-artifacts',
    'rli-use2-config',
];
const mockObjects = [
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
        size: 2147483648,
        lastModified: '2025-01-28T02:00:00Z',
        bucket: 'rli-use2-backups',
    },
    {
        key: 'backups/radiantone-2025-01-27.tar.gz',
        type: 'file',
        size: 2097152000,
        lastModified: '2025-01-27T02:00:00Z',
        bucket: 'rli-use2-backups',
    },
    {
        key: 'postgres/db-dump-2025-01-28.sql.gz',
        type: 'file',
        size: 524288000,
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
        size: 10485760,
        lastModified: '2025-01-28T23:59:59Z',
        bucket: 'rli-use2-logs',
    },
    {
        key: 'audit/gitops-audit-2025-01-28.log',
        type: 'file',
        size: 2097152,
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
        size: 1048576,
        lastModified: '2025-01-25T10:00:00Z',
        bucket: 'rli-use2-artifacts',
    },
];
export const S3FileBrowser = () => {
    const [selectedBucket, setSelectedBucket] = useState('rli-use2-backups');
    const [currentPath, setCurrentPath] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [downloadNotification, setDownloadNotification] = useState({ open: false, message: '', severity: 'info' });
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };
    const formatDate = (dateStr) => {
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
            filtered = filtered.filter(obj => obj.key.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return filtered;
    };
    const handleFolderClick = (folderKey) => {
        setCurrentPath(folderKey);
    };
    const handleBreadcrumbClick = (path) => {
        setCurrentPath(path);
    };
    const handleDownload = async (fileKey) => {
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
        }
        catch (error) {
            setDownloadNotification({
                open: true,
                message: `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: 'error',
            });
        }
        finally {
            setDownloading(null);
        }
    };
    const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
    if (loading)
        return React.createElement(Progress, null);
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" }, "Mock S3 data active. Configure AWS credentials to access real S3 buckets.")),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "S3 File Browser" },
                React.createElement(Box, { mb: 3 },
                    React.createElement(Grid, { container: true, spacing: 2, alignItems: "center" },
                        React.createElement(Grid, { item: true, xs: 12, md: 4 },
                            React.createElement(FormControl, { fullWidth: true },
                                React.createElement(InputLabel, null, "S3 Bucket"),
                                React.createElement(Select, { value: selectedBucket, onChange: e => {
                                        setSelectedBucket(e.target.value);
                                        setCurrentPath('');
                                    } }, mockBuckets.map(bucket => (React.createElement(MenuItem, { key: bucket, value: bucket }, bucket)))))),
                        React.createElement(Grid, { item: true, xs: 12, md: 6 },
                            React.createElement(TextField, { fullWidth: true, placeholder: "Search files and folders...", value: searchTerm, onChange: e => setSearchTerm(e.target.value), InputProps: {
                                    startAdornment: (React.createElement(InputAdornment, { position: "start" },
                                        React.createElement(SearchIcon, null))),
                                } })),
                        React.createElement(Grid, { item: true, xs: 12, md: 2 },
                            React.createElement(IconButton, { title: "Refresh" },
                                React.createElement(RefreshIcon, null))))),
                React.createElement(Box, { mb: 2 },
                    React.createElement(Breadcrumbs, { separator: React.createElement(NavigateNextIcon, { fontSize: "small" }) },
                        React.createElement(Link, { component: "button", variant: "body1", onClick: () => handleBreadcrumbClick(''), style: { cursor: 'pointer' } }, selectedBucket),
                        pathParts.map((part, index) => {
                            const path = pathParts.slice(0, index + 1).join('/') + '/';
                            return (React.createElement(Link, { key: path, component: "button", variant: "body1", onClick: () => handleBreadcrumbClick(path), style: { cursor: 'pointer' } }, part));
                        }))),
                React.createElement(Card, { variant: "outlined" },
                    React.createElement(Table, null,
                        React.createElement(TableHead, null,
                            React.createElement(TableRow, null,
                                React.createElement(TableCell, null, "Name"),
                                React.createElement(TableCell, null, "Type"),
                                React.createElement(TableCell, null, "Size"),
                                React.createElement(TableCell, null, "Last Modified"),
                                React.createElement(TableCell, { align: "right" }, "Actions"))),
                        React.createElement(TableBody, null, getFilteredObjects().length === 0 ? (React.createElement(TableRow, null,
                            React.createElement(TableCell, { colSpan: 5, align: "center" },
                                React.createElement(Typography, { color: "textSecondary" }, "No files or folders found")))) : (getFilteredObjects().map(obj => {
                            const displayName = obj.key.substring(currentPath.length).replace(/\/$/, '');
                            return (React.createElement(TableRow, { key: obj.key, hover: true },
                                React.createElement(TableCell, null,
                                    React.createElement(Box, { display: "flex", alignItems: "center" },
                                        obj.type === 'folder' ? (React.createElement(FolderIcon, { style: { marginRight: 8, color: '#1976d2' } })) : (React.createElement(InsertDriveFileIcon, { style: { marginRight: 8, color: '#757575' } })),
                                        obj.type === 'folder' ? (React.createElement(Link, { component: "button", variant: "body1", onClick: () => handleFolderClick(obj.key), style: { cursor: 'pointer', textAlign: 'left' } }, displayName)) : (React.createElement(Typography, null, displayName)))),
                                React.createElement(TableCell, null,
                                    React.createElement(Chip, { label: obj.type, size: "small", color: obj.type === 'folder' ? 'primary' : 'default' })),
                                React.createElement(TableCell, null, obj.size !== undefined ? formatFileSize(obj.size) : '-'),
                                React.createElement(TableCell, null, obj.lastModified ? formatDate(obj.lastModified) : '-'),
                                React.createElement(TableCell, { align: "right" }, obj.type === 'file' && (React.createElement(IconButton, { size: "small", onClick: () => handleDownload(obj.key), title: "Download file", disabled: downloading === obj.key }, downloading === obj.key ? (React.createElement(CircularProgress, { size: 20 })) : (React.createElement(GetAppIcon, null)))))));
                        }))))),
                React.createElement(Box, { mt: 2 },
                    React.createElement(Typography, { variant: "caption", color: "textSecondary" },
                        "Showing ",
                        getFilteredObjects().length,
                        " item(s) in ",
                        currentPath || selectedBucket)))),
        React.createElement(Snackbar, { open: downloadNotification.open, autoHideDuration: 6000, onClose: () => setDownloadNotification({ ...downloadNotification, open: false }), anchorOrigin: { vertical: 'bottom', horizontal: 'right' } },
            React.createElement(Alert, { onClose: () => setDownloadNotification({ ...downloadNotification, open: false }), severity: downloadNotification.severity, variant: "filled" }, downloadNotification.message))));
};
//# sourceMappingURL=S3FileBrowser.js.map