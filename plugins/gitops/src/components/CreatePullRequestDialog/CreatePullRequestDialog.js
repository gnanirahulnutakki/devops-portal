import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, CircularProgress, Typography, makeStyles, } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
const useStyles = makeStyles((theme) => ({
    formControl: {
        marginBottom: theme.spacing(2),
        width: '100%',
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing(3),
    },
}));
export const CreatePullRequestDialog = ({ open, onClose, repository, currentBranch, onPullRequestCreated, }) => {
    const classes = useStyles();
    const config = useApi(configApiRef);
    const backendUrl = config.getString('backend.baseUrl');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [baseBranch, setBaseBranch] = useState('main');
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [error, setError] = useState(null);
    // Load available branches when dialog opens
    useEffect(() => {
        if (open) {
            loadBranches();
        }
        else {
            // Reset form when dialog closes
            setTitle('');
            setBody('');
            setBaseBranch('main');
            setError(null);
        }
    }, [open]);
    const loadBranches = async () => {
        setLoadingBranches(true);
        try {
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/branches`);
            if (!response.ok) {
                throw new Error('Failed to load branches');
            }
            const data = await response.json();
            const branchNames = data.branches.map((b) => b.name);
            setBranches(branchNames);
            // Set default base branch to 'main' if it exists, otherwise first branch
            if (branchNames.includes('main')) {
                setBaseBranch('main');
            }
            else if (branchNames.includes('master')) {
                setBaseBranch('master');
            }
            else if (branchNames.length > 0) {
                setBaseBranch(branchNames[0]);
            }
        }
        catch (err) {
            console.error('Error loading branches:', err);
            setError(`Failed to load branches: ${err.message}`);
        }
        finally {
            setLoadingBranches(false);
        }
    };
    const handleCreate = async () => {
        if (!title.trim()) {
            setError('PR title is required');
            return;
        }
        if (baseBranch === currentBranch) {
            setError('Cannot create PR: base and head branches are the same');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Create the pull request
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title.trim(),
                    body: body.trim() || undefined,
                    head: currentBranch,
                    base: baseBranch,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to create pull request');
            }
            const data = await response.json();
            if (onPullRequestCreated) {
                onPullRequestCreated(data.pull);
            }
            onClose();
        }
        catch (err) {
            console.error('Error creating pull request:', err);
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    return (React.createElement(Dialog, { open: open, onClose: onClose, maxWidth: "sm", fullWidth: true },
        React.createElement(DialogTitle, null, "Create Pull Request"),
        React.createElement(DialogContent, null, loadingBranches ? (React.createElement(Box, { className: classes.loadingContainer },
            React.createElement(CircularProgress, null))) : (React.createElement(React.Fragment, null,
            error && (React.createElement(Alert, { severity: "error", style: { marginBottom: 16 } }, error)),
            React.createElement(Box, { mb: 2 },
                React.createElement(Typography, { variant: "body2", color: "textSecondary" },
                    "Creating PR from ",
                    React.createElement("strong", null, currentBranch),
                    " into:")),
            React.createElement(FormControl, { className: classes.formControl },
                React.createElement(InputLabel, null, "Base Branch"),
                React.createElement(Select, { value: baseBranch, onChange: (e) => setBaseBranch(e.target.value), disabled: loading }, branches
                    .filter((branch) => branch !== currentBranch)
                    .map((branch) => (React.createElement(MenuItem, { key: branch, value: branch }, branch))))),
            React.createElement(TextField, { className: classes.formControl, label: "Title", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Brief description of changes", required: true, disabled: loading, fullWidth: true, autoFocus: true }),
            React.createElement(TextField, { className: classes.formControl, label: "Description (optional)", value: body, onChange: (e) => setBody(e.target.value), placeholder: "Detailed description of the pull request", multiline: true, rows: 4, disabled: loading, fullWidth: true })))),
        React.createElement(DialogActions, null,
            React.createElement(Button, { onClick: onClose, disabled: loading }, "Cancel"),
            React.createElement(Button, { onClick: handleCreate, color: "primary", variant: "contained", disabled: loading || loadingBranches || !title.trim() }, loading ? React.createElement(CircularProgress, { size: 24 }) : 'Create Pull Request'))));
};
//# sourceMappingURL=CreatePullRequestDialog.js.map