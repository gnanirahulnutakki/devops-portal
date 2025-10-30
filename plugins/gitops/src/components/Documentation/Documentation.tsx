import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Divider,
  Link,
  Breadcrumbs,
  IconButton,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import HomeIcon from '@material-ui/icons/Home';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import HelpIcon from '@material-ui/icons/Help';
import BuildIcon from '@material-ui/icons/Build';
import BugReportIcon from '@material-ui/icons/BugReport';
import CodeIcon from '@material-ui/icons/Code';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  sidebar: {
    position: 'sticky',
    top: theme.spacing(2),
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'auto',
  },
  content: {
    padding: theme.spacing(3),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  docCard: {
    cursor: 'pointer',
    '&:hover': {
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
      transition: 'all 0.3s ease',
    },
    marginBottom: theme.spacing(2),
  },
  breadcrumb: {
    marginBottom: theme.spacing(2),
  },
  markdownContent: {
    '& h1': {
      fontSize: '2rem',
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(2),
      borderBottom: `2px solid ${theme.palette.divider}`,
      paddingBottom: theme.spacing(1),
    },
    '& h2': {
      fontSize: '1.5rem',
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(1.5),
    },
    '& h3': {
      fontSize: '1.25rem',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    '& p': {
      marginBottom: theme.spacing(2),
      lineHeight: 1.6,
    },
    '& code': {
      backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
      padding: '2px 6px',
      borderRadius: '4px',
      fontFamily: 'Monaco, Courier, monospace',
      fontSize: '0.9em',
    },
    '& pre': {
      backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
      padding: theme.spacing(2),
      borderRadius: '4px',
      overflow: 'auto',
      marginBottom: theme.spacing(2),
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: 0,
    },
    '& ul, & ol': {
      marginBottom: theme.spacing(2),
      paddingLeft: theme.spacing(3),
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: theme.spacing(2),
    },
    '& th, & td': {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(1),
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: theme.palette.type === 'dark' ? '#333' : '#f5f5f5',
      fontWeight: 'bold',
    },
    '& blockquote': {
      borderLeft: `4px solid ${theme.palette.primary.main}`,
      paddingLeft: theme.spacing(2),
      marginLeft: 0,
      fontStyle: 'italic',
      color: theme.palette.text.secondary,
    },
    '& a': {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
}));

interface DocItem {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  content?: string;
}

const documentationStructure: { [key: string]: DocItem[] } = {
  'Getting Started': [
    {
      title: 'Portal Overview',
      description: 'Learn what the GitOps Management Portal is and what it can do',
      path: 'index',
      icon: <HomeIcon />,
    },
    {
      title: 'Quick Start Guide',
      description: 'Get up and running with the portal in minutes',
      path: 'getting-started',
      icon: <MenuBookIcon />,
    },
  ],
  'User Guides': [
    {
      title: 'User Guide',
      description: 'Comprehensive guide for daily usage - browsing, editing, bulk operations, and more',
      path: 'guides/user-guide',
      icon: <MenuBookIcon />,
    },
    {
      title: 'Bulk Operations Guide',
      description: 'Master bulk updates across multiple branches simultaneously',
      path: 'guides/bulk-operations',
      icon: <BuildIcon />,
    },
    {
      title: 'Pull Request Workflow',
      description: 'Learn how to create, review, and manage pull requests',
      path: 'guides/pr-workflow',
      icon: <CodeIcon />,
    },
  ],
  'Administrator Guides': [
    {
      title: 'Admin & Operations Guide',
      description: 'Installation, configuration, deployment, security, monitoring, and maintenance',
      path: 'guides/admin-guide',
      icon: <BuildIcon />,
    },
    {
      title: 'Troubleshooting Guide',
      description: 'Solutions to common problems and debugging procedures',
      path: 'guides/troubleshooting',
      icon: <BugReportIcon />,
    },
  ],
  'Reference': [
    {
      title: 'API Reference',
      description: 'Complete REST API documentation with code examples',
      path: 'reference/api-reference',
      icon: <CodeIcon />,
    },
    {
      title: 'FAQ',
      description: 'Frequently asked questions and quick answers',
      path: 'reference/faq',
      icon: <QuestionAnswerIcon />,
    },
  ],
};

export const Documentation = () => {
  const classes = useStyles();
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDocClick = (doc: DocItem) => {
    setSelectedDoc(doc);
  };

  const handleBackToIndex = () => {
    setSelectedDoc(null);
    setMarkdownContent('');
    setError(null);
  };

  useEffect(() => {
    const loadMarkdownContent = async () => {
      if (!selectedDoc) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch markdown file from the docs directory
        const response = await fetch(`/docs/${selectedDoc.path}.md`);

        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }

        const content = await response.text();
        setMarkdownContent(content);
      } catch (err) {
        console.error('Error loading markdown:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdownContent();
  }, [selectedDoc]);

  const renderDocumentationIndex = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box mb={3}>
          <Typography variant="h3" gutterBottom>
            📚 GitOps Management Portal Documentation
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Welcome to the complete documentation for the RadiantLogic GitOps Management Portal.
            Choose a guide below to get started.
          </Typography>
        </Box>
      </Grid>

      {Object.entries(documentationStructure).map(([section, docs]) => (
        <Grid item xs={12} key={section}>
          <Typography variant="h4" className={classes.sectionTitle}>
            {section}
          </Typography>
          <Grid container spacing={2}>
            {docs.map((doc) => (
              <Grid item xs={12} sm={6} md={4} key={doc.path}>
                <Card
                  className={classes.docCard}
                  onClick={() => handleDocClick(doc)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      {doc.icon}
                      <Typography variant="h6" style={{ marginLeft: 8 }}>
                        {doc.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {doc.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      ))}

      <Grid item xs={12}>
        <Divider style={{ margin: '32px 0' }} />
        <Box>
          <Typography variant="h5" gutterBottom>
            📖 Quick Links
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Most Popular
              </Typography>
              <List dense>
                <ListItem button onClick={() => handleDocClick(documentationStructure['User Guides'][0])}>
                  <ListItemText primary="User Guide" secondary="Daily usage" />
                </ListItem>
                <ListItem button onClick={() => handleDocClick(documentationStructure['User Guides'][1])}>
                  <ListItemText primary="Bulk Operations" secondary="Mass updates" />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                For Admins
              </Typography>
              <List dense>
                <ListItem button onClick={() => handleDocClick(documentationStructure['Administrator Guides'][0])}>
                  <ListItemText primary="Admin Guide" secondary="Setup & config" />
                </ListItem>
                <ListItem button onClick={() => handleDocClick(documentationStructure['Administrator Guides'][1])}>
                  <ListItemText primary="Troubleshooting" secondary="Fix issues" />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                For Developers
              </Typography>
              <List dense>
                <ListItem button onClick={() => handleDocClick(documentationStructure['Reference'][0])}>
                  <ListItemText primary="API Reference" secondary="Automation" />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Get Help
              </Typography>
              <List dense>
                <ListItem button onClick={() => handleDocClick(documentationStructure['Reference'][1])}>
                  <ListItemText primary="FAQ" secondary="Quick answers" />
                </ListItem>
                <ListItem button onClick={() => handleDocClick(documentationStructure['Administrator Guides'][1])}>
                  <ListItemText primary="Troubleshooting" secondary="Common issues" />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </Box>
      </Grid>

      <Grid item xs={12}>
        <Box mt={3}>
          <Typography variant="body2" color="textSecondary" align="center">
            Need more help? Contact the platform team at{' '}
            <Link href="mailto:platform-team@radiantlogic.com">
              platform-team@radiantlogic.com
            </Link>
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );

  const renderDocumentContent = () => {
    if (!selectedDoc) return null;

    return (
      <Box>
        <Box className={classes.breadcrumb} display="flex" alignItems="center" mb={2}>
          <IconButton size="small" onClick={handleBackToIndex}>
            <ArrowBackIcon />
          </IconButton>
          <Breadcrumbs aria-label="breadcrumb" style={{ marginLeft: 16 }}>
            <Link color="inherit" onClick={handleBackToIndex} style={{ cursor: 'pointer' }}>
              Documentation
            </Link>
            <Typography color="textPrimary">{selectedDoc.title}</Typography>
          </Breadcrumbs>
        </Box>

        <Card>
          <CardContent className={classes.content}>
            <Box display="flex" alignItems="center" mb={3}>
              {selectedDoc.icon}
              <Typography variant="h4" style={{ marginLeft: 8 }}>
                {selectedDoc.title}
              </Typography>
            </Box>

            <Divider style={{ marginBottom: 24 }} />

            {loading && (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Box className={classes.markdownContent}>
                <Typography variant="body1" color="error" paragraph>
                  <strong>Error loading documentation:</strong> {error}
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Please ensure the documentation file exists at <code>docs/{selectedDoc.path}.md</code>
                </Typography>
              </Box>
            )}

            {!loading && !error && markdownContent && (
              <Box className={classes.markdownContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </ReactMarkdown>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <div className={classes.root}>
      {selectedDoc ? renderDocumentContent() : renderDocumentationIndex()}
    </div>
  );
};
