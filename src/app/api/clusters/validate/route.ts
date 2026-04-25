import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import {
  generateKubeconfig,
  validateConnection,
  detectAuthType,
} from '@/lib/services/cluster-auth';

const validateSchema = z.discriminatedUnion('authType', [
  z.object({
    authType: z.literal('standard'),
    kubeconfig: z.string().min(10),
  }),
  z.object({
    authType: z.literal('duplo'),
    duploHost: z.string().url(),
    duploToken: z.string().min(5),
    planId: z.string().min(1),
    isAdmin: z.boolean().optional(),
  }),
  z.object({
    authType: z.literal('eks'),
    eksClusterName: z.string().min(1),
    eksRegion: z.string().min(1),
    eksEndpoint: z.string().url(),
    eksCaData: z.string().min(10),
    eksAccessKeyId: z.string().min(10),
    eksSecretAccessKey: z.string().min(10),
    eksRoleArn: z.string().optional(),
  }),
]);

export const POST = withTenantApiHandler(
  async (request) => {
    const validation = await validateRequest(request, validateSchema);
    if ('error' in validation) return validation.error;

    const data = validation.data;

    try {
      let kubeconfig: string;

      if (data.authType === 'standard') {
        const detected = detectAuthType(data.kubeconfig);
        if (detected !== 'standard') {
          return errorResponse(
            'EXEC_KUBECONFIG_DETECTED',
            detected === 'exec-duplo'
              ? 'This kubeconfig uses duplo-jit exec authentication. Use the "Duplo JIT" auth type instead — enter your Duplo Host, API Token, and Plan ID.'
              : detected === 'exec-eks'
                ? 'This kubeconfig uses aws eks get-token exec authentication. Use the "EKS" auth type instead — enter your cluster endpoint, CA data, and AWS credentials.'
                : 'This kubeconfig uses an exec-based credential plugin which cannot run server-side. Please provide a token or certificate-based kubeconfig.',
            400
          );
        }
        kubeconfig = data.kubeconfig;
      } else {
        kubeconfig = await generateKubeconfig(data.authType, data as Record<string, any>);
      }

      const result = await validateConnection(kubeconfig);
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
