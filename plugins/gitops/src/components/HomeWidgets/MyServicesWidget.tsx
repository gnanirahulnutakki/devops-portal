import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  makeStyles,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@material-ui/icons/Refresh';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import SyncIcon from '@material-ui/icons/Sync';
import CloudIcon from '@material-ui/icons/Cloud';
import StorageIcon from '@material-ui/icons/Storage';

const useStyles = makeStyles((theme) => ({
  serviceCard: {
    height: '100%',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  },
  serviceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  serviceName: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  statusIcon: {
    fontSize: 20,
  },
  healthy: {
    color: '#00b12b',
  },
  degraded: {
    color: '#ff9800',
  },
  unhealthy: {
    color: '#d32f2f',
  },
  syncing: {
    color: '#2196f3',
    animation: '$spin 1s linear infinite',
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  envChip: {
    height: 20,
    fontSize: '0.7rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
}));

interface Service {
  name: string;
  namespace: string;
  environment: string;
  status: 'Healthy' | 'Degraded' | 'Unhealthy' | 'Progressing' | 'Unknown';
  syncStatus: 'Synced' | 'OutOfSync' | 'Syncing' | 'Unknown';
  lastSyncTime?: string;
  replicaStatus?: string;
  argoAppName?: string;
}

interface MyServicesWidgetProps {
  /** Maximum number of services to display */
  maxItems?: number;
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
  /** Navigate to ArgoCD page on click */
  navigateOnClick?: boolean;
}

export const MyServicesWidget: React.FC<MyServicesWidgetProps> = ({
  maxItems = 6,
  refreshInterval = 60,
  navigateOnClick = true,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/api/gitops/argocd/applications`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      
      const data = await response.json();
      
      // Transform ArgoCD applications to services
      const transformedServices: Service[] = (data.applications || [])
        .slice(0, maxItems)
        .map((app: any) => ({
          name: app.metadata?.name || 'Unknown',
          namespace: app.spec?.destination?.namespace || 'default',
          environment: extractEnvironment(app.metadata?.name || ''),
          status: app.status?.health?.status || 'Unknown',
          syncStatus: app.status?.sync?.status || 'Unknown',
          lastSyncTime: app.status?.operationState?.finishedAt,
          replicaStatus: getReplicaStatus(app),
          argoAppName: app.metadata?.name,
        }));

      setServices(transformedServices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Show mock data on error
      setServices(generateMockServices());
    } finally {
      setLoading(false);
    }
  }, [backendUrl, maxItems]);

  const extractEnvironment = (name: string): string => {
    const envPatterns = ['prod', 'staging', 'dev', 'qa', 'test'];
    for (const env of envPatterns) {
      if (name.toLowerCase().includes(env)) {
        return env.charAt(0).toUpperCase() + env.slice(1);
      }
    }
    return 'Unknown';
  };

  const getReplicaStatus = (app: any): string => {
    const resources = app.status?.resources || [];
    const deployment = resources.find((r: any) => r.kind === 'Deployment');
    if (deployment) {
      return deployment.status || 'Unknown';
    }
    return 'N/A';
  };

  const generateMockServices = (): Service[] => {
    return [
      { name: 'fid-ops1', namespace: 'duploservices-ops1', environment: 'Prod', status: 'Healthy', syncStatus: 'Synced' },
      { name: 'fid-qa1', namespace: 'duploservices-qa1', environment: 'QA', status: 'Healthy', syncStatus: 'Synced' },
      { name: 'fid-dev', namespace: 'duploservices-dev', environment: 'Dev', status: 'Progressing', syncStatus: 'Syncing' },
      { name: 'zookeeper-ops1', namespace: 'duploservices-ops1', environment: 'Prod', status: 'Healthy', syncStatus: 'Synced' },
    ];
  };

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchServices, refreshInterval]);

  const getStatusIcon = (status: string, syncStatus: string) => {
    if (syncStatus === 'Syncing') {
      return <SyncIcon className={`${classes.statusIcon} ${classes.syncing}`} />;
    }
    
    switch (status) {
      case 'Healthy':
        return <CheckCircleIcon className={`${classes.statusIcon} ${classes.healthy}`} />;
      case 'Degraded':
        return <WarningIcon className={`${classes.statusIcon} ${classes.degraded}`} />;
      case 'Unhealthy':
        return <ErrorIcon className={`${classes.statusIcon} ${classes.unhealthy}`} />;
      case 'Progressing':
        return <SyncIcon className={`${classes.statusIcon} ${classes.syncing}`} />;
      default:
        return <CloudIcon className={classes.statusIcon} />;
    }
  };

  const getEnvChipColor = (env: string) => {
    switch (env.toLowerCase()) {
      case 'prod':
        return { backgroundColor: '#e8f5e9', color: '#2e7d32' };
      case 'staging':
        return { backgroundColor: '#fff3e0', color: '#e65100' };
      case 'qa':
        return { backgroundColor: '#e3f2fd', color: '#1565c0' };
      case 'dev':
        return { backgroundColor: '#f3e5f5', color: '#7b1fa2' };
      default:
        return { backgroundColor: '#f5f5f5', color: '#616161' };
    }
  };

  const handleServiceClick = (service: Service) => {
    if (navigateOnClick && service.argoAppName) {
      navigate(`/gitops/argocd?app=${service.argoAppName}`);
    }
  };

  const formatTimeAgo = (date?: string) => {
    if (!date) return 'Never';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <InfoCard
      title="My Services"
      action={
        <Box display="flex" alignItems="center">
          {loading && <LinearProgress style={{ width: 60, marginRight: 8 }} />}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchServices}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      {error && (
        <Typography color="textSecondary" variant="caption" style={{ marginBottom: 8 }}>
          Using sample data (ArgoCD not connected)
        </Typography>
      )}

      {!loading && services.length === 0 && !error && (
        <Box className={classes.emptyState}>
          <StorageIcon style={{ fontSize: 48, color: '#ccc', marginBottom: 8 }} />
          <Typography color="textSecondary">
            No services found
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        {services.map((service, index) => (
          <Grid item xs={12} sm={6} md={4} key={`${service.name}-${index}`}>
            <Card className={classes.serviceCard} variant="outlined">
              <CardActionArea onClick={() => handleServiceClick(service)}>
                <CardContent>
                  <div className={classes.serviceHeader}>
                    <Typography className={classes.serviceName} noWrap>
                      {service.name}
                    </Typography>
                    {getStatusIcon(service.status, service.syncStatus)}
                  </div>
                  
                  <Typography variant="caption" color="textSecondary" noWrap>
                    {service.namespace}
                  </Typography>
                  
                  <div className={classes.metaRow}>
                    <Chip
                      label={service.environment}
                      size="small"
                      className={classes.envChip}
                      style={getEnvChipColor(service.environment)}
                    />
                    <Chip
                      label={service.syncStatus}
                      size="small"
                      className={classes.envChip}
                      variant="outlined"
                    />
                  </div>
                  
                  <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: 'block' }}>
                    Last sync: {formatTimeAgo(service.lastSyncTime)}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </InfoCard>
  );
};

export default MyServicesWidget;
