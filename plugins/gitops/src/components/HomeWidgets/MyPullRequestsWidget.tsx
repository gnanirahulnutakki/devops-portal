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
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import GitHubIcon from '@material-ui/icons/GitHub';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';

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
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPullRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get repositories first
      const reposRes = await fetch(`${backendUrl}/api/gitops/repositories`);
      if (!reposRes.ok) throw new Error('Failed to fetch repositories');
      const reposData = await reposRes.json();
      
      // Fetch PRs from each repository
      const allPRs: PullRequest[] = [];
      
      for (const repo of (reposData.repositories || []).slice(0, 5)) {
        try {
          const prsRes = await fetch(
            `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repo.name)}/pulls?state=open`
          );
          if (prsRes.ok) {
            const prsData = await prsRes.json();
            allPRs.push(...(prsData.pulls || []));
          }
        } catch (err) {
          console.warn(`Failed to fetch PRs for ${repo.name}:`, err);
        }
      }

      // Sort by updated_at and limit
      const sorted = allPRs
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, maxItems);

      setPullRequests(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, maxItems, filter]);

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
      title="My Pull Requests"
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
      {error && (
        <Typography color="error" style={{ padding: 16 }}>
          {error}
        </Typography>
      )}

      {!loading && pullRequests.length === 0 && !error && (
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
