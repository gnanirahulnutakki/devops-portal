import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Tooltip,
  IconButton,
  makeStyles,
  Chip,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import ErrorIcon from '@material-ui/icons/Error';
import SpeedIcon from '@material-ui/icons/Speed';
import DataUsageIcon from '@material-ui/icons/DataUsage';
import NetworkCheckIcon from '@material-ui/icons/NetworkCheck';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

const useStyles = makeStyles((theme) => ({
  signalCard: {
    height: '100%',
    minHeight: 140,
    position: 'relative',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  },
  signalValue: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  signalLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing(0.5),
  },
  signalTrend: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
  },
  trendUp: {
    color: '#d32f2f',
  },
  trendDown: {
    color: '#00b12b',
  },
  trendNeutral: {
    color: theme.palette.text.secondary,
  },
  statusGood: {
    color: '#00b12b',
  },
  statusWarning: {
    color: '#ff9800',
  },
  statusCritical: {
    color: '#d32f2f',
  },
  iconContainer: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    opacity: 0.3,
  },
  chartContainer: {
    height: 60,
    marginTop: theme.spacing(1),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
  },
  sparkline: {
    height: '100%',
    width: '100%',
  },
  grafanaLink: {
    marginLeft: 'auto',
  },
}));

interface GoldenSignal {
  name: string;
  value: number;
  unit: string;
  trend: number; // percentage change
  status: 'good' | 'warning' | 'critical';
  sparkline?: number[]; // Last 24 data points for mini chart
}

interface GoldenSignalsCardProps {
  /** Service/application name for Grafana queries */
  serviceName: string;
  /** Namespace for Grafana queries */
  namespace?: string;
  /** Grafana dashboard URL for "View in Grafana" link */
  grafanaDashboardUrl?: string;
  /** Custom refresh interval in seconds (default: 60) */
  refreshInterval?: number;
  /** Show embedded charts */
  showCharts?: boolean;
}

/**
 * Golden Signals Card - Displays the four golden signals of monitoring:
 * 1. Latency - Response time
 * 2. Traffic - Requests per second
 * 3. Errors - Error rate percentage
 * 4. Saturation - Resource utilization
 * 
 * These are the key metrics for understanding service health according to SRE principles.
 */
