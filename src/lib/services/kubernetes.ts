import { KubeConfig, CoreV1Api, AppsV1Api, NetworkingV1Api, ApiextensionsV1Api, VersionApi, BatchV1Api } from '@kubernetes/client-node';
import { decrypt } from '@/lib/encryption';

export interface ClusterRecord {
  id: string;
  name: string;
  kubeconfig: string | null;
}

export interface KubeClients {
  core: CoreV1Api;
  apps: AppsV1Api;
  networking: NetworkingV1Api;
  apiExt: ApiextensionsV1Api;
  version: VersionApi;
  batch: BatchV1Api;
}

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
