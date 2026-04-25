import { KubeConfig } from '@kubernetes/client-node';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClusterAuthType = 'standard' | 'duplo' | 'eks';

export interface DuploCredentials {
  duploHost: string;
  duploToken: string;
  planId: string;
  isAdmin?: boolean;
}

export interface EksCredentials {
  clusterName: string;
  region: string;
  endpoint: string;
  caData: string;
  accessKeyId: string;
  secretAccessKey: string;
  roleArn?: string;
}

export interface DuploK8sResponse {
  ApiServer: string;
  Token: string;
  CertificateAuthorityDataBase64: string;
}

// ─── Duplo Token Generation ──────────────────────────────────────────────────

export async function getDuploK8sConfig(creds: DuploCredentials): Promise<DuploK8sResponse> {
  const host = creds.duploHost.replace(/\/+$/, '');
  const endpoint = creds.isAdmin !== false
    ? `${host}/v3/admin/plans/${encodeURIComponent(creds.planId)}/k8sConfig`
    : `${host}/v3/subscriptions/${encodeURIComponent(creds.planId)}/k8s/jitAccess`;

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${creds.duploToken}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Duplo API returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  if (!data.ApiServer || !data.Token) {
    throw new Error('Duplo API response missing ApiServer or Token');
  }

  return data as DuploK8sResponse;
}

export function buildKubeconfigFromDuploResponse(resp: DuploK8sResponse): string {
  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '- cluster:',
    `    server: "${resp.ApiServer}"`,
    `    certificate-authority-data: ${resp.CertificateAuthorityDataBase64}`,
    '  name: duplo-cluster',
    'contexts:',
    '- context:',
    '    cluster: duplo-cluster',
    '    user: duplo-user',
    '  name: duplo-context',
    'current-context: duplo-context',
    'users:',
    '- name: duplo-user',
    '  user:',
    `    token: ${resp.Token}`,
  ].join('\n');
}

// ─── EKS Token Generation ────────────────────────────────────────────────────

const STS_TOKEN_PREFIX = 'k8s-aws-v1.';
const TOKEN_EXPIRY_SECONDS = 60;

export async function getEksToken(creds: EksCredentials): Promise<string> {
  const { clusterName, region, accessKeyId, secretAccessKey } = creds;

  const service = 'sts';
  const host = `sts.${region}.amazonaws.com`;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams = new URLSearchParams({
    Action: 'GetCallerIdentity',
    Version: '2011-06-15',
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(TOKEN_EXPIRY_SECONDS),
    'X-Amz-SignedHeaders': 'host;x-k8s-aws-id',
  });

  // Sort query params
  const sortedParams = new URLSearchParams(
    [...queryParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  );

  const canonicalHeaders = `host:${host}\nx-k8s-aws-id:${clusterName}\n`;
  const signedHeaders = 'host;x-k8s-aws-id';

  const canonicalRequest = [
    'GET',
    '/',
    sortedParams.toString(),
    canonicalHeaders,
    signedHeaders,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA256 of empty string
  ].join('\n');

  const { createHmac, createHash } = await import('crypto');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  sortedParams.set('X-Amz-Signature', signature);

  const presignedUrl = `https://${host}/?${sortedParams.toString()}`;

  const token = STS_TOKEN_PREFIX + Buffer.from(presignedUrl).toString('base64url').replace(/=+$/, '');

  return token;
}

export function buildKubeconfigFromEks(creds: EksCredentials, token: string): string {
  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '- cluster:',
    `    server: "${creds.endpoint}"`,
    `    certificate-authority-data: ${creds.caData}`,
    '  name: eks-cluster',
    'contexts:',
    '- context:',
    '    cluster: eks-cluster',
    '    user: eks-user',
    '  name: eks-context',
    'current-context: eks-context',
    'users:',
    '- name: eks-user',
    '  user:',
    `    token: ${token}`,
  ].join('\n');
}

// ─── Unified: Generate kubeconfig from stored config ─────────────────────────

