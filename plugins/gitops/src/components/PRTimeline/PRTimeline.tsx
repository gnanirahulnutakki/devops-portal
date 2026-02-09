import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  makeStyles,
  Paper,
  Card,
  CardContent,
} from '@material-ui/core';
import {
  Alert,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@material-ui/lab';
import CommentIcon from '@material-ui/icons/Comment';
import GitHubIcon from '@material-ui/icons/GitHub';
import MergeIcon from '@material-ui/icons/CallMerge';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import LabelIcon from '@material-ui/icons/Label';
import EditIcon from '@material-ui/icons/Edit';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  timeline: {
    padding: 0,
    margin: 0,
  },
  timelineItem: {
    '&:before': {
      display: 'none',
    },
    minHeight: 70,
  },
  timelineContent: {
    padding: theme.spacing(0, 0, 2, 2),
  },
  eventCard: {
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.background.default,
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  eventAuthor: {
    fontWeight: 500,
    fontSize: '0.875rem',
  },
  eventTime: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  eventDescription: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
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
    marginBottom: theme.spacing(2),
  },
  commitDot: {
    backgroundColor: theme.palette.primary.main,
  },
  commentDot: {
    backgroundColor: theme.palette.info.main,
  },
  reviewDot: {
    backgroundColor: theme.palette.success.main,
  },
  closeDot: {
    backgroundColor: theme.palette.error.main,
  },
  mergeDot: {
    backgroundColor: '#09143F',
  },
}));

interface TimelineEvent {
  id: string;
  type: 'commit' | 'comment' | 'review' | 'merged' | 'closed' | 'reopened' | 'assigned' | 'labeled' | 'renamed';
  user?: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  message?: string;
  commit_id?: string;
  label?: string;
  assignee?: string;
  state?: string;
}

interface PRTimelineProps {
  repository: string;
  pullNumber: number;
}

export const PRTimeline: React.FC<PRTimelineProps> = ({
  repository,
  pullNumber,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimeline();
  }, [repository, pullNumber]);

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/timeline`
      );

      if (!response.ok) {
        throw new Error('Failed to load timeline');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err: any) {
      console.error('Error loading timeline:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'commit':
        return <GitHubIcon fontSize="small" />;
      case 'comment':
        return <CommentIcon fontSize="small" />;
      case 'review':
        return <CheckCircleIcon fontSize="small" />;
      case 'merged':
        return <MergeIcon fontSize="small" />;
      case 'closed':
        return <CancelIcon fontSize="small" />;
      case 'assigned':
        return <PersonAddIcon fontSize="small" />;
      case 'labeled':
        return <LabelIcon fontSize="small" />;
      case 'renamed':
        return <EditIcon fontSize="small" />;
      default:
        return <GitHubIcon fontSize="small" />;
    }
  };

  const getEventDotClass = (type: string) => {
    switch (type) {
      case 'commit':
        return classes.commitDot;
      case 'comment':
        return classes.commentDot;
      case 'review':
        return classes.reviewDot;
      case 'merged':
        return classes.mergeDot;
      case 'closed':
        return classes.closeDot;
      default:
        return '';
    }
  };

  const getEventDescription = (event: TimelineEvent): string => {
    switch (event.type) {
      case 'commit':
        return event.message || 'committed changes';
      case 'comment':
        return 'commented';
      case 'review':
        return event.state === 'approved' ? 'approved these changes' : 'requested changes';
      case 'merged':
        return 'merged this pull request';
      case 'closed':
        return 'closed this pull request';
      case 'reopened':
        return 'reopened this pull request';
      case 'assigned':
        return `assigned ${event.assignee}`;
      case 'labeled':
        return `added label "${event.label}"`;
      case 'renamed':
        return 'renamed this pull request';
      default:
        return event.type;
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" className={classes.sectionTitle}>
          Timeline
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
        <Typography variant="h6" className={classes.sectionTitle}>
          Timeline
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" className={classes.sectionTitle}>
        Timeline
      </Typography>

      {events.length === 0 ? (
        <Box className={classes.emptyState}>
          <GitHubIcon style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
          <Typography variant="body1">No activity yet</Typography>
          <Typography variant="body2">
            Timeline events will appear here as they occur
          </Typography>
        </Box>
      ) : (
        <Timeline className={classes.timeline}>
          {events.map((event, index) => (
            <TimelineItem key={event.id} className={classes.timelineItem}>
              <TimelineSeparator>
                <TimelineDot className={getEventDotClass(event.type)}>
                  {getEventIcon(event.type)}
                </TimelineDot>
                {index < events.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent className={classes.timelineContent}>
                <Paper className={classes.eventCard} elevation={0}>
                  <Box className={classes.eventHeader}>
                    <Avatar
                      src={event.user?.avatar_url}
                      alt={event.user?.login || 'System'}
                      style={{ width: 20, height: 20 }}
                    />
                    <Typography className={classes.eventAuthor}>
                      {event.user?.login || 'System'}
                    </Typography>
                    <Typography className={classes.eventDescription}>
                      {getEventDescription(event)}
                    </Typography>
                    <Typography className={classes.eventTime}>
                      {formatDate(event.created_at)}
                    </Typography>
                  </Box>
                  {event.commit_id && (
                    <Box mt={0.5}>
                      <Chip
                        label={event.commit_id.substring(0, 7)}
                        size="small"
                        style={{ fontSize: '0.75rem', height: 20 }}
                      />
                    </Box>
                  )}
                </Paper>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </Box>
  );
};
