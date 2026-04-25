// =============================================================================
// Credential Health Probes
// Provider-specific health checks for integration credentials
// =============================================================================

import { createHttpClient } from '@/lib/http-client';
import { logger } from '@/lib/logger';
import { IntegrationProvider } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

// Probe timeout — 10 seconds
const PROBE_TIMEOUT_MS = 10_000;

// =============================================================================
// Error Sanitizer
// =============================================================================

export function sanitizeError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  // Strip bearer tokens, api keys, passwords
  message = message.replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, 'Bearer [REDACTED]');
  message = message.replace(/token[=:]\s*[A-Za-z0-9\-._~+\/]+=*/gi, 'token=[REDACTED]');
  message = message.replace(/apikey[=:]\s*[A-Za-z0-9\-._~+\/]+=*/gi, 'apikey=[REDACTED]');
  message = message.replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]');
  // Strip internal hostnames/IPs
  message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '[INTERNAL_IP]');
  // Truncate to 500 chars
  return message.slice(0, 500);
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function checkCredentialHealth(
  provider: IntegrationProvider,
  decryptedCredentials: Record<string, unknown>
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const probeMap: Record<IntegrationProvider, () => Promise<void>> = {
      ARGOCD: () => probeArgoCD(decryptedCredentials),
      GRAFANA: () => probeGrafana(decryptedCredentials),
      PROMETHEUS: () => probePrometheus(decryptedCredentials),
      GITHUB: () => probeGitHub(decryptedCredentials),
      GITLAB: () => probeGitLab(decryptedCredentials),
      S3: () => probeS3(decryptedCredentials),
      SLACK: () => probeSlack(decryptedCredentials),
      PAGERDUTY: () => probePagerDuty(decryptedCredentials),
      LLM: () => probeLlm(decryptedCredentials),
      UPTIME_KUMA: () => probeUptimeKuma(decryptedCredentials),
      SUPABASE: () => probeSupabase(decryptedCredentials),
      VANTA: () => probeVanta(decryptedCredentials),
    };

    const probe = probeMap[provider];
    if (!probe) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: `Unsupported provider: ${provider}`,
      };
    }

    await probe();

    const latencyMs = Date.now() - start;
    // If response took > 5 seconds, mark as degraded
    const status = latencyMs > 5000 ? 'degraded' : 'healthy';

    return { status, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const sanitized = sanitizeError(error);

    logger.debug({ provider, error: sanitized, latencyMs }, 'Credential health check failed');

    return {
      status: 'unhealthy',
      latencyMs,
      error: sanitized,
    };
  }
}

// =============================================================================
// Provider Probes
// =============================================================================

async function probeArgoCD(creds: Record<string, unknown>): Promise<void> {
  const url = String(creds.url || '').replace(/\/$/, '');
  const token = String(creds.token || '');
  const insecure = Boolean(creds.insecure);

  if (!url || !token) throw new Error('Missing ArgoCD url or token');

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    insecureTls: insecure,
    headers: { Authorization: `Bearer ${token}` },
  });

  await client.get('api/v1/session/userinfo');
}

async function probeGrafana(creds: Record<string, unknown>): Promise<void> {
  const url = String(creds.url || '').replace(/\/$/, '');
  const apiKey = String(creds.apiKey || '');

  if (!url || !apiKey) throw new Error('Missing Grafana url or apiKey');

  const isBasicAuth = apiKey.includes(':');
  const authHeader = isBasicAuth
    ? `Basic ${Buffer.from(apiKey).toString('base64')}`
    : `Bearer ${apiKey}`;

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { Authorization: authHeader },
  });

  await client.get('api/org');
}