export const GoldenSignalsCard: React.FC<GoldenSignalsCardProps> = ({
  serviceName,
  namespace,
  grafanaDashboardUrl,
  refreshInterval = 60,
  showCharts = true,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<GoldenSignal[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from Prometheus/Grafana API
      // For now, we'll simulate the data
      const response = await fetch(
        `${backendUrl}/api/gitops/metrics/golden-signals?service=${encodeURIComponent(serviceName)}${namespace ? `&namespace=${namespace}` : ''}`
      );

      if (response.ok) {
        const data = await response.json();
        setSignals(data.signals);
      } else {
        // Use mock data if API not available
        setSignals(generateMockSignals());
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch golden signals:', error);
      setSignals(generateMockSignals());
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Mock data generator for demonstration
  const generateMockSignals = (): GoldenSignal[] => {
    return [
      {
        name: 'Latency',
        value: Math.round(45 + Math.random() * 30),
        unit: 'ms',
        trend: Math.round((Math.random() - 0.5) * 20),
        status: Math.random() > 0.8 ? 'warning' : 'good',
        sparkline: Array.from({ length: 24 }, () => Math.round(40 + Math.random() * 40)),
      },
      {
        name: 'Traffic',
        value: Math.round(1200 + Math.random() * 800),
        unit: 'req/s',
        trend: Math.round((Math.random() - 0.3) * 15),
        status: 'good',
        sparkline: Array.from({ length: 24 }, () => Math.round(1000 + Math.random() * 1000)),
      },
      {
        name: 'Errors',
        value: parseFloat((Math.random() * 2).toFixed(2)),
        unit: '%',
        trend: Math.round((Math.random() - 0.5) * 10),
        status: Math.random() > 0.7 ? 'warning' : Math.random() > 0.9 ? 'critical' : 'good',
        sparkline: Array.from({ length: 24 }, () => parseFloat((Math.random() * 3).toFixed(2))),
      },
      {
        name: 'Saturation',
        value: Math.round(35 + Math.random() * 40),
        unit: '%',
        trend: Math.round((Math.random() - 0.5) * 10),
        status: Math.random() > 0.7 ? 'warning' : 'good',
        sparkline: Array.from({ length: 24 }, () => Math.round(30 + Math.random() * 50)),
      },
    ];
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [serviceName, namespace, refreshInterval]);

  const getSignalIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'latency':
        return <SpeedIcon style={{ fontSize: 40 }} />;
      case 'traffic':
        return <NetworkCheckIcon style={{ fontSize: 40 }} />;
      case 'errors':
        return <ErrorIcon style={{ fontSize: 40 }} />;
      case 'saturation':
        return <DataUsageIcon style={{ fontSize: 40 }} />;
      default:
        return <DataUsageIcon style={{ fontSize: 40 }} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'good':
        return classes.statusGood;
      case 'warning':
        return classes.statusWarning;
      case 'critical':
        return classes.statusCritical;
      default:
        return '';
    }
  };

  const getTrendIcon = (trend: number, signalName: string) => {
    // For errors and latency, up is bad. For traffic, up can be good.
    const isUpBad = signalName.toLowerCase() === 'errors' || signalName.toLowerCase() === 'latency';
    
    if (Math.abs(trend) < 1) {
      return <Typography className={classes.trendNeutral}>—</Typography>;
    }
    
    if (trend > 0) {
      return (
        <Box display="flex" alignItems="center" className={isUpBad ? classes.trendUp : classes.trendDown}>
          <TrendingUpIcon style={{ fontSize: 16, marginRight: 2 }} />
          <Typography variant="caption">+{trend}%</Typography>
        </Box>
      );
    }
    
    return (
      <Box display="flex" alignItems="center" className={isUpBad ? classes.trendDown : classes.trendUp}>
        <TrendingDownIcon style={{ fontSize: 16, marginRight: 2 }} />
        <Typography variant="caption">{trend}%</Typography>
      </Box>
    );
  };

  const renderSparkline = (data: number[]) => {
    if (!data || data.length === 0) return null;
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={classes.sparkline}>
        <polyline
          fill="none"
          stroke="#2ea3f2"
          strokeWidth="2"
          points={points}
        />
      </svg>
    );
  };

  return (
    <InfoCard
      title={`Golden Signals - ${serviceName}`}
      subheader={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : undefined}
      action={
        <Box display="flex" alignItems="center">
          {grafanaDashboardUrl && (
            <Tooltip title="View in Grafana">
              <IconButton
                size="small"
                href={grafanaDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchSignals} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      {loading && signals.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {signals.map((signal) => (
            <Grid item xs={12} sm={6} md={3} key={signal.name}>
              <Card className={classes.signalCard} variant="outlined">
                <CardContent>
                  <div className={classes.iconContainer}>
                    {getSignalIcon(signal.name)}
                  </div>
                  
                  <Typography className={classes.signalLabel}>
                    {signal.name}
                  </Typography>
                  
                  <Box display="flex" alignItems="baseline">
                    <Typography 
                      className={`${classes.signalValue} ${getStatusClass(signal.status)}`}
                    >
                      {signal.value.toLocaleString()}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="textSecondary"
                      style={{ marginLeft: 4 }}
                    >
                      {signal.unit}
                    </Typography>
                  </Box>
                  
                  <div className={classes.signalTrend}>
                    {getTrendIcon(signal.trend, signal.name)}
                    <Chip
                      label={signal.status}
                      size="small"
                      style={{ 
                        marginLeft: 'auto',
                        backgroundColor: signal.status === 'good' ? '#e8f5e9' : 
                                        signal.status === 'warning' ? '#fff3e0' : '#ffebee',
                        color: signal.status === 'good' ? '#2e7d32' : 
                               signal.status === 'warning' ? '#f57c00' : '#c62828',
                      }}
                    />
                  </div>
                  
                  {showCharts && signal.sparkline && (
                    <div className={classes.chartContainer}>
                      {renderSparkline(signal.sparkline)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </InfoCard>
  );
};

export default GoldenSignalsCard;
