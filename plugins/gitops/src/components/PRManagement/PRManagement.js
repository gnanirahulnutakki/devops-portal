import React, { useState } from 'react';
import { Box, Grid, Button, FormControl, InputLabel, Select, MenuItem, Typography, makeStyles, Breadcrumbs, Link, } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import HomeIcon from '@material-ui/icons/Home';
import { Alert } from '@material-ui/lab';
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
export const PRManagement = () => {
    const classes = useStyles();
    // Repository selection
    const [selectedRepo, setSelectedRepo] = useState('radiantlogic-saas/rli-use2');
    const [currentBranch, setCurrentBranch] = useState('tenant-demo-001');
    // View state
    const [selectedPR, setSelectedPR] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    // Mock repositories - in real implementation, fetch from API
    const repositories = [
        'radiantlogic-saas/rli-use2',
        'radiantlogic-saas/fid-platform',
        'radiantlogic-saas/monitoring-stack',
    ];
    const handlePRClick = (prNumber) => {
        setSelectedPR(prNumber);
    };
    const handleBackToList = () => {
        setSelectedPR(null);
    };
    const handleCreatePR = () => {
        setCreateDialogOpen(true);
    };
    const handlePRCreated = (pr) => {
        console.log('PR created:', pr);
        // Could navigate to the new PR details or just refresh the list
        setSelectedPR(pr.number);
    };
    return (React.createElement(Box, null,
        selectedPR && (React.createElement(Breadcrumbs, { className: classes.breadcrumbs },
            React.createElement(Link, { component: "button", variant: "body1", onClick: handleBackToList, style: { display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement(HomeIcon, { fontSize: "small" }),
                "Pull Requests"),
            React.createElement(Typography, { color: "textPrimary" },
                "PR #",
                selectedPR))),
        !selectedPR && (React.createElement(Box, { className: classes.header },
            React.createElement(FormControl, { className: classes.repoSelector, variant: "outlined", size: "small" },
                React.createElement(InputLabel, null, "Repository"),
                React.createElement(Select, { value: selectedRepo, onChange: (e) => setSelectedRepo(e.target.value), label: "Repository" }, repositories.map((repo) => (React.createElement(MenuItem, { key: repo, value: repo }, repo))))),
            React.createElement(Button, { variant: "contained", color: "primary", startIcon: React.createElement(AddIcon, null), onClick: handleCreatePR }, "Create Pull Request"))),
        React.createElement(Alert, { severity: "info", style: { marginBottom: 16 } }, selectedPR
            ? 'Viewing pull request details. All changes are tracked in the audit log.'
            : 'Manage pull requests for your GitOps repositories. Create PRs to propose changes across branches.'),
        React.createElement(Grid, { container: true, spacing: 3 },
            React.createElement(Grid, { item: true, xs: 12 }, selectedPR ? (React.createElement(PullRequestDetails, { repository: selectedRepo, pullNumber: selectedPR, onClose: handleBackToList })) : (React.createElement(PullRequestList, { repository: selectedRepo, onPullRequestClick: handlePRClick })))),
        React.createElement(CreatePullRequestDialog, { open: createDialogOpen, onClose: () => setCreateDialogOpen(false), repository: selectedRepo, currentBranch: currentBranch, onPullRequestCreated: handlePRCreated })));
};
//# sourceMappingURL=PRManagement.js.map