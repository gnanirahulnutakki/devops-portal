import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Tooltip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  makeStyles,
  Collapse,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import WarningIcon from '@material-ui/icons/Warning';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import DescriptionIcon from '@material-ui/icons/Description';
import SecurityIcon from '@material-ui/icons/Security';
import SpeedIcon from '@material-ui/icons/Speed';
import BugReportIcon from '@material-ui/icons/BugReport';
import CloudIcon from '@material-ui/icons/Cloud';
import BuildIcon from '@material-ui/icons/Build';

const useStyles = makeStyles((theme) => ({
  gradeContainer: {
    textAlign: 'center',
    padding: theme.spacing(3),
    position: 'relative',
  },
  gradeCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    position: 'relative',
  },
  gradeLetter: {
    fontSize: '3rem',
    fontWeight: 700,
    color: 'white',
  },
  gradeScore: {
    marginTop: theme.spacing(1),
    fontSize: '1.2rem',
    fontWeight: 600,
  },
  gradeBronze: {
    background: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)',
    boxShadow: '0 4px 20px rgba(205, 127, 50, 0.4)',
  },
  gradeSilver: {
    background: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
    boxShadow: '0 4px 20px rgba(192, 192, 192, 0.4)',
  },
  gradeGold: {
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.4)',
  },
  gradePlatinum: {
    background: 'linear-gradient(135deg, #E5E4E2 0%, #A9A9A9 100%)',
    boxShadow: '0 4px 20px rgba(229, 228, 226, 0.4)',
  },
  categoryCard: {
    height: '100%',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
    },
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  categoryTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  checkItem: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  passed: {
    color: '#00b12b',
  },
  failed: {
    color: '#d32f2f',
  },
  warning: {
    color: '#ff9800',
  },
  improvementChip: {
    margin: theme.spacing(0.5),
    fontSize: '0.7rem',
  },
  summaryBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
  },
}));

interface Check {
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  weight: number;
}

interface Category {
  name: string;
  icon: React.ReactNode;
  score: number;
  maxScore: number;
  checks: Check[];
}

interface MaturityGrade {
  letter: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  score: number;
  maxScore: number;
  categories: Category[];
  improvements: string[];
}

interface MaturityScorecardProps {
  /** Service/repository name to evaluate */
  serviceName: string;
  /** Show detailed breakdown by default */
  showDetails?: boolean;
  /** Compact mode for embedding in other cards */
  compact?: boolean;
}

