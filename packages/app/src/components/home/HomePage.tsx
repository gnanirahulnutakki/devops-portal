/**
 * HomePage - Spotify-Inspired Enterprise Dashboard
 *
 * A modern, personalized dashboard featuring:
 * - User profile with GitHub integration
 * - My Pull Requests (across all repos)
 * - My Services (ArgoCD applications)
 * - Recent Repositories
 * - Quick Actions
 * - System Health Overview
 * - Grafana/Uptime Kuma Integration
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  InputBase,
  Fade,
  Grow,
  Skeleton,
  Badge,
  useTheme,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusPending,
} from '@backstage/core-components';
import { useApi, configApiRef, identityApiRef, githubAuthApiRef } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '@internal/plugin-gitops';
import { useNavigate } from 'react-router-dom';

// Icons
import GitHubIcon from '@material-ui/icons/GitHub';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import FolderIcon from '@material-ui/icons/Folder';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import SyncIcon from '@material-ui/icons/Sync';
import RefreshIcon from '@material-ui/icons/Refresh';
import DashboardIcon from '@material-ui/icons/Dashboard';
import TimelineIcon from '@material-ui/icons/Timeline';
import CloudIcon from '@material-ui/icons/Cloud';
import SearchIcon from '@material-ui/icons/Search';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ScheduleIcon from '@material-ui/icons/Schedule';
import AssignmentIcon from '@material-ui/icons/Assignment';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import StarIcon from '@material-ui/icons/Star';
import CodeIcon from '@material-ui/icons/Code';
import StorageIcon from '@material-ui/icons/Storage';
import SettingsIcon from '@material-ui/icons/Settings';
import NotificationsActiveIcon from '@material-ui/icons/NotificationsActive';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import GroupIcon from '@material-ui/icons/Group';
import EqualizerIcon from '@material-ui/icons/Equalizer';
import SpeedIcon from '@material-ui/icons/Speed';
import WifiIcon from '@material-ui/icons/Wifi';
import SecurityIcon from '@material-ui/icons/Security';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  // Hero Section with search
  heroSection: {
    background: 'linear-gradient(135deg, #09143F 0%, #1a3a7a 50%, #2ea3f2 100%)',
    borderRadius: 16,
    padding: theme.spacing(4),
    marginBottom: theme.spacing(4),
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      width: '40%',
      height: '100%',
      background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      opacity: 0.5,
    },
  },
  heroContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    position: 'relative',
    zIndex: 1,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  avatar: {
    width: 72,
    height: 72,
    border: '3px solid rgba(255,255,255,0.3)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  greeting: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: theme.spacing(0.5),
  },
  subtitle: {
    opacity: 0.9,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  // Search Bar
  searchContainer: {
    flex: '0 0 auto',
    maxWidth: 400,
    width: '100%',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: theme.spacing(1, 2),
    transition: 'all 0.3s ease',
    '&:hover, &:focus-within': {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
  },
  searchInput: {
    flex: 1,
    color: 'white',
    '&::placeholder': {
      color: 'rgba(255,255,255,0.7)',
    },
  },
  searchIcon: {
    color: 'rgba(255,255,255,0.7)',
    marginRight: theme.spacing(1),
  },
  // Section Styles
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
  },
  viewAllLink: {
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    color: theme.palette.primary.main,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  // Cards
  prCard: {
    borderRadius: 12,
    transition: 'all 0.2s ease',
    border: `1px solid ${theme.palette.divider}`,
    height: '100%',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      borderColor: theme.palette.primary.main,
    },
  },
  prCardContent: {
    padding: theme.spacing(2),
  },
  prTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  prMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    marginTop: theme.spacing(1),
  },
  prRepo: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    marginBottom: theme.spacing(0.5),
  },
  prLabels: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: theme.spacing(1),
  },
  labelChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  // Service Cards (ArgoCD apps)
  serviceCard: {
    borderRadius: 12,
    padding: theme.spacing(2),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s ease',
    border: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    },
  },
  serviceCardHealthy: {
    borderLeft: '4px solid #00b12b',
  },
  serviceCardWarning: {
    borderLeft: '4px solid #ff9800',
  },
  serviceCardError: {
    borderLeft: '4px solid #d32f2f',
  },
  serviceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  serviceName: {
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  serviceNamespace: {
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
  },
  // Quick Actions Grid
  quickActionCard: {
    borderRadius: 12,
    padding: theme.spacing(2.5),
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: `2px solid ${theme.palette.divider}`,
    '&:hover': {
      borderColor: theme.palette.primary.main,
      background: `linear-gradient(135deg, ${theme.palette.primary.main}10 0%, ${theme.palette.primary.main}05 100%)`,
      transform: 'translateY(-4px)',
      '& $quickActionIcon': {
        color: theme.palette.primary.main,
        transform: 'scale(1.1)',
      },
    },
  },
  quickActionIcon: {
    fontSize: 40,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
    transition: 'all 0.3s ease',
  },
  quickActionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  quickActionDesc: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  // Stats Cards
  statsCard: {
    borderRadius: 12,
    padding: theme.spacing(2.5),
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
  },
  statsValue: {
    fontSize: '2rem',
    fontWeight: 700,
  },
  statsLabel: {
    opacity: 0.9,
    marginTop: theme.spacing(0.5),
  },
  statsIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 48,
    opacity: 0.2,
  },
  // Repo Cards
  repoCard: {
    borderRadius: 12,
    padding: theme.spacing(2),
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      borderColor: theme.palette.primary.main,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
  },
  repoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  repoName: {
    fontWeight: 600,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  repoDescription: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': 2,
    '-webkit-box-orient': 'vertical',
    minHeight: 32,
  },
  repoStats: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  repoStat: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  // Health Grid
  healthCard: {
    borderRadius: 12,
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  healthInfo: {
    flex: 1,
  },
  healthStatus: {
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  healthLatency: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  // Monitoring Section
  monitoringCard: {
    borderRadius: 12,
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
  monitoringHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1.5),
  },
  // Loading Skeleton
  skeleton: {
    borderRadius: 8,
  },
  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  emptyStateIcon: {
    fontSize: 48,
    opacity: 0.5,
    marginBottom: theme.spacing(1),
  },
}));

// Types
interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  repository: { name: string; full_name: string; html_url: string };
  labels: { name: string; color?: string }[];
  created_at: string;
  updated_at: string;
  draft: boolean;
  comments: number;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  html_url: string;
  updated_at: string;
  pushed_at: string;
}

interface Service {
  name: string;
  namespace: string;
  health: 'Healthy' | 'Degraded' | 'Progressing' | 'Unknown';
  syncStatus: string;
  revision?: string;
}

interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency?: number;
}

interface UserProfile {
  login: string;
  name?: string;
  avatar_url: string;
  email?: string;
}

export const HomePage = () => {
  const classes = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const config = useApi(configApiRef);
  const identityApi = useApi(identityApiRef);
  
  // Use gitOpsApi for user-centric data (handles OAuth token internally)
  const gitOpsApi = useApi(gitOpsApiRef);
  
  // Get GitHub auth API for sign-in flow
  let githubAuthApi: any = null;
  try {
    githubAuthApi = useApi(githubAuthApiRef);
  } catch (e) {
    // GitHub auth not available
  }

  const backendUrl = config.getString('backend.baseUrl');

  // State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([]);
  const [stats, setStats] = useState({
    openPRs: 0,
    deployments: { healthy: 0, total: 0 },
    repos: 0,
    orgs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGitHubAuthenticated, setIsGitHubAuthenticated] = useState(false);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      // Check if user is authenticated with GitHub
      const authenticated = await gitOpsApi.isGitHubAuthenticated();
      setIsGitHubAuthenticated(authenticated);

      // Fetch data in parallel
      const results = await Promise.allSettled([
        authenticated ? gitOpsApi.getUserDashboard() : Promise.reject('Not authenticated'),
        fetch(`${backendUrl}/api/gitops/health?detailed=true`),
        gitOpsApi.listArgoCDApplications(),
      ]);

      // Process dashboard data from gitOpsApi (includes OAuth token)
      if (results[0].status === 'fulfilled') {
        const data = results[0].value;
        setUserProfile(data.user);
        setPullRequests(data.openPullRequests || []);
        setRepositories(data.repositories || []);
        setStats(prev => ({
          ...prev,
          openPRs: (data.openPullRequests || []).length,
          repos: (data.repositories || []).length,
        }));
      }

      // Process health data
      if (results[1].status === 'fulfilled') {
        const healthRes = results[1].value;
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          const healthItems: SystemHealth[] = [
            { service: 'GitHub API', status: healthData.services?.github?.status || 'unknown', latency: healthData.services?.github?.latency },
            { service: 'PostgreSQL', status: healthData.services?.database?.status || 'unknown', latency: healthData.services?.database?.latency },
            { service: 'ArgoCD', status: healthData.services?.argocd?.status || 'unknown', latency: healthData.services?.argocd?.latency },
            { service: 'Grafana', status: healthData.services?.grafana?.status || 'unknown', latency: healthData.services?.grafana?.latency },
          ];
          setSystemHealth(healthItems);
        }
      }

      // Process ArgoCD applications
      if (results[2].status === 'fulfilled') {
        const argoData = results[2].value;
        if (argoData.applications) {
          const mappedServices = argoData.applications.slice(0, 8).map((app: any) => ({
            name: app.metadata?.name || app.name,
            namespace: app.metadata?.namespace || app.spec?.destination?.namespace,
            health: app.status?.health?.status || 'Unknown',
            syncStatus: app.status?.sync?.status || 'Unknown',
            revision: app.status?.sync?.revision,
          }));
          setServices(mappedServices);
          
          const healthy = argoData.applications.filter((a: any) => 
            a.status?.health?.status === 'Healthy'
          ).length;
          setStats(prev => ({
            ...prev,
            deployments: { healthy, total: argoData.applications.length },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [gitOpsApi, backendUrl]);
  
  // Handle GitHub sign-in from dashboard
  const handleGitHubSignIn = async () => {
    if (githubAuthApi) {
      try {
        await githubAuthApi.getAccessToken(['repo', 'read:org', 'user']);
        gitOpsApi.clearTokenCache();
        loadDashboardData();
      } catch (e) {
        console.error('Failed to sign in with GitHub:', e);
      }
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Refresh every 2 minutes
    const interval = setInterval(loadDashboardData, 120000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <StatusOK />;
      case 'degraded': return <StatusWarning />;
      case 'down': return <StatusError />;
      default: return <StatusPending />;
    }
  };

  const getServiceHealthClass = (health: string) => {
    switch (health) {
      case 'Healthy': return classes.serviceCardHealthy;
      case 'Degraded': return classes.serviceCardWarning;
      case 'Progressing': return classes.serviceCardWarning;
      default: return classes.serviceCardError;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Quick Actions
  const quickActions = [
    { title: 'Repositories', desc: 'Browse & edit code', icon: FolderIcon, path: '/gitops' },
    { title: 'Pull Requests', desc: 'Review & merge', icon: MergeTypeIcon, path: '/gitops/pull-requests' },
    { title: 'Deployments', desc: 'ArgoCD apps', icon: CloudIcon, path: '/gitops/argocd' },
    { title: 'Metrics', desc: 'Grafana dashboards', icon: TimelineIcon, path: '/grafana' },
    { title: 'CI/CD', desc: 'GitHub Actions', icon: PlayArrowIcon, path: '/github-actions' },
    { title: 'Catalog', desc: 'Service catalog', icon: StorageIcon, path: '/catalog' },
  ];

  return (
    <Page themeId="home">
      <Content>
        {/* Hero Section */}
        <Box className={classes.heroSection}>
          <div className={classes.heroContent}>
            <div className={classes.userInfo}>
              <Avatar
                src={userProfile?.avatar_url}
                className={classes.avatar}
              >
                {userProfile?.login?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <div>
                <Typography className={classes.greeting}>
                  {getGreeting()}, {userProfile?.name || userProfile?.login || 'Developer'}!
                </Typography>
                <Typography variant="body1" className={classes.subtitle}>
                  <GitHubIcon style={{ fontSize: 18 }} />
                  {userProfile?.login || 'Not connected'}
                  {stats.openPRs > 0 && (
                    <Chip
                      size="small"
                      label={`${stats.openPRs} open PRs`}
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', marginLeft: 8 }}
                    />
                  )}
                </Typography>
              </div>
            </div>

            <form onSubmit={handleSearch} className={classes.searchContainer}>
              <Paper className={classes.searchBox} elevation={0}>
                <SearchIcon className={classes.searchIcon} />
                <InputBase
                  placeholder="Search repositories, services, docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={classes.searchInput}
                  fullWidth
                />
              </Paper>
            </form>
          </div>
        </Box>

        {/* Stats Overview */}
        <Grid container spacing={3} style={{ marginBottom: 32 }}>
          <Grid item xs={6} sm={3}>
            <Grow in timeout={200}>
              <Paper className={classes.statsCard}>
                <MergeTypeIcon className={classes.statsIcon} />
                <Typography className={classes.statsValue}>{stats.openPRs}</Typography>
                <Typography variant="body2" className={classes.statsLabel}>Open Pull Requests</Typography>
              </Paper>
            </Grow>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Grow in timeout={400}>
              <Paper className={classes.statsCard} style={{ background: 'linear-gradient(135deg, #00b12b 0%, #4caf50 100%)' }}>
                <CloudIcon className={classes.statsIcon} />
                <Typography className={classes.statsValue}>
                  {stats.deployments.healthy}/{stats.deployments.total}
                </Typography>
                <Typography variant="body2" className={classes.statsLabel}>Healthy Deployments</Typography>
              </Paper>
            </Grow>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Grow in timeout={600}>
              <Paper className={classes.statsCard} style={{ background: 'linear-gradient(135deg, #ff9800 0%, #ffc107 100%)' }}>
                <FolderIcon className={classes.statsIcon} />
                <Typography className={classes.statsValue}>{stats.repos}</Typography>
                <Typography variant="body2" className={classes.statsLabel}>Repositories</Typography>
              </Paper>
            </Grow>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Grow in timeout={800}>
              <Paper className={classes.statsCard} style={{ background: 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)' }}>
                <GroupIcon className={classes.statsIcon} />
                <Typography className={classes.statsValue}>{stats.orgs}</Typography>
                <Typography variant="body2" className={classes.statsLabel}>Organizations</Typography>
              </Paper>
            </Grow>
          </Grid>
        </Grid>

        <Grid container spacing={4}>
          {/* My Pull Requests */}
          <Grid item xs={12} md={8}>
            <div className={classes.sectionTitle}>
              <Box display="flex" alignItems="center">
                <MergeTypeIcon className={classes.sectionIcon} />
                <Typography variant="h6">My Pull Requests</Typography>
              </Box>
              <Typography
                variant="body2"
                className={classes.viewAllLink}
                onClick={() => navigate('/gitops/pull-requests')}
              >
                View all <ArrowForwardIcon style={{ fontSize: 16 }} />
              </Typography>
            </div>

            {loading ? (
              <Grid container spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Grid item xs={12} sm={6} lg={4} key={i}>
                    <Skeleton variant="rect" height={140} className={classes.skeleton} />
                  </Grid>
                ))}
              </Grid>
            ) : pullRequests.length === 0 ? (
              <Paper className={classes.emptyState}>
                <MergeTypeIcon className={classes.emptyStateIcon} />
                <Typography>No open pull requests</Typography>
                <Typography variant="body2">Your PRs will appear here</Typography>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {pullRequests.slice(0, 6).map((pr, index) => (
                  <Grid item xs={12} sm={6} lg={4} key={pr.id}>
                    <Grow in timeout={200 + index * 100}>
                      <Card
                        className={classes.prCard}
                        onClick={() => window.open(pr.html_url, '_blank')}
                      >
                        <CardActionArea>
                          <CardContent className={classes.prCardContent}>
                            <Typography className={classes.prRepo}>
                              <FolderIcon style={{ fontSize: 14 }} />
                              {pr.repository.name}
                            </Typography>
                            <Typography className={classes.prTitle} title={pr.title}>
                              {pr.title}
                            </Typography>
                            <div className={classes.prLabels}>
                              {pr.draft && (
                                <Chip label="Draft" size="small" className={classes.labelChip} />
                              )}
                              {pr.labels?.slice(0, 2).map((label) => (
                                <Chip
                                  key={label.name}
                                  label={label.name}
                                  size="small"
                                  className={classes.labelChip}
                                  style={{
                                    backgroundColor: label.color ? `#${label.color}20` : undefined,
                                    color: label.color ? `#${label.color}` : undefined,
                                  }}
                                />
                              ))}
                            </div>
                            <div className={classes.prMeta}>
                              <span>#{pr.number}</span>
                              <span>•</span>
                              <AccessTimeIcon style={{ fontSize: 14 }} />
                              <span>{formatTimeAgo(pr.updated_at)}</span>
                              {pr.comments > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{pr.comments} comments</span>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grow>
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <div className={classes.sectionTitle}>
              <Box display="flex" alignItems="center">
                <SpeedIcon className={classes.sectionIcon} />
                <Typography variant="h6">Quick Actions</Typography>
              </Box>
            </div>

            <Grid container spacing={2}>
              {quickActions.map((action, index) => (
                <Grid item xs={6} key={action.title}>
                  <Grow in timeout={200 + index * 100}>
                    <Paper
                      className={classes.quickActionCard}
                      onClick={() => navigate(action.path)}
                    >
                      <action.icon className={classes.quickActionIcon} />
                      <Typography className={classes.quickActionTitle}>
                        {action.title}
                      </Typography>
                      <Typography className={classes.quickActionDesc}>
                        {action.desc}
                      </Typography>
                    </Paper>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* My Services */}
          <Grid item xs={12} md={6}>
            <div className={classes.sectionTitle}>
              <Box display="flex" alignItems="center">
                <CloudIcon className={classes.sectionIcon} />
                <Typography variant="h6">My Services</Typography>
              </Box>
              <Typography
                variant="body2"
                className={classes.viewAllLink}
                onClick={() => navigate('/gitops/argocd')}
              >
                View all <ArrowForwardIcon style={{ fontSize: 16 }} />
              </Typography>
            </div>

            {loading ? (
              <Grid container spacing={2}>
                {[1, 2, 3, 4].map((i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Skeleton variant="rect" height={80} className={classes.skeleton} />
                  </Grid>
                ))}
              </Grid>
            ) : services.length === 0 ? (
              <Paper className={classes.emptyState}>
                <CloudIcon className={classes.emptyStateIcon} />
                <Typography>No services found</Typography>
                <Typography variant="body2">ArgoCD applications will appear here</Typography>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {services.map((service, index) => (
                  <Grid item xs={12} sm={6} key={service.name}>
                    <Grow in timeout={200 + index * 100}>
                      <Paper className={`${classes.serviceCard} ${getServiceHealthClass(service.health)}`}>
                        <div className={classes.serviceHeader}>
                          <Typography className={classes.serviceName}>
                            <CloudIcon style={{ fontSize: 18 }} />
                            {service.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={service.syncStatus}
                            style={{
                              backgroundColor: service.syncStatus === 'Synced' ? '#00b12b20' : '#ff980020',
                              color: service.syncStatus === 'Synced' ? '#00b12b' : '#ff9800',
                            }}
                          />
                        </div>
                        <Typography className={classes.serviceNamespace}>
                          {service.namespace}
                        </Typography>
                      </Paper>
                    </Grow>
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>

          {/* Recent Repositories */}
          <Grid item xs={12} md={6}>
            <div className={classes.sectionTitle}>
              <Box display="flex" alignItems="center">
                <FolderIcon className={classes.sectionIcon} />
                <Typography variant="h6">Recent Repositories</Typography>
              </Box>
              <Typography
                variant="body2"
                className={classes.viewAllLink}
                onClick={() => navigate('/gitops')}
              >
                View all <ArrowForwardIcon style={{ fontSize: 16 }} />
              </Typography>
            </div>

            {loading ? (
              <Grid container spacing={2}>
                {[1, 2, 3, 4].map((i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Skeleton variant="rect" height={100} className={classes.skeleton} />
                  </Grid>
                ))}
              </Grid>
            ) : repositories.length === 0 ? (
              <Paper className={classes.emptyState}>
                <FolderIcon className={classes.emptyStateIcon} />
                <Typography>No repositories</Typography>
                <Typography variant="body2">Connect your GitHub account to see repos</Typography>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {repositories.slice(0, 4).map((repo, index) => (
                  <Grid item xs={12} sm={6} key={repo.id}>
                    <Grow in timeout={200 + index * 100}>
                      <Paper
                        className={classes.repoCard}
                        onClick={() => window.open(repo.html_url, '_blank')}
                      >
                        <div className={classes.repoHeader}>
                          <FolderIcon color="action" style={{ fontSize: 20 }} />
                          <Typography className={classes.repoName}>{repo.name}</Typography>
                          <OpenInNewIcon style={{ fontSize: 16, opacity: 0.5 }} />
                        </div>
                        <Typography className={classes.repoDescription}>
                          {repo.description || 'No description'}
                        </Typography>
                        <div className={classes.repoStats}>
                          {repo.language && (
                            <span className={classes.repoStat}>
                              <CodeIcon style={{ fontSize: 14 }} />
                              {repo.language}
                            </span>
                          )}
                          <span className={classes.repoStat}>
                            <StarIcon style={{ fontSize: 14 }} />
                            {repo.stargazers_count}
                          </span>
                          <span className={classes.repoStat}>
                            <AccountTreeIcon style={{ fontSize: 14 }} />
                            {repo.forks_count}
                          </span>
                        </div>
                      </Paper>
                    </Grow>
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>

          {/* System Health */}
          <Grid item xs={12}>
            <div className={classes.sectionTitle}>
              <Box display="flex" alignItems="center">
                <SecurityIcon className={classes.sectionIcon} />
                <Typography variant="h6">System Health</Typography>
              </Box>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={loadDashboardData}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </div>

            <Grid container spacing={2}>
              {systemHealth.map((health, index) => (
                <Grid item xs={6} sm={3} key={health.service}>
                  <Grow in timeout={200 + index * 100}>
                    <Paper className={classes.healthCard}>
                      {getHealthIcon(health.status)}
                      <div className={classes.healthInfo}>
                        <Typography className={classes.healthStatus}>
                          {health.service}
                        </Typography>
                        <Typography className={classes.healthLatency}>
                          {health.latency ? `${health.latency}ms` : health.status}
                        </Typography>
                      </div>
                    </Paper>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

export default HomePage;
