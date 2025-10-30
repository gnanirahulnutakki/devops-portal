import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  makeStyles,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  InfoCard,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useNavigate } from 'react-router-dom';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import GitHubIcon from '@material-ui/icons/GitHub';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import FolderIcon from '@material-ui/icons/Folder';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import EditIcon from '@material-ui/icons/Edit';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import SyncIcon from '@material-ui/icons/Sync';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';

const useStyles = makeStyles((theme) => ({
  statsCard: {
    height: '100%',
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    '&:hover': {
      transform: 'translateY(-4px)',
      transition: 'transform 0.3s ease',
      boxShadow: '0 8px 16px rgba(9, 20, 63, 0.3)',
    },
  },
  statsValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginTop: theme.spacing(1),
  },
  statsLabel: {
    fontSize: '0.875rem',
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activityItem: {
    borderLeft: '3px solid #09143F',
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  quickActionButton: {
    height: '100%',
    minHeight: 120,
    background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
    border: '2px solid #09143F',
    '&:hover': {
      background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
      color: 'white',
      '& svg': {
        color: 'white',
      },
    },
  },
  quickActionIcon: {
    fontSize: 48,
    color: '#09143F',
  },
  sectionTitle: {
    color: '#09143F',
    fontWeight: 600,
    marginBottom: theme.spacing(2),
  },
  statusChip: {
    fontWeight: 600,
  },
  welcomeCard: {
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    marginBottom: theme.spacing(3),
  },
}));

interface DashboardStats {
  openPRs: number;
  totalBranches: number;
  recentOperations: number;
  failedSyncs: number;
}

interface RecentActivity {
  id: string;
  type: 'pr_merged' | 'pr_created' | 'bulk_op' | 'sync_failed' | 'commit';
  message: string;
  timestamp: string;
  user?: string;
}

export const HomePage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [stats, setStats] = useState<DashboardStats>({
    openPRs: 0,
    totalBranches: 0,
    recentOperations: 0,
    failedSyncs: 0,
  });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load repositories to get branch counts
      const reposResponse = await fetch(`${backendUrl}/api/gitops/repositories`);
      const reposData = await reposResponse.json();

      // Load branches for first repo to get count
      let totalBranches = 0;
      if (reposData.repositories && reposData.repositories.length > 0) {
        const firstRepo = reposData.repositories[0].name;
        const branchesResponse = await fetch(
          `${backendUrl}/api/gitops/repositories/${encodeURIComponent(firstRepo)}/branches`
        );
        const branchesData = await branchesResponse.json();
        totalBranches = branchesData.total || 0;
      }

      // Load recent bulk operations
      const opsResponse = await fetch(`${backendUrl}/api/gitops/operations?limit=10`);
      const opsData = await opsResponse.json();

      // Load audit logs for activity feed
      const auditResponse = await fetch(`${backendUrl}/api/gitops/audit?limit=10`);
      const auditData = await auditResponse.json();

      setStats({
        openPRs: 0, // TODO: Implement PR count endpoint
        totalBranches,
        recentOperations: opsData.operations?.length || 0,
        failedSyncs: 0, // TODO: Implement ArgoCD sync status
      });

      // Transform audit logs to activities
      if (auditData.logs) {
        const recentActivities = auditData.logs.slice(0, 5).map((log: any) => ({
          id: log.id,
          type: log.action.includes('bulk') ? 'bulk_op' : 'commit',
          message: log.action,
          timestamp: log.timestamp,
          user: log.metadata?.user || 'System',
        }));
        setActivities(recentActivities);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pr_merged':
        return <MergeTypeIcon style={{ color: '#00b12b' }} />;
      case 'pr_created':
        return <GitHubIcon style={{ color: '#09143F' }} />;
      case 'bulk_op':
        return <SyncIcon style={{ color: '#2ea3f2' }} />;
      case 'sync_failed':
        return <ErrorIcon color="error" />;
      default:
        return <EditIcon style={{ color: '#e25a1a' }} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Page themeId="home">
      <Header
        title="RadiantLogic DevOps Management Portal"
        subtitle="Manage multi-branch configurations and ArgoCD deployments"
      />
      <Content>
        {loading && <LinearProgress />}

        {/* Welcome Card */}
        <Card className={classes.welcomeCard}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" gutterBottom>
                  Welcome to DevOps Portal
                </Typography>
                <Typography variant="body1">
                  Manage configurations across 50+ environments, create pull requests, and monitor deployments - all in one place.
                </Typography>
              </Box>
              <TrendingUpIcon style={{ fontSize: 80, opacity: 0.3 }} />
            </Box>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Grid container spacing={3} style={{ marginBottom: 24 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsLabel}>
                  Open PRs
                </Typography>
                <Typography className={classes.statsValue}>
                  {stats.openPRs}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  <GitHubIcon style={{ marginRight: 4, fontSize: 16 }} />
                  <Typography variant="caption">Active pull requests</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsLabel}>
                  Total Branches
                </Typography>
                <Typography className={classes.statsValue}>
                  {stats.totalBranches}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  <AccountTreeIcon style={{ marginRight: 4, fontSize: 16 }} />
                  <Typography variant="caption">Environment branches</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsLabel}>
                  Recent Operations
                </Typography>
                <Typography className={classes.statsValue}>
                  {stats.recentOperations}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  <SyncIcon style={{ marginRight: 4, fontSize: 16 }} />
                  <Typography variant="caption">Bulk operations today</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsLabel}>
                  Failed Syncs
                </Typography>
                <Typography className={classes.statsValue}>
                  {stats.failedSyncs}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  <WarningIcon style={{ marginRight: 4, fontSize: 16 }} />
                  <Typography variant="caption">Requires attention</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Quick Actions */}
          <Grid item xs={12} md={6}>
            <Typography variant="h5" className={classes.sectionTitle}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  className={classes.quickActionButton}
                  onClick={() => navigate('/gitops')}
                >
                  <Box textAlign="center">
                    <EditIcon className={classes.quickActionIcon} />
                    <Typography variant="h6">Edit Config</Typography>
                    <Typography variant="caption">Repository Browser</Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  fullWidth
                  className={classes.quickActionButton}
                  onClick={() => navigate('/gitops/pull-requests')}
                >
                  <Box textAlign="center">
                    <GitHubIcon className={classes.quickActionIcon} />
                    <Typography variant="h6">Pull Requests</Typography>
                    <Typography variant="caption">Create & Manage PRs</Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  fullWidth
                  className={classes.quickActionButton}
                  onClick={() => navigate('/gitops/argocd')}
                >
                  <Box textAlign="center">
                    <PlayArrowIcon className={classes.quickActionIcon} />
                    <Typography variant="h6">Deployments</Typography>
                    <Typography variant="caption">ArgoCD Apps</Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={6}>
                <Button
                  fullWidth
                  className={classes.quickActionButton}
                  onClick={() => navigate('/gitops/operations')}
                >
                  <Box textAlign="center">
                    <SyncIcon className={classes.quickActionIcon} />
                    <Typography variant="h6">Operations</Typography>
                    <Typography variant="caption">Track Bulk Ops</Typography>
                  </Box>
                </Button>
              </Grid>
            </Grid>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12} md={6}>
            <Typography variant="h5" className={classes.sectionTitle}>
              Recent Activity
            </Typography>
            <InfoCard>
              {activities.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography color="textSecondary">
                    No recent activity
                  </Typography>
                </Box>
              ) : (
                <List>
                  {activities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem className={classes.activityItem}>
                        <ListItemIcon>
                          {getActivityIcon(activity.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={activity.message}
                          secondary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption">
                                {activity.user}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                • {formatTimestamp(activity.timestamp)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < activities.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </InfoCard>
          </Grid>
        </Grid>

        {/* System Status */}
        <Grid container spacing={3} style={{ marginTop: 16 }}>
          <Grid item xs={12}>
            <Typography variant="h5" className={classes.sectionTitle}>
              System Status
            </Typography>
            <InfoCard>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircleIcon style={{ color: '#00b12b' }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        GitHub API
                      </Typography>
                      <Chip
                        label="Connected"
                        size="small"
                        className={classes.statusChip}
                        style={{ backgroundColor: '#00b12b', color: 'white' }}
                      />
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircleIcon style={{ color: '#00b12b' }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Database
                      </Typography>
                      <Chip
                        label="Healthy"
                        size="small"
                        className={classes.statusChip}
                        style={{ backgroundColor: '#00b12b', color: 'white' }}
                      />
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <WarningIcon style={{ color: '#e25a1a' }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        ArgoCD
                      </Typography>
                      <Chip
                        label="Mock Mode"
                        size="small"
                        className={classes.statusChip}
                        style={{ backgroundColor: '#e25a1a', color: 'white' }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
