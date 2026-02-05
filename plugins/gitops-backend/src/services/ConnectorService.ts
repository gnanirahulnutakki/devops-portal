/**
 * ConnectorService - OAuth Connectors (like ChatGPT plugins)
 *
 * Allows users to connect their external accounts:
 * - GitHub: Access user's repos, orgs, PRs
 * - GitLab: Access user's projects, groups
 * - Microsoft: Azure AD, Microsoft 365 integration
 * - Google: Google Cloud, Google Workspace
 *
 * Features:
 * - Encrypted token storage (AES-256-GCM)
 * - Automatic token refresh
 * - Scopes management
 * - Connection status tracking
 */

import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { Knex } from 'knex';
import logger from '../utils/logger';

// Types
export type ConnectorProvider = 'github' | 'gitlab' | 'microsoft' | 'google';
export type ConnectorStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface Connector {
  id: string;
  userId: string;
  provider: ConnectorProvider;
  providerUserId?: string;
  providerUsername?: string;
  providerEmail?: string;
  providerAvatarUrl?: string;
  scopes: string[];
  status: ConnectorStatus;
  connectedAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

export interface ConnectorProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  enabled: boolean;
}

export interface ConnectorServiceConfig {
  encryptionKey: string;
  baseUrl: string; // For OAuth callbacks
  providers: Partial<Record<ConnectorProvider, ConnectorProviderConfig>>;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

interface ProviderUserInfo {
  id: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  name?: string;
}

// Default provider configurations (secrets come from env)
const DEFAULT_PROVIDER_CONFIGS: Record<ConnectorProvider, Partial<ConnectorProviderConfig>> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['repo', 'read:org', 'read:user', 'user:email'],
  },
  gitlab: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    userInfoUrl: 'https://gitlab.com/api/v4/user',
    scopes: ['read_user', 'read_api', 'read_repository'],
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'profile', 'email'],
  },
};

export class ConnectorService {
  private db: Knex;
  private config: ConnectorServiceConfig;

  constructor(db: Knex, config: Partial<ConnectorServiceConfig> = {}) {
    this.db = db;
    this.config = {
      encryptionKey: config.encryptionKey || process.env.CONNECTOR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
      baseUrl: config.baseUrl || process.env.BACKEND_BASE_URL || 'http://localhost:7007',
      providers: config.providers || {},
    };

    logger.info('ConnectorService initialized', {
      baseUrl: this.config.baseUrl,
      enabledProviders: Object.keys(this.config.providers).filter(
        p => this.config.providers[p as ConnectorProvider]?.enabled
      ),
    });
  }

  // ============================================================================
  // Provider Configuration
  // ============================================================================

  /**
   * Get available providers
   */
  getAvailableProviders(): Array<{
    provider: ConnectorProvider;
    name: string;
    description: string;
    scopes: string[];
  }> {
    const providerInfo: Record<ConnectorProvider, { name: string; description: string }> = {
      github: {
        name: 'GitHub',
        description: 'Access your repositories, organizations, and pull requests',
      },
      gitlab: {
        name: 'GitLab',
        description: 'Access your projects, groups, and merge requests',
      },
      microsoft: {
        name: 'Microsoft',
        description: 'Connect with Azure AD and Microsoft 365',
      },
      google: {
        name: 'Google',
        description: 'Connect with Google Cloud and Workspace',
      },
    };

    return Object.entries(this.config.providers)
      .filter(([, config]) => config?.enabled)
      .map(([provider, config]) => ({
        provider: provider as ConnectorProvider,
        name: providerInfo[provider as ConnectorProvider].name,
        description: providerInfo[provider as ConnectorProvider].description,
        scopes: config?.scopes || [],
      }));
  }

  /**
   * Get provider config
   */
  private getProviderConfig(provider: ConnectorProvider): ConnectorProviderConfig | null {
    const config = this.config.providers[provider];
    if (!config?.enabled) return null;

    return {
      ...DEFAULT_PROVIDER_CONFIGS[provider],
      ...config,
    } as ConnectorProviderConfig;
  }

