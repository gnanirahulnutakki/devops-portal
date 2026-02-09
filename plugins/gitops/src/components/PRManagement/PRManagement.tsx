import React, { useState } from 'react';
import {
  Box,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Typography,
  makeStyles,
  Breadcrumbs,
  Link,
  TextField,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import HomeIcon from '@material-ui/icons/Home';
import RefreshIcon from '@material-ui/icons/Refresh';
import FolderIcon from '@material-ui/icons/Folder';
import { Alert, Autocomplete } from '@material-ui/lab';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { PullRequestList } from '../PullRequestList';
import { PullRequestDetails } from '../PullRequestDetails';
import { CreatePullRequestDialog } from '../CreatePullRequestDialog';

const useStyles = makeStyles((theme) => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  breadcrumbs: {
    marginBottom: theme.spacing(2),
  },
  repoSelector: {
    minWidth: 300,
  },
}));

export const PRManagement: React.FC = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  // Repository selection
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [currentBranch, setCurrentBranch] = useState<string>('master');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Load repositories from API
  React.useEffect(() => {
    const loadRepositories = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/gitops/repositories`);
        if (response.ok) {
          const data = await response.json();
          const repoNames = data.repositories.map((r: any) => r.name);
          setRepositories(repoNames);
        }
      } catch (error) {
        console.error('Failed to load repositories:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRepositories();
  }, [backendUrl]);

  const handlePRClick = (prNumber: number) => {
    setSelectedPR(prNumber);
  };

  const handleBackToList = () => {
    setSelectedPR(null);
  };

  const handleCreatePR = () => {
    setCreateDialogOpen(true);
  };

  const handlePRCreated = (pr: any) => {
    console.log('PR created:', pr);
    // Could navigate to the new PR details or just refresh the list
    setSelectedPR(pr.number);
  };

  const handleReset = () => {
    setSelectedRepo('');
    setSelectedPR(null);
    setCreateDialogOpen(false);
  };

  return (
    <Box>
      {/* Breadcrumbs */}
      {selectedPR && (
        <Breadcrumbs className={classes.breadcrumbs}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToList}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <HomeIcon fontSize="small" />
            Pull Requests
          </Link>
          <Typography color="textPrimary">PR #{selectedPR}</Typography>
        </Breadcrumbs>
      )}

      {/* Header with Repository Selector */}
      {!selectedPR && (
        <Box className={classes.header}>
          <Autocomplete
            className={classes.repoSelector}
            options={repositories}
            value={selectedRepo || null}
            onChange={(_, newValue) => setSelectedRepo(newValue || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Repository"
                variant="outlined"
                size="small"
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
          />

          <Box display="flex" style={{ gap: 1 * 8 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              disabled={!selectedRepo}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreatePR}
              style={{
                background: 'linear-gradient(45deg, #09143F 30%, #2ea3f2 90%)',
                boxShadow: '0 3px 5px 2px rgba(9, 20, 63, .3)',
                fontWeight: 600,
              }}
            >
              Create Pull Request
            </Button>
          </Box>
        </Box>
      )}

      {/* Info Alert */}
      <Alert severity="info" style={{ marginBottom: 16 }}>
        {selectedPR
          ? 'Viewing pull request details. All changes are tracked in the audit log.'
          : 'Manage pull requests for your GitOps repositories. Create PRs to propose changes across branches.'}
      </Alert>

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {loading ? (
            <Alert severity="info">Loading repositories...</Alert>
          ) : repositories.length === 0 ? (
            <Alert severity="warning">No repositories available. Check your GitHub configuration.</Alert>
          ) : !selectedRepo ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <FolderIcon style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No repository selected
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please select a repository from the dropdown above to view pull requests
              </Typography>
            </Box>
          ) : selectedPR ? (
            <PullRequestDetails
              repository={selectedRepo}
              pullNumber={selectedPR}
              onClose={handleBackToList}
            />
          ) : (
            <PullRequestList
              repository={selectedRepo}
              onPullRequestClick={handlePRClick}
            />
          )}
        </Grid>
      </Grid>

      {/* Create PR Dialog */}
      <CreatePullRequestDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        repository={selectedRepo}
        currentBranch={currentBranch}
        onPullRequestCreated={handlePRCreated}
      />
    </Box>
  );
};
