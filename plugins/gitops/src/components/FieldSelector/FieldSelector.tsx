import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { gitOpsApiRef, Branch, FileContent } from '../../api';
import { getCommonValuesPaths, getValueAtPath, parseYaml } from '../../utils/yamlUtils';

interface FieldSelectorProps {
  repository: string;
  fileContent: FileContent | null;
  branches: Branch[];
  selectedBranches: string[];
  onFieldChange?: (fieldPath: string, newValue: string) => void;
}

interface BranchFieldValue {
  branch: string;
  currentValue: any;
  newValue?: string;
  willChange: boolean;
}

export const FieldSelector = ({
  repository,
  fileContent,
  branches,
  selectedBranches,
  onFieldChange,
}: FieldSelectorProps) => {
  const gitOpsApi = useApi(gitOpsApiRef);
  const [selectedField, setSelectedField] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [branchValues, setBranchValues] = useState<BranchFieldValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [customFieldPath, setCustomFieldPath] = useState<string>('');
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
      const values: BranchFieldValue[] = [];

      for (const branchName of selectedBranches) {
        try {
          const content = await gitOpsApi.getFileContent(
            repository,
            branchName,
            fileContent?.path || 'app/charts/radiantone/values.yaml'
          );

          const yamlObj = parseYaml(content.content);
          const currentValue = getValueAtPath(yamlObj, selectedField);

          values.push({
            branch: branchName,
            currentValue,
            newValue: newValue || undefined,
            willChange: newValue ? currentValue !== newValue : false,
          });
        } catch (error) {
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
    setBranchValues(prev =>
      prev.map(bv => ({
        ...bv,
        newValue: newValue || undefined,
        willChange: newValue ? bv.currentValue !== newValue : false,
      }))
    );

    // Notify parent component
    if (onFieldChange && selectedField) {
      onFieldChange(selectedField, newValue);
    }
  }, [newValue, selectedField, onFieldChange]);

  const handleFieldSelect = (path: string) => {
    if (path === '__custom__') {
      setUseCustomField(true);
      setSelectedField('');
    } else {
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

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Field-Level Editing
      </Typography>
      <Typography variant="caption" color="textSecondary" gutterBottom display="block">
        Update specific YAML fields while preserving branch-specific configurations
      </Typography>

      <Box display="flex" gap={2} mb={2} mt={2}>
        <FormControl fullWidth>
          <InputLabel>Select Field to Update</InputLabel>
          <Select
            value={useCustomField ? '__custom__' : selectedField}
            onChange={(e) => handleFieldSelect(e.target.value as string)}
          >
            <MenuItem value="">
              <em>Choose a field...</em>
            </MenuItem>
            {commonPaths.map((item) => (
              <MenuItem key={item.path} value={item.path}>
                {item.description} ({item.path})
              </MenuItem>
            ))}
            <MenuItem value="__custom__">
              <em>Custom field path...</em>
            </MenuItem>
          </Select>
        </FormControl>

        {!useCustomField && selectedField && (
          <TextField
            fullWidth
            label="New Value"
            placeholder="Enter new value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            helperText="This value will be set for all selected branches"
          />
        )}
      </Box>

      {useCustomField && (
        <Box display="flex" gap={2} mb={2}>
          <TextField
            fullWidth
            label="Custom Field Path"
            placeholder="e.g., fid.image.tag or observability.enabled"
            value={customFieldPath}
            onChange={(e) => setCustomFieldPath(e.target.value)}
            helperText="Use dot notation to specify the YAML path"
          />
          <TextField
            fullWidth
            label="New Value"
            placeholder="Enter new value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={!customFieldPath.trim()}
          />
        </Box>
      )}

      {selectedField && (
        <Box mb={2}>
          <Alert severity="info">
            {changesCount > 0 ? (
              <>
                <strong>{changesCount}</strong> branch{changesCount > 1 ? 'es' : ''} will be updated.{' '}
                {branchValues.length - changesCount > 0 && (
                  <>{branchValues.length - changesCount} already have this value.</>
                )}
              </>
            ) : (
              'All selected branches already have this value. No changes will be made.'
            )}
          </Alert>
        </Box>
      )}

      {loading && <LinearProgress />}

      {selectedField && branchValues.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Branch</strong></TableCell>
                <TableCell><strong>Current Value</strong></TableCell>
                <TableCell><strong>New Value</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branchValues.map((bv) => (
                <TableRow key={bv.branch}>
                  <TableCell>
                    <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                      {bv.branch}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={JSON.stringify(bv.currentValue) || 'undefined'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {bv.willChange ? (
                      <Chip
                        label={JSON.stringify(newValue) || 'undefined'}
                        size="small"
                        color="primary"
                      />
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        No change
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {bv.willChange ? (
                      <Chip label="Will Update" color="primary" size="small" />
                    ) : (
                      <Chip label="Same Value" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!selectedField && !useCustomField && (
        <Box p={3} textAlign="center">
          <Typography variant="body2" color="textSecondary">
            Select a field to see current values across branches and preview changes
          </Typography>
        </Box>
      )}
    </Box>
  );
};
