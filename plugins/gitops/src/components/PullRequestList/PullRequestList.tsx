import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  makeStyles,
  Divider,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import GitPullRequestIcon from '@material-ui/icons/CallMerge';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  filterControl: {
    minWidth: 150,
  },
  prListItem: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    padding: theme.spacing(2),
  },
  prHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  prTitle: {
    fontWeight: 500,
    color: theme.palette.primary.main,
  },
  prMeta: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
  },
}));

interface PullRequestListProps {
  repository: string;
  onPullRequestClick?: (prNumber: number) => void;
}

export const PullRequestList: React.FC<PullRequestListProps> = ({
  repository,
  onPullRequestClick,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [pulls, setPulls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');

  useEffect(() => {
    loadPullRequests();
  }, [repository, state]);

  const loadPullRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ state });
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to load pull requests');
      }

      const data = await response.json();
      setPulls(data.pulls || []);
    } catch (err: any) {
      console.error('Error loading pull requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePullRequestClick = (prNumber: number) => {
    if (onPullRequestClick) {
      onPullRequestClick(prNumber);
    }
  };

  const getStateChip = (pr: any) => {
    if (pr.state === 'closed' && pr.merged) {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Merged"
          size="small"
          style={{ backgroundColor: '#09143F', color: 'white' }}
        />
      );
    } else if (pr.state === 'closed') {
      return <Chip label="Closed" size="small" color="secondary" />;
    } else {
      return (
        <Chip
          icon={<GitPullRequestIcon />}
          label="Open"
          size="small"
          style={{ backgroundColor: '#28a745', color: 'white' }}
        />
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Card>
      <CardContent>
        <Box className={classes.header}>
          <Typography variant="h6">Pull Requests</Typography>
          <FormControl className={classes.filterControl} size="small">
            <InputLabel>State</InputLabel>
            <Select
              value={state}
              onChange={(e) => setState(e.target.value as 'open' | 'closed' | 'all')}
              label="State"
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        ) : pulls.length === 0 ? (
          <Box className={classes.emptyState}>
            <GitPullRequestIcon style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
            <Typography variant="h6" color="textSecondary">
              No {state !== 'all' ? state : ''} pull requests
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {state === 'open'
                ? 'Create a pull request to propose changes to this repository'
                : 'Pull requests help you collaborate on code changes'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {pulls.map((pr, index) => (
              <React.Fragment key={pr.number}>
                {index > 0 && <Divider />}
                <ListItem
                  className={classes.prListItem}
                  onClick={() => handlePullRequestClick(pr.number)}
                >
                  <ListItemText
                    primary={
                      <Box className={classes.prHeader}>
                        {getStateChip(pr)}
                        <Typography className={classes.prTitle}>
                          {pr.title}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          #{pr.number}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box className={classes.prMeta}>
                        <Box className={classes.metaItem}>
                          <Avatar
                            src={pr.user?.avatar_url}
                            alt={pr.user?.login}
                            style={{ width: 20, height: 20 }}
                          />
                          <Typography variant="body2">
                            {pr.user?.login}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {pr.head?.ref} → {pr.base?.ref}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {formatDate(pr.created_at)}
                        </Typography>
                        {pr.comments > 0 && (
                          <Chip
                            label={`${pr.comments} comments`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={`+${pr.additions} -${pr.deletions}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
