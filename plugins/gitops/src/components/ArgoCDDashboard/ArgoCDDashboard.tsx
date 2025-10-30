import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef, ArgoCDApplication } from '../../api';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Grid, Chip, Typography, Box } from '@material-ui/core';
import { Alert } from '@material-ui/lab';

export const ArgoCDDashboard = () => {
  const gitOpsApi = useApi(gitOpsApiRef);
  const [applications, setApplications] = useState<ArgoCDApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    gitOpsApi.listArgoCDApplications()
      .then(data => {
        setApplications(data.applications);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [gitOpsApi]);

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'Synced': return 'primary';
      case 'OutOfSync': return 'secondary';
      default: return 'default';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'primary';
      case 'Progressing': return 'default';
      case 'Degraded': return 'secondary';
      default: return 'default';
    }
  };

  const columns: TableColumn[] = [
    {
      title: 'Application',
      field: 'metadata.name',
      highlight: true,
    },
    {
      title: 'Namespace',
      field: 'spec.destination.namespace',
    },
    {
      title: 'Branch',
      field: 'spec.source.targetRevision',
    },
    {
      title: 'Sync Status',
      render: (row: ArgoCDApplication) => (
        <Chip
          label={row.status.sync.status}
          color={getSyncStatusColor(row.status.sync.status) as any}
          size="small"
        />
      ),
    },
    {
      title: 'Health',
      render: (row: ArgoCDApplication) => (
        <Chip
          label={row.status.health.status}
          color={getHealthColor(row.status.health.status) as any}
          size="small"
        />
      ),
    },
  ];

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  const syncedCount = applications.filter(app => app.status.sync.status === 'Synced').length;
  const outOfSyncCount = applications.filter(app => app.status.sync.status === 'OutOfSync').length;
  const healthyCount = applications.filter(app => app.status.health.status === 'Healthy').length;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          Mock data mode active. Showing {applications.length} simulated ArgoCD applications for rli-use2.
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <Box display="flex" gap={2} mb={2}>
          <Chip label={`Total: ${applications.length}`} />
          <Chip label={`Synced: ${syncedCount}`} color="primary" />
          <Chip label={`Out of Sync: ${outOfSyncCount}`} color="secondary" />
          <Chip label={`Healthy: ${healthyCount}`} color="primary" />
        </Box>
      </Grid>

      <Grid item xs={12}>
        <InfoCard title="ArgoCD Applications">
          <Table
            options={{ paging: true, pageSize: 10, search: true }}
            columns={columns}
            data={applications}
          />
        </InfoCard>
      </Grid>
    </Grid>
  );
};
