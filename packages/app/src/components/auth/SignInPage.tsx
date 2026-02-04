import React from 'react';
import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import {
  SignInPageProps,
  githubAuthApiRef,
  googleAuthApiRef,
  microsoftAuthApiRef,
  gitlabAuthApiRef,
} from '@backstage/core-plugin-api';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Providers available in production
const productionProviders = [
  {
    id: 'github-auth-provider',
    title: 'GitHub',
    message: 'Sign in using GitHub',
    apiRef: githubAuthApiRef,
  },
  {
    id: 'google-auth-provider',
    title: 'Google',
    message: 'Sign in using Google',
    apiRef: googleAuthApiRef,
  },
  {
    id: 'microsoft-auth-provider',
    title: 'Microsoft',
    message: 'Sign in using Microsoft Azure AD',
    apiRef: microsoftAuthApiRef,
  },
  {
    id: 'gitlab-auth-provider',
    title: 'GitLab',
    message: 'Sign in using GitLab',
    apiRef: gitlabAuthApiRef,
  },
];

// Guest provider for development only
const guestProvider = {
  id: 'guest',
  title: 'Guest',
  message: 'Continue as guest (development only)',
  apiRef: githubAuthApiRef, // Uses guest resolver on backend
};

export const SignInPage = (props: SignInPageProps) => {
  // In development, add guest option at the end
  const providers = isDevelopment 
    ? [...productionProviders, guestProvider]
    : productionProviders;

  return (
    <BackstageSignInPage
      {...props}
      title="GitOps Management Portal"
      align="center"
      providers={providers}
    />
  );
};
