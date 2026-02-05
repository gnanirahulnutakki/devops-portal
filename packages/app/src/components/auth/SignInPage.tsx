import React, { useState } from 'react';
import {
  SignInPageProps,
  githubAuthApiRef,
  googleAuthApiRef,
  microsoftAuthApiRef,
  gitlabAuthApiRef,
  useApi,
  configApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { UserIdentity } from '@backstage/core-components';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Divider,
  CircularProgress,
  InputAdornment,
  IconButton,
  Collapse,
  Alert,
  makeStyles,
} from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import PersonIcon from '@material-ui/icons/Person';
import EmailIcon from '@material-ui/icons/Email';
import LockIcon from '@material-ui/icons/Lock';
import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';
import GroupIcon from '@material-ui/icons/Group';
import BusinessIcon from '@material-ui/icons/Business';
import CodeIcon from '@material-ui/icons/Code';
import CloudIcon from '@material-ui/icons/Cloud';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

/**
 * Custom SignInPage - Enterprise Authentication Hub
 * 
 * Supports:
 * - GitHub OAuth (recommended for developers)
 * - Google OAuth (for Google Workspace users)
 * - Microsoft OAuth (for Azure AD users)
 * - GitLab OAuth
 * - Guest Access (for development/demo)
 * - Username/Password (local auth with 2FA support)
 */

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #09143F 0%, #1a3a7a 50%, #2ea3f2 100%)',
    padding: theme.spacing(2),
  },
  card: {
    maxWidth: 480,
    width: '100%',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
    overflow: 'visible',
  },
  header: {
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    padding: theme.spacing(4),
    textAlign: 'center',
    borderRadius: '16px 16px 0 0',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    },
  },
  logo: {
    fontSize: 56,
    marginBottom: theme.spacing(2),
    position: 'relative',
    zIndex: 1,
  },
  title: {
    fontWeight: 700,
    position: 'relative',
    zIndex: 1,
  },
  subtitle: {
    opacity: 0.9,
    position: 'relative',
    zIndex: 1,
    marginTop: theme.spacing(1),
  },
  content: {
    padding: theme.spacing(4),
  },
  oauthSection: {
    marginBottom: theme.spacing(3),
  },
  oauthButton: {
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    textTransform: 'none',
    fontSize: '1rem',
    fontWeight: 500,
    justifyContent: 'flex-start',
    paddingLeft: theme.spacing(3),
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
  },
  githubButton: {
    backgroundColor: '#24292e',
    color: 'white',
    '&:hover': {
      backgroundColor: '#1a1f24',
    },
  },
  googleButton: {
    backgroundColor: '#4285f4',
    color: 'white',
    '&:hover': {
      backgroundColor: '#3367d6',
    },
  },
  microsoftButton: {
    backgroundColor: '#00a4ef',
    color: 'white',
    '&:hover': {
      backgroundColor: '#0078d4',
    },
  },
  gitlabButton: {
    backgroundColor: '#fc6d26',
    color: 'white',
    '&:hover': {
      backgroundColor: '#e24329',
    },
  },
  guestButton: {
    backgroundColor: '#6b7280',
    color: 'white',
    '&:hover': {
      backgroundColor: '#4b5563',
    },
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(3, 0),
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    margin: theme.spacing(0, 2),
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  localAuthSection: {
    backgroundColor: theme.palette.background.default,
    borderRadius: 8,
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  localAuthToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderRadius: 4,
    },
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
  submitButton: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    borderRadius: 8,
    '&:hover': {
      background: 'linear-gradient(135deg, #2ea3f2 0%, #09143F 100%)',
    },
  },
  footer: {
    marginTop: theme.spacing(3),
    textAlign: 'center',
  },
  link: {
    color: theme.palette.primary.main,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  providerIcon: {
    marginRight: theme.spacing(2),
    fontSize: 24,
  },
  featureBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#00b12b',
    color: 'white',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.7rem',
    fontWeight: 600,
  },
}));

interface OAuthProvider {
  id: string;
  title: string;
  message: string;
  apiRef: typeof githubAuthApiRef;
  Icon: React.ComponentType<any>;
  className: string;
  recommended?: boolean;
}

