import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  CircularProgress,
  makeStyles,
  Paper,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import CommentIcon from '@material-ui/icons/Comment';
import SendIcon from '@material-ui/icons/Send';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  commentCard: {
    marginBottom: theme.spacing(2),
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  commentAuthor: {
    fontWeight: 500,
  },
  commentDate: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  commentBody: {
    marginLeft: theme.spacing(6),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  commentInput: {
    marginBottom: theme.spacing(2),
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
  commentCount: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
}));

interface Comment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface PRCommentsProps {
  repository: string;
  pullNumber: number;
}

export const PRComments: React.FC<PRCommentsProps> = ({
  repository,
  pullNumber,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [repository, pullNumber]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/comments`
      );

      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err: any) {
      console.error('Error loading comments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/repositories/${encodeURIComponent(repository)}/pulls/${pullNumber}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: newComment.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to add comment');
      }

      // Clear input and reload comments
      setNewComment('');
      await loadComments();
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
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
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  return (
    <Box>
      <Box className={classes.sectionTitle}>
        <CommentIcon />
        <Typography variant="h6">
          Comments
          {comments.length > 0 && (
            <span className={classes.commentCount}> ({comments.length})</span>
          )}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      {/* Add Comment */}
      <Card className={classes.commentCard}>
        <CardContent>
          <TextField
            className={classes.commentInput}
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            placeholder="Leave a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
          />
          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              color="primary"
              startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleAddComment}
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? 'Posting...' : 'Comment'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Comments List */}
      {loading ? (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
        </Box>
      ) : comments.length === 0 ? (
        <Box className={classes.emptyState}>
          <CommentIcon style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
          <Typography variant="body1">No comments yet</Typography>
          <Typography variant="body2">
            Be the first to share your thoughts on this pull request
          </Typography>
        </Box>
      ) : (
        <Box>
          {comments.map((comment, index) => (
            <Paper key={comment.id} className={classes.commentCard} variant="outlined">
              <Box p={2}>
                <Box className={classes.commentHeader}>
                  <Avatar
                    src={comment.user.avatar_url}
                    alt={comment.user.login}
                    style={{ width: 32, height: 32 }}
                  />
                  <Typography className={classes.commentAuthor}>
                    {comment.user.login}
                  </Typography>
                  <Typography className={classes.commentDate}>
                    commented {formatDate(comment.created_at)}
                    {comment.updated_at !== comment.created_at && ' (edited)'}
                  </Typography>
                </Box>
                <Typography className={classes.commentBody} variant="body2">
                  {comment.body}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};
