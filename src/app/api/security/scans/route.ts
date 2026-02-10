import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateRequest,
  validateQuery,
} from '@/lib/api';
import { createSecurityScanSchema, listSecurityScansSchema } from '@/lib/validations/schemas';
import { buildTrivyImageScanJob, createJob } from '@/lib/services/security-scans';

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const query = validateQuery(url.searchParams, listSecurityScansSchema);
    if ('error' in query) return query.error;

    const page = query.data.page ?? 1;
    const pageSize = query.data.pageSize ?? 20;
    const scans = await ctx.db.securityScan.findMany({
      where: { organizationId: ctx.tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        target: true,
        tool: true,
        toolVersion: true,
        summary: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
      },
    });

    return successResponse(scans, { page, pageSize, total: scans.length });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const body = await validateRequest(request, createSecurityScanSchema);
    if ('error' in body) return body.error;

    const { type, target, namespace } = body.data;

    if (type !== 'TRIVY_IMAGE') {
      return errorResponse('VALIDATION_ERROR', 'Unsupported scan type', 400);
    }

    const scan = await ctx.db.securityScan.create({
      data: {
        type: 'TRIVY_IMAGE',
        status: 'RUNNING',
        target,
        tool: 'trivy',
        organizationId: ctx.tenant.organizationId,
        createdById: ctx.tenant.userId,
        startedAt: new Date(),
      },
      select: { id: true, target: true, status: true, type: true, startedAt: true },
    });

    // Create a K8s job to run the scan (in-cluster)
    const jobNamespace =
      namespace ||
      process.env.SECURITY_SCAN_NAMESPACE ||
      process.env.DEVOPS_PORTAL_NAMESPACE ||
      process.env.POD_NAMESPACE ||
      'default';
    const jobName = `devops-portal-scan-${scan.id}`.toLowerCase();
    const job = buildTrivyImageScanJob({
      name: jobName,
      namespace: jobNamespace,
      imageRef: target,
    });

    try {
      await createJob(job);
    } catch (error) {
      // Mark scan failed if we couldn't start the job
      await ctx.db.securityScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          reportText: (error as Error).message,
        },
      });
      return errorResponse('SECURITY_SCAN_START_FAILED', 'Failed to start scan job', 500, {
        message: (error as Error).message,
      });
    }

    return successResponse({
      ...scan,
      namespace: jobNamespace,
      jobName,
    });
  },
  {
    rateLimit: 'general',
    requiredRole: 'READWRITE',
    audit: { action: 'create', resource: 'security_scan' },
  }
);

