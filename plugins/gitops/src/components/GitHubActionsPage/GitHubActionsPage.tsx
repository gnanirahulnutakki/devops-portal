import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  Progress,
  InfoCard,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { GitHubActionsDashboard } from '../GitHubActions';

interface Repository {
  name: string;
  full_name: string;
  description?: string;
}

export const GitHubActionsPage: React.FC = () => {
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/gitops/repositories`);
        if (res.ok) {
          const data = await res.json();
          setRepositories(data.repositories || []);
          if (data.repositories?.length > 0) {
            setSelectedRepo(data.repositories[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch repositories:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, [backendUrl]);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!selectedRepo) return;

      try {
        const res = await fetch(
          `${backendUrl}/api/gitops/repositories/${encodeURIComponent(selectedRepo)}/branches`
        );
        if (res.ok) {
          const data = await res.json();
          setBranches(data.branches?.map((b: any) => b.name) || []);
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };

    fetchBranches();
  }, [backendUrl, selectedRepo]);

  if (loading) {
    return <Progress />;
  }

  return (
    <Page themeId="tool">
      <Header
        title="GitHub Actions"
        subtitle="Monitor CI/CD workflows, view build status, and manage workflow runs"
      />
      <Content>
        {/* Filters */}
        <InfoCard title="Filters">
          <Box display="flex" gap={2} flexWrap="wrap">
            <FormControl variant="outlined" size="small" style={{ minWidth: 250 }}>
              <InputLabel>Repository</InputLabel>
              <Select
                value={selectedRepo}
                onChange={(e) => {
                  setSelectedRepo(e.target.value as string);
                  setSelectedBranch('');
                }}
                label="Repository"
              >
                {repositories.map((repo) => (
                  <MenuItem key={repo.name} value={repo.name}>
                    {repo.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
              <InputLabel>Branch (optional)</InputLabel>
              <Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as string)}
                label="Branch (optional)"
              >
                <MenuItem value="">All branches</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch} value={branch}>
                    {branch}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </InfoCard>

        {/* Dashboard */}
        {selectedRepo ? (
          <Box mt={2}>
            <GitHubActionsDashboard
              repository={selectedRepo}
              branch={selectedBranch || undefined}
              showSummary={true}
              maxRuns={20}
            />
          </Box>
        ) : (
          <InfoCard>
            <Typography color="textSecondary" align="center">
              Select a repository to view workflow runs
            </Typography>
          </InfoCard>
        )}
      </Content>
    </Page>
  );
};

export default GitHubActionsPage;
