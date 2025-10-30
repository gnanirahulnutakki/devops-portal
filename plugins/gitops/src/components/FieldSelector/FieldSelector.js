import React, { useState, useEffect } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, TextField, Typography, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress, } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef } from '../../api';
import { getCommonValuesPaths, getValueAtPath, parseYaml } from '../../utils/yamlUtils';
export const FieldSelector = ({ repository, fileContent, branches, selectedBranches, onFieldChange, }) => {
    const gitOpsApi = useApi(gitOpsApiRef);
    const [selectedField, setSelectedField] = useState('');
    const [newValue, setNewValue] = useState('');
    const [branchValues, setBranchValues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [customFieldPath, setCustomFieldPath] = useState('');
    const [useCustomField, setUseCustomField] = useState(false);
    const commonPaths = getCommonValuesPaths();
    // Load current values for selected field across all selected branches
    useEffect(() => {
        if (!selectedField || selectedBranches.length === 0) {
            setBranchValues([]);
            return;
        }
        const loadBranchValues = async () => {
            setLoading(true);
            const values = [];
            for (const branchName of selectedBranches) {
                try {
                    const content = await gitOpsApi.getFileContent(repository, branchName, fileContent?.path || 'app/charts/radiantone/values.yaml');
                    const yamlObj = parseYaml(content.content);
                    const currentValue = getValueAtPath(yamlObj, selectedField);
                    values.push({
                        branch: branchName,
                        currentValue,
                        newValue: newValue || undefined,
                        willChange: newValue ? currentValue !== newValue : false,
                    });
                }
                catch (error) {
                    console.error(`Failed to load ${branchName}:`, error);
                    values.push({
                        branch: branchName,
                        currentValue: 'Error loading',
                        willChange: false,
                    });
                }
            }
            setBranchValues(values);
            setLoading(false);
        };
        loadBranchValues();
    }, [selectedField, selectedBranches, repository, fileContent, gitOpsApi, newValue]);
    // Update willChange status when new value changes
    useEffect(() => {
        setBranchValues(prev => prev.map(bv => ({
            ...bv,
            newValue: newValue || undefined,
            willChange: newValue ? bv.currentValue !== newValue : false,
        })));
        // Notify parent component
        if (onFieldChange && selectedField) {
            onFieldChange(selectedField, newValue);
        }
    }, [newValue, selectedField, onFieldChange]);
    const handleFieldSelect = (path) => {
        if (path === '__custom__') {
            setUseCustomField(true);
            setSelectedField('');
        }
        else {
            setUseCustomField(false);
            setSelectedField(path);
        }
        setNewValue('');
    };
    const handleCustomFieldApply = () => {
        if (customFieldPath.trim()) {
            setSelectedField(customFieldPath.trim());
            setUseCustomField(false);
        }
    };
    const changesCount = branchValues.filter(bv => bv.willChange).length;
    return (React.createElement(Box, null,
        React.createElement(Typography, { variant: "subtitle2", gutterBottom: true }, "Field-Level Editing"),
        React.createElement(Typography, { variant: "caption", color: "textSecondary", gutterBottom: true, display: "block" }, "Update specific YAML fields while preserving branch-specific configurations"),
        React.createElement(Box, { display: "flex", gap: 2, mb: 2, mt: 2 },
            React.createElement(FormControl, { fullWidth: true },
                React.createElement(InputLabel, null, "Select Field to Update"),
                React.createElement(Select, { value: useCustomField ? '__custom__' : selectedField, onChange: (e) => handleFieldSelect(e.target.value) },
                    React.createElement(MenuItem, { value: "" },
                        React.createElement("em", null, "Choose a field...")),
                    commonPaths.map((item) => (React.createElement(MenuItem, { key: item.path, value: item.path },
                        item.description,
                        " (",
                        item.path,
                        ")"))),
                    React.createElement(MenuItem, { value: "__custom__" },
                        React.createElement("em", null, "Custom field path...")))),
            !useCustomField && selectedField && (React.createElement(TextField, { fullWidth: true, label: "New Value", placeholder: "Enter new value", value: newValue, onChange: (e) => setNewValue(e.target.value), helperText: "This value will be set for all selected branches" }))),
        useCustomField && (React.createElement(Box, { display: "flex", gap: 2, mb: 2 },
            React.createElement(TextField, { fullWidth: true, label: "Custom Field Path", placeholder: "e.g., fid.image.tag or observability.enabled", value: customFieldPath, onChange: (e) => setCustomFieldPath(e.target.value), helperText: "Use dot notation to specify the YAML path" }),
            React.createElement(TextField, { fullWidth: true, label: "New Value", placeholder: "Enter new value", value: newValue, onChange: (e) => setNewValue(e.target.value), disabled: !customFieldPath.trim() }))),
        selectedField && (React.createElement(Box, { mb: 2 },
            React.createElement(Alert, { severity: "info" }, changesCount > 0 ? (React.createElement(React.Fragment, null,
                React.createElement("strong", null, changesCount),
                " branch",
                changesCount > 1 ? 'es' : '',
                " will be updated.",
                ' ',
                branchValues.length - changesCount > 0 && (React.createElement(React.Fragment, null,
                    branchValues.length - changesCount,
                    " already have this value.")))) : ('All selected branches already have this value. No changes will be made.')))),
        loading && React.createElement(LinearProgress, null),
        selectedField && branchValues.length > 0 && (React.createElement(TableContainer, { component: Paper, variant: "outlined" },
            React.createElement(Table, { size: "small" },
                React.createElement(TableHead, null,
                    React.createElement(TableRow, null,
                        React.createElement(TableCell, null,
                            React.createElement("strong", null, "Branch")),
                        React.createElement(TableCell, null,
                            React.createElement("strong", null, "Current Value")),
                        React.createElement(TableCell, null,
                            React.createElement("strong", null, "New Value")),
                        React.createElement(TableCell, null,
                            React.createElement("strong", null, "Status")))),
                React.createElement(TableBody, null, branchValues.map((bv) => (React.createElement(TableRow, { key: bv.branch },
                    React.createElement(TableCell, null,
                        React.createElement(Typography, { variant: "body2", style: { fontFamily: 'monospace' } }, bv.branch)),
                    React.createElement(TableCell, null,
                        React.createElement(Chip, { label: JSON.stringify(bv.currentValue) || 'undefined', size: "small", variant: "outlined" })),
                    React.createElement(TableCell, null, bv.willChange ? (React.createElement(Chip, { label: JSON.stringify(newValue) || 'undefined', size: "small", color: "primary" })) : (React.createElement(Typography, { variant: "caption", color: "textSecondary" }, "No change"))),
                    React.createElement(TableCell, null, bv.willChange ? (React.createElement(Chip, { label: "Will Update", color: "primary", size: "small" })) : (React.createElement(Chip, { label: "Same Value", size: "small" })))))))))),
        !selectedField && !useCustomField && (React.createElement(Box, { p: 3, textAlign: "center" },
            React.createElement(Typography, { variant: "body2", color: "textSecondary" }, "Select a field to see current values across branches and preview changes")))));
};
//# sourceMappingURL=FieldSelector.js.map