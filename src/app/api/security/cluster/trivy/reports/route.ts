import { withTenantApiHandler, successResponse, validateQuery } from '@/lib/api';
import { z } from 'zod';
import { listTrivyOperatorVulnerabilityReports, isTrivyOperatorInstalled } from '@/lib/services/security-scans';

const querySchema = z.object({
  namespace: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/).optional(),
});

export const GET = withTenantApiHandler(
  async (request) => {
    const url = new URL(request.url);
    const query = validateQuery(url.searchParams, querySchema);
    if ('error' in query) return query.error;

    const namespace =
      query.data.namespace ||
      process.env.SECURITY_SCAN_NAMESPACE ||
      process.env.POD_NAMESPACE ||
      'default';

    const installed = await isTrivyOperatorInstalled();
    if (!installed) {
      return successResponse({ installed: false, namespace, items: [] });
    }

    const items = await listTrivyOperatorVulnerabilityReports(namespace);
    return successResponse({ installed: true, namespace, items });
  },
  { rateLimit: 'general', requiredRole: 'USER', requiredFeature: 'vulnerability' }
);