export const SignInPage = (props: SignInPageProps) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const identityApi = useApi(identityApiRef);

  // State
  const [showLocalAuth, setShowLocalAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Configuration
  const backendUrl = configApi.getString('backend.baseUrl');
  const authEnvironment = configApi.getOptionalString('auth.environment') || 'production';
  const authConfig = configApi.getOptionalConfig('auth.providers');

  // Check if guest mode is enabled
  const guestConfig = authConfig?.getOptionalConfig('guest');
  const guestEnabled = authEnvironment === 'development' || 
    guestConfig?.getOptionalBoolean('dangerouslyAllowOutsideDevelopment') === true;

  // Check if local auth is enabled
  const localAuthEnabled = configApi.getOptionalBoolean('localAuth.enabled') ?? true;

  // OAuth Providers
  const oauthProviders: OAuthProvider[] = [];

  if (!authConfig || authConfig.has('github')) {
    oauthProviders.push({
      id: 'github',
      title: 'GitHub',
      message: 'Sign in with your GitHub account',
      apiRef: githubAuthApiRef,
      Icon: GitHubIcon,
      className: classes.githubButton,
      recommended: true,
    });
  }

  if (authConfig?.has('google')) {
    oauthProviders.push({
      id: 'google',
      title: 'Google',
      message: 'Sign in with Google Workspace',
      apiRef: googleAuthApiRef,
      Icon: BusinessIcon,
      className: classes.googleButton,
    });
  }

  if (authConfig?.has('microsoft')) {
    oauthProviders.push({
      id: 'microsoft',
      title: 'Microsoft',
      message: 'Sign in with Azure AD',
      apiRef: microsoftAuthApiRef,
      Icon: CloudIcon,
      className: classes.microsoftButton,
    });
  }

  if (authConfig?.has('gitlab')) {
    oauthProviders.push({
      id: 'gitlab',
      title: 'GitLab',
      message: 'Sign in with GitLab',
      apiRef: gitlabAuthApiRef,
      Icon: CodeIcon,
      className: classes.gitlabButton,
    });
  }

  // Determine auth environment for OAuth
  const authEnv = authEnvironment === 'development' ? 'development' : 'production';

  // Handle OAuth sign-in - redirect to Backstage auth endpoint with env parameter
  const handleOAuthSignIn = (provider: OAuthProvider) => {
    setOauthLoading(provider.id);
    setError(null);
    
    // Build OAuth URL with required env parameter
    const scopes = provider.id === 'github' ? 'repo user read:org' : '';
    const scopeParam = scopes ? `&scope=${encodeURIComponent(scopes)}` : '';
    
    // Redirect to Backstage's built-in auth endpoint
    window.location.href = `/api/auth/${provider.id}/start?env=${authEnv}${scopeParam}`;
  };

  // Handle Guest sign-in using Backstage's guest provider
  const handleGuestSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use Backstage's built-in guest auth endpoint
      window.location.href = `/api/auth/guest/start?env=${authEnv}`;
    } catch (err: any) {
      setError('Guest login is not available');
      setLoading(false);
    }
  };

  // Handle Local Auth sign-in
  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${backendUrl}/api/gitops/auth/local/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Login failed');
        return;
      }

      if (result.requires2fa) {
        // Redirect to 2FA page
        window.location.href = `/auth/2fa?session=${result.sessionId}`;
        return;
      }

      // Store tokens
      if (result.accessToken) {
        localStorage.setItem('devops-portal-token', result.accessToken);
      }
      if (result.refreshToken) {
        localStorage.setItem('devops-portal-refresh-token', result.refreshToken);
      }

      // Redirect to home
      window.location.href = '/';
    } catch (err: any) {
      setError('Unable to connect to authentication server');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/gitops/auth/local/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          displayName: displayName || username,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Registration failed');
        return;
      }

      // Success - switch to login mode
      setSuccess('Account created successfully! Please sign in.');
      setIsRegistering(false);
      setPassword('');
      setConfirmPassword('');
      setEmail('');
      setDisplayName('');
    } catch (err: any) {
      setError('Unable to connect to registration server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={classes.root}>
      <Card className={classes.card}>
        <div className={classes.header}>
          <Typography variant="h3" className={classes.logo}>
            🚀
          </Typography>
          <Typography variant="h4" className={classes.title}>
            DevOps Portal
          </Typography>
          <Typography variant="body1" className={classes.subtitle}>
            Enterprise Infrastructure Management
          </Typography>
        </div>

        <CardContent className={classes.content}>
          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" style={{ marginBottom: 16 }}>
              {success}
            </Alert>
          )}

          {/* OAuth Providers */}
          <div className={classes.oauthSection}>
            {oauthProviders.map((provider) => (
              <Box key={provider.id} position="relative">
                <Button
                  fullWidth
                  variant="contained"
                  className={`${classes.oauthButton} ${provider.className}`}
                  onClick={() => handleOAuthSignIn(provider)}
                  disabled={oauthLoading === provider.id}
                  startIcon={
                    oauthLoading === provider.id ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <provider.Icon className={classes.providerIcon} />
                    )
                  }
                >
                  Sign in with {provider.title}
                </Button>
                {provider.recommended && (
                  <span className={classes.featureBadge}>Recommended</span>
                )}
              </Box>
            ))}

            {/* Guest Access */}
            {guestEnabled && (
              <Button
                fullWidth
                variant="contained"
                className={`${classes.oauthButton} ${classes.guestButton}`}
                onClick={handleGuestSignIn}
                disabled={loading}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <GroupIcon className={classes.providerIcon} />
                  )
                }
              >
                Continue as Guest
              </Button>
            )}
          </div>

          {/* Local Auth Section */}
          {localAuthEnabled && (
            <>
              <div className={classes.dividerContainer}>
                <Divider className={classes.divider} />
                <Typography className={classes.dividerText}>
                  or sign in with credentials
                </Typography>
                <Divider className={classes.divider} />
              </div>

              <div className={classes.localAuthSection}>
                <div
                  className={classes.localAuthToggle}
                  onClick={() => setShowLocalAuth(!showLocalAuth)}
                >
                  <Box display="flex" alignItems="center">
                    <PersonIcon color="action" style={{ marginRight: 8 }} />
                    <Typography variant="body1">
                      {isRegistering ? 'Create Account' : 'Username & Password'}
                    </Typography>
                  </Box>
                  {showLocalAuth ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </div>

                <Collapse in={showLocalAuth}>
                  <Box mt={2}>
                    {isRegistering ? (
                      /* Registration Form */
                      <form onSubmit={handleRegister}>
                        <TextField
                          className={classes.textField}
                          label="Username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          helperText="Choose a unique username"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PersonIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          className={classes.textField}
                          label="Email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <EmailIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          className={classes.textField}
                          label="Display Name (optional)"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          fullWidth
                          variant="outlined"
                          disabled={loading}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PersonIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          className={classes.textField}
                          label="Password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          helperText="At least 8 characters"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockIcon color="action" />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                  size="small"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          className={classes.textField}
                          label="Confirm Password"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          error={confirmPassword !== '' && password !== confirmPassword}
                          helperText={confirmPassword !== '' && password !== confirmPassword ? 'Passwords do not match' : ''}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        <Button
                          type="submit"
                          fullWidth
                          variant="contained"
                          className={classes.submitButton}
                          disabled={loading || !username || !email || !password || !confirmPassword || password !== confirmPassword}
                        >
                          {loading ? (
                            <CircularProgress size={24} color="inherit" />
                          ) : (
                            'Create Account'
                          )}
                        </Button>

                        <Box textAlign="center" mt={2}>
                          <Typography variant="body2">
                            Already have an account?{' '}
                            <span
                              className={classes.link}
                              onClick={() => {
                                setIsRegistering(false);
                                setError(null);
                                setSuccess(null);
                              }}
                            >
                              Sign In
                            </span>
                          </Typography>
                        </Box>
                      </form>
                    ) : (
                      /* Login Form */
                      <form onSubmit={handleLocalSignIn}>
                        <TextField
                          className={classes.textField}
                          label="Username or Email"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PersonIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />

                        <TextField
                          className={classes.textField}
                          label="Password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          fullWidth
                          variant="outlined"
                          required
                          disabled={loading}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockIcon color="action" />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                  size="small"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />

                        <Button
                          type="submit"
                          fullWidth
                          variant="contained"
                          className={classes.submitButton}
                          disabled={loading || !username || !password}
                        >
                          {loading ? (
                            <CircularProgress size={24} color="inherit" />
                          ) : (
                            'Sign In'
                          )}
                        </Button>

                        <Box textAlign="center" mt={2}>
                          <Typography
                            variant="body2"
                            className={classes.link}
                            onClick={() => window.location.href = '/auth/forgot-password'}
                          >
                            Forgot password?
                          </Typography>
                          <Box mt={1}>
                            <Typography variant="body2">
                              Don't have an account?{' '}
                              <span
                                className={classes.link}
                                onClick={() => {
                                  setIsRegistering(true);
                                  setError(null);
                                  setSuccess(null);
                                }}
                              >
                                Create Account
                              </span>
                            </Typography>
                          </Box>
                        </Box>
                      </form>
                    )}
                  </Box>
                </Collapse>
              </div>
            </>
          )}

          <div className={classes.footer}>
            <Typography variant="caption" color="textSecondary">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </Typography>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
