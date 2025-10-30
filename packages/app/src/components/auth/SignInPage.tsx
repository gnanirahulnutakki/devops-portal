import React from 'react';
import { SignInPage as BackstageSignInPage } from '@backstage/core-components';
import {
  githubAuthApiRef,
  googleAuthApiRef,
  oauth2AuthApiRef,
} from '@backstage/core-plugin-api';

export const SignInPage = () => {
  return (
    <BackstageSignInPage
      title="GitOps Management Portal"
      align="center"
      providers={[
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
          id: 'oauth2-auth-provider',
          title: 'Microsoft',
          message: 'Sign in using Microsoft Azure AD',
          apiRef: oauth2AuthApiRef,
        },
      ]}
    />
  );
};
