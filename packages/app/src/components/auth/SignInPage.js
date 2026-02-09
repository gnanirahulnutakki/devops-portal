import React from 'react';
import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import { githubAuthApiRef, googleAuthApiRef, microsoftAuthApiRef, gitlabAuthApiRef, useApi, configApiRef, } from '@backstage/core-plugin-api';
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
export const SignInPage = (props) => {
    const configApi = useApi(configApiRef);
    // Get enabled providers from config
    const enabledProviders = [];
    // Check which providers are configured in app-config
    const authConfig = configApi.getOptionalConfig('auth.providers');
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
    }
    // Fallback: if no providers configured, add GitHub
    if (enabledProviders.length === 0) {
        enabledProviders.push(oauthProviders.github);
    }
    return (React.createElement(BackstageSignInPage, { ...props, title: "DevOps Portal", align: "center", providers: enabledProviders }));
};
//# sourceMappingURL=SignInPage.js.map