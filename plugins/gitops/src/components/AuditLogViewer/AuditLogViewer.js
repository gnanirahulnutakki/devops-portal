import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { InfoCard, Progress, ResponseErrorPanel, Table, } from '@backstage/core-components';
import { Grid, Chip, Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
export const AuditLogViewer = () => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    const getOperationColor = (operation) => {
        switch (operation) {
            case 'commit': return 'primary';
            case 'sync': return 'primary';
            case 'read': return 'default';
            case 'update': return 'secondary';
            default: return 'default';
        }
    };
    const columns = [
        {
            title: 'Timestamp',
            field: 'created_at',
            render: (row) => new Date(row.created_at).toLocaleString(),
        },
        {
            title: 'Operation',
            render: (row) => (React.createElement(Chip, { label: row.operation, color: getOperationColor(row.operation), size: "small" })),
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
            render: (row) => (React.createElement(Chip, { label: row.status, color: row.status === 'success' ? 'primary' : 'secondary', size: "small" })),
        },
    ];
    if (loading)
        return React.createElement(Progress, null);
    if (error)
        return React.createElement(ResponseErrorPanel, { error: error });
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" }, logs.length === 0
                ? 'No audit logs yet. All operations will be tracked here for compliance and debugging.'
                : `Showing ${logs.length} recent audit log entries.`)),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "Audit Logs" }, logs.length > 0 ? (React.createElement(Table, { options: { paging: true, pageSize: 20, search: true }, columns: columns, data: logs })) : (React.createElement(Box, { p: 3, textAlign: "center" },
                React.createElement(Typography, { variant: "body1", color: "textSecondary" }, "No audit logs to display"),
                React.createElement(Typography, { variant: "body2", color: "textSecondary", style: { marginTop: 8 } }, "Audit logs will appear here when you perform operations")))))));
};
//# sourceMappingURL=AuditLogViewer.js.map