import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, Chip, Avatar, CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, makeStyles, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemAvatar, ListItemText, IconButton, Grid, } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import MergeIcon from '@material-ui/icons/CallMerge';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import CloseIcon from '@material-ui/icons/Close';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { DiffViewer } from '../DiffViewer';
const useStyles = makeStyles((theme) => ({
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing(3),
    },
    titleSection: {
        flex: 1,
    },
    title: {
        fontWeight: 500,
        marginBottom: theme.spacing(1),
    },
    metaInfo: {
        display: 'flex',
        gap: theme.spacing(2),
        alignItems: 'center',
        color: theme.palette.text.secondary,
        fontSize: '0.875rem',
    },
    statusChip: {
        marginLeft: theme.spacing(2),
    },
    section: {
        marginBottom: theme.spacing(3),
    },
    sectionTitle: {
        fontWeight: 500,
        marginBottom: theme.spacing(2),
    },
    branchInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.default,
        borderRadius: theme.shape.borderRadius,
    },
    mergeSection: {
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.default,
        borderRadius: theme.shape.borderRadius,
    },
    mergeButton: {
        marginTop: theme.spacing(2),
    },
    reviewersList: {
        maxHeight: 200,
        overflow: 'auto',
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing(4),
    },
    diffSection: {
        marginTop: theme.spacing(3),
    },
}));
export const PullRequestDetails = ({ repository, pullNumber, onClose, }) => {
    const classes = useStyles();
    const config = useApi(configApiRef);
    const backendUrl = config.getString('backend.baseUrl');
    const [pr, setPr] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mergeMethod, setMergeMethod] = useState('merge');
    const [merging, setMerging] = useState(false);
    const [addReviewersOpen, setAddReviewersOpen] = useState(false);
    const [addAssigneesOpen, setAddAssigneesOpen] = useState(false);
    const [reviewerInput, setReviewerInput] = useState('');
    const [assigneeInput, setAssigneeInput] = useState('');
    useEffect(() => {
        loadPullRequestDetails();
        loadPullRequestFiles();
    }, [repository, pullNumber]);
    const loadPullRequestDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}`);
            if (!response.ok) {
                throw new Error('Failed to load pull request details');
            }
            const data = await response.json();
            setPr(data.pull);
        }
        catch (err) {
            console.error('Error loading PR details:', err);
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const loadPullRequestFiles = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/files`);
            if (!response.ok) {
                throw new Error('Failed to load pull request files');
            }
            const data = await response.json();
            setFiles(data.files || []);
        }
        catch (err) {
            console.error('Error loading PR files:', err);
        }
    };
    const handleMerge = async () => {
        if (!pr)
            return;
        setMerging(true);
        setError(null);
        try {
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/merge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    merge_method: mergeMethod,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to merge pull request');
            }
            // Reload PR details to show merged state
            await loadPullRequestDetails();
        }
        catch (err) {
            console.error('Error merging PR:', err);
            setError(err.message);
        }
        finally {
            setMerging(false);
        }
    };
    const handleAddReviewers = async () => {
        if (!reviewerInput.trim())
            return;
        try {
            const reviewers = reviewerInput.split(',').map(r => r.trim()).filter(r => r);
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/reviewers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reviewers }),
            });
            if (!response.ok) {
                throw new Error('Failed to add reviewers');
            }
            // Reload PR details to show new reviewers
            await loadPullRequestDetails();
            setAddReviewersOpen(false);
            setReviewerInput('');
        }
        catch (err) {
            console.error('Error adding reviewers:', err);
            setError(err.message);
        }
    };
    const handleAddAssignees = async () => {
        if (!assigneeInput.trim())
            return;
        try {
            const assignees = assigneeInput.split(',').map(a => a.trim()).filter(a => a);
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/assignees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ assignees }),
            });
            if (!response.ok) {
                throw new Error('Failed to add assignees');
            }
            // Reload PR details to show new assignees
            await loadPullRequestDetails();
            setAddAssigneesOpen(false);
            setAssigneeInput('');
        }
        catch (err) {
            console.error('Error adding assignees:', err);
            setError(err.message);
        }
    };
    const getStateChip = () => {
        if (!pr)
            return null;
        if (pr.state === 'closed' && pr.merged) {
            return (React.createElement(Chip, { icon: React.createElement(CheckCircleIcon, null), label: "Merged", style: { backgroundColor: '#6f42c1', color: 'white' } }));
        }
        else if (pr.state === 'closed') {
            return React.createElement(Chip, { label: "Closed", color: "secondary" });
        }
        else {
            return (React.createElement(Chip, { icon: React.createElement(MergeIcon, null), label: "Open", style: { backgroundColor: '#28a745', color: 'white' } }));
        }
    };
    const getMergeabilityStatus = () => {
        if (!pr)
            return null;
        if (pr.merged) {
            return (React.createElement(Alert, { severity: "success", icon: React.createElement(CheckCircleIcon, null) }, "This pull request was merged"));
        }
        if (pr.mergeable === false) {
            return (React.createElement(Alert, { severity: "error", icon: React.createElement(ErrorIcon, null) }, "This branch has conflicts that must be resolved before merging"));
        }
        if (pr.mergeable === true) {
            return (React.createElement(Alert, { severity: "success", icon: React.createElement(CheckCircleIcon, null) }, "This branch has no conflicts with the base branch"));
        }
        return (React.createElement(Alert, { severity: "info" }, "Checking if this pull request can be merged..."));
    };
    if (loading) {
        return (React.createElement(Box, { className: classes.loadingContainer },
            React.createElement(CircularProgress, null)));
    }
    if (error) {
        return (React.createElement(Alert, { severity: "error" }, error));
    }
    if (!pr) {
        return (React.createElement(Alert, { severity: "warning" }, "Pull request not found"));
    }
    return (React.createElement(Box, null,
        React.createElement(Box, { className: classes.header },
            React.createElement(Box, { className: classes.titleSection },
                React.createElement(Box, { display: "flex", alignItems: "center" },
                    React.createElement(Typography, { variant: "h5", className: classes.title }, pr.title),
                    getStateChip()),
                React.createElement(Typography, { variant: "body2", className: classes.metaInfo },
                    "#",
                    pr.number,
                    " opened by ",
                    pr.user?.login,
                    " \u2022",
                    ' ',
                    new Date(pr.created_at).toLocaleDateString())),
            onClose && (React.createElement(IconButton, { onClick: onClose },
                React.createElement(CloseIcon, null)))),
        error && (React.createElement(Alert, { severity: "error", style: { marginBottom: 16 } }, error)),
        React.createElement(Grid, { container: true, spacing: 3 },
            React.createElement(Grid, { item: true, xs: 12, md: 8 },
                pr.body && (React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Typography, { variant: "body1", style: { whiteSpace: 'pre-wrap' } }, pr.body)))),
                React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Typography, { variant: "h6", className: classes.sectionTitle }, "Branches"),
                        React.createElement(Box, { className: classes.branchInfo },
                            React.createElement(Chip, { label: pr.head?.ref, color: "primary" }),
                            React.createElement(Typography, { variant: "body2" }, "\u2192"),
                            React.createElement(Chip, { label: pr.base?.ref, variant: "outlined" })))),
                React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Typography, { variant: "h6", className: classes.sectionTitle },
                            "Changes (",
                            files.length,
                            " files)"),
                        React.createElement(Box, { mb: 2 },
                            React.createElement(Chip, { label: `+${pr.additions || 0} additions`, size: "small", style: { backgroundColor: '#28a745', color: 'white', marginRight: 8 } }),
                            React.createElement(Chip, { label: `-${pr.deletions || 0} deletions`, size: "small", style: { backgroundColor: '#d73a49', color: 'white' } })),
                        React.createElement(DiffViewer, { files: files }))),
                pr.state === 'open' && (React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Typography, { variant: "h6", className: classes.sectionTitle }, "Merge Pull Request"),
                        getMergeabilityStatus(),
                        React.createElement(Box, { className: classes.mergeSection, mt: 2 },
                            React.createElement(FormControl, { fullWidth: true, size: "small" },
                                React.createElement(InputLabel, null, "Merge Method"),
                                React.createElement(Select, { value: mergeMethod, onChange: (e) => setMergeMethod(e.target.value), label: "Merge Method", disabled: merging || pr.mergeable === false },
                                    React.createElement(MenuItem, { value: "merge" }, "Create a merge commit"),
                                    React.createElement(MenuItem, { value: "squash" }, "Squash and merge"),
                                    React.createElement(MenuItem, { value: "rebase" }, "Rebase and merge"))),
                            React.createElement(Button, { variant: "contained", color: "primary", fullWidth: true, className: classes.mergeButton, onClick: handleMerge, disabled: merging || pr.mergeable === false, startIcon: merging ? React.createElement(CircularProgress, { size: 20 }) : React.createElement(MergeIcon, null) }, merging ? 'Merging...' : 'Merge Pull Request')))))),
            React.createElement(Grid, { item: true, xs: 12, md: 4 },
                React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 },
                            React.createElement(Typography, { variant: "h6" }, "Reviewers"),
                            React.createElement(IconButton, { size: "small", onClick: () => setAddReviewersOpen(true), disabled: pr.state !== 'open' },
                                React.createElement(PersonAddIcon, null))),
                        pr.requested_reviewers && pr.requested_reviewers.length > 0 ? (React.createElement(List, { dense: true, className: classes.reviewersList }, pr.requested_reviewers.map((reviewer) => (React.createElement(ListItem, { key: reviewer.login },
                            React.createElement(ListItemAvatar, null,
                                React.createElement(Avatar, { src: reviewer.avatar_url, alt: reviewer.login })),
                            React.createElement(ListItemText, { primary: reviewer.login })))))) : (React.createElement(Typography, { variant: "body2", color: "textSecondary" }, "No reviewers assigned")))),
                React.createElement(Card, { className: classes.section },
                    React.createElement(CardContent, null,
                        React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 },
                            React.createElement(Typography, { variant: "h6" }, "Assignees"),
                            React.createElement(IconButton, { size: "small", onClick: () => setAddAssigneesOpen(true), disabled: pr.state !== 'open' },
                                React.createElement(PersonAddIcon, null))),
                        pr.assignees && pr.assignees.length > 0 ? (React.createElement(List, { dense: true, className: classes.reviewersList }, pr.assignees.map((assignee) => (React.createElement(ListItem, { key: assignee.login },
                            React.createElement(ListItemAvatar, null,
                                React.createElement(Avatar, { src: assignee.avatar_url, alt: assignee.login })),
                            React.createElement(ListItemText, { primary: assignee.login })))))) : (React.createElement(Typography, { variant: "body2", color: "textSecondary" }, "No assignees")))),
                React.createElement(Card, null,
                    React.createElement(CardContent, null,
                        React.createElement(Typography, { variant: "h6", gutterBottom: true }, "Details"),
                        React.createElement(Box, { display: "flex", flexDirection: "column", gap: 1 },
                            React.createElement(Typography, { variant: "body2" },
                                React.createElement("strong", null, "Commits:"),
                                " ",
                                pr.commits || 0),
                            React.createElement(Typography, { variant: "body2" },
                                React.createElement("strong", null, "Comments:"),
                                " ",
                                pr.comments || 0),
                            React.createElement(Typography, { variant: "body2" },
                                React.createElement("strong", null, "Changed files:"),
                                " ",
                                pr.changed_files || 0),
                            pr.merged_at && (React.createElement(Typography, { variant: "body2" },
                                React.createElement("strong", null, "Merged:"),
                                " ",
                                new Date(pr.merged_at).toLocaleDateString()))))))),
        React.createElement(Dialog, { open: addReviewersOpen, onClose: () => setAddReviewersOpen(false), maxWidth: "sm", fullWidth: true },
            React.createElement(DialogTitle, null, "Add Reviewers"),
            React.createElement(DialogContent, null,
                React.createElement(TextField, { autoFocus: true, fullWidth: true, label: "GitHub Usernames", placeholder: "username1, username2, ...", value: reviewerInput, onChange: (e) => setReviewerInput(e.target.value), helperText: "Enter GitHub usernames separated by commas", margin: "normal" })),
            React.createElement(DialogActions, null,
                React.createElement(Button, { onClick: () => setAddReviewersOpen(false) }, "Cancel"),
                React.createElement(Button, { onClick: handleAddReviewers, color: "primary", variant: "contained" }, "Add Reviewers"))),
        React.createElement(Dialog, { open: addAssigneesOpen, onClose: () => setAddAssigneesOpen(false), maxWidth: "sm", fullWidth: true },
            React.createElement(DialogTitle, null, "Add Assignees"),
            React.createElement(DialogContent, null,
                React.createElement(TextField, { autoFocus: true, fullWidth: true, label: "GitHub Usernames", placeholder: "username1, username2, ...", value: assigneeInput, onChange: (e) => setAssigneeInput(e.target.value), helperText: "Enter GitHub usernames separated by commas", margin: "normal" })),
            React.createElement(DialogActions, null,
                React.createElement(Button, { onClick: () => setAddAssigneesOpen(false) }, "Cancel"),
                React.createElement(Button, { onClick: handleAddAssignees, color: "primary", variant: "contained" }, "Add Assignees")))));
};
//# sourceMappingURL=PullRequestDetails.js.map