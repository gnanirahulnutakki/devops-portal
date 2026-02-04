/**
 * Authentication Module for GitOps Portal
 * 
 * Supports multiple OAuth providers:
 * - GitHub (with repo access via OAuth token)
 * - Google
 * - Microsoft/Azure AD
 * - GitLab
 * - Generic OIDC (for enterprise SSO)
 * - SAML (for enterprise SSO)
 */

export { AuthTokenService } from '../services/AuthTokenService';
export type { 
  AuthTokenServiceConfig, 
  AuthenticatedUser, 
  UserTokens 
} from '../services/AuthTokenService';

/**
 * OAuth Provider Configuration
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
}

/**
 * GitHub OAuth Configuration
 * Scopes determine what the user can access with their token
 */
export interface GitHubOAuthConfig extends OAuthProviderConfig {
  enterpriseInstanceUrl?: string;
  // Scopes for repo access
  scopes?: string[];
}

/**
 * Default GitHub scopes for GitOps operations
 */
export const DEFAULT_GITHUB_SCOPES = [
  'read:user',
  'user:email',
  'repo',           // Full control of private repos
  'read:org',       // Read org membership
  'workflow',       // Update GitHub Actions workflows
];

/**
 * Google OAuth Configuration
 */
export interface GoogleOAuthConfig extends OAuthProviderConfig {
  // Additional scopes beyond basic profile
  scopes?: string[];
}

/**
 * Microsoft/Azure AD OAuth Configuration
 */
export interface MicrosoftOAuthConfig extends OAuthProviderConfig {
  tenantId: string;
  // Can be 'common', 'organizations', 'consumers', or a specific tenant ID
  authority?: string;
  scopes?: string[];
}

/**
 * GitLab OAuth Configuration
 */
export interface GitLabOAuthConfig extends OAuthProviderConfig {
  baseUrl?: string; // For self-hosted GitLab
  scopes?: string[];
}

/**
 * Default GitLab scopes
 */
export const DEFAULT_GITLAB_SCOPES = [
  'read_user',
  'read_api',
  'read_repository',
  'write_repository',
  'api',
];

/**
 * Generic OIDC Configuration for enterprise SSO
 */
export interface OIDCProviderConfig {
  metadataUrl: string; // .well-known/openid-configuration URL
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
  scopes?: string[];
  // Optional claim mappings
  claims?: {
    userId?: string;
    email?: string;
    displayName?: string;
    groups?: string;
  };
}

/**
 * SAML Configuration for enterprise SSO
 */
export interface SAMLProviderConfig {
  entryPoint: string;  // IdP SSO URL
  issuer: string;      // SP Entity ID
  cert: string;        // IdP certificate
  callbackUrl: string;
  // Optional attribute mappings
  attributes?: {
    userId?: string;
    email?: string;
    displayName?: string;
    groups?: string;
  };
  // Signing options
  signatureAlgorithm?: 'sha256' | 'sha512';
  wantAssertionsSigned?: boolean;
}

/**
 * Combined Auth Configuration
 */
export interface AuthConfig {
  // Session management
  session: {
    secret: string;
    cookieName?: string;
    secure?: boolean;
    maxAge?: number; // in milliseconds
  };
  
  // OAuth providers
  providers: {
    guest?: {
      enabled: boolean;
      allowInProduction?: boolean;
    };
    github?: GitHubOAuthConfig;
    google?: GoogleOAuthConfig;
    microsoft?: MicrosoftOAuthConfig;
    gitlab?: GitLabOAuthConfig;
    oidc?: OIDCProviderConfig;
    saml?: SAMLProviderConfig;
  };

  // Permission settings
  permissions?: {
    // Require authentication for all operations
    requireAuth: boolean;
    // Admin users/groups
    admins?: string[];
    // Read-only users/groups
    readOnly?: string[];
  };
}

/**
 * Create Backstage auth configuration from AuthConfig
 */
