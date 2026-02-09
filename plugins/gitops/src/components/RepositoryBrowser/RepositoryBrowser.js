import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { InfoCard, Progress, ResponseErrorPanel, } from '@backstage/core-components';
import { Grid, Typography, Button, TextField, Chip, Box, } from '@material-ui/core';
import { Alert, Autocomplete } from '@material-ui/lab';
import EditIcon from '@material-ui/icons/Edit';
import RefreshIcon from '@material-ui/icons/Refresh';
import FolderIcon from '@material-ui/icons/Folder';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import DescriptionIcon from '@material-ui/icons/Description';
import { FileEditor } from '../FileEditor';
export const RepositoryBrowser = () => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [repositories, setRepositories] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedFile, setSelectedFile] = useState('');
    const [fileContent, setFileContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    // Common Helm chart files
    const commonFiles = [
        { path: 'app/charts/radiantone/values.yaml', label: 'values.yaml' },
        { path: 'app/charts/radiantone/Chart.yaml', label: 'Chart.yaml' },
        { path: 'app/charts/radiantone/templates/deployment.yaml', label: 'templates/deployment.yaml' },
        { path: 'app/charts/radiantone/templates/service.yaml', label: 'templates/service.yaml' },
        { path: 'app/charts/radiantone/templates/configmap.yaml', label: 'templates/configmap.yaml' },
        { path: 'app/charts/radiantone/templates/secret.yaml', label: 'templates/secret.yaml' },
        { path: 'app/charts/radiantone/templates/ingress.yaml', label: 'templates/ingress.yaml' },
        { path: 'app/charts/radiantone/templates/serviceaccount.yaml', label: 'templates/serviceaccount.yaml' },
    ];
    // Load repositories on mount
    useEffect(() => {
        gitOpsApi.listRepositories()
            .then(data => {
            setRepositories(data.repositories);
            setLoading(false);
        })
            .catch(err => {
            setError(err);
            setLoading(false);
        });
    }, [gitOpsApi]);
    // Load branches when repo changes
    useEffect(() => {
        if (!selectedRepo)
            return;
        gitOpsApi.listBranches(selectedRepo)
            .then(data => {
            setBranches(data.branches);
        })
            .catch(err => setError(err));
    }, [selectedRepo, gitOpsApi]);
    // Load file when repo, branch, or file selection changes
    useEffect(() => {
        if (!selectedRepo || !selectedBranch || !selectedFile)
            return;
        gitOpsApi.getFileContent(selectedRepo, selectedBranch, selectedFile)
            .then(data => setFileContent(data))
            .catch(err => console.error('Failed to load file:', err));
    }, [selectedRepo, selectedBranch, selectedFile, gitOpsApi]);
    const handleReset = () => {
        setSelectedRepo('');
        setSelectedBranch('');
        setSelectedFile('');
        setFileContent(null);
        setEditorOpen(false);
    };
    if (loading)
        return React.createElement(Progress, null);
    if (error)
        return React.createElement(ResponseErrorPanel, { error: error });
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" }, "Mock data mode active. Connect GitHub PAT to access real repositories.")),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "Repository Selection", action: React.createElement(Button, { size: "small", startIcon: React.createElement(RefreshIcon, null), onClick: handleReset, disabled: !selectedRepo && !selectedBranch && !selectedFile }, "Reset") },
                React.createElement(Grid, { container: true, spacing: 2 },
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(Autocomplete, { options: repositories.map(repo => repo.name), value: selectedRepo || null, onChange: (_, newValue) => setSelectedRepo(newValue || ''), renderInput: (params) => (React.createElement(TextField, { ...params, label: "Repository", margin: "normal", placeholder: "Search repositories...", InputProps: {
                                    ...params.InputProps,
                                    startAdornment: (React.createElement(React.Fragment, null,
                                        React.createElement(FolderIcon, { style: { marginLeft: 8, marginRight: 4, color: '#09143F' } }),
                                        params.InputProps.startAdornment)),
                                } })), fullWidth: true })),
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(Autocomplete, { options: branches.map(branch => branch.name), value: selectedBranch || null, onChange: (_, newValue) => setSelectedBranch(newValue || ''), disabled: !selectedRepo, renderInput: (params) => (React.createElement(TextField, { ...params, label: `Branch (${branches.length} total)`, margin: "normal", placeholder: "Search branches...", InputProps: {
                                    ...params.InputProps,
                                    startAdornment: (React.createElement(React.Fragment, null,
                                        React.createElement(AccountTreeIcon, { style: { marginLeft: 8, marginRight: 4, color: '#09143F' } }),
                                        params.InputProps.startAdornment)),
                                } })), renderOption: (option) => {
                                const branch = branches.find(b => b.name === option);
                                return (React.createElement(Box, { display: "flex", alignItems: "center", style: { gap: 8 } },
                                    React.createElement("span", null, option),
                                    branch?.protected && React.createElement(Chip, { label: "protected", size: "small" })));
                            }, fullWidth: true })),
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(Autocomplete, { options: commonFiles, getOptionLabel: (option) => typeof option === 'string' ? option : option.label, value: commonFiles.find(f => f.path === selectedFile) || null, onChange: (_, newValue) => setSelectedFile(newValue && typeof newValue !== 'string' ? newValue.path : ''), disabled: !selectedBranch, renderInput: (params) => (React.createElement(TextField, { ...params, label: "File", margin: "normal", placeholder: "Search files...", InputProps: {
                                    ...params.InputProps,
                                    startAdornment: (React.createElement(React.Fragment, null,
                                        React.createElement(DescriptionIcon, { style: { marginLeft: 8, marginRight: 4, color: '#09143F' } }),
                                        params.InputProps.startAdornment)),
                                } })), fullWidth: true }))))),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: React.createElement(Box, { display: "flex", alignItems: "center", style: { gap: 8 } },
                    React.createElement(DescriptionIcon, { style: { color: '#09143F' } }),
                    "File Viewer: ",
                    commonFiles.find(f => f.path === selectedFile)?.label || 'Select a file') }, fileContent ? (React.createElement(Box, null,
                React.createElement(Box, { mb: 2 },
                    React.createElement(Box, { display: "flex", flexWrap: "wrap", style: { gap: 8, marginBottom: 16 } },
                        React.createElement(Chip, { icon: React.createElement(AccountTreeIcon, null), label: `Branch: ${fileContent.branch}`, color: "primary", variant: "outlined" }),
                        React.createElement(Chip, { label: `SHA: ${fileContent.sha.substring(0, 7)}`, variant: "outlined" }),
                        React.createElement(Chip, { label: `Size: ${fileContent.size} bytes`, variant: "outlined" })),
                    React.createElement(Button, { variant: "contained", color: "primary", startIcon: React.createElement(EditIcon, null), onClick: () => setEditorOpen(true), fullWidth: true, size: "large", style: {
                            background: 'linear-gradient(45deg, #09143F 30%, #2ea3f2 90%)',
                            boxShadow: '0 3px 5px 2px rgba(9, 20, 63, .3)',
                            fontWeight: 600,
                        } }, "Edit with Monaco")),
                React.createElement(Box, { style: {
                        border: '2px solid #09143F',
                        borderRadius: 8,
                        overflow: 'hidden',
                    } },
                    React.createElement(TextField, { fullWidth: true, multiline: true, rows: 15, variant: "outlined", value: fileContent.content, InputProps: {
                            readOnly: true,
                            style: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                backgroundColor: '#f5f5f5',
                            }
                        } })),
                React.createElement(Alert, { severity: "info", style: { marginTop: 16 } }, "Read-only preview - Click \"Edit with Monaco\" to modify this file"))) : (React.createElement(Box, { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8 },
                React.createElement(DescriptionIcon, { style: { fontSize: 64, color: '#ccc', marginBottom: 16 } }),
                React.createElement(Typography, { variant: "h6", color: "textSecondary", gutterBottom: true }, "No file selected"),
                React.createElement(Typography, { variant: "body2", color: "textSecondary" }, "Select a repository, branch, and file to view its contents"))))),
        React.createElement(FileEditor, { open: editorOpen, onClose: () => setEditorOpen(false), repository: selectedRepo, fileContent: fileContent, branches: branches, currentBranch: selectedBranch, onSuccess: () => {
                // Reload file content after successful commit
                if (selectedRepo && selectedBranch && fileContent) {
                    gitOpsApi.getFileContent(selectedRepo, selectedBranch, fileContent.path)
                        .then(data => setFileContent(data))
                        .catch(err => console.error('Failed to reload file:', err));
                }
            } })));
};
//# sourceMappingURL=RepositoryBrowser.js.map