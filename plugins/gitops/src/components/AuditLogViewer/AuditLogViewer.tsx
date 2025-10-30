import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Grid, Chip, Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';

export const AuditLogViewer = () => {
  const gitOpsApi = useApi(gitOpsApiRef);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    gitOpsApi.listAuditLogs({ limit: 100 })
      .then(data => {
        setLogs(data.logs);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [gitOpsApi]);

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'commit': return 'primary';
      case 'sync': return 'primary';
      case 'read': return 'default';
      case 'update': return 'secondary';
      default: return 'default';
    }
  };

  const columns: TableColumn[] = [
    {
      title: 'Timestamp',
      field: 'created_at',
      render: (row: any) => new Date(row.created_at).toLocaleString(),
    },
    {
      title: 'Operation',
      render: (row: any) => (
        <Chip
          label={row.operation}
          color={getOperationColor(row.operation) as any}
          size="small"
        />
      ),
    },
    {
      title: 'Resource',
      field: 'resource_type',
    },
    {
      title: 'Repository',
      field: 'repository',
    },
    {
      title: 'Branch',
      field: 'branch',
    },
    {
      title: 'User',
      field: 'user_id',
    },
    {
      title: 'Status',
      render: (row: any) => (
        <Chip
          label={row.status}
          color={row.status === 'success' ? 'primary' : 'secondary'}
          size="small"
        />
      ),
    },
  ];

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info">
          {logs.length === 0
            ? 'No audit logs yet. All operations will be tracked here for compliance and debugging.'
            : `Showing ${logs.length} recent audit log entries.`}
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <InfoCard title="Audit Logs">
          {logs.length > 0 ? (
            <Table
              options={{ paging: true, pageSize: 20, search: true }}
              columns={columns}
              data={logs}
            />
          ) : (
            <Box p={3} textAlign="center">
              <Typography variant="body1" color="textSecondary">
                No audit logs to display
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                Audit logs will appear here when you perform operations
              </Typography>
            </Box>
          )}
        </InfoCard>
      </Grid>
    </Grid>
  );
};
