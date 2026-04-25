import { KubeConfig, CoreV1Api, AppsV1Api, NetworkingV1Api, ApiextensionsV1Api, VersionApi, BatchV1Api } from '@kubernetes/client-node';
import { decrypt } from '@/lib/encryption';
import { generateKubeconfig, generateKubeconfigCached, invalidateTokenCache, type ClusterAuthType } from './cluster-auth';
import { logger } from '@/lib/logger';

export interface ClusterRecord {
  id: string;
  name: string;
  kubeconfig: string | null;
  config?: any;
}

export interface KubeClients {
  core: CoreV1Api;
  apps: AppsV1Api;
  networking: NetworkingV1Api;
  apiExt: ApiextensionsV1Api;
  version: VersionApi;
  batch: BatchV1Api;
}

/**
 * Load a KubeConfig from a cluster record.
 * For standard auth: decrypts and uses stored kubeconfig.
 * For duplo/eks: generates a fresh token-based kubeconfig on-demand.
 */
export async function loadKubeConfigFromClusterAsync(cluster: ClusterRecord): Promise<KubeConfig> {
  const config = cluster.config as Record<string, any> | null;
  const authType = (config?.authType as ClusterAuthType) || 'standard';

  let kubeconfigYaml: string;

  if (authType === 'standard') {
    if (!cluster.kubeconfig) {
      throw new Error('Cluster kubeconfig is not configured');
    }
    kubeconfigYaml = decrypt(cluster.kubeconfig);
  } else {
    // Decrypt any encrypted fields before passing to provider
    const decryptedConfig = { ...config };
    const encryptedKeys = ['duploToken', 'eksAccessKeyId', 'eksSecretAccessKey'];
    for (const key of encryptedKeys) {
      if (decryptedConfig[key] && typeof decryptedConfig[key] === 'string' && decryptedConfig[key].includes(':')) {
        try { decryptedConfig[key] = decrypt(decryptedConfig[key]); } catch { /* not encrypted or corrupt */ }
      }
    }
    try {
      kubeconfigYaml = await generateKubeconfigCached(authType, decryptedConfig);
    } catch (err) {
      // Cache may hold a stale entry that somehow passed TTL check — invalidate and retry once
      invalidateTokenCache(authType, decryptedConfig);
      logger.warn(`Cached token failed for ${authType}, retrying with fresh token: ${(err as Error).message}`);
      kubeconfigYaml = await generateKubeconfig(authType, decryptedConfig);
    }
  }

  const kc = new KubeConfig();
  kc.loadFromString(kubeconfigYaml);
  return kc;
}

/** Sync version kept for backward compat — only works for standard auth */
export function loadKubeConfigFromCluster(cluster: ClusterRecord): KubeConfig {
  if (!cluster.kubeconfig) {
    throw new Error('Cluster kubeconfig is not configured');
  }
  const kc = new KubeConfig();
  const kubeconfig = decrypt(cluster.kubeconfig);
  kc.loadFromString(kubeconfig);
  return kc;
}

export function loadKubeConfigFromString(kubeconfig: string): KubeConfig {
  const kc = new KubeConfig();
  kc.loadFromString(kubeconfig);
  return kc;
}

export function createKubeClients(kc: KubeConfig): KubeClients {
  return {
    core: kc.makeApiClient(CoreV1Api),
    apps: kc.makeApiClient(AppsV1Api),
    networking: kc.makeApiClient(NetworkingV1Api),
    apiExt: kc.makeApiClient(ApiextensionsV1Api),
    version: kc.makeApiClient(VersionApi),
    batch: kc.makeApiClient(BatchV1Api),
  };
}

export async function testKubeconfig(kubeconfig: string, timeoutMs = 8000) {
  const kc = loadKubeConfigFromString(kubeconfig);
  const core = kc.makeApiClient(CoreV1Api);
  const request = (core as any).listNamespace();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Kubernetes API request timed out')), timeoutMs)
  );
  const response = await Promise.race([request, timeout]);
  const list = (response as any).body || response;
  return {
    server: kc.getCurrentCluster()?.server,
    namespaces: Array.isArray(list?.items) ? list.items.length : 0,
  };
}
