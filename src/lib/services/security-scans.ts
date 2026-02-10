import { KubeConfig, BatchV1Api, CoreV1Api, ApiextensionsV1Api, CustomObjectsApi } from '@kubernetes/client-node';
import { logger } from '@/lib/logger';

export interface InClusterClients {
  batch: BatchV1Api;
  core: CoreV1Api;
  apiExt: ApiextensionsV1Api;
  custom: CustomObjectsApi;
}

export function getInClusterKubeConfig(): KubeConfig {
  const kc = new KubeConfig();
  try {
    // Prefer in-cluster when running inside Kubernetes
    (kc as any).loadFromCluster();
    return kc;
  } catch {
    // Fallback for local debugging
    kc.loadFromDefault();
    return kc;
  }
}

export function getInClusterClients(): InClusterClients {
  const kc = getInClusterKubeConfig();
  return {
    batch: kc.makeApiClient(BatchV1Api),
    core: kc.makeApiClient(CoreV1Api),
    apiExt: kc.makeApiClient(ApiextensionsV1Api),
    custom: kc.makeApiClient(CustomObjectsApi),
  };
}

export function buildTrivyImageScanJob(params: {
  name: string;
  namespace: string;
  imageRef: string;
}): any {
  const { name, namespace, imageRef } = params;

  // Note: we print JSON to stdout so the app can capture it via pod logs.
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': 'devops-portal',
        'devops-portal.radiantlogic.io/security-scan': 'true',
      },
    },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 3600,
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': 'devops-portal',
            'job-name': name,
          },
        },
        spec: {
          restartPolicy: 'Never',
          containers: [
            {
              name: 'trivy',
              image: 'aquasec/trivy:latest',
              imagePullPolicy: 'IfNotPresent',
              env: [
                { name: 'TRIVY_NO_PROGRESS', value: 'true' },
                { name: 'TRIVY_TIMEOUT', value: '10m' },
              ],
              command: ['sh', '-lc'],
              args: [
                [
                  'set -euo pipefail',
                  'echo "{\\"tool\\":\\"trivy\\",\\"phase\\":\\"start\\"}"',
                  // Avoid writing files; emit JSON report to stdout.
                  `trivy image --format json "${imageRef}"`,
                ].join('\n'),
              ],
              resources: {
                requests: { cpu: '100m', memory: '256Mi' },
                limits: { cpu: '1000m', memory: '1Gi' },
              },
            },
          ],
        },
      },
    },
  };
}

export async function createJob(job: any) {
  const clients = getInClusterClients();
  const ns = job?.metadata?.namespace;
  return clients.batch.createNamespacedJob({ namespace: ns, body: job } as any);
}

export async function readJob(namespace: string, name: string) {
  const clients = getInClusterClients();
  const res = await clients.batch.readNamespacedJob({ namespace, name } as any);
  return (res as any).body ?? res;
}

export async function findJobPodName(namespace: string, jobName: string): Promise<string | null> {
  const clients = getInClusterClients();
  const res = await clients.core.listNamespacedPod({
    namespace,
    labelSelector: `job-name=${jobName}`,
  } as any);
  const pods = (res as any).body?.items ?? (res as any).items ?? [];
  const pod = pods[0];
  return pod?.metadata?.name ?? null;
}

export async function getPodLogs(namespace: string, podName: string): Promise<string> {
  const clients = getInClusterClients();
  const res = await clients.core.readNamespacedPodLog({
    namespace,
    name: podName,
    container: 'trivy',
    tailLines: 20000,
  } as any);
  return (res as any).body ?? String(res);
}

export async function isTrivyOperatorInstalled(): Promise<boolean> {
  const clients = getInClusterClients();
  try {
    await clients.apiExt.readCustomResourceDefinition({
      name: 'vulnerabilityreports.aquasecurity.github.io',
    } as any);
    return true;
  } catch {
    return false;
  }
}

export async function listTrivyOperatorVulnerabilityReports(namespace: string): Promise<any[]> {
  const clients = getInClusterClients();
  const installed = await isTrivyOperatorInstalled();
  if (!installed) return [];

  try {
    const res = await clients.custom.listNamespacedCustomObject({
      group: 'aquasecurity.github.io',
      version: 'v1alpha1',
      namespace,
      plural: 'vulnerabilityreports',
    } as any);
    const body = (res as any).body ?? res;
    return body?.items ?? [];
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Failed to list Trivy Operator vulnerability reports');
    return [];
  }
}