export function createBackstageAuthConfig(config: AuthConfig): any {
  const authConfig: any = {
    session: {
      secret: config.session.secret,
    },
    providers: {},
  };

  // Guest provider
  if (config.providers.guest?.enabled) {
    authConfig.providers.guest = {
      dangerouslyAllowOutsideDevelopment: config.providers.guest.allowInProduction,
    };
  }

  // GitHub OAuth
  if (config.providers.github) {
    authConfig.providers.github = {
      development: {
        clientId: config.providers.github.clientId,
        clientSecret: config.providers.github.clientSecret,
        ...(config.providers.github.enterpriseInstanceUrl && {
          enterpriseInstanceUrl: config.providers.github.enterpriseInstanceUrl,
        }),
      },
      production: {
        clientId: config.providers.github.clientId,
        clientSecret: config.providers.github.clientSecret,
        ...(config.providers.github.enterpriseInstanceUrl && {
          enterpriseInstanceUrl: config.providers.github.enterpriseInstanceUrl,
        }),
      },
    };
  }

  // Google OAuth
  if (config.providers.google) {
    authConfig.providers.google = {
      development: {
        clientId: config.providers.google.clientId,
        clientSecret: config.providers.google.clientSecret,
      },
      production: {
        clientId: config.providers.google.clientId,
        clientSecret: config.providers.google.clientSecret,
      },
    };
  }

  // Microsoft OAuth (via oauth2 provider)
  if (config.providers.microsoft) {
    const tenantId = config.providers.microsoft.tenantId || 'common';
    authConfig.providers.microsoft = {
      development: {
        clientId: config.providers.microsoft.clientId,
        clientSecret: config.providers.microsoft.clientSecret,
        tenantId,
      },
      production: {
        clientId: config.providers.microsoft.clientId,
        clientSecret: config.providers.microsoft.clientSecret,
        tenantId,
      },
    };
  }

  // GitLab OAuth
  if (config.providers.gitlab) {
    authConfig.providers.gitlab = {
      development: {
        clientId: config.providers.gitlab.clientId,
        clientSecret: config.providers.gitlab.clientSecret,
        ...(config.providers.gitlab.baseUrl && {
          baseUrl: config.providers.gitlab.baseUrl,
        }),
      },
      production: {
        clientId: config.providers.gitlab.clientId,
        clientSecret: config.providers.gitlab.clientSecret,
        ...(config.providers.gitlab.baseUrl && {
          baseUrl: config.providers.gitlab.baseUrl,
        }),
      },
    };
  }

  // Generic OIDC
  if (config.providers.oidc) {
    authConfig.providers.oidc = {
      development: {
        metadataUrl: config.providers.oidc.metadataUrl,
        clientId: config.providers.oidc.clientId,
        clientSecret: config.providers.oidc.clientSecret,
        scope: config.providers.oidc.scopes?.join(' ') || 'openid profile email',
      },
      production: {
        metadataUrl: config.providers.oidc.metadataUrl,
        clientId: config.providers.oidc.clientId,
        clientSecret: config.providers.oidc.clientSecret,
        scope: config.providers.oidc.scopes?.join(' ') || 'openid profile email',
      },
    };
  }

  return authConfig;
}

/**
 * Validate auth configuration
 */
export function validateAuthConfig(config: AuthConfig): string[] {
  const errors: string[] = [];

  if (!config.session?.secret) {
    errors.push('Session secret is required');
  }

  if (config.session?.secret && config.session.secret.length < 32) {
    errors.push('Session secret should be at least 32 characters');
  }

  const hasProvider = config.providers && (
    config.providers.guest?.enabled ||
    config.providers.github ||
    config.providers.google ||
    config.providers.microsoft ||
    config.providers.gitlab ||
    config.providers.oidc ||
    config.providers.saml
  );

  if (!hasProvider) {
    errors.push('At least one auth provider must be configured');
  }

  // Validate provider-specific configs
  if (config.providers.github) {
    if (!config.providers.github.clientId) {
      errors.push('GitHub clientId is required');
    }
    if (!config.providers.github.clientSecret) {
      errors.push('GitHub clientSecret is required');
    }
  }

  if (config.providers.microsoft) {
    if (!config.providers.microsoft.tenantId) {
      errors.push('Microsoft tenantId is required');
    }
  }

  if (config.providers.oidc) {
    if (!config.providers.oidc.metadataUrl) {
      errors.push('OIDC metadataUrl is required');
    }
  }

  if (config.providers.saml) {
    if (!config.providers.saml.entryPoint) {
      errors.push('SAML entryPoint is required');
    }
    if (!config.providers.saml.cert) {
      errors.push('SAML IdP certificate is required');
    }
  }

  return errors;
}
