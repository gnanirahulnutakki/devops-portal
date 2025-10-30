import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  CircularProgress,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  makeStyles,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  formControl: {
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(3),
  },
}));

interface CommitToBranchDialogProps {
  open: boolean;
  onClose: () => void;
  repository: string;
  currentBranch: string;
  onCommitSuccess?: () => void;
  fileContent?: {
    path: string;
    content?: string;
    sha: string;
  };
  commitMessage?: string;
  fieldPath?: string;
  fieldValue?: string;
}

export const CommitToBranchDialog: React.FC<CommitToBranchDialogProps> = ({
  open,
  onClose,
  repository,
  currentBranch,
  onCommitSuccess,
  fileContent,
  commitMessage,
  fieldPath,
  fieldValue,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [commitMode, setCommitMode] = useState<'existing' | 'new'>('new');
  const [selectedBranch, setSelectedBranch] = useState(currentBranch);
  const [newBranchName, setNewBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState(currentBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available branches when dialog opens
  useEffect(() => {
    if (open) {
      loadBranches();
      // Generate suggested branch name for new branch mode
      if (fileContent) {
        const timestamp = Date.now();
        const fileName = fileContent.path.split('/').pop()?.replace('.yaml', '').replace('.yml', '') || 'update';
        setNewBranchName(`feature/${fileName}-${timestamp}`);
      }
    } else {
      // Reset form when dialog closes
      setCommitMode('new');
      setSelectedBranch(currentBranch);
      setNewBranchName('');
      setBaseBranch(currentBranch);
      setError(null);
    }
  }, [open, fileContent, currentBranch]);

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/branches`
      );
      if (!response.ok) {
        throw new Error('Failed to load branches');
      }
      const data = await response.json();
      const branchNames = data.branches.map((b: any) => b.name);
      setBranches(branchNames);
    } catch (err: any) {
      console.error('Error loading branches:', err);
      setError(`Failed to load branches: ${err.message}`);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCommit = async () => {
    if (commitMode === 'new' && !newBranchName.trim()) {
      setError('New branch name is required');
      return;
    }

    if (commitMode === 'existing' && !selectedBranch) {
      setError('Please select a branch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let targetBranch = commitMode === 'existing' ? selectedBranch : newBranchName.trim();

      // Step 1: If creating new branch, create it first
      if (commitMode === 'new') {
        const createBranchResponse = await fetch(
          `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/branches`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              branch: newBranchName.trim(),
              from_branch: baseBranch,
            }),
          }
        );

        if (!createBranchResponse.ok) {
          const errorData = await createBranchResponse.json();
          throw new Error(errorData.error?.message || 'Failed to create branch');
        }
      }

      // Step 2: Get file to get its SHA
      const fileResponse = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/content?branch=${encodeURIComponent(targetBranch)}&path=${encodeURIComponent(fileContent!.path)}`
      );

      if (!fileResponse.ok) {
        throw new Error('Failed to get file content');
      }

      const fileData = await fileResponse.json();

      // Step 3: Commit changes
      const commitPayload: any = {
        branches: [targetBranch],
        path: fileContent!.path,
        message: commitMessage,
      };

      // Use field-level update if fieldPath/fieldValue provided, otherwise full content
      if (fieldPath && fieldValue) {
        commitPayload.fieldPath = fieldPath;
        commitPayload.fieldValue = fieldValue;
      } else if (fileContent?.content) {
        commitPayload.content = fileContent.content;
      }

      const commitResponse = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/files/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(commitPayload),
        }
      );

      if (!commitResponse.ok) {
        const errorData = await commitResponse.json();
        throw new Error(errorData.error?.message || 'Failed to commit changes');
      }

      if (onCommitSuccess) {
        onCommitSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('Error committing changes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Commit to Branch</DialogTitle>
      <DialogContent>
        {loadingBranches ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" style={{ marginBottom: 16 }}>
                {error}
              </Alert>
            )}

            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Choose how to commit your changes
              </Typography>
              <RadioGroup
                value={commitMode}
                onChange={(e) => setCommitMode(e.target.value as 'existing' | 'new')}
              >
                <FormControlLabel
                  value="new"
                  control={<Radio />}
                  label="Create new branch and commit"
                />
                <FormControlLabel
                  value="existing"
                  control={<Radio />}
                  label="Commit to existing branch"
                />
              </RadioGroup>
            </Box>

            {commitMode === 'new' ? (
              <Box mb={3} p={2} style={{ backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                <Typography variant="subtitle2" gutterBottom>
                  New Branch Details
                </Typography>

                <FormControl className={classes.formControl}>
                  <InputLabel>Base Branch (create from)</InputLabel>
                  <Select
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value as string)}
                    disabled={loading}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch} value={branch}>
                        {branch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  className={classes.formControl}
                  label="New Branch Name"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/my-changes"
                  required
                  disabled={loading}
                  fullWidth
                />
              </Box>
            ) : (
              <Box mb={3}>
                <FormControl className={classes.formControl}>
                  <InputLabel>Target Branch</InputLabel>
                  <Select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value as string)}
                    disabled={loading}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch} value={branch}>
                        {branch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            <Box mb={2}>
              <Typography variant="caption" color="textSecondary" display="block">
                File: {fileContent?.path}
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block">
                Message: {commitMessage}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCommit}
          color="primary"
          variant="contained"
          disabled={loading || loadingBranches}
        >
          {loading ? <CircularProgress size={24} /> : 'Commit Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
