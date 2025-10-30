import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox, Box, Typography, Chip, LinearProgress, Divider, Menu, MenuItem, } from '@material-ui/core';
import { Alert, ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import EditIcon from '@material-ui/icons/Edit';
import ListIcon from '@material-ui/icons/List';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { FieldSelector } from '../FieldSelector';
import { CreatePullRequestDialog } from '../CreatePullRequestDialog';
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
    const handleOpenPrDialog = async () => {
        // For PR creation, we need to commit changes to current branch first
        if (!fileContent || !commitMessage.trim()) {
            setError('Commit message is required');
            return;
        }
        setAnchorEl(null);
        setSubmitting(true);
        setError(null);
        try {
            // Build request based on edit mode
            const requestData = {
                branches: [currentBranch],
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
            await gitOpsApi.updateFile(repository, requestData);
            // Changes committed successfully, now open PR dialog
            setSubmitting(false);
            setPrDialogOpen(true);
        }
        catch (err) {
            setError(err.message || 'Failed to commit changes');
            setSubmitting(false);
        }
    };
    const handlePrCreated = (pullRequest) => {
        // Success - show PR created message
        console.log('Pull request created:', pullRequest);
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
                React.createElement(Typography, { variant: "subtitle2", gutterBottom: true },
                    "Select Branches to Update (",
                    selectedBranches.length,
                    " selected)"),
                React.createElement(Box, { display: "flex", flexWrap: "wrap", gap: 1 }, branches.slice(0, 15).map((branch) => (React.createElement(FormControlLabel, { key: branch.name, control: React.createElement(Checkbox, { checked: selectedBranches.includes(branch.name), onChange: () => handleBranchToggle(branch.name), disabled: submitting }), label: React.createElement(Box, { display: "flex", alignItems: "center", gap: 0.5 },
                        branch.name,
                        branch.protected && React.createElement(Chip, { label: "protected", size: "small" })) })))),
                branches.length > 15 && (React.createElement(Typography, { variant: "caption", color: "textSecondary" },
                    "Showing first 15 branches. ",
                    branches.length - 15,
                    " more available."))),
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
                React.createElement(MenuItem, { onClick: handleOpenPrDialog, disabled: !hasChanges || !commitMessage.trim() }, "Create Pull Request"))),
        React.createElement(CreatePullRequestDialog, { open: prDialogOpen, onClose: () => setPrDialogOpen(false), repository: repository, currentBranch: currentBranch, onPullRequestCreated: handlePrCreated })));
};
//# sourceMappingURL=FileEditor.js.map