import { withTenantApiHandler, successResponse, errorResponse, validateQuery } from '@/lib/api';
import { z } from 'zod';
import { getVantaCredentials } from '@/lib/services/integration-credentials';
import { VantaService } from '@/lib/integrations/vanta';

const querySchema = z.object({
  pageSize: z.coerce.number().min(1).max(200).default(50),
  pageCursor: z.string().optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  slaDeadlineAfterDate: z.string().optional(),
  slaDeadlineBeforeDate: z.string().optional(),
  isFixAvailable: z.coerce.boolean().optional(),
  includeVulnerabilitiesWithoutSlas: z.coerce.boolean().optional(),
});

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const query = validateQuery(url.searchParams, querySchema);
    if ('error' in query) return query.error;

    const creds = await getVantaCredentials(ctx.tenant.organizationId);
    if (!creds?.accessToken) {
      return errorResponse('VANTA_NOT_CONFIGURED', 'Vanta is not configured for this organization', 400);
    }

    try {
      const vanta = new VantaService({ accessToken: creds.accessToken, baseUrl: creds.baseUrl });
      const data = await vanta.listVulnerabilities(query.data);
      return successResponse(data);
    } catch (error) {
      return errorResponse('VANTA_API_ERROR', 'Failed to fetch Vanta vulnerabilities', 502, {
        message: (error as Error).message,
      });
    }
  },
  { rateLimit: 'general', requiredRole: 'USER', requiredFeature: 'vulnerability' }
);

