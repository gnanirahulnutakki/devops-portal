import React, { useState } from 'react';
import { Box, Grid, Button, Typography, makeStyles, Breadcrumbs, Link, TextField, } from '@material-ui/core';
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
export const PRManagement = () => {
    const classes = useStyles();
    const config = useApi(configApiRef);
    const backendUrl = config.getString('backend.baseUrl');
    // Repository selection
    const [selectedRepo, setSelectedRepo] = useState('');
    const [currentBranch, setCurrentBranch] = useState('master');
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(true);
    // View state
    const [selectedPR, setSelectedPR] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    // Load repositories from API
    React.useEffect(() => {
        const loadRepositories = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/gitops/repositories`);
                if (response.ok) {
                    const data = await response.json();
                    const repoNames = data.repositories.map((r) => r.name);
                    setRepositories(repoNames);
                }
            }
            catch (error) {
                console.error('Failed to load repositories:', error);
            }
            finally {
                setLoading(false);
            }
        };
        loadRepositories();
    }, [backendUrl]);
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
    const handleReset = () => {
        setSelectedRepo('');
        setSelectedPR(null);
        setCreateDialogOpen(false);
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
            React.createElement(Autocomplete, { className: classes.repoSelector, options: repositories, value: selectedRepo || null, onChange: (_, newValue) => setSelectedRepo(newValue || ''), renderInput: (params) => (React.createElement(TextField, { ...params, label: "Repository", variant: "outlined", size: "small", placeholder: "Search repositories...", InputProps: {
                        ...params.InputProps,
                        startAdornment: (React.createElement(React.Fragment, null,
                            React.createElement(FolderIcon, { style: { marginLeft: 8, marginRight: 4, color: '#09143F' } }),
                            params.InputProps.startAdornment)),
                    } })) }),
            React.createElement(Box, { display: "flex", gap: 1 },
                React.createElement(Button, { variant: "outlined", startIcon: React.createElement(RefreshIcon, null), onClick: handleReset, disabled: !selectedRepo }, "Reset"),
                React.createElement(Button, { variant: "contained", color: "primary", startIcon: React.createElement(AddIcon, null), onClick: handleCreatePR, style: {
                        background: 'linear-gradient(45deg, #09143F 30%, #2ea3f2 90%)',
                        boxShadow: '0 3px 5px 2px rgba(9, 20, 63, .3)',
                        fontWeight: 600,
                    } }, "Create Pull Request")))),
        React.createElement(Alert, { severity: "info", style: { marginBottom: 16 } }, selectedPR
            ? 'Viewing pull request details. All changes are tracked in the audit log.'
            : 'Manage pull requests for your GitOps repositories. Create PRs to propose changes across branches.'),
        React.createElement(Grid, { container: true, spacing: 3 },
            React.createElement(Grid, { item: true, xs: 12 }, loading ? (React.createElement(Alert, { severity: "info" }, "Loading repositories...")) : repositories.length === 0 ? (React.createElement(Alert, { severity: "warning" }, "No repositories available. Check your GitHub configuration.")) : !selectedRepo ? (React.createElement(Box, { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8 },
                React.createElement(FolderIcon, { style: { fontSize: 64, color: '#ccc', marginBottom: 16 } }),
                React.createElement(Typography, { variant: "h6", color: "textSecondary", gutterBottom: true }, "No repository selected"),
                React.createElement(Typography, { variant: "body2", color: "textSecondary" }, "Please select a repository from the dropdown above to view pull requests"))) : selectedPR ? (React.createElement(PullRequestDetails, { repository: selectedRepo, pullNumber: selectedPR, onClose: handleBackToList })) : (React.createElement(PullRequestList, { repository: selectedRepo, onPullRequestClick: handlePRClick })))),
        React.createElement(CreatePullRequestDialog, { open: createDialogOpen, onClose: () => setCreateDialogOpen(false), repository: selectedRepo, currentBranch: currentBranch, onPullRequestCreated: handlePRCreated })));
};
//# sourceMappingURL=PRManagement.js.map