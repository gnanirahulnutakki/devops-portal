import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Link,
  Collapse,
  makeStyles,
} from '@material-ui/core';
import {
  InfoCard,
  Progress,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import StopIcon from '@material-ui/icons/Stop';
import ReplayIcon from '@material-ui/icons/Replay';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import CancelIcon from '@material-ui/icons/Cancel';
import ScheduleIcon from '@material-ui/icons/Schedule';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

const useStyles = makeStyles((theme) => ({
  statusChip: {
    fontWeight: 600,
    minWidth: 100,
  },
  successChip: {
    backgroundColor: '#00b12b',
    color: 'white',
  },
  failureChip: {
    backgroundColor: '#d32f2f',
    color: 'white',
  },
  cancelledChip: {
    backgroundColor: '#757575',
    color: 'white',
  },
  inProgressChip: {
    backgroundColor: '#ff9800',
    color: 'white',
  },
  queuedChip: {
    backgroundColor: '#2196f3',
    color: 'white',
  },
  statsCard: {
    textAlign: 'center',
    padding: theme.spacing(2),
    '&:hover': {
      boxShadow: theme.shadows[4],
    },
  },
  statsValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#09143F',
  },
  statsLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  workflowRow: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  expandedRow: {
    backgroundColor: theme.palette.grey[50],
  },
  jobStep: {
    padding: theme.spacing(0.5, 2),
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  avatar: {
    width: 24,
    height: 24,
    marginRight: theme.spacing(1),
  },
  runDuration: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  actionButton: {
    marginLeft: theme.spacing(0.5),
  },
}));

interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  event: string;
  run_attempt: number;
  run_number: number;
}

interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  steps: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
  }>;
}

interface BuildSummary {
  lastRun: WorkflowRun | null;
  recentRuns: WorkflowRun[];
  stats: {
    total: number;
    success: number;
    failed: number;
    cancelled: number;
    inProgress: number;
  };
}

interface GitHubActionsDashboardProps {
  repository: string;
  branch?: string;
  showSummary?: boolean;
  maxRuns?: number;
}

