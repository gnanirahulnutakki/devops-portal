// =============================================================================
// Credential Health Check Orchestrator
// Runs health checks across all credentials for an organization
// =============================================================================

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { checkCredentialHealth, sanitizeError } from '@/lib/services/credential-health';
import { logger } from '@/lib/logger';
import { recordCredentialHealthCheck, updateCredentialHealthGauges } from '@/lib/metrics';
import { IntegrationProvider } from '@prisma/client';
import type { HealthCheckResult } from '@/lib/services/credential-health';

// =============================================================================
// Types
// =============================================================================

export interface HealthCheckSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  results: Array<{
    credentialId: string;
    provider: IntegrationProvider;
    status: HealthCheckResult['status'];
    latencyMs: number;
    error?: string;
  }>;
}

// Days before expiry to flag as degraded
const EXPIRY_WARNING_DAYS = 7;

// =============================================================================
// Check All Credentials for an Organization
// =============================================================================

export async function checkAllCredentials(
  organizationId: string
): Promise<HealthCheckSummary> {
  const credentials = await prisma.integrationCredential.findMany({
    where: {
      organizationId,
      enabled: true,
    },
    select: {
      id: true,
      provider: true,
      credentials: true,
      enabled: true,
      expiresAt: true,
    },
  });

  const summary: HealthCheckSummary = {
    total: credentials.length,
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
    results: [],
  };

  for (const credential of credentials) {
    const result = await checkSingleCredentialInternal(credential);
    summary.results.push(result);

    switch (result.status) {
      case 'healthy':
        summary.healthy++;
        break;
      case 'degraded':
        summary.degraded++;
        break;
      case 'unhealthy':
        summary.unhealthy++;
        break;
    }
  }

  // Feed per-org / per-provider / per-status counts into the Prom gauge so
  // dashboards can aggregate without re-querying the DB.
  const statusCounts: Record<string, Record<string, number>> = {};
  for (const r of summary.results) {
    const provider = r.provider;
    statusCounts[provider] ??= { healthy: 0, degraded: 0, unhealthy: 0 };
    statusCounts[provider][r.status] = (statusCounts[provider][r.status] ?? 0) + 1;
  }
  updateCredentialHealthGauges(organizationId, statusCounts);

  return summary;
}

// =============================================================================
// Check a Single Credential (On-Demand)
// =============================================================================

export async function checkSingleCredential(
  credentialId: string,
  organizationId: string
): Promise<HealthCheckResult & { credentialId: string; provider: IntegrationProvider }> {
  const credential = await prisma.integrationCredential.findFirst({
    where: {
      id: credentialId,
      organizationId,
    },
    select: {
      id: true,
      provider: true,
      credentials: true,
      enabled: true,
      expiresAt: true,
    },
  });

  if (!credential) {
    throw new Error('Credential not found or does not belong to this organization');
  }

  return checkSingleCredentialInternal(credential);
}

// =============================================================================
// Internal Logic
// =============================================================================

interface CredentialRecord {
  id: string;
  provider: IntegrationProvider;
  credentials: string;
  enabled: boolean;
  expiresAt: Date | null;
}

async function checkSingleCredentialInternal(
  credential: CredentialRecord
): Promise<HealthCheckResult & { credentialId: string; provider: IntegrationProvider }> {
  let result: HealthCheckResult;

  // Decrypt credentials
  let decrypted: Record<string, unknown>;
  try {
    const decryptedString = decrypt(credential.credentials);
    decrypted = JSON.parse(decryptedString) as Record<string, unknown>;
  } catch (error) {
    logger.error(
      { credentialId: credential.id, provider: credential.provider },
      'Failed to decrypt credential during health check'
    );

    result = {
      status: 'unhealthy',
      latencyMs: 0,
      error: 'Decryption failed - key may need rotation',
    };

    await persistHealthCheck(credential.id, result);

    return {
      ...result,
      credentialId: credential.id,
      provider: credential.provider,
    };
  }

  // Run the provider-specific health check
  result = await checkCredentialHealth(credential.provider, decrypted);

  // If credential has expiresAt and it's within warning window, override to degraded
  if (credential.expiresAt && result.status === 'healthy') {
    const daysUntilExpiry = (credential.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      result = {
        ...result,
        status: 'degraded',
        error: `Credential expires in ${Math.ceil(daysUntilExpiry)} day(s)`,
      };
    }
  }

  // Persist the health check result
  await persistHealthCheck(credential.id, result);

  recordCredentialHealthCheck(credential.provider, result.status, result.latencyMs);

  return {
    ...result,
    credentialId: credential.id,
    provider: credential.provider,
  };
}

async function persistHealthCheck(
  credentialId: string,
  result: HealthCheckResult
): Promise<void> {
  const now = new Date();

  try {
    // Update the credential record
    await prisma.integrationCredential.update({
      where: { id: credentialId },
      data: {
        healthStatus: result.status,
        lastHealthCheckAt: now,
      },
    });

    // Create audit trail record
    await prisma.credentialHealthCheck.create({
      data: {
        credentialId,
        status: result.status,
        latencyMs: result.latencyMs,
        error: result.error,
        checkedAt: now,
      },
    });
  } catch (error) {
    logger.error(
      { credentialId, error: sanitizeError(error) },
      'Failed to persist health check result'
    );
  }
}
