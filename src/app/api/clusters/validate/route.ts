import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { testKubeconfig } from '@/lib/services/kubernetes';

const validateSchema = z.object({
  kubeconfig: z.string().min(10),
});

export const POST = withTenantApiHandler(
  async (request) => {
    const validation = await validateRequest(request, validateSchema);
    if ('error' in validation) return validation.error;

    const { kubeconfig } = validation.data;

    try {
      const result = await testKubeconfig(kubeconfig);
      return successResponse({
        ok: true,
        server: result.server,
        namespaces: result.namespaces,
      });
    } catch (error) {
      return errorResponse(
        'KUBECONFIG_VALIDATION_FAILED',
        (error as Error).message || 'Failed to connect to Kubernetes API',
        400
      );
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