export const GitHubActionsDashboard: React.FC<GitHubActionsDashboardProps> = ({
  repository,
  branch,
  showSummary = true,
  maxRuns = 10,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BuildSummary | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Record<number, WorkflowJob[]>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch summary
      const summaryRes = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/actions/summary${branch ? `?branch=${branch}` : ''}`
      );
      if (!summaryRes.ok) throw new Error('Failed to fetch build summary');
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Fetch runs
      const runsRes = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/actions/runs?per_page=${maxRuns}${branch ? `&branch=${branch}` : ''}`
      );
      if (!runsRes.ok) throw new Error('Failed to fetch workflow runs');
      const runsData = await runsRes.json();
      setRuns(runsData.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, repository, branch, maxRuns]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchJobs = async (runId: number) => {
    if (jobs[runId]) return; // Already fetched

    try {
      const res = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/actions/runs/${runId}/jobs`
      );
      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => ({ ...prev, [runId]: data.jobs }));
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  const handleExpandRun = (runId: number) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
    } else {
      setExpandedRun(runId);
      fetchJobs(runId);
    }
  };

  const handleRerun = async (runId: number) => {
    try {
      await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/actions/runs/${runId}/rerun`,
        { method: 'POST' }
      );
      fetchData();
    } catch (err) {
      console.error('Failed to rerun workflow:', err);
    }
  };

  const handleCancel = async (runId: number) => {
    try {
      await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/actions/runs/${runId}/cancel`,
        { method: 'POST' }
      );
      fetchData();
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
    }
  };

  const getStatusChip = (run: WorkflowRun) => {
    if (run.status === 'in_progress' || run.status === 'queued') {
      return (
        <Chip
          icon={<ScheduleIcon />}
          label={run.status === 'queued' ? 'Queued' : 'Running'}
          size="small"
          className={`${classes.statusChip} ${run.status === 'queued' ? classes.queuedChip : classes.inProgressChip}`}
        />
      );
    }

    switch (run.conclusion) {
      case 'success':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Success"
            size="small"
            className={`${classes.statusChip} ${classes.successChip}`}
          />
        );
      case 'failure':
        return (
          <Chip
            icon={<ErrorIcon />}
            label="Failed"
            size="small"
            className={`${classes.statusChip} ${classes.failureChip}`}
          />
        );
      case 'cancelled':
        return (
          <Chip
            icon={<CancelIcon />}
            label="Cancelled"
            size="small"
            className={`${classes.statusChip} ${classes.cancelledChip}`}
          />
        );
      default:
        return (
          <Chip
            label={run.conclusion || 'Unknown'}
            size="small"
            className={classes.statusChip}
          />
        );
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

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

  if (loading && !runs.length) {
    return <Progress />;
  }

  if (error) {
    return (
      <InfoCard title="GitHub Actions">
        <Typography color="error">{error}</Typography>
        <Button onClick={fetchData} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </InfoCard>
    );
  }

  return (
    <Box>
      {/* Summary Stats */}
      {showSummary && summary && (
        <Grid container spacing={2} style={{ marginBottom: 16 }}>
          <Grid item xs={6} sm={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsValue} style={{ color: '#00b12b' }}>
                  {summary.stats.success}
                </Typography>
                <Typography className={classes.statsLabel}>Successful</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsValue} style={{ color: '#d32f2f' }}>
                  {summary.stats.failed}
                </Typography>
                <Typography className={classes.statsLabel}>Failed</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsValue} style={{ color: '#ff9800' }}>
                  {summary.stats.inProgress}
                </Typography>
                <Typography className={classes.statsLabel}>In Progress</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card className={classes.statsCard}>
              <CardContent>
                <Typography className={classes.statsValue}>
                  {summary.stats.total}
                </Typography>
                <Typography className={classes.statsLabel}>Total Runs</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Workflow Runs Table */}
      <InfoCard
        title="Recent Workflow Runs"
        action={
          <Box display="flex" alignItems="center">
            {loading && <LinearProgress style={{ width: 100, marginRight: 8 }} />}
            <Tooltip title="Refresh">
              <IconButton onClick={fetchData} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      >
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Workflow</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Triggered</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((run) => (
                <React.Fragment key={run.id}>
                  <TableRow className={classes.workflowRow}>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpandRun(run.id)}
                      >
                        {expandedRun === run.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          src={run.actor.avatar_url}
                          className={classes.avatar}
                        />
                        <Box>
                          <Typography variant="body2" style={{ fontWeight: 500 }}>
                            {run.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            #{run.run_number} by {run.actor.login}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{getStatusChip(run)}</TableCell>
                    <TableCell>
                      <Chip label={run.head_branch} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{run.event}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography className={classes.runDuration}>
                        {formatDuration(run.run_started_at, run.status === 'completed' ? run.updated_at : undefined)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatTimeAgo(run.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {(run.status === 'in_progress' || run.status === 'queued') ? (
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(run.id)}
                            className={classes.actionButton}
                          >
                            <StopIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Re-run">
                          <IconButton
                            size="small"
                            onClick={() => handleRerun(run.id)}
                            className={classes.actionButton}
                          >
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="View on GitHub">
                        <IconButton
                          size="small"
                          component={Link}
                          href={run.html_url}
                          target="_blank"
                          className={classes.actionButton}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Jobs */}
                  <TableRow>
                    <TableCell colSpan={8} style={{ padding: 0 }}>
                      <Collapse in={expandedRun === run.id} timeout="auto" unmountOnExit>
                        <Box className={classes.expandedRow} p={2}>
                          <Typography variant="subtitle2" gutterBottom>
                            Jobs
                          </Typography>
                          {jobs[run.id] ? (
                            jobs[run.id].map((job) => (
                              <Box key={job.id} mb={1}>
                                <Box display="flex" alignItems="center" mb={0.5}>
                                  {job.conclusion === 'success' ? (
                                    <CheckCircleIcon style={{ color: '#00b12b', fontSize: 18, marginRight: 8 }} />
                                  ) : job.conclusion === 'failure' ? (
                                    <ErrorIcon style={{ color: '#d32f2f', fontSize: 18, marginRight: 8 }} />
                                  ) : (
                                    <ScheduleIcon style={{ color: '#ff9800', fontSize: 18, marginRight: 8 }} />
                                  )}
                                  <Typography variant="body2" style={{ fontWeight: 500 }}>
                                    {job.name}
                                  </Typography>
                                  <Link
                                    href={job.html_url}
                                    target="_blank"
                                    style={{ marginLeft: 8 }}
                                  >
                                    <OpenInNewIcon style={{ fontSize: 14 }} />
                                  </Link>
                                </Box>
                                {job.steps && job.steps.map((step) => (
                                  <Box key={step.number} className={classes.jobStep}>
                                    {step.conclusion === 'success' ? (
                                      <CheckCircleIcon style={{ color: '#00b12b', fontSize: 14, marginRight: 8 }} />
                                    ) : step.conclusion === 'failure' ? (
                                      <ErrorIcon style={{ color: '#d32f2f', fontSize: 14, marginRight: 8 }} />
                                    ) : step.conclusion === 'skipped' ? (
                                      <CancelIcon style={{ color: '#757575', fontSize: 14, marginRight: 8 }} />
                                    ) : (
                                      <ScheduleIcon style={{ color: '#ff9800', fontSize: 14, marginRight: 8 }} />
                                    )}
                                    <Typography variant="caption">{step.name}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            ))
                          ) : (
                            <LinearProgress />
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="textSecondary">No workflow runs found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </InfoCard>
    </Box>
  );
};

export default GitHubActionsDashboard;
