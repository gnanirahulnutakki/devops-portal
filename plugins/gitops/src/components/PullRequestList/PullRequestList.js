import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem, Avatar, makeStyles, Divider, } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import GitPullRequestIcon from '@material-ui/icons/CallMerge';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
const useStyles = makeStyles((theme) => ({
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing(2),
    },
    filterControl: {
        minWidth: 150,
    },
    prListItem: {
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
        padding: theme.spacing(2),
    },
    prHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
    },
    prTitle: {
        fontWeight: 500,
        color: theme.palette.primary.main,
    },
    prMeta: {
        display: 'flex',
        gap: theme.spacing(2),
        alignItems: 'center',
        marginTop: theme.spacing(1),
    },
    metaItem: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
        fontSize: '0.875rem',
        color: theme.palette.text.secondary,
    },
    emptyState: {
        textAlign: 'center',
        padding: theme.spacing(4),
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing(4),
    },
}));
export const PullRequestList = ({ repository, onPullRequestClick, }) => {
    const classes = useStyles();
    const config = useApi(configApiRef);
    const backendUrl = config.getString('backend.baseUrl');
    const [pulls, setPulls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [state, setState] = useState('open');
    useEffect(() => {
        loadPullRequests();
    }, [repository, state]);
    const loadPullRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ state });
            const response = await fetch(`${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls?${params}`);
            if (!response.ok) {
                throw new Error('Failed to load pull requests');
            }
            const data = await response.json();
            setPulls(data.pulls || []);
        }
        catch (err) {
            console.error('Error loading pull requests:', err);
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const handlePullRequestClick = (prNumber) => {
        if (onPullRequestClick) {
            onPullRequestClick(prNumber);
        }
    };
    const getStateChip = (pr) => {
        if (pr.state === 'closed' && pr.merged) {
            return (React.createElement(Chip, { icon: React.createElement(CheckCircleIcon, null), label: "Merged", size: "small", style: { backgroundColor: '#6f42c1', color: 'white' } }));
        }
        else if (pr.state === 'closed') {
            return React.createElement(Chip, { label: "Closed", size: "small", color: "secondary" });
        }
        else {
            return (React.createElement(Chip, { icon: React.createElement(GitPullRequestIcon, null), label: "Open", size: "small", style: { backgroundColor: '#28a745', color: 'white' } }));
        }
    };
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return 'today';
        }
        else if (diffDays === 1) {
            return 'yesterday';
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString();
        }
    };
    return (React.createElement(Card, null,
        React.createElement(CardContent, null,
            React.createElement(Box, { className: classes.header },
                React.createElement(Typography, { variant: "h6" }, "Pull Requests"),
                React.createElement(FormControl, { className: classes.filterControl, size: "small" },
                    React.createElement(InputLabel, null, "State"),
                    React.createElement(Select, { value: state, onChange: (e) => setState(e.target.value), label: "State" },
                        React.createElement(MenuItem, { value: "open" }, "Open"),
                        React.createElement(MenuItem, { value: "closed" }, "Closed"),
                        React.createElement(MenuItem, { value: "all" }, "All")))),
            error && (React.createElement(Alert, { severity: "error", style: { marginBottom: 16 } }, error)),
            loading ? (React.createElement(Box, { className: classes.loadingContainer },
                React.createElement(CircularProgress, null))) : pulls.length === 0 ? (React.createElement(Box, { className: classes.emptyState },
                React.createElement(GitPullRequestIcon, { style: { fontSize: 48, color: '#ccc', marginBottom: 16 } }),
                React.createElement(Typography, { variant: "h6", color: "textSecondary" },
                    "No ",
                    state !== 'all' ? state : '',
                    " pull requests"),
                React.createElement(Typography, { variant: "body2", color: "textSecondary" }, state === 'open'
                    ? 'Create a pull request to propose changes to this repository'
                    : 'Pull requests help you collaborate on code changes'))) : (React.createElement(List, { disablePadding: true }, pulls.map((pr, index) => (React.createElement(React.Fragment, { key: pr.number },
                index > 0 && React.createElement(Divider, null),
                React.createElement(ListItem, { className: classes.prListItem, onClick: () => handlePullRequestClick(pr.number) },
                    React.createElement(ListItemText, { primary: React.createElement(Box, { className: classes.prHeader },
                            getStateChip(pr),
                            React.createElement(Typography, { className: classes.prTitle }, pr.title),
                            React.createElement(Typography, { variant: "body2", color: "textSecondary" },
                                "#",
                                pr.number)), secondary: React.createElement(Box, { className: classes.prMeta },
                            React.createElement(Box, { className: classes.metaItem },
                                React.createElement(Avatar, { src: pr.user?.avatar_url, alt: pr.user?.login, style: { width: 20, height: 20 } }),
                                React.createElement(Typography, { variant: "body2" }, pr.user?.login)),
                            React.createElement(Typography, { variant: "body2", color: "textSecondary" },
                                pr.head?.ref,
                                " \u2192 ",
                                pr.base?.ref),
                            React.createElement(Typography, { variant: "body2", color: "textSecondary" }, formatDate(pr.created_at)),
                            pr.comments > 0 && (React.createElement(Chip, { label: `${pr.comments} comments`, size: "small", variant: "outlined" })),
                            React.createElement(Chip, { label: `+${pr.additions} -${pr.deletions}`, size: "small", variant: "outlined" })) }))))))))));
};
//# sourceMappingURL=PullRequestList.js.map