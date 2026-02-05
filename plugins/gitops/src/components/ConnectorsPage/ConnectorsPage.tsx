/**
 * ConnectorsPage - OAuth Connectors (like ChatGPT plugins)
 *
 * A grid-based UI for connecting external accounts:
 * - GitHub: Access repos, PRs, Actions
 * - GitLab: Access projects, merge requests
 * - Microsoft: Azure AD, Microsoft 365
 * - Google: Google Cloud, Workspace
 *
 * Each connector shows:
 * - Connection status
 * - Connected account info
 * - Scopes/permissions
 * - Connect/Disconnect actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Button,
  Avatar,
  Chip,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  InfoCard,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import GitHubIcon from '@material-ui/icons/GitHub';
import CloudIcon from '@material-ui/icons/Cloud';
import BusinessIcon from '@material-ui/icons/Business';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import LinkIcon from '@material-ui/icons/Link';
import LinkOffIcon from '@material-ui/icons/LinkOff';
import RefreshIcon from '@material-ui/icons/Refresh';
import SecurityIcon from '@material-ui/icons/Security';

const useStyles = makeStyles((theme) => ({
  connectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: theme.spacing(3),
  },
  connectorCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[8],
    },
  },
  connectorCardConnected: {
    borderTop: '4px solid #00b12b',
  },
  connectorCardDisconnected: {
    borderTop: `4px solid ${theme.palette.divider}`,
  },
  connectorCardError: {
    borderTop: '4px solid #d32f2f',
  },
  connectorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  connectorLogo: {
    width: 56,
    height: 56,
    backgroundColor: theme.palette.background.default,
    '& svg': {
      fontSize: 32,
    },
  },
  connectorContent: {
    flexGrow: 1,
  },
  connectorStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  scopeChip: {
    margin: theme.spacing(0.25),
    fontSize: '0.75rem',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  userAvatar: {
    width: 32,
    height: 32,
  },
  connectButton: {
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    '&:hover': {
      background: 'linear-gradient(135deg, #2ea3f2 0%, #09143F 100%)',
    },
  },
  disconnectButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },
}));

interface Connector {
  id: string;
  provider: string;
  providerUsername?: string;
  providerEmail?: string;
  providerAvatarUrl?: string;
  scopes: string[];
  status: 'active' | 'expired' | 'revoked' | 'error';
  connectedAt?: string;
  lastUsedAt?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  scopes: string[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Access your repositories, pull requests, and GitHub Actions',
    icon: <GitHubIcon />,
    color: '#24292e',
    scopes: ['repo', 'read:org', 'workflow'],
  },
  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Access your projects, merge requests, and CI/CD pipelines',
    icon: <CloudIcon />,
    color: '#fc6d26',
    scopes: ['read_user', 'read_api', 'read_repository'],
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Connect with Azure AD, Microsoft 365, and Azure DevOps',
    icon: <BusinessIcon />,
    color: '#00a4ef',
    scopes: ['User.Read', 'profile', 'email'],
  },
  google: {
    id: 'google',
    name: 'Google',
    description: 'Connect with Google Cloud Platform and Google Workspace',
    icon: <CloudIcon />,
    color: '#4285f4',
    scopes: ['profile', 'email', 'openid'],
  },
};

export const ConnectorsPage = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<Connector | null>(null);

  const loadConnectors = useCallback(async () => {
    try {
      // Load user's connected providers
      const connectorsResponse = await fetch(`${backendUrl}/api/connectors`);
      if (connectorsResponse.ok) {
        const data = await connectorsResponse.json();
        setConnectors(data.connectors || []);
      }

      // Load available providers
      const providersResponse = await fetch(`${backendUrl}/api/connectors/available`);
      if (providersResponse.ok) {
        const data = await providersResponse.json();
        setAvailableProviders(data.providers?.map((p: any) => p.provider) || Object.keys(PROVIDERS));
      } else {
        setAvailableProviders(Object.keys(PROVIDERS));
      }
    } catch (error) {
      console.error('Failed to load connectors:', error);
      setAvailableProviders(Object.keys(PROVIDERS));
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    loadConnectors();
  }, [loadConnectors]);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const response = await fetch(`${backendUrl}/api/connectors/${provider}/connect`);
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          // Redirect to OAuth authorization
          window.location.href = data.url;
        }
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog) return;

    try {
      const response = await fetch(
        `${backendUrl}/api/connectors/${disconnectDialog.provider}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        setConnectors(connectors.filter(c => c.provider !== disconnectDialog.provider));
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setDisconnectDialog(null);
    }
  };

  const getConnector = (provider: string): Connector | undefined => {
    return connectors.find(c => c.provider === provider);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon style={{ color: '#00b12b' }} />;
      case 'expired':
        return <WarningIcon style={{ color: '#e25a1a' }} />;
      case 'error':
        return <ErrorIcon style={{ color: '#d32f2f' }} />;
      default:
        return null;
    }
  };

  const getCardClass = (connector?: Connector) => {
    if (!connector) return classes.connectorCardDisconnected;
    if (connector.status === 'active') return classes.connectorCardConnected;
    if (connector.status === 'error') return classes.connectorCardError;
    return classes.connectorCardDisconnected;
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Connectors" subtitle="Connect your external accounts" />
        <Content>
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title="Connectors"
        subtitle="Connect your external accounts to access additional features"
      >
        <Tooltip title="Refresh">
          <IconButton onClick={loadConnectors}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Header>
      <Content>
        <Box mb={3}>
          <InfoCard title="About Connectors">
            <Typography variant="body2" color="textSecondary">
              Connectors allow you to link your external accounts (GitHub, GitLab, etc.) to access
              your personal repositories, pull requests, and other resources. Your credentials are
              encrypted and stored securely.
            </Typography>
          </InfoCard>
        </Box>

        <div className={classes.connectorGrid}>
          {availableProviders.map((providerId) => {
            const provider = PROVIDERS[providerId];
            if (!provider) return null;

            const connector = getConnector(providerId);
            const isConnected = connector?.status === 'active';

            return (
              <Card
                key={providerId}
                className={`${classes.connectorCard} ${getCardClass(connector)}`}
              >
                <CardContent className={classes.connectorContent}>
                  <Box className={classes.connectorHeader}>
                    <Avatar
                      className={classes.connectorLogo}
                      style={{ backgroundColor: provider.color, color: 'white' }}
                    >
                      {provider.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{provider.name}</Typography>
                      {connector && (
                        <Box className={classes.connectorStatus}>
                          {getStatusIcon(connector.status)}
                          <Typography variant="caption" color="textSecondary">
                            {connector.status === 'active' ? 'Connected' : connector.status}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Typography variant="body2" color="textSecondary" paragraph>
                    {provider.description}
                  </Typography>

                  <Box mb={1}>
                    <Typography variant="caption" color="textSecondary">
                      <SecurityIcon style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} />
                      Permissions:
                    </Typography>
                    <Box mt={0.5}>
                      {(connector?.scopes || provider.scopes).map((scope) => (
                        <Chip
                          key={scope}
                          label={scope}
                          size="small"
                          variant="outlined"
                          className={classes.scopeChip}
                        />
                      ))}
                    </Box>
                  </Box>

                  {connector && isConnected && (
                    <Box className={classes.userInfo}>
                      {connector.providerAvatarUrl ? (
                        <Avatar src={connector.providerAvatarUrl} className={classes.userAvatar} />
                      ) : (
                        <Avatar className={classes.userAvatar}>
                          {connector.providerUsername?.[0]?.toUpperCase()}
                        </Avatar>
                      )}
                      <Box>
                        <Typography variant="body2">
                          {connector.providerUsername || connector.providerEmail}
                        </Typography>
                        {connector.lastUsedAt && (
                          <Typography variant="caption" color="textSecondary">
                            Last used: {new Date(connector.lastUsedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                </CardContent>

                <CardActions>
                  {isConnected ? (
                    <Button
                      variant="outlined"
                      className={classes.disconnectButton}
                      startIcon={<LinkOffIcon />}
                      onClick={() => setDisconnectDialog(connector!)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      className={classes.connectButton}
                      startIcon={connecting === providerId ? <CircularProgress size={20} /> : <LinkIcon />}
                      onClick={() => handleConnect(providerId)}
                      disabled={connecting !== null}
                    >
                      Connect
                    </Button>
                  )}
                </CardActions>
              </Card>
            );
          })}
        </div>

        {/* Disconnect Confirmation Dialog */}
        <Dialog
          open={!!disconnectDialog}
          onClose={() => setDisconnectDialog(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Disconnect {PROVIDERS[disconnectDialog?.provider || '']?.name}?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary">
              This will revoke access to your {PROVIDERS[disconnectDialog?.provider || '']?.name} account.
              You can reconnect at any time.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDisconnectDialog(null)}>Cancel</Button>
            <Button onClick={handleDisconnect} color="secondary" variant="contained">
              Disconnect
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

export default ConnectorsPage;
