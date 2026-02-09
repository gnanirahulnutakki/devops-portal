import React from 'react';
import { Box, Typography, Card, CardContent, Chip, makeStyles, } from '@material-ui/core';
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
export const DiffViewer = ({ files }) => {
    const classes = useStyles();
    const parsePatch = (patch) => {
        const lines = [];
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
            }
            else if (line.startsWith('+')) {
                lines.push({
                    type: 'add',
                    content: line.substring(1),
                    newLineNumber: newLineNum++,
                });
            }
            else if (line.startsWith('-')) {
                lines.push({
                    type: 'remove',
                    content: line.substring(1),
                    oldLineNumber: oldLineNum++,
                });
            }
            else if (line.startsWith(' ')) {
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
    const getStatusIcon = (status) => {
        switch (status) {
            case 'added':
                return React.createElement(AddIcon, { fontSize: "small", style: { color: '#28a745' } });
            case 'removed':
                return React.createElement(RemoveIcon, { fontSize: "small", style: { color: '#d73a49' } });
            case 'modified':
                return React.createElement(EditIcon, { fontSize: "small", style: { color: '#0366d6' } });
            default:
                return React.createElement(EditIcon, { fontSize: "small", style: { color: '#0366d6' } });
        }
    };
    const getStatusColor = (status) => {
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
    return (React.createElement(Box, null,
        files.map((file, index) => {
            const diffLines = file.patch ? parsePatch(file.patch) : [];
            return (React.createElement(Card, { key: index, style: { marginBottom: 16 } },
                React.createElement(Box, { className: classes.fileHeader },
                    React.createElement(Box, { display: "flex", alignItems: "center", style: { gap: 2 * 8 } },
                        getStatusIcon(file.status),
                        React.createElement(Typography, { variant: "subtitle1", style: { fontFamily: 'monospace' } }, file.previous_filename && file.previous_filename !== file.filename
                            ? `${file.previous_filename} → ${file.filename}`
                            : file.filename),
                        React.createElement(Chip, { label: file.status, size: "small", color: getStatusColor(file.status) })),
                    React.createElement(Box, { className: classes.stats },
                        React.createElement(Typography, { variant: "body2", style: { color: '#28a745' } },
                            "+",
                            file.additions),
                        React.createElement(Typography, { variant: "body2", style: { color: '#d73a49' } },
                            "-",
                            file.deletions),
                        React.createElement(Typography, { variant: "body2", color: "textSecondary" },
                            file.changes,
                            " changes"))),
                React.createElement(CardContent, { style: { padding: 0 } }, diffLines.length > 0 ? (React.createElement(Box, { className: classes.diffContainer }, diffLines.map((line, lineIndex) => {
                    if (line.type === 'hunk') {
                        return (React.createElement(Box, { key: lineIndex, className: classes.hunkHeader }, line.content));
                    }
                    const lineClass = line.type === 'add'
                        ? classes.addedLine
                        : line.type === 'remove'
                            ? classes.removedLine
                            : classes.contextLine;
                    return (React.createElement(Box, { key: lineIndex, className: `${classes.diffLine} ${lineClass}` },
                        React.createElement(Box, { className: classes.lineNumber }, line.oldLineNumber || ''),
                        React.createElement(Box, { className: classes.lineNumber }, line.newLineNumber || ''),
                        React.createElement(Box, { className: classes.lineContent }, line.content)));
                }))) : (React.createElement(Box, { p: 2 },
                    React.createElement(Typography, { variant: "body2", color: "textSecondary" }, file.status === 'added'
                        ? 'New file added'
                        : file.status === 'removed'
                            ? 'File removed'
                            : 'Binary file or no diff available'))))));
        }),
        files.length === 0 && (React.createElement(Box, { textAlign: "center", p: 4 },
            React.createElement(Typography, { variant: "body1", color: "textSecondary" }, "No files changed")))));
};
//# sourceMappingURL=DiffViewer.js.map