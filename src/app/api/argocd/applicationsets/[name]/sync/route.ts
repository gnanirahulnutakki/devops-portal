import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { getArgoCDClient } from '@/lib/services/argocd';

// Validate ApplicationSet name to prevent label-selector injection or path traversal.
// K8s object name rules: lowercase alphanumeric or '-', max 253 chars, must start/end with alnum.
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split('/');
      const rawName = segments[segments.indexOf('applicationsets') + 1];
      if (!rawName) {
        return errorResponse('VALIDATION_ERROR', 'name path param required', 400);
      }
      const name = decodeURIComponent(rawName);
      if (!NAME_PATTERN.test(name) || name.length > 253) {
        return errorResponse(
          'VALIDATION_ERROR',
          'invalid applicationset name (must match k8s object name pattern)',
          400,
        );
      }

      const client = await getArgoCDClient(ctx.tenant.organizationId);
      // ApplicationSets don't have a built-in "sync the set" verb — sync the generated apps instead.
      // Selector pattern matches what argo-cd controller injects on generated Applications.
      const apps = await client
        .get('api/v1/applications', {
          searchParams: { selector: `argocd.argoproj.io/application-set-name=${name}` },
        })
        .json<{ items?: Array<{ metadata?: { name?: string } }> }>();

      const targets = (apps.items || [])
        .slice(0, 50)
        .map((a) => a.metadata?.name)
        .filter(Boolean) as string[];

      const results = await Promise.allSettled(
        targets.map((appName) =>
          client.post(`api/v1/applications/${encodeURIComponent(appName)}/sync`, { json: {} }).json(),
        ),
      );

      return successResponse({
        targeted: targets.length,
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
      });
    } catch (error) {
      return errorResponse('ARGOCD_APPLICATIONSET_SYNC_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'sync',
    requiredRole: 'READWRITE',
    audit: { action: 'argocd.applicationset.sync', resource: 'applicationset' },
  }
);
