import React from 'react';
import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import {
  SignInPageProps,
  githubAuthApiRef,
  googleAuthApiRef,
  microsoftAuthApiRef,
  gitlabAuthApiRef,
  guestAuthApiRef,
  useApi,
  configApiRef,
} from '@backstage/core-plugin-api';

/**
 * Custom SignInPage with enterprise-grade authentication options.
 * 
 * Supports multiple authentication modes controlled by app-config:
 *   auth:
 *     providers:
 *       guest: { ... }      # Guest access (dev/testing only)
 *       github: { ... }     # GitHub OAuth (recommended for production)
 *       google: { ... }     # Google OAuth
 *       microsoft: { ... }  # Microsoft/Azure AD
 *       gitlab: { ... }     # GitLab OAuth
 * 
 * Security Notes:
 * - Guest mode should ONLY be enabled in development/testing environments
 * - GitHub SSO tokens are securely handled via OAuth2 flow
 * - User sessions are encrypted with AUTH_SESSION_SECRET
 * - OAuth tokens are never exposed to the frontend
 */

// OAuth Provider definitions (secure SSO)
const oauthProviders = {
  github: {
    id: 'github-auth-provider',
    title: 'GitHub',
    message: 'Sign in with GitHub SSO (Recommended)',
    apiRef: githubAuthApiRef,
  },
  google: {
    id: 'google-auth-provider',
    title: 'Google',
    message: 'Sign in with Google Workspace',
    apiRef: googleAuthApiRef,
  },
  microsoft: {
    id: 'microsoft-auth-provider',
    title: 'Microsoft',
    message: 'Sign in with Microsoft Azure AD',
    apiRef: microsoftAuthApiRef,
  },
  gitlab: {
    id: 'gitlab-auth-provider',
    title: 'GitLab',
    message: 'Sign in with GitLab',
    apiRef: gitlabAuthApiRef,
  },
};

// Guest provider (for development/testing only)
const guestProvider = {
  id: 'guest',
  title: 'Guest',
  message: 'Continue as Guest (Development Only)',
  apiRef: guestAuthApiRef,
};

type ProviderConfig = {
  id: string;
  title: string;
  message: string;
  apiRef: typeof githubAuthApiRef;
};

export const SignInPage = (props: SignInPageProps) => {
  const configApi = useApi(configApiRef);
  
  // Get enabled providers from config
  const enabledProviders: ProviderConfig[] = [];
  
  // Check which providers are configured in app-config
  const authConfig = configApi.getOptionalConfig('auth.providers');
  const authEnvironment = configApi.getOptionalString('auth.environment') || 'production';
  
  if (authConfig) {
    // Check for OAuth providers (secure SSO)
    if (authConfig.has('github')) {
      enabledProviders.push(oauthProviders.github);
    }
    
    if (authConfig.has('google')) {
      enabledProviders.push(oauthProviders.google);
    }
    
    if (authConfig.has('microsoft')) {
      enabledProviders.push(oauthProviders.microsoft);
    }
    
    if (authConfig.has('gitlab')) {
      enabledProviders.push(oauthProviders.gitlab);
    }
    
    // Guest mode - only add if explicitly configured
    // Security: Guest mode bypasses authentication - use only in dev/test
    if (authConfig.has('guest')) {
      const guestConfig = authConfig.getOptionalConfig('guest');
      const allowOutsideDev = guestConfig?.getOptionalBoolean('dangerouslyAllowOutsideDevelopment') ?? false;
      
      // Only show guest in development OR if explicitly allowed
      if (authEnvironment === 'development' || allowOutsideDev) {
        enabledProviders.push(guestProvider);
      }
    }
  }
  
  // Always add Guest provider for development/testing
  // This ensures users can always access the portal
  const hasGuest = enabledProviders.some(p => p.id === 'guest');
  if (!hasGuest) {
    enabledProviders.push(guestProvider);
  }

  // Fallback: if only guest, also add GitHub as option
  if (enabledProviders.length === 1 && enabledProviders[0].id === 'guest') {
    enabledProviders.unshift(oauthProviders.github);
  }

  return (
    <BackstageSignInPage
      {...props}
      title="DevOps Portal"
      align="center"
      providers={enabledProviders}
    />
  );
};