export const MaturityScorecard: React.FC<MaturityScorecardProps> = ({
  serviceName,
  showDetails = true,
  compact = false,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [maturity, setMaturity] = useState<MaturityGrade | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const calculateMaturity = async () => {
    setLoading(true);
    
    try {
      // In production, this would call backend APIs to evaluate the service
      // For now, we'll generate sample data based on common checks
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const categories: Category[] = [
        {
          name: 'Documentation',
          icon: <DescriptionIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'README exists', description: 'Repository has a README.md file', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 25 },
            { name: 'API docs', description: 'API documentation (OpenAPI/Swagger)', status: Math.random() > 0.5 ? 'passed' : 'failed', weight: 25 },
            { name: 'Architecture docs', description: 'Architecture decision records', status: Math.random() > 0.6 ? 'passed' : 'warning', weight: 25 },
            { name: 'Runbooks', description: 'Operational runbooks available', status: Math.random() > 0.4 ? 'passed' : 'failed', weight: 25 },
          ],
        },
        {
          name: 'Testing',
          icon: <BugReportIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'Unit tests', description: 'Unit test coverage > 70%', status: Math.random() > 0.3 ? 'passed' : 'warning', weight: 30 },
            { name: 'Integration tests', description: 'Integration tests exist', status: Math.random() > 0.4 ? 'passed' : 'failed', weight: 30 },
            { name: 'E2E tests', description: 'End-to-end tests exist', status: Math.random() > 0.6 ? 'passed' : 'failed', weight: 20 },
            { name: 'Test in CI', description: 'Tests run in CI pipeline', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 20 },
          ],
        },
        {
          name: 'CI/CD',
          icon: <BuildIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'Automated build', description: 'Automated build pipeline', status: Math.random() > 0.1 ? 'passed' : 'failed', weight: 25 },
            { name: 'Automated deploy', description: 'Automated deployment', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 25 },
            { name: 'GitOps', description: 'GitOps workflow enabled', status: Math.random() > 0.3 ? 'passed' : 'warning', weight: 25 },
            { name: 'Rollback', description: 'Automated rollback capability', status: Math.random() > 0.5 ? 'passed' : 'failed', weight: 25 },
          ],
        },
        {
          name: 'Monitoring',
          icon: <SpeedIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'Health checks', description: 'Kubernetes health probes', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 20 },
            { name: 'Metrics', description: 'Prometheus metrics exposed', status: Math.random() > 0.3 ? 'passed' : 'warning', weight: 20 },
            { name: 'Logging', description: 'Structured logging', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 20 },
            { name: 'Alerting', description: 'Alerts configured', status: Math.random() > 0.4 ? 'passed' : 'failed', weight: 20 },
            { name: 'Dashboards', description: 'Grafana dashboards', status: Math.random() > 0.5 ? 'passed' : 'failed', weight: 20 },
          ],
        },
        {
          name: 'Security',
          icon: <SecurityIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'Dependency scan', description: 'Dependency vulnerability scanning', status: Math.random() > 0.3 ? 'passed' : 'warning', weight: 25 },
            { name: 'SAST', description: 'Static code analysis', status: Math.random() > 0.4 ? 'passed' : 'failed', weight: 25 },
            { name: 'Secrets scan', description: 'Secret detection in code', status: Math.random() > 0.3 ? 'passed' : 'failed', weight: 25 },
            { name: 'Container scan', description: 'Container image scanning', status: Math.random() > 0.5 ? 'passed' : 'warning', weight: 25 },
          ],
        },
        {
          name: 'Infrastructure',
          icon: <CloudIcon />,
          score: 0,
          maxScore: 100,
          checks: [
            { name: 'IaC', description: 'Infrastructure as Code', status: Math.random() > 0.2 ? 'passed' : 'failed', weight: 25 },
            { name: 'Multi-env', description: 'Multiple environments', status: Math.random() > 0.3 ? 'passed' : 'failed', weight: 25 },
            { name: 'Resource limits', description: 'K8s resource limits set', status: Math.random() > 0.2 ? 'passed' : 'warning', weight: 25 },
            { name: 'HA config', description: 'High availability setup', status: Math.random() > 0.5 ? 'passed' : 'failed', weight: 25 },
          ],
        },
      ];

      // Calculate scores
      categories.forEach(category => {
        let score = 0;
        category.checks.forEach(check => {
          if (check.status === 'passed') {
            score += check.weight;
          } else if (check.status === 'warning') {
            score += check.weight * 0.5;
          }
        });
        category.score = score;
      });

      // Calculate total score
      const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
      const maxScore = categories.reduce((sum, cat) => sum + cat.maxScore, 0);
      const percentage = (totalScore / maxScore) * 100;

      // Determine grade
      let grade: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
      if (percentage >= 90) {
        grade = 'Platinum';
      } else if (percentage >= 75) {
        grade = 'Gold';
      } else if (percentage >= 50) {
        grade = 'Silver';
      } else {
        grade = 'Bronze';
      }

      // Generate improvements
      const improvements: string[] = [];
      categories.forEach(category => {
        category.checks.forEach(check => {
          if (check.status === 'failed') {
            improvements.push(`Add ${check.name.toLowerCase()}`);
          }
        });
      });

      setMaturity({
        letter: grade,
        score: Math.round(percentage),
        maxScore: 100,
        categories,
        improvements: improvements.slice(0, 5), // Top 5 improvements
      });
    } catch (error) {
      console.error('Failed to calculate maturity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateMaturity();
  }, [serviceName]);

  const getGradeClass = (grade: string) => {
    switch (grade) {
      case 'Bronze': return classes.gradeBronze;
      case 'Silver': return classes.gradeSilver;
      case 'Gold': return classes.gradeGold;
      case 'Platinum': return classes.gradePlatinum;
      default: return classes.gradeBronze;
    }
  };

  const getProgressColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 75) return '#00b12b';
    if (percentage >= 50) return '#ff9800';
    return '#d32f2f';
  };

  if (loading) {
    return (
      <InfoCard title={`Maturity Score - ${serviceName}`}>
        <Box display="flex" justifyContent="center" p={4}>
          <LinearProgress style={{ width: '100%' }} />
        </Box>
      </InfoCard>
    );
  }

  if (!maturity) {
    return (
      <InfoCard title={`Maturity Score - ${serviceName}`}>
        <Typography color="error">Failed to calculate maturity score</Typography>
      </InfoCard>
    );
  }

  if (compact) {
    return (
      <Box display="flex" alignItems="center" style={{ gap: 16 }}>
        <Box 
          className={`${classes.gradeCircle} ${getGradeClass(maturity.letter)}`}
          style={{ width: 60, height: 60 }}
        >
          <Typography style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
            {maturity.score}
          </Typography>
        </Box>
        <Box>
          <Typography variant="h6">{maturity.letter}</Typography>
          <Typography variant="caption" color="textSecondary">
            {maturity.score}% maturity
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <InfoCard
      title={`Service Maturity - ${serviceName}`}
      action={
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={calculateMaturity}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <Grid container spacing={3}>
        {/* Grade Display */}
        <Grid item xs={12} md={4}>
          <Box className={classes.gradeContainer}>
            <Box className={`${classes.gradeCircle} ${getGradeClass(maturity.letter)}`}>
              <Typography className={classes.gradeLetter}>
                {maturity.score}
              </Typography>
            </Box>
            <Typography className={classes.gradeScore}>
              {maturity.letter}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Overall Maturity Score
            </Typography>

            {/* Quick Improvements */}
            {maturity.improvements.length > 0 && (
              <Box className={classes.summaryBox}>
                <Typography variant="subtitle2" gutterBottom>
                  Top Improvements
                </Typography>
                {maturity.improvements.map((improvement, idx) => (
                  <Chip
                    key={idx}
                    label={improvement}
                    size="small"
                    className={classes.improvementChip}
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Category Breakdown */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {maturity.categories.map((category) => (
              <Grid item xs={12} sm={6} key={category.name}>
                <Card 
                  className={classes.categoryCard} 
                  variant="outlined"
                  onClick={() => setExpandedCategory(
                    expandedCategory === category.name ? null : category.name
                  )}
                >
                  <CardContent>
                    <div className={classes.categoryHeader}>
                      <div className={classes.categoryTitle}>
                        {category.icon}
                        <Typography variant="subtitle2">
                          {category.name}
                        </Typography>
                      </div>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        <Typography variant="body2">
                          {category.score}/{category.maxScore}
                        </Typography>
                        {expandedCategory === category.name ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )}
                      </Box>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={(category.score / category.maxScore) * 100}
                      className={classes.progressBar}
                      style={{
                        backgroundColor: '#e0e0e0',
                      }}
                      // @ts-ignore
                      sx={{
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getProgressColor(category.score, category.maxScore),
                        },
                      }}
                    />

                    <Collapse in={expandedCategory === category.name}>
                      <List dense>
                        {category.checks.map((check) => (
                          <ListItem key={check.name} className={classes.checkItem}>
                            <ListItemIcon style={{ minWidth: 32 }}>
                              {check.status === 'passed' ? (
                                <CheckCircleIcon className={classes.passed} fontSize="small" />
                              ) : check.status === 'warning' ? (
                                <WarningIcon className={classes.warning} fontSize="small" />
                              ) : (
                                <CancelIcon className={classes.failed} fontSize="small" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={check.name}
                              secondary={check.description}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </InfoCard>
  );
};

export default MaturityScorecard;
