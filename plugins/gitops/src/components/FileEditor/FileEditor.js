import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Checkbox, Box, Typography, Chip, LinearProgress, Divider, Menu, MenuItem, List, ListItem, ListItemText, ListItemSecondaryAction, InputAdornment, } from '@material-ui/core';
import { Alert, ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import SearchIcon from '@material-ui/icons/Search';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import EditIcon from '@material-ui/icons/Edit';
import ListIcon from '@material-ui/icons/List';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { FieldSelector } from '../FieldSelector';
import { CreatePullRequestDialog } from '../CreatePullRequestDialog';
import { CommitToBranchDialog } from '../CommitToBranchDialog';
export const FileEditor = ({ open, onClose, repository, fileContent, branches, currentBranch, onSuccess, }) => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [editMode, setEditMode] = useState('field');
    const [editedContent, setEditedContent] = useState(fileContent?.content || '');
    const [commitMessage, setCommitMessage] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([currentBranch]);
    const [submitting, setSubmitting] = useState(false);
    const [operationId, setOperationId] = useState(null);
    const [error, setError] = useState(null);
    const [fieldPath, setFieldPath] = useState('');
    const [fieldValue, setFieldValue] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [prDialogOpen, setPrDialogOpen] = useState(false);
    const [commitOnlyDialogOpen, setCommitOnlyDialogOpen] = useState(false);
    const [branchDialogOpen, setBranchDialogOpen] = useState(false);
    const [branchSearchQuery, setBranchSearchQuery] = useState('');
    React.useEffect(() => {
        if (fileContent) {
            setEditedContent(fileContent.content);
            setSelectedBranches([currentBranch]);
        }
    }, [fileContent, currentBranch]);
    const handleBranchToggle = (branchName) => {
        setSelectedBranches(prev => prev.includes(branchName)
            ? prev.filter(b => b !== branchName)
            : [...prev, branchName]);
    };
    const handleSubmit = async () => {
        if (!fileContent || !commitMessage.trim()) {
            setError('Commit message is required');
            return;
        }
        if (selectedBranches.length === 0) {
            setError('Please select at least one branch');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            // Build request based on edit mode
            const requestData = {
                branches: selectedBranches,
                path: fileContent.path,
                message: commitMessage,
            };
            if (editMode === 'field') {
                // Field-level update
                requestData.fieldPath = fieldPath;
                requestData.fieldValue = fieldValue;
            }
            else {
                // Full file update
                requestData.content = editedContent;
            }
            const result = await gitOpsApi.updateFile(repository, requestData);
            setOperationId(result.operation_id);
            // Success - close after a moment to show the operation ID
            setTimeout(() => {
                onSuccess?.();
                handleClose();
            }, 2000);
        }
        catch (err) {
            setError(err.message || 'Failed to commit changes');
            setSubmitting(false);
        }
    };
    const handleClose = () => {
        setEditedContent(fileContent?.content || '');
        setCommitMessage('');
        setSelectedBranches([currentBranch]);
        setSubmitting(false);
        setOperationId(null);
        setError(null);
        setFieldPath('');
        setFieldValue('');
        setEditMode('field');
        setAnchorEl(null);
        setPrDialogOpen(false);
        onClose();
    };
    const handleOpenPrDialog = () => {
        // For PR creation with new branch, we don't commit yet - just open the dialog
        if (!fileContent || !commitMessage.trim()) {
            setError('Commit message is required');
            return;
        }
        setAnchorEl(null);
        setPrDialogOpen(true);
    };
    const handleOpenCommitOnlyDialog = () => {
        // For commit-only (create branch, no PR)
        if (!fileContent || !commitMessage.trim()) {
            setError('Commit message is required');
            return;
        }
        setAnchorEl(null);
        setCommitOnlyDialogOpen(true);
    };
    const handlePrCreated = (pullRequest) => {
        // Success - show PR created message
        console.log('Pull request created:', pullRequest);
        onSuccess?.();
        handleClose();
    };
    const handleCommitOnlySuccess = () => {
        // Success - show commit created message
        onSuccess?.();
        handleClose();
    };
    const handleFieldChange = (path, value) => {
        setFieldPath(path);
        setFieldValue(value);
    };
    const hasChanges = editMode === 'full'
        ? editedContent !== fileContent?.content
        : fieldPath && fieldValue;
    return (React.createElement(Dialog, { open: open, onClose: handleClose, maxWidth: "lg", fullWidth: true },
        React.createElement(DialogTitle, null,
            "Edit File: ",
            fileContent?.name,
            selectedBranches.length > 1 && (React.createElement(Chip, { label: `${selectedBranches.length} branches selected`, color: "primary", size: "small", style: { marginLeft: 16 } }))),
        React.createElement(DialogContent, null,
            operationId && (React.createElement(Alert, { severity: "success", style: { marginBottom: 16 } },
                "Bulk operation initiated! Operation ID: ",
                operationId.substring(0, 8),
                "...",
                React.createElement("br", null),
                "Check the Operations tab to track progress.")),
            error && (React.createElement(Alert, { severity: "error", style: { marginBottom: 16 } }, error)),
            React.createElement(Box, { mb: 3 },
                React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 },
                    React.createElement(Typography, { variant: "subtitle2" },
                        "Editing: ",
                        fileContent?.path),
                    React.createElement(ToggleButtonGroup, { value: editMode, exclusive: true, onChange: (_, newMode) => newMode && setEditMode(newMode), size: "small" },
                        React.createElement(ToggleButton, { value: "field" },
                            React.createElement(ListIcon, { style: { marginRight: 8 } }),
                            "Field-Level Edit"),
                        React.createElement(ToggleButton, { value: "full" },
                            React.createElement(EditIcon, { style: { marginRight: 8 } }),
                            "Full File Edit"))),
                React.createElement(Divider, null)),
            editMode === 'field' ? (React.createElement(FieldSelector, { repository: repository, fileContent: fileContent, branches: branches, selectedBranches: selectedBranches, onFieldChange: handleFieldChange })) : (React.createElement(Box, { mb: 2 },
                React.createElement(Typography, { variant: "subtitle2", gutterBottom: true }, "Monaco Editor - Full File Content"),
                React.createElement(Editor, { height: "400px", defaultLanguage: "yaml", value: editedContent, onChange: (value) => setEditedContent(value || ''), theme: "vs-dark", options: {
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    } }))),
            React.createElement(TextField, { fullWidth: true, label: "Commit Message", placeholder: "Update configuration values", value: commitMessage, onChange: (e) => setCommitMessage(e.target.value), margin: "normal", required: true, disabled: submitting }),
            React.createElement(Box, { mt: 2 },
                React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 },
                    React.createElement(Typography, { variant: "subtitle2" },
                        "Select Branches to Update (",
                        selectedBranches.length,
                        " selected)"),
                    branches.length > 15 && (React.createElement(Button, { size: "small", variant: "outlined", onClick: () => setBranchDialogOpen(true) },
                        "View All ",
                        branches.length,
                        " Branches"))),
                React.createElement(Box, { display: "flex", flexWrap: "wrap", gap: 1 }, branches.slice(0, 15).map((branch) => {
                    const isSelected = selectedBranches.includes(branch.name);
                    return (React.createElement(Chip, { key: branch.name, label: React.createElement(Box, { display: "flex", alignItems: "center", gap: 0.5 },
                            isSelected && React.createElement(CheckCircleIcon, { style: { fontSize: 16 } }),
                            branch.name,
                            branch.protected && React.createElement(Chip, { label: "protected", size: "small", style: { marginLeft: 4, height: 16 } })), onClick: () => !submitting && handleBranchToggle(branch.name), color: isSelected ? "primary" : "default", variant: isSelected ? "default" : "outlined", disabled: submitting, style: {
                            cursor: submitting ? 'default' : 'pointer',
                            backgroundColor: isSelected ? '#09143F' : undefined,
                            color: isSelected ? 'white' : undefined,
                            fontWeight: isSelected ? 600 : 400,
                        } }));
                })),
                branches.length > 15 && (React.createElement(Typography, { variant: "caption", color: "textSecondary", style: { marginTop: 8, display: 'block' } },
                    "Showing first 15 branches. Click \"View All\" to see and select from all ",
                    branches.length,
                    " branches."))),
            submitting && React.createElement(LinearProgress, { style: { marginTop: 16 } })),
        React.createElement(DialogActions, null,
            React.createElement(Button, { onClick: handleClose, disabled: submitting }, "Cancel"),
            React.createElement(Box, { display: "flex" },
                React.createElement(Button, { onClick: handleSubmit, color: "primary", variant: "contained", disabled: submitting || !hasChanges || !commitMessage.trim(), style: { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }, submitting
                    ? 'Committing...'
                    : editMode === 'field'
                        ? `Update Field in ${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`
                        : `Commit to ${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`),
                React.createElement(Button, { color: "primary", variant: "contained", size: "small", disabled: submitting || !hasChanges || !commitMessage.trim(), onClick: (e) => setAnchorEl(e.currentTarget), style: {
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderLeft: '1px solid rgba(255,255,255,0.3)',
                        minWidth: '40px',
                        padding: '6px 8px',
                    } },
                    React.createElement(ArrowDropDownIcon, null))),
            React.createElement(Menu, { anchorEl: anchorEl, open: Boolean(anchorEl), onClose: () => setAnchorEl(null) },
                React.createElement(MenuItem, { onClick: handleOpenCommitOnlyDialog, disabled: !hasChanges || !commitMessage.trim() }, "Commit to New Branch"),
                React.createElement(MenuItem, { onClick: handleOpenPrDialog, disabled: !hasChanges || !commitMessage.trim() }, "Create New Branch & Pull Request"))),
        React.createElement(CreatePullRequestDialog, { open: prDialogOpen, onClose: () => setPrDialogOpen(false), repository: repository, currentBranch: currentBranch, onPullRequestCreated: handlePrCreated, allowBranchCreation: true, fileContent: fileContent ? {
                path: fileContent.path,
                content: editMode === 'full' ? editedContent : undefined,
                sha: fileContent.sha,
            } : undefined, commitMessage: commitMessage, fieldPath: editMode === 'field' ? fieldPath : undefined, fieldValue: editMode === 'field' ? fieldValue : undefined }),
        React.createElement(CommitToBranchDialog, { open: commitOnlyDialogOpen, onClose: () => setCommitOnlyDialogOpen(false), repository: repository, currentBranch: currentBranch, onCommitSuccess: handleCommitOnlySuccess, fileContent: fileContent ? {
                path: fileContent.path,
                content: editMode === 'full' ? editedContent : undefined,
                sha: fileContent.sha,
            } : undefined, commitMessage: commitMessage, fieldPath: editMode === 'field' ? fieldPath : undefined, fieldValue: editMode === 'field' ? fieldValue : undefined }),
        React.createElement(Dialog, { open: branchDialogOpen, onClose: () => setBranchDialogOpen(false), maxWidth: "sm", fullWidth: true },
            React.createElement(DialogTitle, null,
                "Select Branches (",
                selectedBranches.length,
                " selected)"),
            React.createElement(DialogContent, null,
                React.createElement(TextField, { fullWidth: true, placeholder: "Search branches...", value: branchSearchQuery, onChange: (e) => setBranchSearchQuery(e.target.value), margin: "normal", variant: "outlined", size: "small", InputProps: {
                        startAdornment: (React.createElement(InputAdornment, { position: "start" },
                            React.createElement(SearchIcon, null))),
                    } }),
                React.createElement(List, { style: { maxHeight: 400, overflow: 'auto', marginTop: 8 } }, branches
                    .filter((branch) => branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase()))
                    .map((branch) => {
                    const isSelected = selectedBranches.includes(branch.name);
                    return (React.createElement(ListItem, { key: branch.name, button: true, onClick: () => handleBranchToggle(branch.name), style: {
                            backgroundColor: isSelected ? 'rgba(9, 20, 63, 0.08)' : undefined,
                            borderLeft: isSelected ? '4px solid #09143F' : '4px solid transparent',
                        } },
                        React.createElement(Checkbox, { checked: isSelected, tabIndex: -1, disableRipple: true, color: "primary" }),
                        React.createElement(ListItemText, { primary: React.createElement(Box, { display: "flex", alignItems: "center", gap: 1 },
                                React.createElement("span", { style: { fontWeight: isSelected ? 600 : 400 } }, branch.name),
                                branch.protected && (React.createElement(Chip, { label: "protected", size: "small" }))) }),
                        isSelected && (React.createElement(ListItemSecondaryAction, null,
                            React.createElement(CheckCircleIcon, { style: { color: '#09143F' } })))));
                })),
                branches.filter((branch) => branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())).length === 0 && (React.createElement(Typography, { variant: "body2", color: "textSecondary", align: "center", style: { padding: 16 } },
                    "No branches found matching \"",
                    branchSearchQuery,
                    "\""))),
            React.createElement(DialogActions, null,
                React.createElement(Button, { onClick: () => setBranchDialogOpen(false) }, "Done")))));
};
//# sourceMappingURL=FileEditor.js.map