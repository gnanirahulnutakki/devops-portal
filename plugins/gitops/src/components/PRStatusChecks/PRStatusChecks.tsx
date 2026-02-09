import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  LinearProgress,
  makeStyles,
  Collapse,
  IconButton,
  Link,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import ErrorIcon from '@material-ui/icons/Error';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  statusItem: {
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  statusIcon: {
    minWidth: 40,
  },
  statusSuccess: {
    color: theme.palette.success.main,
  },
  statusFailure: {
    color: theme.palette.error.main,
  },
  statusPending: {
    color: theme.palette.warning.main,
  },
  statusRunning: {
    color: theme.palette.info.main,
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  overallStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  statusSummary: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  detailsButton: {
    marginLeft: 'auto',
  },
  checkDetails: {
    marginLeft: theme.spacing(7),
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
  externalLink: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

interface StatusCheck {
  id: number;
  name: string;
  context: string;
  state: 'success' | 'failure' | 'pending' | 'error' | 'in_progress';
  description?: string;
  target_url?: string;
  created_at: string;
  updated_at: string;
  conclusion?: string;
}

interface PRStatusChecksProps {
  repository: string;
  pullNumber: number;
}

export const PRStatusChecks: React.FC<PRStatusChecksProps> = ({
  repository,
  pullNumber,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [checks, setChecks] = useState<StatusCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    loadStatusChecks();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadStatusChecks, 30000);
    return () => clearInterval(interval);
  }, [repository, pullNumber]);

  const loadStatusChecks = async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/status-checks`
      );

      if (!response.ok) {
        throw new Error('Failed to load status checks');
      }

      const data = await response.json();
      setChecks(data.checks || []);
      setError(null);
    } catch (err: any) {
      console.error('Error loading status checks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (checkId: number) => {
    setExpanded(prev => ({ ...prev, [checkId]: !prev[checkId] }));
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'success':
        return <CheckCircleIcon className={classes.statusSuccess} />;
      case 'failure':
      case 'error':
        return <CancelIcon className={classes.statusFailure} />;
      case 'in_progress':
        return <CircularProgress size={24} className={classes.statusRunning} />;
      case 'pending':
        return <HourglassEmptyIcon className={classes.statusPending} />;
      default:
        return <PlayArrowIcon />;
    }
  };

  const getStatusColor = (state: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (state) {
      case 'success':
        return 'success';
      case 'failure':
      case 'error':
        return 'error';
      case 'pending':
      case 'in_progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getOverallStatus = () => {
    if (checks.length === 0) {
      return { state: 'none', label: 'No checks', color: 'default' };
    }

    const hasFailure = checks.some(c => c.state === 'failure' || c.state === 'error');
    const hasRunning = checks.some(c => c.state === 'in_progress' || c.state === 'pending');
    const allSuccess = checks.every(c => c.state === 'success');

    if (hasFailure) {
      return { state: 'failure', label: 'Some checks failed', color: 'error' };
    } else if (hasRunning) {
      return { state: 'running', label: 'Checks in progress', color: 'warning' };
    } else if (allSuccess) {
      return { state: 'success', label: 'All checks passed', color: 'success' };
    }

    return { state: 'pending', label: 'Checks pending', color: 'default' };
  };

  const overallStatus = getOverallStatus();
  const successCount = checks.filter(c => c.state === 'success').length;
  const failureCount = checks.filter(c => c.state === 'failure' || c.state === 'error').length;
  const runningCount = checks.filter(c => c.state === 'in_progress' || c.state === 'pending').length;

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Status Checks
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Status Checks
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box className={classes.statusHeader}>
        <Typography variant="h6">Status Checks</Typography>
        {checks.length > 0 && (
          <Chip
            label={`${successCount}/${checks.length} passed`}
            size="small"
            color={overallStatus.color as any}
          />
        )}
      </Box>

      {checks.length === 0 ? (
        <Box className={classes.emptyState}>
          <CheckCircleIcon style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
          <Typography variant="body1">No status checks</Typography>
          <Typography variant="body2">
            Status checks help ensure code quality and security
          </Typography>
        </Box>
      ) : (
        <>
          {/* Overall Status Summary */}
          <Box className={classes.overallStatus}>
            {overallStatus.state === 'running' && <CircularProgress size={24} />}
            {overallStatus.state === 'success' && (
              <CheckCircleIcon className={classes.statusSuccess} />
            )}
            {overallStatus.state === 'failure' && (
              <CancelIcon className={classes.statusFailure} />
            )}
            <Box flex={1}>
              <Typography variant="subtitle1" style={{ fontWeight: 500 }}>
                {overallStatus.label}
              </Typography>
              <Box className={classes.statusSummary}>
                {successCount > 0 && (
                  <Typography variant="body2" className={classes.statusSuccess}>
                    {successCount} successful
                  </Typography>
                )}
                {failureCount > 0 && (
                  <Typography variant="body2" className={classes.statusFailure}>
                    {failureCount} failed
                  </Typography>
                )}
                {runningCount > 0 && (
                  <Typography variant="body2" className={classes.statusRunning}>
                    {runningCount} in progress
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* Individual Checks */}
          <List disablePadding>
            {checks.map((check) => (
              <Box key={check.id}>
                <ListItem className={classes.statusItem}>
                  <ListItemIcon className={classes.statusIcon}>
                    {getStatusIcon(check.state)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" style={{ gap: 1 * 8 }}>
                        <Typography variant="body1">{check.name}</Typography>
                        <Chip
                          label={check.state}
                          size="small"
                          color={getStatusColor(check.state) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          {check.description || check.context}
                        </Typography>
                        {check.target_url && (
                          <Link
                            href={check.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={classes.externalLink}
                            variant="body2"
                          >
                            View details
                            <OpenInNewIcon fontSize="small" />
                          </Link>
                        )}
                      </Box>
                    }
                  />
                  {check.description && (
                    <IconButton
                      size="small"
                      onClick={() => toggleExpanded(check.id)}
                    >
                      {expanded[check.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </ListItem>
                <Collapse in={expanded[check.id]}>
                  <Box className={classes.checkDetails}>
                    <Typography variant="body2">
                      <strong>Context:</strong> {check.context}
                    </Typography>
                    {check.conclusion && (
                      <Typography variant="body2">
                        <strong>Conclusion:</strong> {check.conclusion}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Updated:</strong> {new Date(check.updated_at).toLocaleString()}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            ))}
          </List>
        </>
      )}
    </Box>
  );
};
