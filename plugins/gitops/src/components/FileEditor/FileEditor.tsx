import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Divider,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  InputAdornment,
} from '@material-ui/core';
import { Alert, ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import SearchIcon from '@material-ui/icons/Search';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import EditIcon from '@material-ui/icons/Edit';
import ListIcon from '@material-ui/icons/List';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef, FileContent, Branch } from '../../api';
import { FieldSelector } from '../FieldSelector';
import { CreatePullRequestDialog } from '../CreatePullRequestDialog';
import { CommitToBranchDialog } from '../CommitToBranchDialog';

interface FileEditorProps {
  open: boolean;
  onClose: () => void;
  repository: string;
  fileContent: FileContent | null;
  branches: Branch[];
  currentBranch: string;
  onSuccess?: () => void;
}

export const FileEditor = ({
  open,
  onClose,
  repository,
  fileContent,
  branches,
  currentBranch,
  onSuccess,
}: FileEditorProps) => {
  const gitOpsApi = useApi(gitOpsApiRef);
  const [editMode, setEditMode] = useState<'full' | 'field'>('field');
  const [editedContent, setEditedContent] = useState(fileContent?.content || '');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([currentBranch]);
  const [submitting, setSubmitting] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldPath, setFieldPath] = useState<string>('');
  const [fieldValue, setFieldValue] = useState<string>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [commitOnlyDialogOpen, setCommitOnlyDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');

  React.useEffect(() => {
    if (fileContent) {
      setEditedContent(fileContent.content);
      setSelectedBranches([currentBranch]);
    }
  }, [fileContent, currentBranch]);

  const handleBranchToggle = (branchName: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchName)
        ? prev.filter(b => b !== branchName)
        : [...prev, branchName]
    );
  };

  const handleSubmit = async () => {
    if (!fileContent || !commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    if (selectedBranches.length === 0) {
      setError('Please select at least one branch');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build request based on edit mode
      const requestData: any = {
        branches: selectedBranches,
        path: fileContent.path,
        message: commitMessage,
      };

      if (editMode === 'field') {
        // Field-level update
        requestData.fieldPath = fieldPath;
        requestData.fieldValue = fieldValue;
      } else {
        // Full file update
        requestData.content = editedContent;
      }

      const result = await gitOpsApi.updateFile(repository, requestData);

      setOperationId(result.operation_id);

      // Success - close after a moment to show the operation ID
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to commit changes');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEditedContent(fileContent?.content || '');
    setCommitMessage('');
    setSelectedBranches([currentBranch]);
    setSubmitting(false);
    setOperationId(null);
    setError(null);
    setFieldPath('');
    setFieldValue('');
    setEditMode('field');
    setAnchorEl(null);
    setPrDialogOpen(false);
    onClose();
  };

  const handleOpenPrDialog = () => {
    // For PR creation with new branch, we don't commit yet - just open the dialog
    if (!fileContent || !commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    setAnchorEl(null);
    setPrDialogOpen(true);
  };

  const handleOpenCommitOnlyDialog = () => {
    // For commit-only (create branch, no PR)
    if (!fileContent || !commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    setAnchorEl(null);
    setCommitOnlyDialogOpen(true);
  };

  const handlePrCreated = (pullRequest: any) => {
    // Success - show PR created message
    console.log('Pull request created:', pullRequest);
    onSuccess?.();
    handleClose();
  };

  const handleCommitOnlySuccess = () => {
    // Success - show commit created message
    onSuccess?.();
    handleClose();
  };

  const handleFieldChange = (path: string, value: string) => {
    setFieldPath(path);
    setFieldValue(value);
  };

  const hasChanges = editMode === 'full'
    ? editedContent !== fileContent?.content
    : fieldPath && fieldValue;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Edit File: {fileContent?.name}
        {selectedBranches.length > 1 && (
          <Chip
            label={`${selectedBranches.length} branches selected`}
            color="primary"
            size="small"
            style={{ marginLeft: 16 }}
          />
        )}
      </DialogTitle>

      <DialogContent>
        {operationId && (
          <Alert severity="success" style={{ marginBottom: 16 }}>
            Bulk operation initiated! Operation ID: {operationId.substring(0, 8)}...
            <br />
            Check the Operations tab to track progress.
          </Alert>
        )}

        {error && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle2">
              Editing: {fileContent?.path}
            </Typography>
            <ToggleButtonGroup
              value={editMode}
              exclusive
              onChange={(_, newMode) => newMode && setEditMode(newMode)}
              size="small"
            >
              <ToggleButton value="field">
                <ListIcon style={{ marginRight: 8 }} />
                Field-Level Edit
              </ToggleButton>
              <ToggleButton value="full">
                <EditIcon style={{ marginRight: 8 }} />
                Full File Edit
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider />
        </Box>

        {editMode === 'field' ? (
          <FieldSelector
            repository={repository}
            fileContent={fileContent}
            branches={branches}
            selectedBranches={selectedBranches}
            onFieldChange={handleFieldChange}
          />
        ) : (
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              Monaco Editor - Full File Content
            </Typography>
            <Editor
              height="400px"
              defaultLanguage="yaml"
              value={editedContent}
              onChange={(value) => setEditedContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </Box>
        )}

        <TextField
          fullWidth
          label="Commit Message"
          placeholder="Update configuration values"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          margin="normal"
          required
          disabled={submitting}
        />

        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">
              Select Branches to Update ({selectedBranches.length} selected)
            </Typography>
            {branches.length > 15 && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setBranchDialogOpen(true)}
              >
                View All {branches.length} Branches
              </Button>
            )}
          </Box>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {branches.slice(0, 15).map((branch) => {
              const isSelected = selectedBranches.includes(branch.name);
              return (
                <Chip
                  key={branch.name}
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {isSelected && <CheckCircleIcon style={{ fontSize: 16 }} />}
                      {branch.name}
                      {branch.protected && <Chip label="protected" size="small" style={{ marginLeft: 4, height: 16 }} />}
                    </Box>
                  }
                  onClick={() => !submitting && handleBranchToggle(branch.name)}
                  color={isSelected ? "primary" : "default"}
                  variant={isSelected ? "default" : "outlined"}
                  disabled={submitting}
                  style={{
                    cursor: submitting ? 'default' : 'pointer',
                    backgroundColor: isSelected ? '#09143F' : undefined,
                    color: isSelected ? 'white' : undefined,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
              );
            })}
          </Box>
          {branches.length > 15 && (
            <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: 'block' }}>
              Showing first 15 branches. Click "View All" to see and select from all {branches.length} branches.
            </Typography>
          )}
        </Box>

        {submitting && <LinearProgress style={{ marginTop: 16 }} />}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Box display="flex">
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={submitting || !hasChanges || !commitMessage.trim()}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          >
            {submitting
              ? 'Committing...'
              : editMode === 'field'
              ? `Update Field in ${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`
              : `Commit to ${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`
            }
          </Button>
          <Button
            color="primary"
            variant="contained"
            size="small"
            disabled={submitting || !hasChanges || !commitMessage.trim()}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            style={{
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: '1px solid rgba(255,255,255,0.3)',
              minWidth: '40px',
              padding: '6px 8px',
            }}
          >
            <ArrowDropDownIcon />
          </Button>
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem
            onClick={handleOpenCommitOnlyDialog}
            disabled={!hasChanges || !commitMessage.trim()}
          >
            Commit to New Branch
          </MenuItem>
          <MenuItem
            onClick={handleOpenPrDialog}
            disabled={!hasChanges || !commitMessage.trim()}
          >
            Create New Branch & Pull Request
          </MenuItem>
        </Menu>
      </DialogActions>

      <CreatePullRequestDialog
        open={prDialogOpen}
        onClose={() => setPrDialogOpen(false)}
        repository={repository}
        currentBranch={currentBranch}
        onPullRequestCreated={handlePrCreated}
        allowBranchCreation={true}
        fileContent={fileContent ? {
          path: fileContent.path,
          content: editMode === 'full' ? editedContent : undefined,
          sha: fileContent.sha,
        } : undefined}
        commitMessage={commitMessage}
        fieldPath={editMode === 'field' ? fieldPath : undefined}
        fieldValue={editMode === 'field' ? fieldValue : undefined}
      />

      <CommitToBranchDialog
        open={commitOnlyDialogOpen}
        onClose={() => setCommitOnlyDialogOpen(false)}
        repository={repository}
        currentBranch={currentBranch}
        onCommitSuccess={handleCommitOnlySuccess}
        fileContent={fileContent ? {
          path: fileContent.path,
          content: editMode === 'full' ? editedContent : undefined,
          sha: fileContent.sha,
        } : undefined}
        commitMessage={commitMessage}
        fieldPath={editMode === 'field' ? fieldPath : undefined}
        fieldValue={editMode === 'field' ? fieldValue : undefined}
      />

      {/* Branch Selection Dialog */}
      <Dialog
        open={branchDialogOpen}
        onClose={() => setBranchDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Select Branches ({selectedBranches.length} selected)
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search branches..."
            value={branchSearchQuery}
            onChange={(e) => setBranchSearchQuery(e.target.value)}
            margin="normal"
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <List style={{ maxHeight: 400, overflow: 'auto', marginTop: 8 }}>
            {branches
              .filter((branch) =>
                branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
              )
              .map((branch) => {
                const isSelected = selectedBranches.includes(branch.name);
                return (
                  <ListItem
                    key={branch.name}
                    button
                    onClick={() => handleBranchToggle(branch.name)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(9, 20, 63, 0.08)' : undefined,
                      borderLeft: isSelected ? '4px solid #09143F' : '4px solid transparent',
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      tabIndex={-1}
                      disableRipple
                      color="primary"
                    />
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                            {branch.name}
                          </span>
                          {branch.protected && (
                            <Chip label="protected" size="small" />
                          )}
                        </Box>
                      }
                    />
                    {isSelected && (
                      <ListItemSecondaryAction>
                        <CheckCircleIcon style={{ color: '#09143F' }} />
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                );
              })}
          </List>
          {branches.filter((branch) =>
            branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
          ).length === 0 && (
            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              style={{ padding: 16 }}
            >
              No branches found matching "{branchSearchQuery}"
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBranchDialogOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
