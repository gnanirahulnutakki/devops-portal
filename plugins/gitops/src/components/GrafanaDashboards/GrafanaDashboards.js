import React, { useState, useEffect } from 'react';
import { Grid, Select, MenuItem, FormControl, InputLabel, Box, Typography, Chip, IconButton, Link, } from '@material-ui/core';
import { InfoCard, Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
export const GrafanaDashboards = () => {
    const [selectedFolder, setSelectedFolder] = useState('');
    const [selectedDashboard, setSelectedDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dashboards, setDashboards] = useState([]);
    const [folders, setFolders] = useState([]);
    const discoveryApi = useApi(discoveryApiRef);
    const fetchApi = useApi(fetchApiRef);
    // Fetch dashboards from backend
    const fetchDashboards = async () => {
        try {
            setLoading(true);
            setError(null);
            const baseUrl = await discoveryApi.getBaseUrl('gitops');
            const response = await fetchApi.fetch(`${baseUrl}/grafana/dashboards`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Failed to fetch dashboards: ${response.statusText}`);
            }
            const data = await response.json();
            setDashboards(data.dashboards || []);
            // Extract unique folders (excluding 'General' if empty)
            const uniqueFolders = [...new Set(data.dashboards.map((d) => d.folder))].sort();
            setFolders(uniqueFolders);
            // Auto-select first folder if available
            if (uniqueFolders.length > 0 && !selectedFolder) {
                setSelectedFolder(uniqueFolders[0]);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching dashboards';
            setError(errorMessage);
            console.error('Error fetching Grafana dashboards:', err);
        }
        finally {
            setLoading(false);
        }
    };
    // Fetch on component mount
    useEffect(() => {
        fetchDashboards();
    }, []);
    // Filter dashboards by folder
    const filteredDashboards = selectedFolder === 'All'
        ? dashboards
        : dashboards.filter(d => d.folder === selectedFolder);
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60)
            return `${diffMins} minutes ago`;
        if (diffMins < 1440)
            return `${Math.floor(diffMins / 60)} hours ago`;
        return `${Math.floor(diffMins / 1440)} days ago`;
    };
    if (loading)
        return React.createElement(Progress, null);
    // Get dashboards for selected folder
    const folderDashboards = selectedFolder
        ? dashboards.filter(d => d.folder === selectedFolder)
        : [];
    return (React.createElement(Grid, { container: true, spacing: 3 },
        error && (React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "error" },
                "Error loading Grafana dashboards: ",
                error))),
        !error && dashboards.length === 0 && !loading && (React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "warning" }, "No dashboards found. Make sure Grafana Cloud is configured in app-config.yaml and the API token has the correct permissions."))),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "Grafana Cloud Dashboards" },
                React.createElement(Box, { mb: 3, display: "flex", gap: 3, alignItems: "center" },
                    React.createElement(FormControl, { style: { minWidth: 250 } },
                        React.createElement(InputLabel, null, "Select Folder"),
                        React.createElement(Select, { value: selectedFolder, onChange: e => {
                                setSelectedFolder(e.target.value);
                                setSelectedDashboard(null); // Reset dashboard selection when folder changes
                            } }, folders.map(folder => (React.createElement(MenuItem, { key: folder, value: folder }, folder))))),
                    React.createElement(FormControl, { style: { minWidth: 350 }, disabled: !selectedFolder },
                        React.createElement(InputLabel, null, "Select Dashboard"),
                        React.createElement(Select, { value: selectedDashboard?.id || '', onChange: e => {
                                const dashboard = folderDashboards.find(d => d.id === e.target.value);
                                setSelectedDashboard(dashboard || null);
                            } }, folderDashboards.map(dashboard => (React.createElement(MenuItem, { key: dashboard.id, value: dashboard.id }, dashboard.title))))),
                    React.createElement(Box, { display: "flex", gap: 1, alignItems: "center" },
                        React.createElement(IconButton, { size: "small", title: "Refresh Dashboards", onClick: fetchDashboards },
                            React.createElement(RefreshIcon, null)),
                        selectedDashboard && (React.createElement(IconButton, { size: "small", component: Link, href: selectedDashboard.url, target: "_blank", title: "Open in Grafana" },
                            React.createElement(OpenInNewIcon, null))))),
                !selectedDashboard && (React.createElement(Box, { textAlign: "center", p: 8 },
                    React.createElement(Typography, { variant: "h6", color: "textSecondary", gutterBottom: true }, "Select a folder and dashboard to view"),
                    React.createElement(Typography, { variant: "body2", color: "textSecondary" }, dashboards.length > 0
                        ? `${dashboards.length} dashboards available across ${folders.length} folders`
                        : 'No dashboards available'))),
                selectedDashboard && (React.createElement(Box, null,
                    React.createElement(Box, { mb: 3, p: 2, bgcolor: "background.paper", borderRadius: 1, border: "1px solid #e0e0e0" },
                        React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 },
                            React.createElement(Box, null,
                                React.createElement(Typography, { variant: "h5", gutterBottom: true }, selectedDashboard.title),
                                selectedDashboard.description && (React.createElement(Typography, { variant: "body2", color: "textSecondary", gutterBottom: true }, selectedDashboard.description)))),
                        React.createElement(Box, { display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" },
                            React.createElement(Chip, { label: selectedDashboard.folder, size: "small", color: "primary" }),
                            selectedDashboard.panels !== undefined && (React.createElement(Chip, { label: `${selectedDashboard.panels} panels`, size: "small", variant: "outlined" })),
                            selectedDashboard.tags.map(tag => (React.createElement(Chip, { key: tag, label: tag, size: "small" }))),
                            selectedDashboard.lastUpdated && (React.createElement(Typography, { variant: "caption", color: "textSecondary", style: { marginLeft: 'auto' } },
                                "Updated ",
                                formatDate(selectedDashboard.lastUpdated))))),
                    React.createElement(Box, { style: {
                            width: '100%',
                            height: '700px',
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            overflow: 'hidden',
                        } },
                        React.createElement("iframe", { src: `${selectedDashboard.url}?orgId=1&kiosk=tv&theme=light`, width: "100%", height: "100%", frameBorder: "0", title: selectedDashboard.title, style: { border: 0 } }))))))));
};
//# sourceMappingURL=GrafanaDashboards.js.map