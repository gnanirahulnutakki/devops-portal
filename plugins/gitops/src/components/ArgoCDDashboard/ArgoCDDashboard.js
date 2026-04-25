import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { InfoCard, Progress, ResponseErrorPanel, Table, } from '@backstage/core-components';
import { Grid, Chip, Box } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
export const ArgoCDDashboard = () => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    const getSyncStatusColor = (status) => {
        switch (status) {
            case 'Synced': return 'primary';
            case 'OutOfSync': return 'secondary';
            default: return 'default';
        }
    };
    const getHealthColor = (status) => {
        switch (status) {
            case 'Healthy': return 'primary';
            case 'Progressing': return 'default';
            case 'Degraded': return 'secondary';
            default: return 'default';
        }
    };
    const columns = [
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
            render: (row) => (React.createElement(Chip, { label: row.status.sync.status, color: getSyncStatusColor(row.status.sync.status), size: "small" })),
        },
        {
            title: 'Health',
            render: (row) => (React.createElement(Chip, { label: row.status.health.status, color: getHealthColor(row.status.health.status), size: "small" })),
        },
    ];
    if (loading)
        return React.createElement(Progress, null);
    if (error)
        return React.createElement(ResponseErrorPanel, { error: error });
    const syncedCount = applications.filter(app => app.status.sync.status === 'Synced').length;
    const outOfSyncCount = applications.filter(app => app.status.sync.status === 'OutOfSync').length;
    const healthyCount = applications.filter(app => app.status.health.status === 'Healthy').length;
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" },
                "Mock data mode active. Showing ",
                applications.length,
                " simulated ArgoCD applications for rli-use2.")),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Box, { display: "flex", style: { gap: 2 * 8 }, mb: 2 },
                React.createElement(Chip, { label: `Total: ${applications.length}` }),
                React.createElement(Chip, { label: `Synced: ${syncedCount}`, color: "primary" }),
                React.createElement(Chip, { label: `Out of Sync: ${outOfSyncCount}`, color: "secondary" }),
                React.createElement(Chip, { label: `Healthy: ${healthyCount}`, color: "primary" }))),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "ArgoCD Applications" },
                React.createElement(Table, { options: { paging: true, pageSize: 10, search: true }, columns: columns, data: applications })))));
};
//# sourceMappingURL=ArgoCDDashboard.js.map