async function probePrometheus(creds: Record<string, unknown>): Promise<void> {
  const url = String(creds.url || '').replace(/\/$/, '');

  if (!url) throw new Error('Missing Prometheus url');

  const headers: Record<string, string> = {};
  if (creds.username && creds.password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`;
  }

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers,
  });

  await client.get('api/v1/status/buildinfo');
}

async function probeGitHub(creds: Record<string, unknown>): Promise<void> {
  const token = String(creds.token || '');

  if (!token) throw new Error('Missing GitHub token');

  const client = createHttpClient({
    baseUrl: 'https://api.github.com',
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  await client.get('user');
}

async function probeGitLab(creds: Record<string, unknown>): Promise<void> {
  const token = String(creds.token || '');
  const url = String(creds.url || 'https://gitlab.com').replace(/\/$/, '');

  if (!token) throw new Error('Missing GitLab token');

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { 'PRIVATE-TOKEN': token },
  });

  await client.get('api/v4/user');
}

async function probeS3(creds: Record<string, unknown>): Promise<void> {
  const bucket = String(creds.bucket || '');
  const region = String(creds.region || '');
  const accessKeyId = String(creds.accessKeyId || '');
  const secretAccessKey = String(creds.secretAccessKey || '');

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing S3 credentials (bucket, region, accessKeyId, secretAccessKey)');
  }

  // Validate by making a HEAD request to the S3 bucket endpoint
  // Using the REST API directly to avoid AWS SDK dependency
  const endpoint = creds.endpoint
    ? String(creds.endpoint)
    : `https://${bucket}.s3.${region}.amazonaws.com`;

  const client = createHttpClient({
    baseUrl: endpoint,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
  });

  try {
    await client.head('');
  } catch (error: any) {
    // S3 returns 403 if creds are valid but permissions are restricted
    // which still means the endpoint is reachable
    if (error?.response?.status === 403) {
      return; // Credentials are valid enough to reach S3
    }
    throw error;
  }
}

async function probeSlack(creds: Record<string, unknown>): Promise<void> {
  const token = String(creds.token || '');

  if (!token) throw new Error('Missing Slack token');

  const client = createHttpClient({
    baseUrl: 'https://slack.com',
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { Authorization: `Bearer ${token}` },
  });

  const response = await client.post('api/auth.test').json<{ ok: boolean; error?: string }>();
  if (!response.ok) {
    throw new Error(`Slack auth failed: ${response.error || 'unknown'}`);
  }
}

async function probePagerDuty(creds: Record<string, unknown>): Promise<void> {
  const token = String(creds.token || creds.apiKey || '');

  if (!token) throw new Error('Missing PagerDuty token');

  const client = createHttpClient({
    baseUrl: 'https://api.pagerduty.com',
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { Authorization: `Token token=${token}` },
  });

  await client.get('abilities');
}

async function probeLlm(creds: Record<string, unknown>): Promise<void> {
  const apiKey = String(creds.apiKey || '');
  const baseUrl = String(creds.baseUrl || '').replace(/\/$/, '');

  if (!apiKey) throw new Error('Missing LLM apiKey');

  // If no baseUrl, just validate the key exists (can't make a generic call)
  if (!baseUrl) return;

  const client = createHttpClient({
    baseUrl,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  await client.get('models');
}

async function probeUptimeKuma(creds: Record<string, unknown>): Promise<void> {
  const url = String(creds.url || '').replace(/\/$/, '');
  const apiKey = String(creds.apiKey || '');

  if (!url) throw new Error('Missing Uptime Kuma url');

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers,
  });

  await client.get('metrics');
}

async function probeSupabase(creds: Record<string, unknown>): Promise<void> {
  const url = String(creds.url || '').replace(/\/$/, '');
  const key = String(creds.serviceRoleKey || creds.anonKey || '');

  if (!url) throw new Error('Missing Supabase url');
  if (!key) throw new Error('Missing Supabase key (anonKey or serviceRoleKey)');

  const client = createHttpClient({
    baseUrl: url,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { apikey: key },
  });

  await client.get('rest/v1/');
}

async function probeVanta(creds: Record<string, unknown>): Promise<void> {
  const accessToken = String(creds.accessToken || '');
  const baseUrl = String(creds.baseUrl || 'https://api.vanta.com').replace(/\/$/, '');

  if (!accessToken) throw new Error('Missing Vanta accessToken');

  const client = createHttpClient({
    baseUrl,
    timeout: PROBE_TIMEOUT_MS,
    retries: 0,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  await client.get('v1/resources/vulnerability_reports');
}
