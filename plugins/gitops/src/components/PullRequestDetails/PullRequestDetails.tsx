import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Divider,
  makeStyles,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Grid,
} from '@material-ui/core';
import { Alert, Autocomplete } from '@material-ui/lab';
import MergeIcon from '@material-ui/icons/CallMerge';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import CloseIcon from '@material-ui/icons/Close';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { DiffViewer } from '../DiffViewer';
import { PRComments } from '../PRComments';
import { PRStatusChecks } from '../PRStatusChecks';
import { PRTimeline } from '../PRTimeline';
import { PRReviewStatus } from '../PRReviewStatus';

const useStyles = makeStyles((theme) => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(3),
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  metaInfo: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  statusChip: {
    marginLeft: theme.spacing(2),
  },
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontWeight: 500,
    marginBottom: theme.spacing(2),
  },
  branchInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  mergeSection: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  mergeButton: {
    marginTop: theme.spacing(2),
  },
  reviewersList: {
    maxHeight: 200,
    overflow: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
  },
  diffSection: {
    marginTop: theme.spacing(3),
  },
}));

interface PullRequestDetailsProps {
  repository: string;
  pullNumber: number;
  onClose?: () => void;
}

export const PullRequestDetails: React.FC<PullRequestDetailsProps> = ({
  repository,
  pullNumber,
  onClose,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [pr, setPr] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [merging, setMerging] = useState(false);
  const [addReviewersOpen, setAddReviewersOpen] = useState(false);
  const [addAssigneesOpen, setAddAssigneesOpen] = useState(false);
  const [reviewerInput, setReviewerInput] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');

  useEffect(() => {
    loadPullRequestDetails();
    loadPullRequestFiles();
  }, [repository, pullNumber]);

  const loadPullRequestDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}`
      );

      if (!response.ok) {
        throw new Error('Failed to load pull request details');
      }

      const data = await response.json();
      setPr(data.pull);
    } catch (err: any) {
      console.error('Error loading PR details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPullRequestFiles = async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/files`
      );

      if (!response.ok) {
        throw new Error('Failed to load pull request files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Error loading PR files:', err);
    }
  };

  const handleMerge = async () => {
    if (!pr) return;

    setMerging(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/merge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merge_method: mergeMethod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to merge pull request');
      }

      // Reload PR details to show merged state
      await loadPullRequestDetails();
    } catch (err: any) {
      console.error('Error merging PR:', err);
      setError(err.message);
    } finally {
      setMerging(false);
    }
  };

  const handleAddReviewers = async () => {
    if (!reviewerInput.trim()) return;

    try {
      const reviewers = reviewerInput.split(',').map(r => r.trim()).filter(r => r);
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/reviewers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reviewers }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add reviewers');
      }

      // Reload PR details to show new reviewers
      await loadPullRequestDetails();
      setAddReviewersOpen(false);
      setReviewerInput('');
    } catch (err: any) {
      console.error('Error adding reviewers:', err);
      setError(err.message);
    }
  };

  const handleAddAssignees = async () => {
    if (!assigneeInput.trim()) return;

    try {
      const assignees = assigneeInput.split(',').map(a => a.trim()).filter(a => a);
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/assignees`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ assignees }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add assignees');
      }

      // Reload PR details to show new assignees
      await loadPullRequestDetails();
      setAddAssigneesOpen(false);
      setAssigneeInput('');
    } catch (err: any) {
      console.error('Error adding assignees:', err);
      setError(err.message);
    }
  };

  const getStateChip = () => {
    if (!pr) return null;

    if (pr.state === 'closed' && pr.merged) {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Merged"
          style={{ backgroundColor: '#09143F', color: 'white' }}
        />
      );
    } else if (pr.state === 'closed') {
      return <Chip label="Closed" color="secondary" />;
    } else {
      return (
        <Chip
          icon={<MergeIcon />}
          label="Open"
          style={{ backgroundColor: '#28a745', color: 'white' }}
        />
      );
    }
  };

  const getMergeabilityStatus = () => {
    if (!pr) return null;

    if (pr.merged) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          This pull request was merged
        </Alert>
      );
    }

    if (pr.mergeable === false) {
      return (
        <Alert severity="error" icon={<ErrorIcon />}>
          This branch has conflicts that must be resolved before merging
        </Alert>
      );
    }

    if (pr.mergeable === true) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          This branch has no conflicts with the base branch
        </Alert>
      );
    }

    return (
      <Alert severity="info">
        Checking if this pull request can be merged...
      </Alert>
    );
  };

  if (loading) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  if (!pr) {
    return (
      <Alert severity="warning">
        Pull request not found
      </Alert>
    );
  }

  return (
    <Box>
      <Box className={classes.header}>
        <Box className={classes.titleSection}>
          <Box display="flex" alignItems="center">
            <Typography variant="h5" className={classes.title}>
              {pr.title}
            </Typography>
            {getStateChip()}
          </Box>
          <Typography variant="body2" className={classes.metaInfo}>
            #{pr.number} opened by {pr.user?.login} •{' '}
            {new Date(pr.created_at).toLocaleDateString()}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {error && (
        <Alert severity="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Description */}
          {pr.body && (
            <Card className={classes.section}>
              <CardContent>
                <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                  {pr.body}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Branch Information */}
          <Card className={classes.section}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                Branches
              </Typography>
              <Box className={classes.branchInfo}>
                <Chip label={pr.head?.ref} color="primary" />
                <Typography variant="body2">→</Typography>
                <Chip label={pr.base?.ref} variant="outlined" />
              </Box>
            </CardContent>
          </Card>

          {/* Status Checks */}
          <Card className={classes.section}>
            <CardContent>
              <PRStatusChecks repository={repository} pullNumber={pullNumber} />
            </CardContent>
          </Card>

          {/* Review Status */}
          <Card className={classes.section}>
            <CardContent>
              <PRReviewStatus repository={repository} pullNumber={pullNumber} />
            </CardContent>
          </Card>

          {/* Changes / Diff */}
          <Card className={classes.section}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                Changes ({files.length} files)
              </Typography>
              <Box mb={2}>
                <Chip
                  label={`+${pr.additions || 0} additions`}
                  size="small"
                  style={{ backgroundColor: '#28a745', color: 'white', marginRight: 8 }}
                />
                <Chip
                  label={`-${pr.deletions || 0} deletions`}
                  size="small"
                  style={{ backgroundColor: '#d73a49', color: 'white' }}
                />
              </Box>
              <DiffViewer files={files} />
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className={classes.section}>
            <CardContent>
              <PRComments repository={repository} pullNumber={pullNumber} />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className={classes.section}>
            <CardContent>
              <PRTimeline repository={repository} pullNumber={pullNumber} />
            </CardContent>
          </Card>

          {/* Merge Section */}
          {pr.state === 'open' && (
            <Card className={classes.section}>
              <CardContent>
                <Typography variant="h6" className={classes.sectionTitle}>
                  Merge Pull Request
                </Typography>

                {getMergeabilityStatus()}

                <Box className={classes.mergeSection} mt={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Merge Method</InputLabel>
                    <Select
                      value={mergeMethod}
                      onChange={(e) => setMergeMethod(e.target.value as any)}
                      label="Merge Method"
                      disabled={merging || pr.mergeable === false}
                    >
                      <MenuItem value="merge">
                        Create a merge commit
                      </MenuItem>
                      <MenuItem value="squash">
                        Squash and merge
                      </MenuItem>
                      <MenuItem value="rebase">
                        Rebase and merge
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    className={classes.mergeButton}
                    onClick={handleMerge}
                    disabled={merging || pr.mergeable === false}
                    startIcon={merging ? <CircularProgress size={20} /> : <MergeIcon />}
                  >
                    {merging ? 'Merging...' : 'Merge Pull Request'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Reviewers */}
          <Card className={classes.section}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Reviewers</Typography>
                <IconButton
                  size="small"
                  onClick={() => setAddReviewersOpen(true)}
                  disabled={pr.state !== 'open'}
                >
                  <PersonAddIcon />
                </IconButton>
              </Box>
              {pr.requested_reviewers && pr.requested_reviewers.length > 0 ? (
                <List dense className={classes.reviewersList}>
                  {pr.requested_reviewers.map((reviewer: any) => (
                    <ListItem key={reviewer.login}>
                      <ListItemAvatar>
                        <Avatar src={reviewer.avatar_url} alt={reviewer.login} />
                      </ListItemAvatar>
                      <ListItemText primary={reviewer.login} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No reviewers assigned
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Assignees */}
          <Card className={classes.section}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Assignees</Typography>
                <IconButton
                  size="small"
                  onClick={() => setAddAssigneesOpen(true)}
                  disabled={pr.state !== 'open'}
                >
                  <PersonAddIcon />
                </IconButton>
              </Box>
              {pr.assignees && pr.assignees.length > 0 ? (
                <List dense className={classes.reviewersList}>
                  {pr.assignees.map((assignee: any) => (
                    <ListItem key={assignee.login}>
                      <ListItemAvatar>
                        <Avatar src={assignee.avatar_url} alt={assignee.login} />
                      </ListItemAvatar>
                      <ListItemText primary={assignee.login} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No assignees
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="body2">
                  <strong>Commits:</strong> {pr.commits || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>Comments:</strong> {pr.comments || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>Changed files:</strong> {pr.changed_files || 0}
                </Typography>
                {pr.merged_at && (
                  <Typography variant="body2">
                    <strong>Merged:</strong> {new Date(pr.merged_at).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Reviewers Dialog */}
      <Dialog open={addReviewersOpen} onClose={() => setAddReviewersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Reviewers</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="GitHub Usernames"
            placeholder="username1, username2, ..."
            value={reviewerInput}
            onChange={(e) => setReviewerInput(e.target.value)}
            helperText="Enter GitHub usernames separated by commas"
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddReviewersOpen(false)}>Cancel</Button>
          <Button onClick={handleAddReviewers} color="primary" variant="contained">
            Add Reviewers
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Assignees Dialog */}
      <Dialog open={addAssigneesOpen} onClose={() => setAddAssigneesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Assignees</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="GitHub Usernames"
            placeholder="username1, username2, ..."
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            helperText="Enter GitHub usernames separated by commas"
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAssigneesOpen(false)}>Cancel</Button>
          <Button onClick={handleAddAssignees} color="primary" variant="contained">
            Add Assignees
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
