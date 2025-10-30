import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef, Repository, Branch, FileContent } from '../../api';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import {
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  TextField,
  Chip,
  Box,
} from '@material-ui/core';
import { Alert, Autocomplete } from '@material-ui/lab';
import EditIcon from '@material-ui/icons/Edit';
import RefreshIcon from '@material-ui/icons/Refresh';
import FolderIcon from '@material-ui/icons/Folder';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import DescriptionIcon from '@material-ui/icons/Description';
import { FileEditor } from '../FileEditor';

export const RepositoryBrowser = () => {
  const gitOpsApi = useApi(gitOpsApiRef);

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // Common Helm chart files
  const commonFiles = [
    { path: 'app/charts/radiantone/values.yaml', label: 'values.yaml' },
    { path: 'app/charts/radiantone/Chart.yaml', label: 'Chart.yaml' },
    { path: 'app/charts/radiantone/templates/deployment.yaml', label: 'templates/deployment.yaml' },
    { path: 'app/charts/radiantone/templates/service.yaml', label: 'templates/service.yaml' },
    { path: 'app/charts/radiantone/templates/configmap.yaml', label: 'templates/configmap.yaml' },
    { path: 'app/charts/radiantone/templates/secret.yaml', label: 'templates/secret.yaml' },
    { path: 'app/charts/radiantone/templates/ingress.yaml', label: 'templates/ingress.yaml' },
    { path: 'app/charts/radiantone/templates/serviceaccount.yaml', label: 'templates/serviceaccount.yaml' },
  ];

  // Load repositories on mount
  useEffect(() => {
    gitOpsApi.listRepositories()
      .then(data => {
        setRepositories(data.repositories);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [gitOpsApi]);

  // Load branches when repo changes
  useEffect(() => {
    if (!selectedRepo) return;

    gitOpsApi.listBranches(selectedRepo)
      .then(data => {
        setBranches(data.branches);
      })
      .catch(err => setError(err));
  }, [selectedRepo, gitOpsApi]);

  // Load file when repo, branch, or file selection changes
  useEffect(() => {
    if (!selectedRepo || !selectedBranch || !selectedFile) return;

    gitOpsApi.getFileContent(
      selectedRepo,
      selectedBranch,
      selectedFile
    )
      .then(data => setFileContent(data))
      .catch(err => console.error('Failed to load file:', err));
  }, [selectedRepo, selectedBranch, selectedFile, gitOpsApi]);

  const handleReset = () => {
    setSelectedRepo('');
    setSelectedBranch('');
    setSelectedFile('');
    setFileContent(null);
    setEditorOpen(false);
  };

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          Mock data mode active. Connect GitHub PAT to access real repositories.
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <InfoCard
          title="Repository Selection"
          action={
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              disabled={!selectedRepo && !selectedBranch && !selectedFile}
            >
              Reset
            </Button>
          }
        >
          <Grid container spacing={2}>
            <Grid item md={4} xs={12}>
              <Autocomplete
                options={repositories.map(repo => repo.name)}
                value={selectedRepo || null}
                onChange={(_, newValue) => setSelectedRepo(newValue || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Repository"
                    margin="normal"
                    placeholder="Search repositories..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <FolderIcon style={{ marginLeft: 8, marginRight: 4, color: '#09143F' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                fullWidth
              />
            </Grid>

            <Grid item md={4} xs={12}>
              <Autocomplete
                options={branches.map(branch => branch.name)}
                value={selectedBranch || null}
                onChange={(_, newValue) => setSelectedBranch(newValue || '')}
                disabled={!selectedRepo}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Branch (${branches.length} total)`}
                    margin="normal"
                    placeholder="Search branches..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <AccountTreeIcon style={{ marginLeft: 8, marginRight: 4, color: '#09143F' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(option) => {
                  const branch = branches.find(b => b.name === option);
                  return (
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{option}</span>
                      {branch?.protected && <Chip label="protected" size="small" />}
                    </Box>
                  );
                }}
                fullWidth
              />
            </Grid>

            <Grid item md={4} xs={12}>
              <Autocomplete
                options={commonFiles}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                value={commonFiles.find(f => f.path === selectedFile) || null}
                onChange={(_, newValue) => setSelectedFile(newValue ? newValue.path : '')}
                disabled={!selectedBranch}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="File"
                    margin="normal"
                    placeholder="Search files..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <DescriptionIcon style={{ marginLeft: 8, marginRight: 4, color: '#09143F' }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                fullWidth
              />
            </Grid>
          </Grid>
        </InfoCard>
      </Grid>

      <Grid item xs={12}>
        <InfoCard
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <DescriptionIcon style={{ color: '#09143F' }} />
              File Viewer: {commonFiles.find(f => f.path === selectedFile)?.label || 'Select a file'}
            </Box>
          }
        >
          {fileContent ? (
            <Box>
              <Box mb={2}>
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  <Chip
                    icon={<AccountTreeIcon />}
                    label={`Branch: ${fileContent.branch}`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`SHA: ${fileContent.sha.substring(0, 7)}`}
                    variant="outlined"
                  />
                  <Chip
                    label={`Size: ${fileContent.size} bytes`}
                    variant="outlined"
                  />
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setEditorOpen(true)}
                  fullWidth
                  size="large"
                  style={{
                    background: 'linear-gradient(45deg, #09143F 30%, #2ea3f2 90%)',
                    boxShadow: '0 3px 5px 2px rgba(9, 20, 63, .3)',
                    fontWeight: 600,
                  }}
                >
                  Edit with Monaco
                </Button>
              </Box>
              <Box
                style={{
                  border: '2px solid #09143F',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <TextField
                  fullWidth
                  multiline
                  rows={15}
                  variant="outlined"
                  value={fileContent.content}
                  InputProps={{
                    readOnly: true,
                    style: {
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      backgroundColor: '#f5f5f5',
                    }
                  }}
                />
              </Box>
              <Alert severity="info" style={{ marginTop: 16 }}>
                Read-only preview - Click "Edit with Monaco" to modify this file
              </Alert>
            </Box>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <DescriptionIcon style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No file selected
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Select a repository, branch, and file to view its contents
              </Typography>
            </Box>
          )}
        </InfoCard>
      </Grid>

      <FileEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        repository={selectedRepo}
        fileContent={fileContent}
        branches={branches}
        currentBranch={selectedBranch}
        onSuccess={() => {
          // Reload file content after successful commit
          if (selectedRepo && selectedBranch && fileContent) {
            gitOpsApi.getFileContent(selectedRepo, selectedBranch, fileContent.path)
              .then(data => setFileContent(data))
              .catch(err => console.error('Failed to reload file:', err));
          }
        }}
      />
    </Grid>
  );
};
