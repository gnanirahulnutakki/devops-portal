import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { idSchema } from '@/lib/validations/schemas';
import { findJobPodName, getPodLogs, readJob } from '@/lib/services/security-scans';

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

    // If still running, try to refresh status by checking the K8s job/pod logs.
    if (scan.status === 'RUNNING') {
      const namespace = process.env.SECURITY_SCAN_NAMESPACE || process.env.POD_NAMESPACE || 'default';
      const jobName = `devops-portal-scan-${scan.id}`.toLowerCase();

      try {
        const job = await readJob(namespace, jobName);
        const succeeded = (job?.status?.succeeded || 0) > 0;
        const failed = (job?.status?.failed || 0) > 0;

        if (succeeded || failed) {
          const podName = await findJobPodName(namespace, jobName);
          const logs = podName ? await getPodLogs(namespace, podName) : '';

          let reportJson: any = null;
          let summary: any = null;
          if (succeeded && logs) {
            // logs should be pure JSON, but may contain a prelude line; try parse leniently
            const trimmed = logs.trim();
            const jsonStart = trimmed.indexOf('{');
            if (jsonStart >= 0) {
              reportJson = JSON.parse(trimmed.slice(jsonStart));
              summary = summarizeTrivyReport(reportJson);
            }
          }

          await ctx.db.securityScan.update({
            where: { id: scan.id },
            data: {
              status: succeeded ? 'COMPLETED' : 'FAILED',
              completedAt: new Date(),
              summary: summary ?? undefined,
              reportJson: reportJson ?? undefined,
              reportText: logs || undefined,
            },
          });
        }
      } catch {
        // best-effort refresh, don't fail API call
      }
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
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        reportJson: true,
        reportText: true,
      },
    });

    return successResponse(updated);
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

