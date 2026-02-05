import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Switch,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  makeStyles,
  fade,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

// Icons
import RefreshIcon from '@material-ui/icons/Refresh';
import ScaleIcon from '@material-ui/icons/AspectRatio';
import SyncIcon from '@material-ui/icons/Sync';
import HistoryIcon from '@material-ui/icons/History';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import SettingsIcon from '@material-ui/icons/Settings';
import DeleteSweepIcon from '@material-ui/icons/DeleteSweep';
import CloudDownloadIcon from '@material-ui/icons/CloudDownload';
import BackupIcon from '@material-ui/icons/Backup';
import RestoreIcon from '@material-ui/icons/Restore';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import CancelIcon from '@material-ui/icons/Cancel';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import WarningIcon from '@material-ui/icons/Warning';
import InfoIcon from '@material-ui/icons/Info';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const useStyles = makeStyles((theme) => ({
  operationCard: {
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[4],
    },
  },
  operationIcon: {
    fontSize: 40,
    marginBottom: theme.spacing(1),
  },
  lowRisk: {
    color: theme.palette.success.main,
  },
  mediumRisk: {
    color: theme.palette.warning.main,
  },
  highRisk: {
    color: theme.palette.error.main,
  },
  criticalRisk: {
    color: theme.palette.error.dark,
    animation: '$pulse 2s infinite',
  },
  '@keyframes pulse': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.5 },
    '100%': { opacity: 1 },
  },
  riskChip: {
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '0.65rem',
  },
  statusPending: {
    color: theme.palette.grey[500],
  },
  statusInProgress: {
    color: theme.palette.info.main,
  },
  statusCompleted: {
    color: theme.palette.success.main,
  },
  statusFailed: {
    color: theme.palette.error.main,
  },
  statusApproval: {
    color: theme.palette.warning.main,
  },
  confirmationBox: {
    padding: theme.spacing(2),
    backgroundColor: fade(theme.palette.warning.main, 0.1),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  criticalConfirmationBox: {
    padding: theme.spacing(2),
    backgroundColor: fade(theme.palette.error.main, 0.1),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `2px solid ${theme.palette.error.main}`,
  },
  logEntry: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    padding: theme.spacing(0.5),
    '&.info': { color: theme.palette.text.primary },
    '&.warn': { color: theme.palette.warning.main },
    '&.error': { color: theme.palette.error.main },
  },
  logsContainer: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    maxHeight: 300,
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
  },
  historyTable: {
    '& .MuiTableCell-root': {
      padding: theme.spacing(1),
    },
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
}));

// Types
interface OperationParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  required: boolean;
  default?: any;
  options?: { label: string; value: any }[];
  validation?: { min?: number; max?: number; pattern?: string };
}

interface OperationDefinition {
  type: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  requiredPermission: string;
  parameters: OperationParameter[];
  confirmationMessage?: string;
}

interface OperationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface OperationResult {
  id: string;
  type: string;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'requires_approval';
  target: {
    namespace: string;
    name: string;
    kind: string;
  };
  parameters: Record<string, any>;
  requestedBy: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  approvedBy?: string;
  result?: {
    success: boolean;
    message: string;
    details?: Record<string, any>;
  };
  logs: OperationLog[];
}

// Icon mapping
const operationIcons: Record<string, React.ReactNode> = {
  restart_service: <RefreshIcon />,
  scale_replicas: <ScaleIcon />,
  force_sync: <SyncIcon />,
  rollback: <HistoryIcon />,
  rotate_secrets: <VpnKeyIcon />,
  update_config: <SettingsIcon />,
  clear_cache: <DeleteSweepIcon />,
  export_logs: <CloudDownloadIcon />,
  create_backup: <BackupIcon />,
  restore_backup: <RestoreIcon />,
};

const riskColors: Record<string, 'default' | 'primary' | 'secondary'> = {
  low: 'default',
  medium: 'primary',
  high: 'secondary',
  critical: 'secondary',
};

interface Day2OperationsCardProps {
  /** Target service namespace */
  namespace: string;
  /** Target service name */
  serviceName: string;
  /** Target resource kind */
  kind?: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Application';
  /** Cluster (if multi-cluster) */
  cluster?: string;
  /** Show operation history */
  showHistory?: boolean;
}

