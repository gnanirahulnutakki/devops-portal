import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Link,
  makeStyles,
  Button,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, githubAuthApiRef } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api/GitOpsApi';
import RefreshIcon from '@material-ui/icons/Refresh';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import GitHubIcon from '@material-ui/icons/GitHub';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import PersonIcon from '@material-ui/icons/Person';

const useStyles = makeStyles((theme) => ({
  listItem: {
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  prTitle: {
    fontWeight: 500,
    color: theme.palette.text.primary,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  prMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  statusChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  openChip: {
    backgroundColor: '#2cbe4e',
    color: 'white',
  },
  draftChip: {
    backgroundColor: '#6a737d',
    color: 'white',
  },
  reviewChip: {
    backgroundColor: '#dbab0a',
    color: 'white',
  },
  mergedChip: {
    backgroundColor: '#6f42c1',
    color: 'white',
  },
  closedChip: {
    backgroundColor: '#cb2431',
    color: 'white',
  },
  checksSuccess: {
    color: '#2cbe4e',
  },
  checksFailed: {
    color: '#cb2431',
  },
  checksPending: {
    color: '#dbab0a',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
}));

interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  user: {
    login: string;
    avatar_url: string;
  };
  base: {
    ref: string;
    repo: {
      name: string;
      full_name: string;
    };
  };
  head: {
    ref: string;
  };
  created_at: string;
  updated_at: string;
  requested_reviewers?: Array<{ login: string }>;
  review_comments?: number;
  mergeable_state?: string;
}

interface MyPullRequestsWidgetProps {
  /** Maximum number of PRs to display */
  maxItems?: number;
  /** Filter: 'created' (PRs I created), 'assigned' (PRs assigned to me), 'review' (PRs I need to review), 'all' */
  filter?: 'created' | 'assigned' | 'review' | 'all';
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
}

export const MyPullRequestsWidget: React.FC<MyPullRequestsWidgetProps> = ({
  maxItems = 5,
  filter = 'all',
  refreshInterval = 120,
}) => {
  const classes = useStyles();
  
  // Use the GitOps API (which handles OAuth token internally)
  const gitOpsApi = useApi(gitOpsApiRef);
  
  // Get GitHub auth API for OAuth token (for sign-in flow)
  let githubAuthApi: any = null;
  try {
    githubAuthApi = useApi(githubAuthApiRef);
  } catch (e) {
    // GitHub auth not available
  }

  const [loading, setLoading] = useState(true);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string; name?: string } | null>(null);

  const fetchPullRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if user is authenticated with GitHub
      const authenticated = await gitOpsApi.isGitHubAuthenticated();
      
      if (!authenticated) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      setIsAuthenticated(true);
      
      // Use the gitOpsApi which handles the OAuth token internally
      try {
        // Fetch user profile
        const userResult = await gitOpsApi.getUserProfile();
        if (userResult.user) {
          setGithubUser(userResult.user);
        }
      } catch (profileErr) {
        console.debug('[MyPullRequestsWidget] Could not fetch user profile:', profileErr);
      }
      
      // Use the user-centric pull requests endpoint
      const prsResult = await gitOpsApi.getUserPullRequests({
        filter: filter as any,
        state: 'open',
        per_page: maxItems,
      });
      
      // Transform the response to match our interface
      const transformedPRs: PullRequest[] = (prsResult.pullRequests || []).map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        state: pr.state,
        draft: pr.draft,
        merged: false,
        user: pr.user,
        base: {
          ref: 'main',
          repo: {
            name: pr.repository?.name || 'unknown',
            full_name: pr.repository?.full_name || 'unknown',
          },
        },
        head: { ref: 'feature' },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        requested_reviewers: [],
        review_comments: pr.comments,
      }));

      setPullRequests(transformedPRs.slice(0, maxItems));
    } catch (err) {
      // Check if it's an auth error
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errMsg.includes('authentication required') || errMsg.includes('not logged in')) {
        setIsAuthenticated(false);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [gitOpsApi, maxItems, filter]);

  // Handle GitHub sign-in
  const handleSignIn = async () => {
    if (githubAuthApi) {
      try {
        // This will trigger the OAuth flow
        await githubAuthApi.getAccessToken(['repo', 'read:org', 'user']);
        // Clear the token cache and refresh
        gitOpsApi.clearTokenCache();
        fetchPullRequests();
      } catch (e) {
        console.error('Failed to sign in with GitHub:', e);
      }
    }
  };

  useEffect(() => {
    fetchPullRequests();
    const interval = setInterval(fetchPullRequests, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchPullRequests, refreshInterval]);

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusChip = (pr: PullRequest) => {
    if (pr.merged) {
      return <Chip label="Merged" size="small" className={`${classes.statusChip} ${classes.mergedChip}`} />;
    }
    if (pr.state === 'closed') {
      return <Chip label="Closed" size="small" className={`${classes.statusChip} ${classes.closedChip}`} />;
    }
    if (pr.draft) {
      return <Chip label="Draft" size="small" className={`${classes.statusChip} ${classes.draftChip}`} />;
    }
    if (pr.requested_reviewers && pr.requested_reviewers.length > 0) {
      return <Chip label="Review" size="small" className={`${classes.statusChip} ${classes.reviewChip}`} />;
    }
    return <Chip label="Open" size="small" className={`${classes.statusChip} ${classes.openChip}`} />;
  };

  const getChecksIcon = (pr: PullRequest) => {
    if (!pr.mergeable_state) return null;
    
    switch (pr.mergeable_state) {
      case 'clean':
        return <CheckCircleIcon className={classes.checksSuccess} style={{ fontSize: 16 }} />;
      case 'unstable':
      case 'blocked':
        return <ErrorIcon className={classes.checksFailed} style={{ fontSize: 16 }} />;
      default:
        return <ScheduleIcon className={classes.checksPending} style={{ fontSize: 16 }} />;
    }
  };

  return (
    <InfoCard
      title={
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <MergeTypeIcon />
          <span>My Pull Requests</span>
          {githubUser && (
            <Chip
              size="small"
              avatar={<Avatar src={githubUser.avatar_url} />}
              label={githubUser.login}
              variant="outlined"
              style={{ marginLeft: 8 }}
            />
          )}
        </Box>
      }
      action={
        <Box display="flex" alignItems="center">
          {loading && <LinearProgress style={{ width: 60, marginRight: 8 }} />}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchPullRequests}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      {/* Show sign-in prompt if not authenticated */}
      {isAuthenticated === false && (
        <Box className={classes.emptyState}>
          <PersonIcon style={{ fontSize: 48, color: '#ccc', marginBottom: 8 }} />
          <Typography color="textSecondary" gutterBottom>
            Sign in with GitHub to see your pull requests
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GitHubIcon />}
            onClick={handleSignIn}
            style={{ marginTop: 8 }}
          >
            Sign in with GitHub
          </Button>
        </Box>
      )}

      {error && isAuthenticated !== false && (
        <Typography color="error" style={{ padding: 16 }}>
          {error}
        </Typography>
      )}

      {!loading && pullRequests.length === 0 && !error && isAuthenticated && (
        <Box className={classes.emptyState}>
          <MergeTypeIcon style={{ fontSize: 48, color: '#ccc', marginBottom: 8 }} />
          <Typography color="textSecondary">
            No open pull requests
          </Typography>
        </Box>
      )}

      <List dense>
        {pullRequests.map((pr) => (
          <ListItem key={pr.id} className={classes.listItem}>
            <ListItemAvatar>
              <Avatar src={pr.user.avatar_url} alt={pr.user.login}>
                <GitHubIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Link
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes.prTitle}
                >
                  {pr.title}
                </Link>
              }
              secondary={
                <Box className={classes.prMeta}>
                  <Typography variant="caption" color="textSecondary">
                    #{pr.number} • {pr.base.repo.name}
                  </Typography>
                  {getStatusChip(pr)}
                  {getChecksIcon(pr)}
                  <Typography variant="caption" color="textSecondary">
                    {formatTimeAgo(pr.updated_at)}
                  </Typography>
                </Box>
              }
            />
            <Tooltip title="Open in GitHub">
              <IconButton
                size="small"
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    </InfoCard>
  );
};

export default MyPullRequestsWidget;
