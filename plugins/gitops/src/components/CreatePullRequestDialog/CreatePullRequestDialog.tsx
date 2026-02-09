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

interface CreatePullRequestDialogProps {
  open: boolean;
  onClose: () => void;
  repository: string;
  currentBranch: string;
  onPullRequestCreated?: (pullRequest: any) => void;
  allowBranchCreation?: boolean;
  fileContent?: {
    path: string;
    content?: string;
    sha: string;
  };
  commitMessage?: string;
  fieldPath?: string;
  fieldValue?: string;
}

export const CreatePullRequestDialog: React.FC<CreatePullRequestDialogProps> = ({
  open,
  onClose,
  repository,
  currentBranch,
  onPullRequestCreated,
  allowBranchCreation = false,
  fileContent,
  commitMessage,
  fieldPath,
  fieldValue,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [headBranch, setHeadBranch] = useState(currentBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New branch creation fields
  const [createNewBranch, setCreateNewBranch] = useState(allowBranchCreation);
  const [newBranchName, setNewBranchName] = useState('');
  const [baseBranchForNew, setBaseBranchForNew] = useState(currentBranch);

  // Load available branches when dialog opens
  useEffect(() => {
    if (open) {
      loadBranches();
      // Generate suggested branch name if creating new branch
      if (allowBranchCreation && fileContent) {
        const timestamp = Date.now();
        const fileName = fileContent.path.split('/').pop()?.replace('.yaml', '').replace('.yml', '') || 'update';
        setNewBranchName(`feature/update-${fileName}-${timestamp}`);
        setCreateNewBranch(true);
      }
    } else {
      // Reset form when dialog closes
      setTitle('');
      setBody('');
      setTargetBranch('main');
      setHeadBranch(currentBranch);
      setError(null);
      setCreateNewBranch(allowBranchCreation);
      setNewBranchName('');
      setBaseBranchForNew(currentBranch);
    }
  }, [open, allowBranchCreation, fileContent, currentBranch]);

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

      // Set default target branch to 'main' if it exists, otherwise 'master', otherwise first branch
      if (branchNames.includes('main')) {
        setTargetBranch('main');
      } else if (branchNames.includes('master')) {
        setTargetBranch('master');
      } else if (branchNames.length > 0) {
        setTargetBranch(branchNames[0]);
      }
    } catch (err: any) {
      console.error('Error loading branches:', err);
      setError(`Failed to load branches: ${err.message}`);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('PR title is required');
      return;
    }

    if (createNewBranch && !newBranchName.trim()) {
      setError('New branch name is required');
      return;
    }

    if (createNewBranch && !baseBranchForNew) {
      setError('Base branch for new branch is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let selectedHeadBranch = headBranch;
      let response;

      // If creating new branch with changes, use the synchronous endpoint
      if (createNewBranch && fileContent && commitMessage) {
        selectedHeadBranch = newBranchName.trim();

        // Validate target branch
        if (targetBranch === selectedHeadBranch) {
          setError('Cannot create PR: target and source branches are the same');
          setLoading(false);
          return;
        }

        // Use the new synchronous PR creation endpoint
        const prPayload: any = {
          title: title.trim(),
          body: body.trim() || undefined,
          base: targetBranch,
          newBranchName: selectedHeadBranch,
          baseBranch: baseBranchForNew,
          filePath: fileContent.path,
          commitMessage: commitMessage,
        };

        // Use field-level update if fieldPath/fieldValue provided, otherwise full content
        if (fieldPath && fieldValue) {
          prPayload.fieldPath = fieldPath;
          prPayload.fieldValue = fieldValue;
        } else if (fileContent.content) {
          prPayload.content = fileContent.content;
        }

        response = await fetch(
          `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/with-changes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(prPayload),
          }
        );
      } else {
        // Standard PR creation without file changes
        if (targetBranch === selectedHeadBranch) {
          setError('Cannot create PR: target and source branches are the same');
          setLoading(false);
          return;
        }

        response = await fetch(
          `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: title.trim(),
              body: body.trim() || undefined,
              head: selectedHeadBranch,
              base: targetBranch,
            }),
          }
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create pull request');
      }

      const data = await response.json();

      if (onPullRequestCreated) {
        onPullRequestCreated(data.pull);
      }

      onClose();
    } catch (err: any) {
      console.error('Error creating pull request:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Pull Request</DialogTitle>
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

            {allowBranchCreation && (
              <Box mb={3} p={2} style={{ backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Feature Branch Workflow
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 12 }}>
                  1. A new branch will be created from the base branch below<br />
                  2. Your changes will be committed to the new branch<br />
                  3. A pull request will be created to merge the new branch into the target branch
                </Typography>

                <FormControl className={classes.formControl}>
                  <InputLabel>Base Branch (branch from)</InputLabel>
                  <Select
                    value={baseBranchForNew}
                    onChange={(e) => setBaseBranchForNew(e.target.value as string)}
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
                  helperText="This branch will be created from the base branch above"
                />
              </Box>
            )}

            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Pull Request Details
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 12 }}>
                {createNewBranch
                  ? `Creating PR from new branch "${newBranchName}" into:`
                  : `Select the source branch (with your changes) and target branch (to merge into):`}
              </Typography>
            </Box>

            {!createNewBranch && (
              <FormControl className={classes.formControl}>
                <InputLabel>Source Branch (branch with changes)</InputLabel>
                <Select
                  value={headBranch}
                  onChange={(e) => setHeadBranch(e.target.value as string)}
                  disabled={loading}
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch} value={branch}>
                      {branch}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl className={classes.formControl}>
              <InputLabel>Target Branch (merge into)</InputLabel>
              <Select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value as string)}
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
              label="PR Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of changes"
              required
              disabled={loading}
              fullWidth
              autoFocus
            />

            <TextField
              className={classes.formControl}
              label="PR Description (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detailed description of the pull request"
              multiline
              rows={4}
              disabled={loading}
              fullWidth
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          color="primary"
          variant="contained"
          disabled={loading || loadingBranches || !title.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Create Pull Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