export const Day2OperationsCard: React.FC<Day2OperationsCardProps> = ({
  namespace,
  serviceName,
  kind = 'Deployment',
  cluster,
  showHistory = true,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [operations, setOperations] = useState<OperationDefinition[]>([]);
  const [history, setHistory] = useState<OperationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState<OperationDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState<OperationResult | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Fetch operation definitions and history
  useEffect(() => {
    fetchOperations();
    if (showHistory) {
      fetchHistory();
    }
  }, [namespace, serviceName]);

  const fetchOperations = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/gitops/operations/definitions`);
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
    } catch (error) {
      console.error('Failed to fetch operations:', error);
      // Use mock data for development
      setOperations(getMockOperations());
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/gitops/operations/history?namespace=${namespace}&name=${serviceName}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const getMockOperations = (): OperationDefinition[] => [
    {
      type: 'restart_service',
      name: 'Restart Service',
      description: 'Perform a rolling restart of all pods',
      riskLevel: 'low',
      requiresApproval: false,
      requiredPermission: 'RESTART_APPLICATION',
      parameters: [
        { name: 'strategy', type: 'select', label: 'Strategy', required: true, default: 'rolling', options: [{ label: 'Rolling', value: 'rolling' }, { label: 'Delete All', value: 'delete' }] },
        { name: 'waitForReady', type: 'boolean', label: 'Wait for Ready', required: false, default: true },
      ],
      confirmationMessage: 'This will restart all pods. Continue?',
    },
    {
      type: 'scale_replicas',
      name: 'Scale Replicas',
      description: 'Scale the number of replicas',
      riskLevel: 'low',
      requiresApproval: false,
      requiredPermission: 'SCALE_APPLICATION',
      parameters: [
        { name: 'replicas', type: 'number', label: 'Target Replicas', required: true, default: 1, validation: { min: 0, max: 100 } },
      ],
    },
    {
      type: 'force_sync',
      name: 'Force Sync',
      description: 'Force sync with ArgoCD',
      riskLevel: 'low',
      requiresApproval: false,
      requiredPermission: 'SYNC_ARGOCD_APPS',
      parameters: [
        { name: 'prune', type: 'boolean', label: 'Prune Resources', required: false, default: false },
        { name: 'force', type: 'boolean', label: 'Force Apply', required: false, default: false },
      ],
    },
    {
      type: 'rollback',
      name: 'Rollback',
      description: 'Rollback to previous version',
      riskLevel: 'medium',
      requiresApproval: true,
      requiredPermission: 'SYNC_ARGOCD_APPS',
      parameters: [
        { name: 'revision', type: 'string', label: 'Target Revision', required: true },
        { name: 'reason', type: 'string', label: 'Reason', required: true },
      ],
      confirmationMessage: 'Rollback will revert to a previous version. Are you sure?',
    },
    {
      type: 'rotate_secrets',
      name: 'Rotate Secrets',
      description: 'Rotate secrets and credentials',
      riskLevel: 'high',
      requiresApproval: true,
      requiredPermission: 'MANAGE_SECRETS',
      parameters: [
        { name: 'secretName', type: 'string', label: 'Secret Name', required: true },
        { name: 'rotationType', type: 'select', label: 'Rotation Type', required: true, default: 'auto', options: [{ label: 'Auto Generate', value: 'auto' }, { label: 'Vault', value: 'vault' }] },
        { name: 'restartAfter', type: 'boolean', label: 'Restart After', required: false, default: true },
      ],
      confirmationMessage: 'Secret rotation is a sensitive operation. Ensure dependent services are prepared.',
    },
    {
      type: 'clear_cache',
      name: 'Clear Cache',
      description: 'Clear application or Redis cache',
      riskLevel: 'low',
      requiresApproval: false,
      requiredPermission: 'RESTART_APPLICATION',
      parameters: [
        { name: 'cacheType', type: 'select', label: 'Cache Type', required: true, default: 'application', options: [{ label: 'Application', value: 'application' }, { label: 'Redis', value: 'redis' }, { label: 'All', value: 'all' }] },
      ],
    },
  ];

  const handleOpenDialog = (operation: OperationDefinition) => {
    setSelectedOperation(operation);

    // Initialize form values with defaults
    const defaults: Record<string, any> = {};
    operation.parameters.forEach((param) => {
      defaults[param.name] = param.default !== undefined ? param.default : '';
    });
    setFormValues(defaults);
    setConfirmChecked(false);
    setActiveStep(0);
    setCurrentResult(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedOperation(null);
    setCurrentResult(null);
    setExecuting(false);
  };

  const handleExecute = async () => {
    if (!selectedOperation) return;

    setExecuting(true);
    setActiveStep(1);

    try {
      const response = await fetch(`${backendUrl}/api/gitops/operations/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedOperation.type,
          target: {
            namespace,
            name: serviceName,
            kind,
            cluster,
          },
          parameters: formValues,
          requestedBy: 'current-user', // Would come from auth context
          reason: formValues.reason || undefined,
        }),
      });

      const result: OperationResult = await response.json();
      setCurrentResult(result);
      setActiveStep(2);

      // Refresh history
      fetchHistory();
    } catch (error: any) {
      setCurrentResult({
        id: 'error',
        type: selectedOperation.type,
        status: 'failed',
        target: { namespace, name: serviceName, kind },
        parameters: formValues,
        requestedBy: 'current-user',
        requestedAt: new Date().toISOString(),
        result: { success: false, message: error.message || 'Operation failed' },
        logs: [{ timestamp: new Date().toISOString(), level: 'error', message: error.message }],
      });
      setActiveStep(2);
    }

    setExecuting(false);
  };

  const getRiskClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return classes.lowRisk;
      case 'medium': return classes.mediumRisk;
      case 'high': return classes.highRisk;
      case 'critical': return classes.criticalRisk;
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className={classes.statusCompleted} />;
      case 'failed': return <ErrorIcon className={classes.statusFailed} />;
      case 'in_progress': return <HourglassEmptyIcon className={classes.statusInProgress} />;
      case 'requires_approval': return <WarningIcon className={classes.statusApproval} />;
      case 'cancelled': return <CancelIcon className={classes.statusFailed} />;
      default: return <HourglassEmptyIcon className={classes.statusPending} />;
    }
  };

  const renderParameterInput = (param: OperationParameter) => {
    const value = formValues[param.name];

    switch (param.type) {
      case 'string':
        return (
          <TextField
            key={param.name}
            fullWidth
            label={param.label}
            value={value || ''}
            onChange={(e) => setFormValues({ ...formValues, [param.name]: e.target.value })}
            required={param.required}
            helperText={param.description}
            margin="normal"
          />
        );

      case 'number':
        return (
          <TextField
            key={param.name}
            fullWidth
            type="number"
            label={param.label}
            value={value !== undefined ? value : ''}
            onChange={(e) => setFormValues({ ...formValues, [param.name]: parseInt(e.target.value, 10) })}
            required={param.required}
            helperText={param.description}
            margin="normal"
            inputProps={{
              min: param.validation?.min,
              max: param.validation?.max,
            }}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            key={param.name}
            control={
              <Switch
                checked={!!value}
                onChange={(e) => setFormValues({ ...formValues, [param.name]: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">{param.label}</Typography>
                {param.description && (
                  <Typography variant="caption" color="textSecondary">{param.description}</Typography>
                )}
              </Box>
            }
            style={{ marginTop: 16, marginBottom: 8, display: 'block' }}
          />
        );

      case 'select':
        return (
          <FormControl key={param.name} fullWidth margin="normal" required={param.required}>
            <InputLabel>{param.label}</InputLabel>
            <Select
              value={value || ''}
              onChange={(e) => setFormValues({ ...formValues, [param.name]: e.target.value })}
            >
              {param.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <InfoCard title="Day-2 Operations">
        <LinearProgress />
      </InfoCard>
    );
  }

  return (
    <InfoCard
      title="Day-2 Operations"
      subheader={`${kind}/${serviceName} in ${namespace}`}
    >
      {/* Operation Cards */}
      <Grid container spacing={2}>
        {operations.map((op) => (
          <Grid item xs={6} sm={4} md={3} key={op.type}>
            <Card className={classes.operationCard} onClick={() => handleOpenDialog(op)}>
              <CardContent style={{ textAlign: 'center', padding: 16 }}>
                <Box className={`${classes.operationIcon} ${getRiskClass(op.riskLevel)}`}>
                  {operationIcons[op.type] || <SettingsIcon fontSize="large" />}
                </Box>
                <Typography variant="subtitle2" gutterBottom>
                  {op.name}
                </Typography>
                <Chip
                  size="small"
                  label={op.riskLevel}
                  color={riskColors[op.riskLevel]}
                  className={classes.riskChip}
                />
                {op.requiresApproval && (
                  <Tooltip title="Requires approval">
                    <WarningIcon fontSize="small" color="action" style={{ marginLeft: 4 }} />
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Operation History */}
      {showHistory && history.length > 0 && (
        <>
          <Typography variant="h6" className={classes.sectionTitle}>
            Recent Operations
          </Typography>
          <TableContainer>
            <Table size="small" className={classes.historyTable}>
              <TableHead>
                <TableRow>
                  <TableCell>Operation</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.slice(0, 5).map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        {operationIcons[op.type]}
                        <Typography variant="body2">
                          {operations.find(o => o.type === op.type)?.name || op.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                        {getStatusIcon(op.status)}
                        <Typography variant="body2">{op.status}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{op.requestedBy}</TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(op.requestedAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Operation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedOperation && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                {operationIcons[selectedOperation.type]}
                {selectedOperation.name}
                <Chip
                  size="small"
                  label={selectedOperation.riskLevel}
                  color={riskColors[selectedOperation.riskLevel]}
                  className={classes.riskChip}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stepper activeStep={activeStep} orientation="vertical">
                {/* Step 1: Configure */}
                <Step>
                  <StepLabel>Configure Operation</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {selectedOperation.description}
                    </Typography>

                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Target
                      </Typography>
                      <Chip label={`${namespace}/${serviceName}`} />
                      <Chip label={kind} variant="outlined" style={{ marginLeft: 8 }} />
                    </Box>

                    <Box mt={2}>
                      {selectedOperation.parameters.map(renderParameterInput)}
                    </Box>

                    {/* Confirmation for risky operations */}
                    {(selectedOperation.riskLevel === 'high' || selectedOperation.riskLevel === 'critical') && (
                      <Box className={selectedOperation.riskLevel === 'critical' ? classes.criticalConfirmationBox : classes.confirmationBox}>
                        <Typography variant="body2" gutterBottom>
                          <WarningIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                          {selectedOperation.confirmationMessage || 'This is a high-risk operation. Please confirm.'}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={confirmChecked}
                              onChange={(e) => setConfirmChecked(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="I understand the risks and want to proceed"
                        />
                      </Box>
                    )}

                    {selectedOperation.requiresApproval && (
                      <Alert severity="info" style={{ marginTop: 16 }}>
                        This operation requires approval before execution.
                      </Alert>
                    )}
                  </StepContent>
                </Step>

                {/* Step 2: Executing */}
                <Step>
                  <StepLabel>Executing</StepLabel>
                  <StepContent>
                    <Box display="flex" alignItems="center" style={{ gap: 16 }}>
                      <LinearProgress style={{ flex: 1 }} />
                      <Typography variant="body2">Processing...</Typography>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 3: Result */}
                <Step>
                  <StepLabel>Result</StepLabel>
                  <StepContent>
                    {currentResult && (
                      <>
                        <Alert severity={currentResult.result?.success ? 'success' : 'error'}>
                          {currentResult.result?.message}
                        </Alert>

                        {currentResult.logs && currentResult.logs.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Operation Logs
                            </Typography>
                            <Box className={classes.logsContainer}>
                              {currentResult.logs.map((log, idx) => (
                                <div key={idx} className={`${classes.logEntry} ${log.level}`}>
                                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.level.toUpperCase()}: {log.message}
                                </div>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </>
                    )}
                  </StepContent>
                </Step>
              </Stepper>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>
                {activeStep === 2 ? 'Close' : 'Cancel'}
              </Button>
              {activeStep === 0 && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleExecute}
                  disabled={
                    executing ||
                    ((selectedOperation.riskLevel === 'high' || selectedOperation.riskLevel === 'critical') && !confirmChecked)
                  }
                  startIcon={<PlayArrowIcon />}
                >
                  {selectedOperation.requiresApproval ? 'Request Approval' : 'Execute'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </InfoCard>
  );
};

export default Day2OperationsCard;
