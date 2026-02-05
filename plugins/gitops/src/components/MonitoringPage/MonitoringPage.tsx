/**
 * MonitoringPage - Unified Observability Dashboard
 *
 * Combines Grafana dashboards and Uptime Kuma monitoring in a
 * seamless, modern interface for comprehensive infrastructure oversight.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardActionArea,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  makeStyles,
  Paper,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  useTheme,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  InfoCard,
  Progress,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusPending,
} from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useApi, configApiRef, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

// Icons
import DashboardIcon from '@material-ui/icons/Dashboard';
import TimelineIcon from '@material-ui/icons/Timeline';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import VisibilityIcon from '@material-ui/icons/Visibility';
import NotificationsIcon from '@material-ui/icons/Notifications';
import SpeedIcon from '@material-ui/icons/Speed';
import StorageIcon from '@material-ui/icons/Storage';
import HttpIcon from '@material-ui/icons/Http';
import DnsIcon from '@material-ui/icons/Dns';
import SecurityIcon from '@material-ui/icons/Security';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import SettingsIcon from '@material-ui/icons/Settings';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  tabsContainer: {
    marginBottom: theme.spacing(3),
  },
  tabPanel: {
    minHeight: 400,
  },
  // Summary Cards
  summaryGrid: {
    marginBottom: theme.spacing(3),
  },
  summaryCard: {
    borderRadius: 12,
    padding: theme.spacing(2.5),
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
    },
  },
  summaryCardHealthy: {
    background: 'linear-gradient(135deg, #00b12b 0%, #4caf50 100%)',
  },
  summaryCardWarning: {
    background: 'linear-gradient(135deg, #ff9800 0%, #ffc107 100%)',
  },
  summaryCardError: {
    background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)',
  },
  summaryCardInfo: {
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
  },
  summaryValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
  },
  summaryLabel: {
    opacity: 0.9,
    marginTop: theme.spacing(0.5),
  },
  summaryIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 56,
    opacity: 0.2,
  },
  // Monitor Cards
  monitorCard: {
    borderRadius: 12,
    transition: 'all 0.2s ease',
    border: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      borderColor: theme.palette.primary.main,
    },
  },
  monitorCardUp: {
    borderLeft: '4px solid #00b12b',
  },
  monitorCardDown: {
    borderLeft: '4px solid #d32f2f',
  },
  monitorCardPending: {
    borderLeft: '4px solid #ff9800',
  },
  monitorCardPaused: {
    borderLeft: '4px solid #9e9e9e',
  },
  monitorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  monitorName: {
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  monitorStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  monitorContent: {
    padding: theme.spacing(2),
  },
  monitorStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  monitorStat: {
    textAlign: 'center',
  },
  monitorStatValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  monitorStatLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  uptimeBar: {
    display: 'flex',
    gap: 2,
    marginTop: theme.spacing(1.5),
  },
  uptimeSegment: {
    flex: 1,
    height: 20,
    borderRadius: 2,
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
    '&:hover': {
      transform: 'scaleY(1.2)',
    },
  },
  // Grafana Section
  grafanaContainer: {
    marginTop: theme.spacing(2),
  },
  dashboardSelector: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  dashboardCard: {
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: `2px solid transparent`,
    '&:hover': {
      borderColor: theme.palette.primary.main,
      transform: 'translateY(-2px)',
    },
  },
  dashboardCardSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: `${theme.palette.primary.main}08`,
  },
  dashboardFrame: {
    width: '100%',
    height: 600,
    border: 'none',
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
  },
  // Quick Stats
  quickStatsBar: {
    display: 'flex',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    marginBottom: theme.spacing(3),
  },
  quickStat: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(6),
    color: theme.palette.text.secondary,
  },
  emptyStateIcon: {
    fontSize: 64,
    opacity: 0.4,
    marginBottom: theme.spacing(2),
  },
}));

// Types
interface UptimeMonitor {
  id: number;
  name: string;
  type: string;
  url?: string;
  hostname?: string;
  port?: number;
  status: 'up' | 'down' | 'pending' | 'paused';
  uptime: number; // Percentage
  responseTime: number; // ms
  lastCheck: string;
  certExpiry?: string;
  history?: { status: number; time: string }[];
}

interface GrafanaDashboard {
  id: string;
  uid: string;
  title: string;
  description?: string;
  tags: string[];
  folder: string;
  url: string;
}

interface MonitoringStats {
  totalMonitors: number;
  monitorsUp: number;
  monitorsDown: number;
  monitorsPaused: number;
  avgUptime: number;
  avgResponseTime: number;
}

export const MonitoringPage = () => {
  const classes = useStyles();
  const theme = useTheme();
  const config = useApi(configApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uptime Kuma state
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [stats, setStats] = useState<MonitoringStats>({
    totalMonitors: 0,
    monitorsUp: 0,
    monitorsDown: 0,
    monitorsPaused: 0,
    avgUptime: 0,
    avgResponseTime: 0,
  });

  // Grafana state
  const [dashboards, setDashboards] = useState<GrafanaDashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<GrafanaDashboard | null>(null);
  const [grafanaBaseUrl, setGrafanaBaseUrl] = useState<string>('');

  // Configuration
  const uptimeKumaEnabled = config.getOptionalBoolean('gitops.uptimeKuma.enabled') ?? false;
  const grafanaEnabled = config.getOptionalBoolean('gitops.grafana.enabled') ?? false;

  // Fetch monitoring data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('gitops');

      // Fetch Uptime Kuma data
      if (uptimeKumaEnabled) {
        try {
          const [monitorsRes, statsRes] = await Promise.all([
            fetchApi.fetch(`${baseUrl}/uptime-kuma/monitors`),
            fetchApi.fetch(`${baseUrl}/uptime-kuma/stats`),
          ]);

          if (monitorsRes.ok) {
            const data = await monitorsRes.json();
            setMonitors(data.monitors || []);
          }

          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
        } catch (err) {
          console.warn('Uptime Kuma fetch error:', err);
        }
      }

      // Fetch Grafana dashboards
      if (grafanaEnabled) {
        try {
          const dashRes = await fetchApi.fetch(`${baseUrl}/grafana/dashboards`);
          if (dashRes.ok) {
            const dashData = await dashRes.json();
            setDashboards(dashData.dashboards || []);
            
            // Auto-select first dashboard
            if (dashData.dashboards?.length > 0 && !selectedDashboard) {
              setSelectedDashboard(dashData.dashboards[0]);
            }
          }
        } catch (err) {
          console.warn('Grafana fetch error:', err);
        }
      }

      // Get Grafana base URL
      const grafanaUrl = config.getOptionalString('gitops.grafana.url');
      if (grafanaUrl) {
        setGrafanaBaseUrl(grafanaUrl);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [discoveryApi, fetchApi, uptimeKumaEnabled, grafanaEnabled, selectedDashboard, config]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up': return <CheckCircleIcon style={{ color: '#00b12b' }} />;
      case 'down': return <ErrorIcon style={{ color: '#d32f2f' }} />;
      case 'pending': return <HourglassEmptyIcon style={{ color: '#ff9800' }} />;
      case 'paused': return <PauseIcon style={{ color: '#9e9e9e' }} />;
      default: return <HourglassEmptyIcon style={{ color: '#9e9e9e' }} />;
    }
  };

  const getMonitorCardClass = (status: string) => {
    switch (status) {
      case 'up': return classes.monitorCardUp;
      case 'down': return classes.monitorCardDown;
      case 'pending': return classes.monitorCardPending;
      case 'paused': return classes.monitorCardPaused;
      default: return '';
    }
  };

  const getMonitorTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'http':
      case 'https': return <HttpIcon />;
      case 'dns': return <DnsIcon />;
      case 'tcp':
      case 'port': return <StorageIcon />;
      case 'ping': return <CloudQueueIcon />;
      default: return <VisibilityIcon />;
    }
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderUptimeBar = (history?: { status: number; time: string }[]) => {
    // Generate last 30 data points (or use actual history)
    const points = history?.slice(-30) || Array(30).fill({ status: 1 });
    
    return (
      <div className={classes.uptimeBar}>
        {points.map((point, index) => (
          <Tooltip
            key={index}
            title={point.time ? new Date(point.time).toLocaleString() : `Point ${index + 1}`}
          >
            <div
              className={classes.uptimeSegment}
              style={{
                backgroundColor: point.status === 1 ? '#00b12b' : '#d32f2f',
              }}
            />
          </Tooltip>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Monitoring" subtitle="Infrastructure health and performance" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title="Monitoring Dashboard"
        subtitle="Real-time infrastructure health, uptime, and metrics"
      >
        <div className={classes.headerActions}>
          <Tooltip title="Refresh data">
            <IconButton onClick={() => fetchData(true)} disabled={refreshing}>
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          {grafanaBaseUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open(grafanaBaseUrl, '_blank')}
            >
              Open Grafana
            </Button>
          )}
        </div>
      </Header>
      <Content>
        {error && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} className={classes.summaryGrid}>
          <Grid item xs={6} sm={3}>
            <Paper className={`${classes.summaryCard} ${classes.summaryCardHealthy}`}>
              <CheckCircleIcon className={classes.summaryIcon} />
              <Typography className={classes.summaryValue}>
                {stats.monitorsUp || monitors.filter(m => m.status === 'up').length}
              </Typography>
              <Typography variant="body2" className={classes.summaryLabel}>
                Services Up
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper className={`${classes.summaryCard} ${classes.summaryCardError}`}>
              <ErrorIcon className={classes.summaryIcon} />
              <Typography className={classes.summaryValue}>
                {stats.monitorsDown || monitors.filter(m => m.status === 'down').length}
              </Typography>
              <Typography variant="body2" className={classes.summaryLabel}>
                Services Down
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper className={`${classes.summaryCard} ${classes.summaryCardInfo}`}>
              <TrendingUpIcon className={classes.summaryIcon} />
              <Typography className={classes.summaryValue}>
                {stats.avgUptime?.toFixed(1) || '99.9'}%
              </Typography>
              <Typography variant="body2" className={classes.summaryLabel}>
                Avg Uptime
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper className={`${classes.summaryCard} ${classes.summaryCardWarning}`}>
              <SpeedIcon className={classes.summaryIcon} />
              <Typography className={classes.summaryValue}>
                {formatResponseTime(stats.avgResponseTime || 150)}
              </Typography>
              <Typography variant="body2" className={classes.summaryLabel}>
                Avg Response
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper className={classes.tabsContainer}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab icon={<VisibilityIcon />} label="Uptime Monitors" />
            <Tab icon={<TimelineIcon />} label="Grafana Dashboards" />
            <Tab icon={<NotificationsIcon />} label="Alerts" />
          </Tabs>
        </Paper>

        {/* Uptime Monitors Tab */}
        {activeTab === 0 && (
          <div className={classes.tabPanel}>
            {!uptimeKumaEnabled ? (
              <Paper className={classes.emptyState}>
                <VisibilityIcon className={classes.emptyStateIcon} />
                <Typography variant="h6">Uptime Kuma Not Configured</Typography>
                <Typography variant="body2">
                  Enable Uptime Kuma in app-config.yaml to monitor service uptime
                </Typography>
              </Paper>
            ) : monitors.length === 0 ? (
              <Paper className={classes.emptyState}>
                <VisibilityIcon className={classes.emptyStateIcon} />
                <Typography variant="h6">No Monitors Found</Typography>
                <Typography variant="body2">
                  Add monitors in Uptime Kuma to track service health
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {monitors.map((monitor) => (
                  <Grid item xs={12} sm={6} lg={4} key={monitor.id}>
                    <Card className={`${classes.monitorCard} ${getMonitorCardClass(monitor.status)}`}>
                      <div className={classes.monitorHeader}>
                        <div className={classes.monitorName}>
                          {getMonitorTypeIcon(monitor.type)}
                          <Typography variant="subtitle1">{monitor.name}</Typography>
                        </div>
                        <div className={classes.monitorStatus}>
                          {getStatusIcon(monitor.status)}
                          <Chip
                            size="small"
                            label={monitor.status.toUpperCase()}
                            style={{
                              backgroundColor: monitor.status === 'up' ? '#00b12b20' :
                                             monitor.status === 'down' ? '#d32f2f20' : '#9e9e9e20',
                              color: monitor.status === 'up' ? '#00b12b' :
                                    monitor.status === 'down' ? '#d32f2f' : '#9e9e9e',
                            }}
                          />
                        </div>
                      </div>
                      <div className={classes.monitorContent}>
                        <Typography variant="body2" color="textSecondary" noWrap>
                          {monitor.url || monitor.hostname || `Port ${monitor.port}`}
                        </Typography>
                        
                        {renderUptimeBar(monitor.history)}
                        
                        <div className={classes.monitorStats}>
                          <div className={classes.monitorStat}>
                            <Typography className={classes.monitorStatValue}>
                              {monitor.uptime?.toFixed(2) || '99.9'}%
                            </Typography>
                            <Typography className={classes.monitorStatLabel}>Uptime</Typography>
                          </div>
                          <div className={classes.monitorStat}>
                            <Typography className={classes.monitorStatValue}>
                              {formatResponseTime(monitor.responseTime || 0)}
                            </Typography>
                            <Typography className={classes.monitorStatLabel}>Response</Typography>
                          </div>
                          <div className={classes.monitorStat}>
                            <Typography className={classes.monitorStatValue} style={{ fontSize: '0.9rem' }}>
                              {monitor.lastCheck ? new Date(monitor.lastCheck).toLocaleTimeString() : 'N/A'}
                            </Typography>
                            <Typography className={classes.monitorStatLabel}>Last Check</Typography>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </div>
        )}

        {/* Grafana Dashboards Tab */}
        {activeTab === 1 && (
          <div className={classes.tabPanel}>
            {!grafanaEnabled ? (
              <Paper className={classes.emptyState}>
                <TimelineIcon className={classes.emptyStateIcon} />
                <Typography variant="h6">Grafana Not Configured</Typography>
                <Typography variant="body2">
                  Enable Grafana in app-config.yaml to view metrics dashboards
                </Typography>
              </Paper>
            ) : dashboards.length === 0 ? (
              <Paper className={classes.emptyState}>
                <TimelineIcon className={classes.emptyStateIcon} />
                <Typography variant="h6">No Dashboards Found</Typography>
                <Typography variant="body2">
                  Create dashboards in Grafana to view them here
                </Typography>
              </Paper>
            ) : (
              <div className={classes.grafanaContainer}>
                {/* Dashboard Selector */}
                <Box className={classes.dashboardSelector}>
                  <FormControl style={{ minWidth: 300 }}>
                    <InputLabel>Select Dashboard</InputLabel>
                    <Select
                      value={selectedDashboard?.uid || ''}
                      onChange={(e) => {
                        const dash = dashboards.find(d => d.uid === e.target.value);
                        setSelectedDashboard(dash || null);
                      }}
                    >
                      {dashboards.map((dash) => (
                        <MenuItem key={dash.uid} value={dash.uid}>
                          {dash.title}
                          {dash.folder && (
                            <Chip
                              size="small"
                              label={dash.folder}
                              style={{ marginLeft: 8 }}
                            />
                          )}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {selectedDashboard && (
                    <Button
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => window.open(selectedDashboard.url, '_blank')}
                    >
                      Open in Grafana
                    </Button>
                  )}
                </Box>

                {/* Dashboard Preview Cards */}
                <Box mb={3}>
                  <Grid container spacing={2}>
                    {dashboards.slice(0, 6).map((dash) => (
                      <Grid item xs={6} sm={4} md={2} key={dash.uid}>
                        <Card
                          className={`${classes.dashboardCard} ${selectedDashboard?.uid === dash.uid ? classes.dashboardCardSelected : ''}`}
                          onClick={() => setSelectedDashboard(dash)}
                        >
                          <CardActionArea>
                            <CardContent>
                              <Typography variant="body2" noWrap>
                                {dash.title}
                              </Typography>
                              <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
                                {dash.tags?.slice(0, 2).map((tag) => (
                                  <Chip key={tag} label={tag} size="small" />
                                ))}
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Embedded Dashboard */}
                {selectedDashboard && (
                  <Paper style={{ borderRadius: 12, overflow: 'hidden' }}>
                    <Box p={2} borderBottom={`1px solid ${theme.palette.divider}`}>
                      <Typography variant="h6">{selectedDashboard.title}</Typography>
                      {selectedDashboard.description && (
                        <Typography variant="body2" color="textSecondary">
                          {selectedDashboard.description}
                        </Typography>
                      )}
                    </Box>
                    <iframe
                      src={`${selectedDashboard.url}?orgId=1&kiosk=tv&theme=${theme.palette.type}`}
                      className={classes.dashboardFrame}
                      title={selectedDashboard.title}
                    />
                  </Paper>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 2 && (
          <div className={classes.tabPanel}>
            <Paper className={classes.emptyState}>
              <NotificationsIcon className={classes.emptyStateIcon} />
              <Typography variant="h6">Alert Management</Typography>
              <Typography variant="body2">
                View and manage alerts from Grafana, Prometheus, and Uptime Kuma
              </Typography>
              <Box mt={2}>
                <Button variant="outlined" disabled>
                  Coming Soon
                </Button>
              </Box>
            </Paper>
          </div>
        )}
      </Content>
    </Page>
  );
};

export default MonitoringPage;
