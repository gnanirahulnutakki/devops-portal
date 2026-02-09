import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  makeStyles,
  Divider,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import HelpIcon from '@material-ui/icons/Help';
import RateReviewIcon from '@material-ui/icons/RateReview';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  reviewItem: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  reviewStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  approved: {
    color: theme.palette.success.main,
  },
  changesRequested: {
    color: theme.palette.error.main,
  },
  pending: {
    color: theme.palette.warning.main,
  },
  summaryCard: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    marginBottom: theme.spacing(2),
  },
  statusSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  statusCount: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  reviewComment: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    borderLeft: `3px solid ${theme.palette.divider}`,
    fontSize: '0.875rem',
    fontStyle: 'italic',
  },
}));

interface Review {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  body: string;
  submitted_at: string;
  commit_id?: string;
}

interface PRReviewStatusProps {
  repository: string;
  pullNumber: number;
}

export const PRReviewStatus: React.FC<PRReviewStatusProps> = ({
  repository,
  pullNumber,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, [repository, pullNumber]);

  const loadReviews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/reviews`
      );

      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err: any) {
      console.error('Error loading reviews:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getReviewIcon = (state: string) => {
    switch (state) {
      case 'APPROVED':
        return <CheckCircleIcon className={classes.approved} />;
      case 'CHANGES_REQUESTED':
        return <CancelIcon className={classes.changesRequested} />;
      case 'COMMENTED':
        return <RateReviewIcon className={classes.pending} />;
      case 'PENDING':
        return <HelpIcon className={classes.pending} />;
      case 'DISMISSED':
        return <CancelIcon style={{ opacity: 0.5 }} />;
      default:
        return <HelpIcon />;
    }
  };

  const getReviewChip = (state: string) => {
    switch (state) {
      case 'APPROVED':
        return (
          <Chip
            label="Approved"
            size="small"
            style={{ backgroundColor: '#28a745', color: 'white' }}
            icon={<CheckCircleIcon style={{ color: 'white' }} />}
          />
        );
      case 'CHANGES_REQUESTED':
        return (
          <Chip
            label="Changes Requested"
            size="small"
            style={{ backgroundColor: '#d73a49', color: 'white' }}
            icon={<CancelIcon style={{ color: 'white' }} />}
          />
        );
      case 'COMMENTED':
        return <Chip label="Commented" size="small" />;
      case 'PENDING':
        return <Chip label="Pending" size="small" color="default" />;
      case 'DISMISSED':
        return <Chip label="Dismissed" size="small" variant="outlined" />;
      default:
        return <Chip label={state} size="small" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const approvedCount = reviews.filter(r => r.state === 'APPROVED').length;
  const changesRequestedCount = reviews.filter(r => r.state === 'CHANGES_REQUESTED').length;
  const commentedCount = reviews.filter(r => r.state === 'COMMENTED').length;

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Reviews
        </Typography>
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Reviews
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box className={classes.sectionTitle}>
        <RateReviewIcon />
        <Typography variant="h6">Reviews</Typography>
        {reviews.length > 0 && (
          <Chip label={reviews.length} size="small" color="primary" />
        )}
      </Box>

      {reviews.length === 0 ? (
        <Box className={classes.emptyState}>
          <RateReviewIcon style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
          <Typography variant="body1">No reviews yet</Typography>
          <Typography variant="body2">
            Reviews help maintain code quality and catch issues early
          </Typography>
        </Box>
      ) : (
        <>
          {/* Review Summary */}
          <Box className={classes.summaryCard}>
            <Typography variant="subtitle2" gutterBottom>
              Review Summary
            </Typography>
            <Box className={classes.statusSummary}>
              {approvedCount > 0 && (
                <Box className={classes.statusCount}>
                  <CheckCircleIcon className={classes.approved} fontSize="small" />
                  <Typography variant="body2" className={classes.approved}>
                    {approvedCount} approved
                  </Typography>
                </Box>
              )}
              {changesRequestedCount > 0 && (
                <Box className={classes.statusCount}>
                  <CancelIcon className={classes.changesRequested} fontSize="small" />
                  <Typography variant="body2" className={classes.changesRequested}>
                    {changesRequestedCount} requested changes
                  </Typography>
                </Box>
              )}
              {commentedCount > 0 && (
                <Box className={classes.statusCount}>
                  <RateReviewIcon className={classes.pending} fontSize="small" />
                  <Typography variant="body2" className={classes.pending}>
                    {commentedCount} commented
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Individual Reviews */}
          <List disablePadding>
            {reviews.map((review, index) => (
              <React.Fragment key={review.id}>
                {index > 0 && <Divider />}
                <ListItem className={classes.reviewItem}>
                  <ListItemAvatar>
                    <Avatar
                      src={review.user.avatar_url}
                      alt={review.user.login}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box className={classes.reviewStatus}>
                        <Typography variant="body1" style={{ fontWeight: 500 }}>
                          {review.user.login}
                        </Typography>
                        {getReviewChip(review.state)}
                        <Typography variant="body2" color="textSecondary">
                          • {formatDate(review.submitted_at)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      review.body && (
                        <Box className={classes.reviewComment}>
                          {review.body}
                        </Box>
                      )
                    }
                  />
                  {getReviewIcon(review.state)}
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </>
      )}
    </Box>
  );
};
