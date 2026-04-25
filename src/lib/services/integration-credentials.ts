// =============================================================================
// Integration Credentials Service
// Per-organization encrypted credential management
// =============================================================================

import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { IntegrationProvider } from '@prisma/client';

/**
 * Parses an ISO date string / null / undefined into the `expiresAt` value
 * shape that saveCredentials and updateCredentialById accept.
 *
 * undefined → leave unchanged (don't touch the column)
 * null      → clear the expiry
 * string    → parse as Date (must be a valid ISO date or date-only string)
 */
export function parseExpiresAt(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

// =============================================================================
// Types
// =============================================================================

export interface ArgoCDCredentials {
  url: string;
  token: string;
  insecure?: boolean;
}

export interface GrafanaCredentials {
  url: string;
  apiKey: string;
}

export interface PrometheusCredentials {
  url: string;
  username?: string;
  password?: string;
}

export interface GitHubCredentials {
  token: string;
  organization?: string;
}

export interface S3Credentials {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // For S3-compatible storage
}

export interface LlmCredentials {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface UptimeKumaCredentials {
  url: string;
  apiKey: string;
}

export interface SupabaseCredentials {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

export interface VantaCredentials {
  accessToken: string;
  baseUrl?: string; // default: https://api.vanta.com
}

export type CredentialPayload =
  | { provider: 'ARGOCD'; credentials: ArgoCDCredentials }
  | { provider: 'GRAFANA'; credentials: GrafanaCredentials }
  | { provider: 'PROMETHEUS'; credentials: PrometheusCredentials }
  | { provider: 'GITHUB'; credentials: GitHubCredentials }
  | { provider: 'S3'; credentials: S3Credentials }
  | { provider: 'LLM'; credentials: LlmCredentials }
  | { provider: 'UPTIME_KUMA'; credentials: UptimeKumaCredentials }
  | { provider: 'SUPABASE'; credentials: SupabaseCredentials }
  | { provider: 'VANTA'; credentials: VantaCredentials };

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Get decrypted credentials for an integration
 */
export async function getCredentials<T>(
  organizationId: string,
  provider: IntegrationProvider,
  options: { credentialId?: string; name?: string } = {}
): Promise<T | null> {
  const { credentialId, name } = options;
  const credential = await prisma.integrationCredential.findFirst({
    where: {
      organizationId,
      provider,
      enabled: true,
      ...(credentialId ? { id: credentialId } : {}),
      ...(name ? { name } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential || !credential.enabled) {
    return null;
  }

  try {
    const decrypted = await decrypt(credential.credentials);
    
    // Update last used timestamp
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // Non-critical, don't fail the request
    });

    return JSON.parse(decrypted) as T;
  } catch (error) {
    logger.error(
      { organizationId, provider, error },
      'Failed to decrypt integration credentials'
    );
    
    // Record the error
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: {
        lastErrorAt: new Date(),
        lastError: 'Decryption failed - key may need rotation',
      },
    }).catch(() => {});
    
    return null;
  }
}

/**
 * Save or update credentials for an integration
 */
export async function saveCredentials(
  organizationId: string,
  provider: IntegrationProvider,
  credentials: Record<string, unknown>,
  name: string,
  createdById?: string,
  expiresAt?: Date | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate credentials based on provider
    const validationError = validateCredentials(provider, credentials);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Encrypt credentials
    const encrypted = await encrypt(JSON.stringify(credentials));

    const existing = await prisma.integrationCredential.findFirst({
      where: { organizationId, provider, name },
    });

    if (existing) {
      await prisma.integrationCredential.update({
        where: { id: existing.id },
        data: {
          name,
          credentials: encrypted,
          enabled: true,
          lastError: null,
          lastErrorAt: null,
          updatedAt: new Date(),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          rotatedAt: new Date(),
        },
      });
    } else {
      await prisma.integrationCredential.create({
        data: {
          organizationId,
          provider,
          name,
          credentials: encrypted,
          createdById,
          enabled: true,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        },
      });
    }

    logger.info({ organizationId, provider }, 'Integration credentials saved');
    return { success: true };
  } catch (error) {
    logger.error({ organizationId, provider, error }, 'Failed to save credentials');
    return { success: false, error: 'Failed to save credentials' };
  }
}

/**
 * Delete credentials for an integration
 */
export async function deleteCredentials(
  organizationId: string,
  provider: IntegrationProvider,
  credentialId?: string
): Promise<boolean> {
  try {
    if (credentialId) {
      await prisma.integrationCredential.delete({
        where: { id: credentialId },
      });
    } else {
      await prisma.integrationCredential.deleteMany({
        where: { organizationId, provider },
      });
    }
    logger.info({ organizationId, provider }, 'Integration credentials deleted');
    return true;
  } catch {
    return false;
  }
}

/**
 * List all credentials for an organization (without decrypted values)
 */
export async function listCredentials(
  organizationId: string,
  provider?: IntegrationProvider
) {
  const credentials = await prisma.integrationCredential.findMany({
    where: {
      organizationId,
      ...(provider ? { provider } : {}),
    },
    select: {
      id: true,
      provider: true,
      name: true,
      enabled: true,
      lastUsedAt: true,
      lastErrorAt: true,
      lastError: true,
      healthStatus: true,
      lastHealthCheckAt: true,
      expiresAt: true,
      rotatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return credentials;
}

/**
 * Update a single credential record by id (CRUD support).
 * - Verifies org + provider ownership
 * - Optionally updates name, enabled, and/or decrypted credentials payload (patch merge)
 */
export async function updateCredentialById<T extends Record<string, any>>(
  organizationId: string,
  provider: IntegrationProvider,
  credentialId: string,
  update: {
    name?: string;
    enabled?: boolean;
    expiresAt?: Date | null;
    credentialsPatch?: Partial<T>;
    replaceCredentials?: T;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.integrationCredential.findFirst({
      where: { id: credentialId, organizationId, provider },
      select: { id: true, name: true, credentials: true, enabled: true },
    });
    if (!existing) return { success: false, error: 'Credential not found' };

    let nextCreds: Record<string, unknown> | undefined;
    if (update.replaceCredentials) {
      nextCreds = update.replaceCredentials;
    } else if (update.credentialsPatch && Object.keys(update.credentialsPatch).length > 0) {
      const decrypted = JSON.parse(await decrypt(existing.credentials)) as Record<string, unknown>;
      nextCreds = { ...decrypted, ...update.credentialsPatch };
    }

    // Validate & encrypt only if creds are changing
    let encrypted: string | undefined;
    if (nextCreds) {
      const validationError = validateCredentials(provider, nextCreds as any);
      if (validationError) return { success: false, error: validationError };
      encrypted = await encrypt(JSON.stringify(nextCreds));
    }

    await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: {
        ...(typeof update.name === 'string' ? { name: update.name } : {}),
        ...(typeof update.enabled === 'boolean' ? { enabled: update.enabled } : {}),
        ...(update.expiresAt !== undefined ? { expiresAt: update.expiresAt } : {}),
        ...(encrypted ? { credentials: encrypted } : {}),
        ...(encrypted
          ? {
              lastError: null,
              lastErrorAt: null,
              rotatedAt: new Date(),
              updatedAt: new Date(),
            }
          : { updatedAt: new Date() }),
      },
    });

    return { success: true };
  } catch (error: any) {
    // Prisma unique constraint error when renaming to an existing name
    const msg = typeof error?.message === 'string' ? error.message : 'Failed to update credentials';
    logger.error({ organizationId, provider, credentialId, error }, 'Failed to update credential by id');
    return { success: false, error: msg };
  }
}

/**
 * Delete a credential record by id (CRUD support).
 * Ensures org + provider ownership.
 */
export async function deleteCredentialById(
  organizationId: string,
  provider: IntegrationProvider,
  credentialId: string
): Promise<boolean> {
  try {
    const res = await prisma.integrationCredential.deleteMany({
      where: { id: credentialId, organizationId, provider },
    });
    return res.count > 0;
  } catch {
    return false;
  }
}

/**
 * Check if credentials exist and are enabled
 */
export async function hasCredentials(
  organizationId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const credential = await prisma.integrationCredential.findFirst({
    where: { organizationId, provider, enabled: true },
    select: { enabled: true },
  });

  return credential?.enabled ?? false;
}

/**
 * Toggle credentials enabled/disabled
 */
export async function toggleCredentials(
  organizationId: string,
  provider: IntegrationProvider,
  enabled: boolean,
  credentialId?: string
): Promise<boolean> {
  try {
    if (credentialId) {
      await prisma.integrationCredential.update({
        where: { id: credentialId },
        data: { enabled },
      });
    } else {
      await prisma.integrationCredential.updateMany({
        where: { organizationId, provider },
        data: { enabled },
      });
    }
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Validation
// =============================================================================

function validateCredentials(
  provider: IntegrationProvider,
  credentials: Record<string, unknown>
): string | null {
  switch (provider) {
    case 'ARGOCD':
      if (!credentials.url || !credentials.token) {
        return 'ArgoCD requires url and token';
      }
      break;
    case 'GRAFANA':
      if (!credentials.url || !credentials.apiKey) {
        return 'Grafana requires url and apiKey';
      }
      break;
    case 'PROMETHEUS':
      if (!credentials.url) {
        return 'Prometheus requires url';
      }
      break;
    case 'GITHUB':
      if (!credentials.token) {
        return 'GitHub requires token';
      }
      break;
    case 'S3':
      if (!credentials.bucket || !credentials.region || !credentials.accessKeyId || !credentials.secretAccessKey) {
        return 'S3 requires bucket, region, accessKeyId, and secretAccessKey';
      }
      break;
    case 'LLM':
      if (!credentials.provider || !credentials.apiKey) {
        return 'LLM requires provider and apiKey';
      }
      break;
    case 'UPTIME_KUMA':
      if (!credentials.url || !credentials.apiKey) {
        return 'Uptime Kuma requires url and apiKey';
      }
      break;
    case 'SUPABASE':
      if (!credentials.url) {
        return 'Supabase requires url';
      }
      if (!credentials.anonKey && !credentials.serviceRoleKey) {
        return 'Supabase requires anonKey or serviceRoleKey';
      }
      break;
    case 'VANTA':
      if (!credentials.accessToken) {
        return 'Vanta requires accessToken';
      }
      break;
  }
  return null;
}

// =============================================================================
// Convenience Getters with Env Fallback
// =============================================================================

/**
 * Get ArgoCD credentials with env fallback
 */
export async function getArgoCDCredentials(
  organizationId: string
): Promise<ArgoCDCredentials | null> {
  // Try org-specific credentials first
  const orgCreds = await getCredentials<ArgoCDCredentials>(organizationId, 'ARGOCD');
  if (orgCreds) return orgCreds;

  // Fall back to environment variables
  const url = process.env.ARGOCD_URL;
  const token = process.env.ARGOCD_TOKEN;
  
  if (url && token) {
    return {
      url,
      token,
      insecure: process.env.ARGOCD_INSECURE === 'true',
    };
  }

  return null;
}

/**
 * Get Grafana credentials with env fallback
 */
export async function getGrafanaCredentials(
  organizationId: string,
  options: { credentialId?: string; name?: string } = {}
): Promise<GrafanaCredentials | null> {
  // Try org-specific credentials first
  const orgCreds = await getCredentials<GrafanaCredentials>(organizationId, 'GRAFANA', options);
  if (orgCreds) return orgCreds;

  // Fall back to environment variables
  const url = process.env.GRAFANA_URL;
  const apiKey = process.env.GRAFANA_API_KEY;
  
  if (url && apiKey) {
    return { url, apiKey };
  }

  return null;
}

/**
 * Get S3 credentials with env fallback
 */
export async function getS3Credentials(
  organizationId: string
): Promise<S3Credentials | null> {
  // Try org-specific credentials first
  const orgCreds = await getCredentials<S3Credentials>(organizationId, 'S3');
  if (orgCreds) return orgCreds;

  // Fall back to environment variables
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (bucket && region && accessKeyId && secretAccessKey) {
    return {
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint: process.env.S3_ENDPOINT,
    };
  }

  return null;
}

/**
 * Get Vanta credentials with env fallback
 */
export async function getVantaCredentials(
  organizationId: string
): Promise<VantaCredentials | null> {
  const orgCreds = await getCredentials<VantaCredentials>(organizationId, 'VANTA');
  if (orgCreds) return orgCreds;

  const accessToken = process.env.VANTA_ACCESS_TOKEN;
  if (accessToken) {
    return { accessToken, baseUrl: process.env.VANTA_BASE_URL || 'https://api.vanta.com' };
  }
  return null;
}
