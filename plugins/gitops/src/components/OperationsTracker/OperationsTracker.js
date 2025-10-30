import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { InfoCard, Progress, ResponseErrorPanel, Table, } from '@backstage/core-components';
import { Grid, Chip, LinearProgress, Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
export const OperationsTracker = () => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'primary';
            case 'in_progress': return 'default';
            case 'failed': return 'secondary';
            case 'partial': return 'default';
            default: return 'default';
        }
    };
    const columns = [
        {
            title: 'Operation ID',
            field: 'id',
            render: (row) => row.id.substring(0, 8) + '...',
        },
        {
            title: 'Status',
            render: (row) => (React.createElement(Chip, { label: row.status, color: getStatusColor(row.status), size: "small" })),
        },
        {
            title: 'Progress',
            render: (row) => (React.createElement(Box, { width: "100%" },
                React.createElement(LinearProgress, { variant: "determinate", value: row.progress_percentage }),
                React.createElement(Typography, { variant: "caption" },
                    row.progress_percentage,
                    "%"))),
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
    if (loading)
        return React.createElement(Progress, null);
    if (error)
        return React.createElement(ResponseErrorPanel, { error: error });
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" }, operations.length === 0
                ? 'No bulk operations yet. Operations will appear here when you perform bulk updates across branches.'
                : `Tracking ${operations.length} bulk operations.`)),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "Bulk Operations" }, operations.length > 0 ? (React.createElement(Table, { options: { paging: true, pageSize: 10 }, columns: columns, data: operations })) : (React.createElement(Box, { p: 3, textAlign: "center" },
                React.createElement(Typography, { variant: "body1", color: "textSecondary" }, "No operations to display")))))));
};
//# sourceMappingURL=OperationsTracker.js.map