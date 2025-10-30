import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { InfoCard, Progress, ResponseErrorPanel, } from '@backstage/core-components';
import { Grid, Select, MenuItem, FormControl, InputLabel, Typography, Button, TextField, Chip, Box, } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import EditIcon from '@material-ui/icons/Edit';
import { FileEditor } from '../FileEditor';
export const RepositoryBrowser = () => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [repositories, setRepositories] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedFile, setSelectedFile] = useState('app/charts/radiantone/values.yaml');
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
            if (data.repositories.length > 0) {
                setSelectedRepo(data.repositories[0].name);
            }
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
            if (data.branches.length > 0) {
                setSelectedBranch(data.branches[0].name);
            }
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
    if (loading)
        return React.createElement(Progress, null);
    if (error)
        return React.createElement(ResponseErrorPanel, { error: error });
    return (React.createElement(Grid, { container: true, spacing: 3 },
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(Alert, { severity: "info" }, "Mock data mode active. Connect GitHub PAT to access real repositories.")),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: "Repository Selection" },
                React.createElement(Grid, { container: true, spacing: 2 },
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(FormControl, { fullWidth: true, margin: "normal" },
                            React.createElement(InputLabel, null, "Repository"),
                            React.createElement(Select, { value: selectedRepo, onChange: (e) => setSelectedRepo(e.target.value) }, repositories.map(repo => (React.createElement(MenuItem, { key: repo.name, value: repo.name }, repo.name)))))),
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(FormControl, { fullWidth: true, margin: "normal" },
                            React.createElement(InputLabel, null,
                                "Branch (",
                                branches.length,
                                " total)"),
                            React.createElement(Select, { value: selectedBranch, onChange: (e) => setSelectedBranch(e.target.value) }, branches.map(branch => (React.createElement(MenuItem, { key: branch.name, value: branch.name },
                                branch.name,
                                " ",
                                branch.protected && React.createElement(Chip, { label: "protected", size: "small" }))))))),
                    React.createElement(Grid, { item: true, md: 4, xs: 12 },
                        React.createElement(FormControl, { fullWidth: true, margin: "normal" },
                            React.createElement(InputLabel, null, "File"),
                            React.createElement(Select, { value: selectedFile, onChange: (e) => setSelectedFile(e.target.value) }, commonFiles.map(file => (React.createElement(MenuItem, { key: file.path, value: file.path }, file.label))))))))),
        React.createElement(Grid, { item: true, xs: 12 },
            React.createElement(InfoCard, { title: `File Viewer: ${commonFiles.find(f => f.path === selectedFile)?.label || 'Select a file'}` }, fileContent ? (React.createElement(Box, null,
                React.createElement(Box, { mb: 2 },
                    React.createElement(Box, { display: "flex", flexWrap: "wrap", gap: 1, mb: 1 },
                        React.createElement(Chip, { label: `Branch: ${fileContent.branch}` }),
                        React.createElement(Chip, { label: `SHA: ${fileContent.sha.substring(0, 7)}` })),
                    React.createElement(Button, { variant: "contained", color: "primary", startIcon: React.createElement(EditIcon, null), onClick: () => setEditorOpen(true), fullWidth: true }, "Edit with Monaco")),
                React.createElement(TextField, { fullWidth: true, multiline: true, rows: 15, variant: "outlined", value: fileContent.content, InputProps: {
                        readOnly: true,
                        style: { fontFamily: 'monospace', fontSize: '12px' }
                    } }),
                React.createElement(Typography, { variant: "caption", color: "textSecondary", style: { marginTop: 8, display: 'block' } },
                    "File size: ",
                    fileContent.size,
                    " bytes | Read-only preview - Click \"Edit with Monaco\" to modify"))) : (React.createElement(Typography, null, "Select a repository and branch to view files")))),
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