import {
  withTenantApiHandler,
  successResponse,
  errorResponse,
  validateRequest,
  validateQuery,
} from '@/lib/api';
import { createSecurityScanSchema, listSecurityScansSchema } from '@/lib/validations/schemas';
import { buildTrivyImageScanJob, createJob, findJobPodName, getPodLogs, readJob } from '@/lib/services/security-scans';

function summarizeTrivyReport(report: any) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const results = Array.isArray(report?.Results) ? report.Results : [];
  for (const r of results) {
    const vulns = Array.isArray(r?.Vulnerabilities) ? r.Vulnerabilities : [];
    for (const v of vulns) {
      const sev = String(v?.Severity || 'UNKNOWN').toLowerCase();
      if (sev === 'critical') summary.critical++;
      else if (sev === 'high') summary.high++;
      else if (sev === 'medium') summary.medium++;
      else if (sev === 'low') summary.low++;
      else summary.unknown++;
    }
  }
  return summary;
}

function extractJsonFromLogs(logs: string): any | null {
  const trimmed = (logs || '').trim();
  if (!trimmed) return null;

  const startMarker = '===REPORT_JSON_START===';
  const endMarker = '===REPORT_JSON_END===';
  const s = trimmed.lastIndexOf(startMarker);
  const e = trimmed.lastIndexOf(endMarker);
  if (s >= 0 && e > s) {
    const jsonText = trimmed.slice(s + startMarker.length, e).trim();
    return JSON.parse(jsonText);
  }

  // Backward-compatible: attempt to parse from first '{'
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    return JSON.parse(trimmed.slice(jsonStart));
  }
  return null;
}

async function refreshRunningScans(ctx: any, scans: any[]) {
  const running = scans.filter((s) => s.status === 'RUNNING').slice(0, 5);
  if (running.length === 0) return;

  const defaultNamespace =
    process.env.SECURITY_SCAN_NAMESPACE ||
    process.env.DEVOPS_PORTAL_NAMESPACE ||
    process.env.POD_NAMESPACE ||
    'default';

  await Promise.all(
    running.map(async (scan) => {
      const namespace = scan.k8sNamespace || defaultNamespace;
      const jobName = scan.k8sJobName || `devops-portal-scan-${scan.id}`.toLowerCase();
      try {
        const job = await readJob(namespace, jobName);
        const succeeded = (job?.status?.succeeded || 0) > 0;
        const failed = (job?.status?.failed || 0) > 0;
        if (!succeeded && !failed) return;

        const podName = await findJobPodName(namespace, jobName);
        const logs = podName ? await getPodLogs(namespace, podName) : '';
        let reportJson: any = null;
        let summary: any = null;
        if (succeeded && logs) {
          reportJson = extractJsonFromLogs(logs);
          if (reportJson) summary = summarizeTrivyReport(reportJson);
        }

        await ctx.db.securityScan.update({
          where: { id: scan.id },
          data: {
            status: succeeded ? 'COMPLETED' : 'FAILED',
            completedAt: new Date(),
            summary: summary ?? undefined,
            reportJson: reportJson ?? undefined,
            reportText: logs || undefined,
            k8sNamespace: namespace,
            k8sJobName: jobName,
            k8sPodName: podName ?? undefined,
          },
        });
      } catch {
        // best-effort refresh
      }
    })
  );
}

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
        k8sNamespace: true,
        k8sJobName: true,
        k8sPodName: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
      },
    });

    // Best-effort refresh of RUNNING scans so UI doesn't get stuck
    await refreshRunningScans(ctx, scans);

    const refreshed = await ctx.db.securityScan.findMany({
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
        k8sNamespace: true,
        k8sJobName: true,
        k8sPodName: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
      },
    });

    return successResponse(refreshed, { page, pageSize, total: refreshed.length });
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
      select: { id: true, target: true, status: true, type: true, startedAt: true, k8sNamespace: true, k8sJobName: true },
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
      scanId: scan.id,
    });

    try {
      await createJob(job);
      await ctx.db.securityScan.update({
        where: { id: scan.id },
        data: {
          k8sNamespace: jobNamespace,
          k8sJobName: jobName,
        },
      });
    } catch (error) {
      // Mark scan failed if we couldn't start the job
      await ctx.db.securityScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          reportText: (error as Error).message,
          k8sNamespace: jobNamespace,
          k8sJobName: jobName,
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

