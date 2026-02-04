/**
 * AuthTokenService - Manages OAuth tokens for authenticated users
 * 
 * This service allows using the user's GitHub OAuth token for API calls
 * instead of a static API token, enabling user-scoped access to repositories.
 */

import { Request } from 'express';
import logger from '../utils/logger';

export interface UserTokens {
  github?: string;
  gitlab?: string;
  google?: string;
  microsoft?: string;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  displayName?: string;
  provider: string;
  tokens: UserTokens;
}

export interface AuthTokenServiceConfig {
  // Fallback tokens when user is not authenticated or token not available
  fallbackGitHubToken?: string;
  fallbackGitLabToken?: string;
  // Whether to allow unauthenticated access with fallback tokens
  allowUnauthenticated: boolean;
}

/**
 * Service to extract and manage OAuth tokens from authenticated requests
 */
export class AuthTokenService {
  private config: AuthTokenServiceConfig;

  constructor(config: AuthTokenServiceConfig) {
    this.config = config;
    logger.info('AuthTokenService initialized', {
      allowUnauthenticated: config.allowUnauthenticated,
      hasFallbackGitHub: !!config.fallbackGitHubToken,
      hasFallbackGitLab: !!config.fallbackGitLabToken,
    });
  }

  /**
   * Extract authenticated user info from request
   * Works with Backstage auth middleware
   */
  async getUserFromRequest(req: Request): Promise<AuthenticatedUser | null> {
    try {
      // Backstage stores user info in req.user after auth middleware
      const backstageUser = (req as any).user;
      
      if (!backstageUser) {
        logger.debug('No authenticated user in request');
        return null;
      }

      // Extract user identity from Backstage format
      const identity = backstageUser.identity || backstageUser;
      
      return {
        id: identity.userEntityRef || identity.sub || 'unknown',
        email: identity.email,
        displayName: identity.displayName || identity.name,
        provider: identity.provider || 'unknown',
        tokens: {
          github: await this.extractGitHubToken(req),
          gitlab: await this.extractGitLabToken(req),
        },
      };
    } catch (error) {
      logger.error('Error extracting user from request', { error });
      return null;
    }
  }

  /**
   * Get GitHub token for API calls - prefers user's OAuth token, falls back to static token
   */
  async getGitHubToken(req: Request): Promise<string | null> {
    const user = await this.getUserFromRequest(req);
    
    // Try user's OAuth token first
    if (user?.tokens.github) {
      logger.debug('Using user OAuth token for GitHub', { userId: user.id });
      return user.tokens.github;
    }

    // Fall back to static token if allowed
    if (this.config.allowUnauthenticated && this.config.fallbackGitHubToken) {
      logger.debug('Using fallback GitHub token');
      return this.config.fallbackGitHubToken;
    }

    logger.warn('No GitHub token available');
    return null;
  }

  /**
   * Get GitLab token for API calls
   */
  async getGitLabToken(req: Request): Promise<string | null> {
    const user = await this.getUserFromRequest(req);
    
    if (user?.tokens.gitlab) {
      logger.debug('Using user OAuth token for GitLab', { userId: user.id });
      return user.tokens.gitlab;
    }

    if (this.config.allowUnauthenticated && this.config.fallbackGitLabToken) {
      logger.debug('Using fallback GitLab token');
      return this.config.fallbackGitLabToken;
    }

    return null;
  }

  /**
   * Extract GitHub OAuth token from request
   * Backstage stores OAuth tokens in the session/credentials
   */
  private async extractGitHubToken(req: Request): Promise<string | undefined> {
    try {
      // Method 1: Check Backstage credentials service
      const credentials = (req as any).credentials;
      if (credentials?.token) {
        // Verify it's a GitHub token by checking the prefix or making a test call
        return credentials.token;
      }

      // Method 2: Check session for OAuth tokens
      const session = (req as any).session;
      if (session?.passport?.user?.accessToken) {
        return session.passport.user.accessToken;
      }

      // Method 3: Check for token in custom header (for API clients)
      const headerToken = req.headers['x-github-token'] as string;
      if (headerToken) {
        return headerToken;
      }

      // Method 4: Check Backstage auth header format
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer github:')) {
        return authHeader.replace('Bearer github:', '');
      }

      return undefined;
    } catch (error) {
      logger.debug('Could not extract GitHub token', { error });
      return undefined;
    }
  }

  /**
   * Extract GitLab OAuth token from request
   */
  private async extractGitLabToken(req: Request): Promise<string | undefined> {
    try {
      // Check for token in custom header
      const headerToken = req.headers['x-gitlab-token'] as string;
      if (headerToken) {
        return headerToken;
      }

      // Check session
      const session = (req as any).session;
      if (session?.gitlabToken) {
        return session.gitlabToken;
      }

      return undefined;
    } catch (error) {
      logger.debug('Could not extract GitLab token', { error });
      return undefined;
    }
  }

  /**
   * Check if user has required permissions for an operation
   */
  async checkPermissions(
    req: Request,
    requiredScopes: string[]
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.getUserFromRequest(req);

    if (!user) {
      if (this.config.allowUnauthenticated) {
        return { allowed: true, reason: 'Unauthenticated access allowed' };
      }
      return { allowed: false, reason: 'Authentication required' };
    }

    // For now, allow all authenticated users
    // Future: Implement scope checking based on OAuth scopes
    return { allowed: true };
  }

  /**
   * Get user's accessible organizations/groups
   * This is useful for filtering which repos the user can see
   */
  async getUserOrganizations(req: Request): Promise<string[]> {
    const token = await this.getGitHubToken(req);
    if (!token) return [];

    try {
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        logger.warn('Failed to fetch user organizations', { 
          status: response.status 
        });
        return [];
      }

      const orgs = await response.json();
      return orgs.map((org: any) => org.login);
    } catch (error) {
      logger.error('Error fetching user organizations', { error });
      return [];
    }
  }
}

export default AuthTokenService;