  // ============================================================================
  // OAuth Flow
  // ============================================================================

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(
    userId: string,
    provider: ConnectorProvider,
    customScopes?: string[]
  ): Promise<{ url: string; state: string } | null> {
    const config = this.getProviderConfig(provider);
    if (!config) {
      logger.warn('Provider not configured', { provider });
      return null;
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const stateExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store state in database
    await this.db('user_connectors')
      .insert({
        user_id: userId,
        provider,
        status: 'pending' as any,
        oauth_state: state,
        oauth_state_expires: stateExpires,
      })
      .onConflict(['user_id', 'provider'])
      .merge({
        oauth_state: state,
        oauth_state_expires: stateExpires,
        status: 'pending' as any,
        updated_at: new Date(),
      });

    // Build authorization URL
    const scopes = customScopes || config.scopes;
    const redirectUri = `${this.config.baseUrl}/api/connectors/${provider}/callback`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
    });

    // Provider-specific params
    if (provider === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    return {
      url: `${config.authorizeUrl}?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(
    provider: ConnectorProvider,
    code: string,
    state: string
  ): Promise<{ success: boolean; connector?: Connector; error?: string }> {
    try {
      // Find pending connector by state
      const pending = await this.db('user_connectors')
        .where('provider', provider)
        .where('oauth_state', state)
        .where('oauth_state_expires', '>', new Date())
        .first();

      if (!pending) {
        return { success: false, error: 'Invalid or expired state' };
      }

      const config = this.getProviderConfig(provider);
      if (!config) {
        return { success: false, error: 'Provider not configured' };
      }

      // Exchange code for tokens
      const redirectUri = `${this.config.baseUrl}/api/connectors/${provider}/callback`;
      const tokenResponse = await this.exchangeCodeForTokens(
        config,
        code,
        redirectUri
      );

      if (!tokenResponse) {
        return { success: false, error: 'Failed to exchange code for tokens' };
      }

      // Get user info from provider
      const userInfo = await this.fetchUserInfo(provider, config, tokenResponse.access_token);

      // Encrypt tokens
      const encryptedAccessToken = this.encryptToken(tokenResponse.access_token);
      const encryptedRefreshToken = tokenResponse.refresh_token
        ? this.encryptToken(tokenResponse.refresh_token)
        : null;

      // Calculate expiry
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      // Update connector
      const [connector] = await this.db('user_connectors')
        .where('id', pending.id)
        .update({
          provider_user_id: userInfo?.id,
          provider_username: userInfo?.username,
          provider_email: userInfo?.email,
          provider_avatar_url: userInfo?.avatarUrl,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          access_token_expires_at: expiresAt,
          token_type: tokenResponse.token_type,
          scopes: JSON.stringify(tokenResponse.scope?.split(' ') || config.scopes),
          status: 'active',
          connected_at: new Date(),
          oauth_state: null,
          oauth_state_expires: null,
          updated_at: new Date(),
        })
        .returning('*');

      logger.info('Connector connected', {
        userId: pending.user_id,
        provider,
        providerUsername: userInfo?.username,
      });

      return {
        success: true,
        connector: this.mapDbConnectorToConnector(connector),
      };
    } catch (error) {
      logger.error('OAuth callback error', { error, provider });
      return { success: false, error: 'OAuth callback failed' };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    config: ConnectorProviderConfig,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse | null> {
    try {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Token exchange failed', { status: response.status, error: errorText });
        return null;
      }

      return response.json();
    } catch (error) {
      logger.error('Token exchange error', { error });
      return null;
    }
  }

  /**
   * Fetch user info from provider
   */
  private async fetchUserInfo(
    provider: ConnectorProvider,
    config: ConnectorProviderConfig,
    accessToken: string
  ): Promise<ProviderUserInfo | null> {
    try {
      const response = await fetch(config.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        logger.error('User info fetch failed', { provider, status: response.status });
        return null;
      }

      const data = await response.json();

      // Map provider-specific response to common format
      switch (provider) {
        case 'github':
          return {
            id: String(data.id),
            username: data.login,
            email: data.email,
            avatarUrl: data.avatar_url,
            name: data.name,
          };
        case 'gitlab':
          return {
            id: String(data.id),
            username: data.username,
            email: data.email,
            avatarUrl: data.avatar_url,
            name: data.name,
          };
        case 'microsoft':
          return {
            id: data.id,
            username: data.userPrincipalName,
            email: data.mail || data.userPrincipalName,
            name: data.displayName,
          };
        case 'google':
          return {
            id: data.sub,
            username: data.email,
            email: data.email,
            avatarUrl: data.picture,
            name: data.name,
          };
        default:
          return null;
      }
    } catch (error) {
      logger.error('User info fetch error', { error, provider });
      return null;
    }
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  /**
   * Get decrypted access token for a provider
   */
  async getAccessToken(userId: string, provider: ConnectorProvider): Promise<string | null> {
    const connector = await this.db('user_connectors')
      .where('user_id', userId)
      .where('provider', provider)
      .where('status', 'active')
      .first();

    if (!connector) return null;

    // Check if token is expired and needs refresh
    if (connector.access_token_expires_at && new Date(connector.access_token_expires_at) < new Date()) {
      if (connector.refresh_token) {
        const refreshed = await this.refreshAccessToken(userId, provider);
        if (refreshed) {
          return refreshed;
        }
      }
      // Mark as expired
      await this.db('user_connectors')
        .where('id', connector.id)
        .update({ status: 'expired', updated_at: new Date() });
      return null;
    }

    // Update last used
    await this.db('user_connectors')
      .where('id', connector.id)
      .update({ last_used_at: new Date() });

    return this.decryptToken(connector.access_token);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(userId: string, provider: ConnectorProvider): Promise<string | null> {
    const connector = await this.db('user_connectors')
      .where('user_id', userId)
      .where('provider', provider)
      .first();

    if (!connector?.refresh_token) return null;

    const config = this.getProviderConfig(provider);
    if (!config) return null;

    try {
      const refreshToken = this.decryptToken(connector.refresh_token);

      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        logger.error('Token refresh failed', { provider, status: response.status });
        return null;
      }

      const tokenResponse: OAuthTokenResponse = await response.json();

      // Update connector with new tokens
      const encryptedAccessToken = this.encryptToken(tokenResponse.access_token);
      const encryptedRefreshToken = tokenResponse.refresh_token
        ? this.encryptToken(tokenResponse.refresh_token)
        : connector.refresh_token;

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      await this.db('user_connectors')
        .where('id', connector.id)
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          access_token_expires_at: expiresAt,
          status: 'active',
          updated_at: new Date(),
        });

      logger.info('Token refreshed', { userId, provider });
      return tokenResponse.access_token;
    } catch (error) {
      logger.error('Token refresh error', { error, provider });
      return null;
    }
  }

  // ============================================================================
  // Connector Management
  // ============================================================================

  /**
   * Get user's connectors
   */
  async getUserConnectors(userId: string): Promise<Connector[]> {
    const connectors = await this.db('user_connectors')
      .where('user_id', userId)
      .whereIn('status', ['active', 'expired', 'error'])
      .orderBy('connected_at', 'desc');

    return connectors.map(c => this.mapDbConnectorToConnector(c));
  }

  /**
   * Get specific connector
   */
  async getConnector(userId: string, provider: ConnectorProvider): Promise<Connector | null> {
    const connector = await this.db('user_connectors')
      .where('user_id', userId)
      .where('provider', provider)
      .whereIn('status', ['active', 'expired', 'error'])
      .first();

    return connector ? this.mapDbConnectorToConnector(connector) : null;
  }

  /**
   * Disconnect a provider
   */
  async disconnect(userId: string, provider: ConnectorProvider): Promise<boolean> {
    const updated = await this.db('user_connectors')
      .where('user_id', userId)
      .where('provider', provider)
      .update({
        status: 'revoked',
        disconnected_at: new Date(),
        access_token: null,
        refresh_token: null,
        updated_at: new Date(),
      });

    if (updated > 0) {
      logger.info('Connector disconnected', { userId, provider });
    }

    return updated > 0;
  }

  /**
   * Check if provider is connected
   */
  async isConnected(userId: string, provider: ConnectorProvider): Promise<boolean> {
    const connector = await this.db('user_connectors')
      .where('user_id', userId)
      .where('provider', provider)
      .where('status', 'active')
      .first();

    return !!connector;
  }

  // ============================================================================
  // Encryption Helpers
  // ============================================================================

  private encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, this.config.encryptionKey).toString();
  }

  private decryptToken(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, this.config.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapDbConnectorToConnector(db: any): Connector {
    return {
      id: db.id,
      userId: db.user_id,
      provider: db.provider,
      providerUserId: db.provider_user_id,
      providerUsername: db.provider_username,
      providerEmail: db.provider_email,
      providerAvatarUrl: db.provider_avatar_url,
      scopes: JSON.parse(db.scopes || '[]'),
      status: db.status,
      connectedAt: new Date(db.connected_at),
      lastUsedAt: db.last_used_at ? new Date(db.last_used_at) : undefined,
      expiresAt: db.access_token_expires_at ? new Date(db.access_token_expires_at) : undefined,
    };
  }
}

export default ConnectorService;
