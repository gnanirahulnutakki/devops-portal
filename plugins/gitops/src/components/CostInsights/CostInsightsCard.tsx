import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  makeStyles,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import WarningIcon from '@material-ui/icons/Warning';

const useStyles = makeStyles((theme) => ({
  totalCost: {
    textAlign: 'center',
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  costAmount: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  trendUp: {
    color: '#d32f2f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
  },
  trendDown: {
    color: '#00b12b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
  },
  trendFlat: {
    color: '#757575',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
  },
  serviceRow: {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  costBar: {
    width: 100,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.grey[200],
  },
  budgetWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor: '#fff3e0',
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  breakdownCard: {
    height: '100%',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
  },
  chartContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    margin: '0 auto',
  },
}));

interface CostBreakdown {
  category: string;
  cost: number;
  percentage: number;
  color: string;
}

interface ServiceCost {
  serviceName: string;
  environment: string;
  cost: number;
  previousCost: number;
  trend: 'up' | 'down' | 'flat';
  percentage: number;
  breakdown: CostBreakdown[];
}

interface CostSummary {
  totalCost: number;
  previousTotalCost: number;
  trend: 'up' | 'down' | 'flat';
  trendPercentage: number;
  budget?: number;
  services: ServiceCost[];
  breakdown: CostBreakdown[];
  period: string;
}

interface CostInsightsCardProps {
  /** Service name to show cost for (optional, shows all if not specified) */
  serviceName?: string;
  /** Time period for cost data */
  period?: 'daily' | 'weekly' | 'monthly';
  /** Show detailed breakdown */
  showBreakdown?: boolean;
}

export const CostInsightsCard: React.FC<CostInsightsCardProps> = ({
  serviceName,
  period = 'monthly',
  showBreakdown = true,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [costData, setCostData] = useState<CostSummary | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const fetchCostData = async () => {
    setLoading(true);
    
    try {
      // In production, this would call a backend API connected to AWS Cost Explorer, GCP Billing, etc.
      // For now, we generate realistic mock data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4'];
      
      const generateBreakdown = (): CostBreakdown[] => {
        const categories = ['Compute (EC2/EKS)', 'Storage (S3/EBS)', 'Database (RDS)', 'Network', 'Other'];
        const breakdown: CostBreakdown[] = [];
        let remaining = 100;
        
        categories.forEach((category, idx) => {
          const percentage = idx === categories.length - 1 
            ? remaining 
            : Math.floor(Math.random() * (remaining / 2)) + 5;
          remaining -= percentage;
          breakdown.push({
            category,
            cost: 0, // Will calculate based on total
            percentage,
            color: colors[idx],
          });
        });
        
        return breakdown;
      };

      const services: ServiceCost[] = [
        { serviceName: 'fid-cluster', environment: 'production', cost: 2450, previousCost: 2200, trend: 'up', percentage: 11.4, breakdown: generateBreakdown() },
        { serviceName: 'eoc-backend', environment: 'production', cost: 890, previousCost: 920, trend: 'down', percentage: -3.3, breakdown: generateBreakdown() },
        { serviceName: 'argocd', environment: 'shared', cost: 340, previousCost: 335, trend: 'flat', percentage: 1.5, breakdown: generateBreakdown() },
        { serviceName: 'grafana-stack', environment: 'shared', cost: 280, previousCost: 275, trend: 'flat', percentage: 1.8, breakdown: generateBreakdown() },
        { serviceName: 'elasticsearch', environment: 'shared', cost: 1200, previousCost: 1150, trend: 'up', percentage: 4.3, breakdown: generateBreakdown() },
        { serviceName: 'redis-cluster', environment: 'production', cost: 180, previousCost: 190, trend: 'down', percentage: -5.3, breakdown: generateBreakdown() },
      ];

      // If specific service requested, filter
      const filteredServices = serviceName 
        ? services.filter(s => s.serviceName.toLowerCase().includes(serviceName.toLowerCase()))
        : services;

      const totalCost = filteredServices.reduce((sum, s) => sum + s.cost, 0);
      const previousTotalCost = filteredServices.reduce((sum, s) => sum + s.previousCost, 0);
      const trendPercentage = ((totalCost - previousTotalCost) / previousTotalCost) * 100;

      // Generate overall breakdown
      const overallBreakdown: CostBreakdown[] = [
        { category: 'Compute (EC2/EKS)', cost: totalCost * 0.45, percentage: 45, color: colors[0] },
        { category: 'Storage (S3/EBS)', cost: totalCost * 0.20, percentage: 20, color: colors[1] },
        { category: 'Database (RDS)', cost: totalCost * 0.18, percentage: 18, color: colors[2] },
        { category: 'Network', cost: totalCost * 0.12, percentage: 12, color: colors[3] },
        { category: 'Other', cost: totalCost * 0.05, percentage: 5, color: colors[4] },
      ];

      setCostData({
        totalCost,
        previousTotalCost,
        trend: trendPercentage > 2 ? 'up' : trendPercentage < -2 ? 'down' : 'flat',
        trendPercentage: Math.abs(trendPercentage),
        budget: 6000,
        services: filteredServices,
        breakdown: overallBreakdown,
        period: selectedPeriod,
      });
    } catch (error) {
      console.error('Failed to fetch cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData();
  }, [serviceName, selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderTrendIcon = (trend: 'up' | 'down' | 'flat', percentage: number) => {
    const trendClass = trend === 'up' ? classes.trendUp : trend === 'down' ? classes.trendDown : classes.trendFlat;
    const Icon = trend === 'up' ? TrendingUpIcon : trend === 'down' ? TrendingDownIcon : TrendingFlatIcon;
    const prefix = trend === 'up' ? '+' : trend === 'down' ? '-' : '';
    
    return (
      <span className={trendClass}>
        <Icon fontSize="small" />
        <Typography variant="body2" component="span">
          {prefix}{percentage.toFixed(1)}%
        </Typography>
      </span>
    );
  };

  const renderDonutChart = (breakdown: CostBreakdown[]) => {
    let cumulativePercentage = 0;
    
    return (
      <svg viewBox="0 0 100 100" className={classes.chartContainer}>
        {breakdown.map((item, idx) => {
          const startAngle = (cumulativePercentage / 100) * 360;
          cumulativePercentage += item.percentage;
          const endAngle = (cumulativePercentage / 100) * 360;
          
          const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
          const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
          
          const largeArc = item.percentage > 50 ? 1 : 0;
          
          const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
          
          return (
            <path
              key={idx}
              d={pathData}
              fill={item.color}
              stroke="white"
              strokeWidth="1"
            />
          );
        })}
        <circle cx="50" cy="50" r="25" fill="white" />
      </svg>
    );
  };

  if (loading) {
    return (
      <InfoCard title="Cost Insights">
        <Box display="flex" justifyContent="center" p={4}>
          <LinearProgress style={{ width: '100%' }} />
        </Box>
      </InfoCard>
    );
  }

  if (!costData) {
    return (
      <InfoCard title="Cost Insights">
        <Typography color="error">Failed to load cost data</Typography>
      </InfoCard>
    );
  }

  const budgetPercentage = costData.budget 
    ? (costData.totalCost / costData.budget) * 100 
    : 0;

  return (
    <InfoCard
      title={serviceName ? `Cost Insights - ${serviceName}` : 'Cost Insights'}
      action={
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" variant="outlined" style={{ minWidth: 100 }}>
            <Select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchCostData}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      {/* Budget Warning */}
      {costData.budget && budgetPercentage > 80 && (
        <Box className={classes.budgetWarning}>
          <WarningIcon color="action" />
          <Typography variant="body2">
            <strong>Budget Alert:</strong> You've used {budgetPercentage.toFixed(0)}% of your {selectedPeriod} budget ({formatCurrency(costData.budget)})
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Total Cost Summary */}
        <Grid item xs={12} md={4}>
          <Box className={classes.totalCost}>
            <AttachMoneyIcon style={{ fontSize: 40, color: '#2196f3' }} />
            <Typography className={classes.costAmount}>
              {formatCurrency(costData.totalCost)}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Total
            </Typography>
            {renderTrendIcon(costData.trend, costData.trendPercentage)}
            <Typography variant="caption" color="textSecondary">
              vs previous {selectedPeriod}
            </Typography>

            {costData.budget && (
              <Box mt={2}>
                <Typography variant="caption" color="textSecondary">
                  Budget: {formatCurrency(costData.budget)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(budgetPercentage, 100)}
                  style={{ 
                    height: 8, 
                    borderRadius: 4,
                    marginTop: 4,
                  }}
                  color={budgetPercentage > 80 ? 'secondary' : 'primary'}
                />
              </Box>
            )}
          </Box>

          {/* Cost Breakdown Donut */}
          {showBreakdown && (
            <Card variant="outlined" className={classes.breakdownCard}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Cost Breakdown
                </Typography>
                <Box display="flex" justifyContent="center" mb={2}>
                  <Box style={{ width: 150, height: 150 }}>
                    {renderDonutChart(costData.breakdown)}
                  </Box>
                </Box>
                {costData.breakdown.map((item) => (
                  <div key={item.category} className={classes.legendItem}>
                    <span 
                      className={classes.legendDot} 
                      style={{ backgroundColor: item.color }}
                    />
                    <Typography variant="caption" style={{ flex: 1 }}>
                      {item.category}
                    </Typography>
                    <Typography variant="caption">
                      {item.percentage}%
                    </Typography>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Services Table */}
        <Grid item xs={12} md={8}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Environment</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Trend</TableCell>
                  <TableCell>Share</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costData.services.map((service) => {
                  const sharePercentage = (service.cost / costData.totalCost) * 100;
                  return (
                    <TableRow key={service.serviceName} className={classes.serviceRow}>
                      <TableCell>
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          {service.serviceName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={service.environment}
                          size="small"
                          color={service.environment === 'production' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          {formatCurrency(service.cost)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {renderTrendIcon(service.trend, Math.abs(service.percentage))}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box className={classes.costBar}>
                            <Box
                              style={{
                                width: `${sharePercentage}%`,
                                height: '100%',
                                backgroundColor: '#2196f3',
                                borderRadius: 4,
                              }}
                            />
                          </Box>
                          <Typography variant="caption">
                            {sharePercentage.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Top Recommendations */}
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Cost Optimization Recommendations
            </Typography>
            <Box component="ul" pl={2} mt={1}>
              <Typography component="li" variant="body2" color="textSecondary" gutterBottom>
                Consider using Reserved Instances for fid-cluster - potential savings of ~30%
              </Typography>
              <Typography component="li" variant="body2" color="textSecondary" gutterBottom>
                Elasticsearch storage can be moved to S3 Glacier for cold data
              </Typography>
              <Typography component="li" variant="body2" color="textSecondary">
                Enable auto-scaling policies to reduce idle compute costs
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </InfoCard>
  );
};

export default CostInsightsCard;
