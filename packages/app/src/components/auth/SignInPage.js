import React from 'react';
import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import { githubAuthApiRef, googleAuthApiRef, microsoftAuthApiRef, gitlabAuthApiRef, useApi, configApiRef, } from '@backstage/core-plugin-api';
/**
 * Custom SignInPage that dynamically shows only the configured auth providers.
 *
 * The providers shown are controlled by app-config:
 *   auth:
 *     providers:
 *       github: { ... }     # GitHub OAuth
 *       google: { ... }     # Google OAuth
 *       microsoft: { ... }  # Microsoft/Azure AD
 *       gitlab: { ... }     # GitLab OAuth
 *       guest: { ... }      # Guest (dev only)
 */
// All available provider definitions
const allProviders = {
    github: {
        id: 'github-auth-provider',
        title: 'GitHub',
        message: 'Sign in using GitHub',
        apiRef: githubAuthApiRef,
    },
    google: {
        id: 'google-auth-provider',
        title: 'Google',
        message: 'Sign in using Google',
        apiRef: googleAuthApiRef,
    },
    microsoft: {
        id: 'microsoft-auth-provider',
        title: 'Microsoft',
        message: 'Sign in using Microsoft Azure AD',
        apiRef: microsoftAuthApiRef,
    },
    gitlab: {
        id: 'gitlab-auth-provider',
        title: 'GitLab',
        message: 'Sign in using GitLab',
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
        // Check for GitHub
        if (authConfig.has('github')) {
            enabledProviders.push(allProviders.github);
        }
        // Check for Google
        if (authConfig.has('google')) {
            enabledProviders.push(allProviders.google);
        }
        // Check for Microsoft
        if (authConfig.has('microsoft')) {
            enabledProviders.push(allProviders.microsoft);
        }
        // Check for GitLab
        if (authConfig.has('gitlab')) {
            enabledProviders.push(allProviders.gitlab);
        }
    }
    // Fallback: if no providers detected, show GitHub as default
    if (enabledProviders.length === 0) {
        enabledProviders.push(allProviders.github);
    }
    return (React.createElement(BackstageSignInPage, { ...props, title: "GitOps Management Portal", align: "center", providers: enabledProviders }));
};
//# sourceMappingURL=SignInPage.js.map