export async function generateKubeconfig(
  authType: ClusterAuthType,
  config: Record<string, any>
): Promise<string> {
  switch (authType) {
    case 'duplo': {
      const creds: DuploCredentials = {
        duploHost: config.duploHost,
        duploToken: config.duploToken,
        planId: config.planId,
        isAdmin: config.isAdmin ?? true,
      };
      const resp = await getDuploK8sConfig(creds);
      return buildKubeconfigFromDuploResponse(resp);
    }
    case 'eks': {
      const creds: EksCredentials = {
        clusterName: config.eksClusterName,
        region: config.eksRegion,
        endpoint: config.eksEndpoint,
        caData: config.eksCaData,
        accessKeyId: config.eksAccessKeyId,
        secretAccessKey: config.eksSecretAccessKey,
        roleArn: config.eksRoleArn,
      };
      const token = await getEksToken(creds);
      return buildKubeconfigFromEks(creds, token);
    }
    case 'standard':
    default:
      throw new Error('Standard auth uses stored kubeconfig directly');
  }
}

// ─── Token Cache ─────────────────────────────────────────────────────────────

interface CachedToken {
  kubeconfig: string;
  expiresAt: number;
}

const TOKEN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (5-min buffer before 15-min expiry)
const tokenCache = new Map<string, CachedToken>();

// Periodic cleanup of expired entries (runs every 5 min, won't keep the process alive)
const _cacheCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (now >= entry.expiresAt) tokenCache.delete(key);
  }
}, 5 * 60 * 1000);
if (typeof _cacheCleanup === 'object' && 'unref' in _cacheCleanup) {
  (_cacheCleanup as NodeJS.Timeout).unref();
}

function cacheKey(authType: ClusterAuthType, config: Record<string, any>): string {
  if (authType === 'duplo') return `duplo:${config.duploHost}:${config.planId}`;
  if (authType === 'eks') return `eks:${config.eksClusterName}:${config.eksRegion}`;
  return `standard:${config.server || 'unknown'}`;
}

export async function generateKubeconfigCached(
  authType: ClusterAuthType,
  config: Record<string, any>
): Promise<string> {
  const key = cacheKey(authType, config);
  const cached = tokenCache.get(key);

  if (cached && Date.now() < cached.expiresAt) {
    logger.debug(`Token cache hit for ${key}`);
    return cached.kubeconfig;
  }

  const kubeconfig = await generateKubeconfig(authType, config);
  tokenCache.set(key, { kubeconfig, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  logger.debug(`Token cache miss — generated and cached for ${key}`);
  return kubeconfig;
}

export function invalidateTokenCache(authType: ClusterAuthType, config: Record<string, any>): void {
  const key = cacheKey(authType, config);
  tokenCache.delete(key);
  logger.debug(`Token cache invalidated for ${key}`);
}

// ─── Detect auth type from raw kubeconfig ────────────────────────────────────

export function detectAuthType(kubeconfig: string): 'standard' | 'exec-duplo' | 'exec-eks' | 'exec-other' {
  const lc = kubeconfig.toLowerCase();
  if (!lc.includes('exec:') && !lc.includes('command:')) return 'standard';
  if (lc.includes('duplo-jit') || lc.includes('duplo')) return 'exec-duplo';
  if (lc.includes('aws') && lc.includes('eks')) return 'exec-eks';
  return 'exec-other';
}

// ─── Validate a kubeconfig by actually connecting ────────────────────────────

export async function validateConnection(kubeconfig: string, timeoutMs = 10000) {
  const kc = new KubeConfig();
  kc.loadFromString(kubeconfig);

  const { CoreV1Api } = await import('@kubernetes/client-node');
  const core = kc.makeApiClient(CoreV1Api);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Connection timed out')), timeoutMs)
  );

  const request = (core as any).listNamespace();
  const response = await Promise.race([request, timeout]);
  const list = (response as any).body || response;

  return {
    ok: true,
    server: kc.getCurrentCluster()?.server,
    namespaces: Array.isArray(list?.items) ? list.items.length : 0,
  };
}
