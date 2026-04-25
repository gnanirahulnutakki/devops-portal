import { withTenantApiHandler, successResponse, notFoundError, serverError } from '@/lib/api';
import { checkSingleCredential } from '@/lib/services/credential-health-orchestrator';

export const POST = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      // Extract credential ID from the URL path
      const url = new URL(_request.url);
      const pathParts = url.pathname.split('/');
      // Path: /api/integrations/credentials/{id}/check
      const credentialIdIndex = pathParts.indexOf('credentials') + 1;
      const credentialId = pathParts[credentialIdIndex];

      if (!credentialId) {
        return notFoundError('Credential');
      }

      const result = await checkSingleCredential(credentialId, ctx.tenant.organizationId);
      return successResponse(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return notFoundError('Credential');
      }
      return serverError(error);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'READWRITE',
    requiredFeature: 'monitoring',
    audit: {
      action: 'credential.health_check',
      resource: 'IntegrationCredential',
    },
  }
);
