/**
 * LocalAuthLoginPage - Username/Password Login with 2FA Support
 *
 * Features:
 * - Username/email + password login
 * - TOTP 2FA verification dialog
 * - Remember device option
 * - Account lockout warning
 * - Password requirements display
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  InputAdornment,
  IconButton,
  makeStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';
import LockIcon from '@material-ui/icons/Lock';
import PersonIcon from '@material-ui/icons/Person';
import SecurityIcon from '@material-ui/icons/Security';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
  },
  card: {
    maxWidth: 440,
    width: '100%',
    margin: theme.spacing(2),
    borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
  },
  header: {
    textAlign: 'center',
    marginBottom: theme.spacing(3),
  },
  logo: {
    width: 120,
    marginBottom: theme.spacing(2),
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  submitButton: {
    marginTop: theme.spacing(2),
    background: 'linear-gradient(135deg, #09143F 0%, #2ea3f2 100%)',
    color: 'white',
    padding: theme.spacing(1.5),
    '&:hover': {
      background: 'linear-gradient(135deg, #2ea3f2 0%, #09143F 100%)',
    },
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(3, 0),
    '&::before, &::after': {
      content: '""',
      flex: 1,
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  dividerText: {
    margin: theme.spacing(0, 2),
    color: theme.palette.text.secondary,
  },
  oauthButton: {
    marginBottom: theme.spacing(1),
  },
  tfaInput: {
    letterSpacing: '0.5em',
    textAlign: 'center',
    fontSize: '1.5rem',
  },
  lockoutWarning: {
    marginBottom: theme.spacing(2),
  },
}));

interface LoginResult {
  success: boolean;
  user?: any;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  requires2fa?: boolean;
  sessionId?: string;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}

export const LocalAuthLoginPage = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutInfo, setLockoutInfo] = useState<{
    remainingAttempts?: number;
    lockedUntil?: Date;
  } | null>(null);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [tfaCode, setTfaCode] = useState('');
  const [tempSessionData, setTempSessionData] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLockoutInfo(null);

    try {
      const response = await fetch(`${backendUrl}/api/auth/local/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          rememberDevice,
        }),
      });

      const result: LoginResult = await response.json();

      if (!result.success) {
        if (result.lockedUntil) {
          setLockoutInfo({ lockedUntil: new Date(result.lockedUntil) });
        } else if (result.remainingAttempts !== undefined) {
          setLockoutInfo({ remainingAttempts: result.remainingAttempts });
        }
        setError(result.error || 'Login failed');
        return;
      }

      if (result.requires2fa) {
        setTempSessionData(result);
        setShow2FA(true);
        return;
      }

      // Store tokens and redirect
      handleLoginSuccess(result);
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/auth/local/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: tempSessionData?.user?.id,
          code: tfaCode,
          rememberDevice,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Invalid 2FA code');
        return;
      }

      handleLoginSuccess(result);
    } catch (err) {
      setError('2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (result: LoginResult) => {
    // Store tokens in localStorage
    if (result.accessToken) {
      localStorage.setItem('devops-portal-token', result.accessToken);
    }
    if (result.refreshToken) {
      localStorage.setItem('devops-portal-refresh-token', result.refreshToken);
    }

    // Redirect to home
    window.location.href = '/';
  };

  const formatLockoutTime = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    return `${diffMins} minutes`;
  };

  return (
    <div className={classes.root}>
      <Card className={classes.card}>
        <CardContent>
          <Box className={classes.header}>
            <LockIcon style={{ fontSize: 48, color: '#09143F' }} />
            <Typography variant="h4" gutterBottom>
              DevOps Portal
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Sign in to your account
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              {error}
            </Alert>
          )}

          {lockoutInfo?.lockedUntil && (
            <Alert severity="warning" className={classes.lockoutWarning}>
              Account locked. Try again in {formatLockoutTime(lockoutInfo.lockedUntil)}.
            </Alert>
          )}

          {lockoutInfo?.remainingAttempts !== undefined && lockoutInfo.remainingAttempts < 3 && (
            <Alert severity="warning" className={classes.lockoutWarning}>
              {lockoutInfo.remainingAttempts} attempts remaining before lockout.
            </Alert>
          )}

          <form onSubmit={handleLogin} className={classes.form}>
            <TextField
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
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  color="primary"
                />
              }
              label="Remember this device for 30 days"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              className={classes.submitButton}
              disabled={loading || !!lockoutInfo?.lockedUntil}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Box textAlign="center" mt={2}>
            <Link href="#" variant="body2">
              Forgot password?
            </Link>
          </Box>

          <Box className={classes.divider}>
            <Typography variant="body2" className={classes.dividerText}>
              or continue with
            </Typography>
          </Box>

          <Button
            variant="outlined"
            fullWidth
            className={classes.oauthButton}
            onClick={() => (window.location.href = '/api/auth/github/start')}
          >
            Sign in with GitHub
          </Button>
        </CardContent>
      </Card>

      {/* 2FA Dialog */}
      <Dialog open={show2FA} onClose={() => setShow2FA(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <SecurityIcon color="primary" />
            Two-Factor Authentication
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Enter the 6-digit code from your authenticator app.
          </Typography>
          <TextField
            label="Authentication Code"
            value={tfaCode}
            onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            fullWidth
            variant="outlined"
            margin="normal"
            inputProps={{
              maxLength: 6,
              className: classes.tfaInput,
            }}
            autoFocus
          />
          {error && (
            <Alert severity="error" style={{ marginTop: 8 }}>
              {error}
            </Alert>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                color="primary"
              />
            }
            label="Trust this device for 30 days"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShow2FA(false)}>Cancel</Button>
          <Button
            onClick={handle2FAVerify}
            variant="contained"
            color="primary"
            disabled={loading || tfaCode.length !== 6}
          >
            {loading ? <CircularProgress size={20} /> : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LocalAuthLoginPage;
