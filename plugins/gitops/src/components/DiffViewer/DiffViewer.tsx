import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  makeStyles,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import EditIcon from '@material-ui/icons/Edit';

const useStyles = makeStyles((theme) => ({
  diffContainer: {
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'auto',
    backgroundColor: '#f6f8fa',
  },
  diffLine: {
    display: 'flex',
    padding: '2px 8px',
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
  },
  lineNumber: {
    minWidth: '40px',
    paddingRight: '16px',
    color: '#666',
    userSelect: 'none',
    textAlign: 'right',
  },
  lineContent: {
    flex: 1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  addedLine: {
    backgroundColor: '#e6ffed',
    '&:hover': {
      backgroundColor: '#d6f5dd',
    },
  },
  removedLine: {
    backgroundColor: '#ffeef0',
    '&:hover': {
      backgroundColor: '#f5d6d8',
    },
  },
  contextLine: {
    backgroundColor: 'transparent',
  },
  hunkHeader: {
    backgroundColor: '#f1f8ff',
    color: '#586069',
    fontWeight: 'bold',
    padding: '4px 8px',
  },
  fileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(2),
    backgroundColor: '#fafbfc',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  stats: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

interface FileDiff {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'hunk';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffViewerProps {
  files: FileDiff[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ files }) => {
  const classes = useStyles();

  const parsePatch = (patch: string): DiffLine[] => {
    const lines: DiffLine[] = [];
    const patchLines = patch.split('\n');

    let oldLineNum = 0;
    let newLineNum = 0;

    patchLines.forEach((line) => {
      if (line.startsWith('@@')) {
        // Hunk header
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1], 10);
          newLineNum = parseInt(match[2], 10);
        }
        lines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+')) {
        lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineNum++,
        });
      } else if (line.startsWith('-')) {
        lines.push({
          type: 'remove',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
        });
      } else if (line.startsWith(' ')) {
        lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    });

    return lines;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <AddIcon fontSize="small" style={{ color: '#28a745' }} />;
      case 'removed':
        return <RemoveIcon fontSize="small" style={{ color: '#d73a49' }} />;
      case 'modified':
        return <EditIcon fontSize="small" style={{ color: '#0366d6' }} />;
      default:
        return <EditIcon fontSize="small" style={{ color: '#0366d6' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'primary';
      case 'removed':
        return 'secondary';
      case 'modified':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {files.map((file, index) => {
        const diffLines = file.patch ? parsePatch(file.patch) : [];

        return (
          <Card key={index} style={{ marginBottom: 16 }}>
            <Box className={classes.fileHeader}>
              <Box display="flex" alignItems="center" style={{ gap: 2 * 8 }}>
                {getStatusIcon(file.status)}
                <Typography variant="subtitle1" style={{ fontFamily: 'monospace' }}>
                  {file.previous_filename && file.previous_filename !== file.filename
                    ? `${file.previous_filename} → ${file.filename}`
                    : file.filename}
                </Typography>
                <Chip
                  label={file.status}
                  size="small"
                  color={getStatusColor(file.status) as any}
                />
              </Box>
              <Box className={classes.stats}>
                <Typography variant="body2" style={{ color: '#28a745' }}>
                  +{file.additions}
                </Typography>
                <Typography variant="body2" style={{ color: '#d73a49' }}>
                  -{file.deletions}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {file.changes} changes
                </Typography>
              </Box>
            </Box>

            <CardContent style={{ padding: 0 }}>
              {diffLines.length > 0 ? (
                <Box className={classes.diffContainer}>
                  {diffLines.map((line, lineIndex) => {
                    if (line.type === 'hunk') {
                      return (
                        <Box key={lineIndex} className={classes.hunkHeader}>
                          {line.content}
                        </Box>
                      );
                    }

                    const lineClass =
                      line.type === 'add'
                        ? classes.addedLine
                        : line.type === 'remove'
                        ? classes.removedLine
                        : classes.contextLine;

                    return (
                      <Box
                        key={lineIndex}
                        className={`${classes.diffLine} ${lineClass}`}
                      >
                        <Box className={classes.lineNumber}>
                          {line.oldLineNumber || ''}
                        </Box>
                        <Box className={classes.lineNumber}>
                          {line.newLineNumber || ''}
                        </Box>
                        <Box className={classes.lineContent}>{line.content}</Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box p={2}>
                  <Typography variant="body2" color="textSecondary">
                    {file.status === 'added'
                      ? 'New file added'
                      : file.status === 'removed'
                      ? 'File removed'
                      : 'Binary file or no diff available'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

      {files.length === 0 && (
        <Box textAlign="center" p={4}>
          <Typography variant="body1" color="textSecondary">
            No files changed
          </Typography>
        </Box>
      )}
    </Box>
  );
};
