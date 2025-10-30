import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef, BulkOperation } from '../../api';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Grid, Chip, LinearProgress, Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';

export const OperationsTracker = () => {
  const gitOpsApi = useApi(gitOpsApiRef);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadOperations = () => {
      gitOpsApi.listBulkOperations({ limit: 50 })
        .then(data => {
          setOperations(data.operations);
          setLoading(false);
        })
        .catch(err => {
          setError(err);
          setLoading(false);
        });
    };

    // Initial load
    loadOperations();

    // Poll every 5 seconds for updates
    const interval = setInterval(loadOperations, 5000);

    return () => clearInterval(interval);
  }, [gitOpsApi]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'primary';
      case 'in_progress': return 'default';
      case 'failed': return 'secondary';
      case 'partial': return 'default';
      default: return 'default';
    }
  };

  const columns: TableColumn[] = [
    {
      title: 'Operation ID',
      field: 'id',
      render: (row: BulkOperation) => row.id.substring(0, 8) + '...',
    },
    {
      title: 'Status',
      render: (row: BulkOperation) => (
        <Chip
          label={row.status}
          color={getStatusColor(row.status) as any}
          size="small"
        />
      ),
    },
    {
      title: 'Progress',
      render: (row: BulkOperation) => (
        <Box width="100%">
          <LinearProgress
            variant="determinate"
            value={row.progress_percentage}
          />
          <Typography variant="caption">
            {row.progress_percentage}%
          </Typography>
        </Box>
      ),
    },
    {
      title: 'Targets',
      field: 'total_targets',
    },
    {
      title: 'Success',
      field: 'successful_count',
    },
    {
      title: 'Failed',
      field: 'failed_count',
    },
  ];

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          {operations.length === 0
            ? 'No bulk operations yet. Operations will appear here when you perform bulk updates across branches.'
            : `Tracking ${operations.length} bulk operations.`}
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <InfoCard title="Bulk Operations">
          {operations.length > 0 ? (
            <Table
              options={{ paging: true, pageSize: 10 }}
              columns={columns}
              data={operations}
            />
          ) : (
            <Box p={3} textAlign="center">
              <Typography variant="body1" color="textSecondary">
                No operations to display
              </Typography>
            </Box>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
};
