import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getClusterOrThrow } from '@/app/api/clusters/utils';
import { loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
import * as k8s from '@kubernetes/client-node';
import yaml from 'js-yaml';

/**
 * GET  /api/clusters/[id]/yaml?apiVersion=...&kind=...&name=...&namespace=...
 *      Returns the resource as YAML in `data.yaml`.
 *
 * PUT  /api/clusters/[id]/yaml
 *      Body: { yaml: string }  (full resource manifest)
 *      Server-side applies the manifest with field manager `devops-portal`.
 *      Returns the updated object as YAML.
 *
 * Secret values are redacted on GET (the `data` map's values become "***" so
 * users can see structure without exfiltrating secrets through the editor).
 */

function stripManagedFields(obj: any) {
  if (obj?.metadata?.managedFields) delete obj.metadata.managedFields;
  return obj;
}

function redactSecret(obj: any) {
  if (obj?.kind === 'Secret' && obj.data) {
    for (const k of Object.keys(obj.data)) obj.data[k] = '***REDACTED***';
  }
  return obj;
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const clusterId = segments[segments.indexOf('clusters') + 1];
      if (!clusterId) {
        return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
      }
      const apiVersion = url.searchParams.get('apiVersion') || 'v1';
      const kind = url.searchParams.get('kind');
      const name = url.searchParams.get('name');
      const namespace = url.searchParams.get('namespace') || undefined;
      if (!kind || !name) {
        return errorResponse('VALIDATION_ERROR', 'kind and name query params are required', 400);
      }

      const cluster = await getClusterOrThrow(ctx, clusterId);
      const kubeConfig = await loadKubeConfigFromClusterAsync({
        id: cluster.id,
        name: cluster.name,
        kubeconfig: cluster.kubeconfig,
        config: cluster.config,
      });
      const api = kubeConfig.makeApiClient(k8s.KubernetesObjectApi);

      const result: any = await (api as any).read({
        apiVersion,
        kind,
        metadata: { name, namespace },
      });
      const obj = result?.body || result;
      const cleaned = redactSecret(stripManagedFields(obj));
      const yamlText = yaml.dump(cleaned, { lineWidth: 120, noRefs: true });

      return successResponse({ yaml: yamlText, apiVersion, kind, name, namespace });
    } catch (error) {
      return errorResponse('CLUSTER_YAML_GET_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const PUT = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const clusterId = segments[segments.indexOf('clusters') + 1];
      if (!clusterId) {
        return errorResponse('VALIDATION_ERROR', 'Cluster id is required', 400);
      }

      const body = await request.json().catch(() => ({}));
      const yamlText = (body?.yaml || '').toString();
      if (!yamlText.trim()) {
        return errorResponse('VALIDATION_ERROR', 'yaml body is required', 400);
      }
      let parsed: any;
      try {
        parsed = yaml.load(yamlText);
      } catch (e) {
        return errorResponse('VALIDATION_ERROR', `Invalid YAML: ${(e as Error).message}`, 400);
      }
      if (!parsed?.kind || !parsed?.apiVersion || !parsed?.metadata?.name) {
        return errorResponse('VALIDATION_ERROR', 'YAML must include apiVersion, kind, metadata.name', 400);
      }
      // Refuse Secret apply through the editor — secrets should go through
      // a dedicated rotation flow, not be edited in the open clipboard path.
      if (parsed.kind === 'Secret') {
        return errorResponse(
          'POLICY_VIOLATION',
          'Editing Secrets through the YAML editor is disabled. Use the Settings → Configurations flow instead.',
          403,
        );
      }

      const cluster = await getClusterOrThrow(ctx, clusterId);
      const kubeConfig = await loadKubeConfigFromClusterAsync({
        id: cluster.id,
        name: cluster.name,
        kubeconfig: cluster.kubeconfig,
        config: cluster.config,
      });
      const api = kubeConfig.makeApiClient(k8s.KubernetesObjectApi);

      // Server-side apply with field manager `devops-portal`.
      // 6th positional arg in @kubernetes/client-node v1 is `patchStrategy`
      // (a string from `PatchStrategy`), NOT an options object — passing
      // `{ headers: ... }` here used to silently fall through and let the
      // request go out without a Content-Type, getting rejected by the
      // apiserver with 415.
      const applied: any = await (api as any).patch(
        parsed,
        undefined, // pretty
        undefined, // dryRun
        'devops-portal', // fieldManager
        true, // force
        k8s.PatchStrategy.ServerSideApply,
      );
      const obj = applied?.body || applied;
      const yamlOut = yaml.dump(stripManagedFields(obj), { lineWidth: 120, noRefs: true });

      return successResponse({ yaml: yamlOut, applied: true });
    } catch (error) {
      return errorResponse('CLUSTER_YAML_PUT_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'sync',
    requiredRole: 'READWRITE',
    audit: { action: 'cluster.resource.apply', resource: 'Cluster' },
  }
);
