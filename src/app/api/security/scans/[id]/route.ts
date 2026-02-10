import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { idSchema } from '@/lib/validations/schemas';
import { findJobPodName, getPodLogs, getPodLogsTail, readJob } from '@/lib/services/security-scans';

function summarizeTrivyReport(report: any) {
  // Trivy JSON has Results[].Vulnerabilities[].Severity
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

  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    return JSON.parse(trimmed.slice(jsonStart));
  }
  return null;
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop() || '';

    const parsed = idSchema.safeParse({ id });
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid scan id', 400);
    }

    const scan = await ctx.db.securityScan.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
    });
    if (!scan) return errorResponse('NOT_FOUND', 'Scan not found', 404);

    const defaultNamespace =
      process.env.SECURITY_SCAN_NAMESPACE ||
      process.env.DEVOPS_PORTAL_NAMESPACE ||
      process.env.POD_NAMESPACE ||
      'default';
    const namespace = scan.k8sNamespace || defaultNamespace;
    const jobName = scan.k8sJobName || `devops-portal-scan-${scan.id}`.toLowerCase();

    // Always attempt a best-effort refresh (supports viewing progression)
    let jobStatus: any = null;
    let podName: string | null = null;
    let logsTail: string | null = null;

    try {
      const job = await readJob(namespace, jobName);
      jobStatus = job?.status || null;

      podName = scan.k8sPodName || (await findJobPodName(namespace, jobName));
      if (podName) {
        logsTail = await getPodLogsTail(namespace, podName, 200);
      }

      const succeeded = (job?.status?.succeeded || 0) > 0;
      const failed = (job?.status?.failed || 0) > 0;

      if ((succeeded || failed) && scan.status === 'RUNNING') {
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
      } else if (podName && (!scan.k8sPodName || scan.k8sPodName !== podName)) {
        await ctx.db.securityScan.update({
          where: { id: scan.id },
          data: { k8sNamespace: namespace, k8sJobName: jobName, k8sPodName: podName },
        });
      }
    } catch {
      // ignore refresh issues (RBAC/network)
    }

    const updated = await ctx.db.securityScan.findFirst({
      where: { id, organizationId: ctx.tenant.organizationId },
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
        reportJson: true,
        reportText: true,
      },
    });

    return successResponse({
      ...updated,
      k8s: {
        namespace,
        jobName,
        podName,
        jobStatus,
        logsTail,
      },
    });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

