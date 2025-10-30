import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip,
  IconButton,
  Link,
} from '@material-ui/core';
import { InfoCard, Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

interface Dashboard {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  folder: string;
  url: string;
  panels?: number;
  lastUpdated?: string;
}

export const GrafanaDashboards = () => {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [folders, setFolders] = useState<string[]>([]);

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
      const uniqueFolders = [...new Set(data.dashboards.map((d: Dashboard) => d.folder))].sort();
      setFolders(uniqueFolders as string[]);

      // Auto-select first folder if available
      if (uniqueFolders.length > 0 && !selectedFolder) {
        setSelectedFolder(uniqueFolders[0] as string);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching dashboards';
      setError(errorMessage);
      console.error('Error fetching Grafana dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on component mount
  useEffect(() => {
    fetchDashboards();
  }, []);

  // Filter dashboards by folder
  const filteredDashboards =
    selectedFolder === 'All'
      ? dashboards
      : dashboards.filter(d => d.folder === selectedFolder);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (loading) return <Progress />;

  // Get dashboards for selected folder
  const folderDashboards = selectedFolder
    ? dashboards.filter(d => d.folder === selectedFolder)
    : [];

  return (
    <Grid container spacing={3}>
      {error && (
        <Grid item xs={12}>
          <Alert severity="error">
            Error loading Grafana dashboards: {error}
          </Alert>
        </Grid>
      )}

      {!error && dashboards.length === 0 && !loading && (
        <Grid item xs={12}>
          <Alert severity="warning">
            No dashboards found. Make sure Grafana Cloud is configured in app-config.yaml and the API token has the correct permissions.
          </Alert>
        </Grid>
      )}

      <Grid item xs={12}>
        <InfoCard title="Grafana Cloud Dashboards">
          <Box mb={3} display="flex" gap={3} alignItems="center">
            <FormControl style={{ minWidth: 250 }}>
              <InputLabel>Select Folder</InputLabel>
              <Select
                value={selectedFolder}
                onChange={e => {
                  setSelectedFolder(e.target.value as string);
                  setSelectedDashboard(null); // Reset dashboard selection when folder changes
                }}
              >
                {folders.map(folder => (
                  <MenuItem key={folder} value={folder}>
                    {folder}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl style={{ minWidth: 350 }} disabled={!selectedFolder}>
              <InputLabel>Select Dashboard</InputLabel>
              <Select
                value={selectedDashboard?.id || ''}
                onChange={e => {
                  const dashboard = folderDashboards.find(d => d.id === e.target.value);
                  setSelectedDashboard(dashboard || null);
                }}
              >
                {folderDashboards.map(dashboard => (
                  <MenuItem key={dashboard.id} value={dashboard.id}>
                    {dashboard.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box display="flex" gap={1} alignItems="center">
              <IconButton size="small" title="Refresh Dashboards" onClick={fetchDashboards}>
                <RefreshIcon />
              </IconButton>
              {selectedDashboard && (
                <IconButton
                  size="small"
                  component={Link}
                  href={selectedDashboard.url}
                  target="_blank"
                  title="Open in Grafana"
                >
                  <OpenInNewIcon />
                </IconButton>
              )}
            </Box>
          </Box>

          {!selectedDashboard && (
            <Box textAlign="center" p={8}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Select a folder and dashboard to view
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {dashboards.length > 0
                  ? `${dashboards.length} dashboards available across ${folders.length} folders`
                  : 'No dashboards available'
                }
              </Typography>
            </Box>
          )}

          {selectedDashboard && (
            <Box>
              {/* Dashboard metadata */}
              <Box mb={3} p={2} bgcolor="background.paper" borderRadius={1} border="1px solid #e0e0e0">
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography variant="h5" gutterBottom>
                      {selectedDashboard.title}
                    </Typography>
                    {selectedDashboard.description && (
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {selectedDashboard.description}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                  <Chip label={selectedDashboard.folder} size="small" color="primary" />
                  {selectedDashboard.panels !== undefined && (
                    <Chip label={`${selectedDashboard.panels} panels`} size="small" variant="outlined" />
                  )}
                  {selectedDashboard.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                  {selectedDashboard.lastUpdated && (
                    <Typography variant="caption" color="textSecondary" style={{ marginLeft: 'auto' }}>
                      Updated {formatDate(selectedDashboard.lastUpdated)}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Embedded dashboard */}
              <Box
                style={{
                  width: '100%',
                  height: '700px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <iframe
                  src={`${selectedDashboard.url}?orgId=1&kiosk=tv&theme=light`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title={selectedDashboard.title}
                  style={{ border: 0 }}
                />
              </Box>
            </Box>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
};
