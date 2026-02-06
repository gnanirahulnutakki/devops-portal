// =============================================================================
// Integration Credentials Service
// Per-organization encrypted credential management
// =============================================================================

import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { IntegrationProvider } from '@prisma/client';

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

export type CredentialPayload =
  | { provider: 'ARGOCD'; credentials: ArgoCDCredentials }
  | { provider: 'GRAFANA'; credentials: GrafanaCredentials }
  | { provider: 'PROMETHEUS'; credentials: PrometheusCredentials }
  | { provider: 'GITHUB'; credentials: GitHubCredentials }
  | { provider: 'S3'; credentials: S3Credentials };

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Get decrypted credentials for an integration
 */
export async function getCredentials<T>(
  organizationId: string,
  provider: IntegrationProvider
): Promise<T | null> {
  const credential = await prisma.integrationCredential.findUnique({
    where: {
      organizationId_provider: { organizationId, provider },
    },
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
  createdById?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate credentials based on provider
    const validationError = validateCredentials(provider, credentials);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Encrypt credentials
    const encrypted = await encrypt(JSON.stringify(credentials));

    // Upsert credential
    await prisma.integrationCredential.upsert({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      create: {
        organizationId,
        provider,
        name,
        credentials: encrypted,
        createdById,
        enabled: true,
      },
      update: {
        name,
        credentials: encrypted,
        enabled: true,
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      },
    });

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
  provider: IntegrationProvider
): Promise<boolean> {
  try {
    await prisma.integrationCredential.delete({
      where: {
        organizationId_provider: { organizationId, provider },
      },
    });
    logger.info({ organizationId, provider }, 'Integration credentials deleted');
    return true;
  } catch {
    return false;
  }
}

/**
 * List all credentials for an organization (without decrypted values)
 */
export async function listCredentials(organizationId: string) {
  const credentials = await prisma.integrationCredential.findMany({
    where: { organizationId },
    select: {
      id: true,
      provider: true,
      name: true,
      enabled: true,
      lastUsedAt: true,
      lastErrorAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return credentials;
}

/**
 * Check if credentials exist and are enabled
 */
export async function hasCredentials(
  organizationId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const credential = await prisma.integrationCredential.findUnique({
    where: {
      organizationId_provider: { organizationId, provider },
    },
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
  enabled: boolean
): Promise<boolean> {
  try {
    await prisma.integrationCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: { enabled },
    });
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
  organizationId: string
): Promise<GrafanaCredentials | null> {
  // Try org-specific credentials first
  const orgCreds = await getCredentials<GrafanaCredentials>(organizationId, 'GRAFANA');
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
