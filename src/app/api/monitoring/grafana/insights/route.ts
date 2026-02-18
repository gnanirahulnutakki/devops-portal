import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import {
  isGrafanaConfigured,
  listAlertAnnotations,
  listAlertmanagerAlerts,
  listAlerts,
  type GrafanaAnnotation,
} from '@/lib/services/grafana';
import { trackIntegrationCall } from '@/lib/services/with-integration-metrics';

function parseRangeMs(range: string | null): number {
  // Accept: 15m, 1h, 24h, 7d
  const r = String(range || '24h').trim().toLowerCase();
  const m = r.match(/^(\d+)\s*(m|h|d)$/);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(n) || n <= 0) return 24 * 60 * 60 * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

function extractAlertKey(a: GrafanaAnnotation): string {
  const tags = Array.isArray(a.tags) ? a.tags : [];
  const tagKey =
    tags.find((t) => /^alertname[=:]/i.test(t)) ||
    tags.find((t) => /^rule[=:]/i.test(t)) ||
    tags.find((t) => /^alert[=:]/i.test(t));
  if (tagKey) return tagKey.replace(/^(alertname|rule|alert)[=:]/i, '').trim() || 'unknown';

  const text = String(a.text || '').trim();
  const m1 = text.match(/^(Alerting|OK|NoData|Error)\s*:\s*(.+)$/i);
  if (m1) return String(m1[2]).trim();
  return text.slice(0, 140) || 'unknown';
}

function stateOf(a: GrafanaAnnotation): string {
  const s = String(a.newState || '').trim();
  if (s) return s.toLowerCase();
  const t = String(a.text || '').toLowerCase();
  if (t.startsWith('alerting:')) return 'alerting';
  if (t.startsWith('ok:')) return 'ok';
  if (t.startsWith('nodata:')) return 'nodata';
  if (t.startsWith('error:')) return 'error';
  return 'unknown';
}

function bucketHour(tsMs: number): string {
  const d = new Date(tsMs);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const url = new URL(request.url);
      const credentialId = url.searchParams.get('credentialId') || undefined;
      const alertKey = url.searchParams.get('alertKey') || undefined;
      const rangeMs = parseRangeMs(url.searchParams.get('range'));
      const now = Date.now();
      const fromMs = Number(url.searchParams.get('fromMs') || (now - rangeMs));
      const toMs = Number(url.searchParams.get('toMs') || now);
      const limit = Number(url.searchParams.get('limit') || 2000);

      const configured = await isGrafanaConfigured(ctx.tenant.organizationId, credentialId);
      if (!configured) {
        return errorResponse('GRAFANA_NOT_CONFIGURED', 'Grafana is not configured for this organization', 400);
      }

      // Primary: annotation events (history)
      let annotations: GrafanaAnnotation[] = [];
      let usedFallback = false;
      try {
        annotations = await trackIntegrationCall('grafana', 'listAlertAnnotations', () =>
          listAlertAnnotations(ctx.tenant.organizationId, {
            fromMs,
            toMs,
            limit: Number.isFinite(limit) ? Math.max(10, Math.min(5000, limit)) : 2000,
            credentialId,
          })
        );
      } catch {
        annotations = [];
      }

      // Fallback: active alerts (no history)
      let activeAlerts: any[] = [];
      if (!annotations.length) {
        try {
          activeAlerts = await trackIntegrationCall('grafana', 'listAlertmanagerAlerts', () =>
            listAlertmanagerAlerts(ctx.tenant.organizationId, credentialId)
          );
          usedFallback = true;
        } catch {
          activeAlerts = [];
        }
      }

      const events = annotations
        .map((a) => {
          const key = extractAlertKey(a);
          return {
            id: a.id,
            time: a.time,
            state: stateOf(a),
            prevState: a.prevState || null,
            newState: a.newState || null,
            title: key,
            text: a.text,
            tags: a.tags || [],
          };
        })
        .sort((a, b) => b.time - a.time);

      const recent10 = events.slice(0, 10);

      const noisyCounts = new Map<string, number>();
      const stateCounts: Record<string, number> = {};
      const hourly: Record<string, number> = {};

      for (const e of events) {
        stateCounts[e.state] = (stateCounts[e.state] || 0) + 1;
        const hour = bucketHour(e.time);
        hourly[hour] = (hourly[hour] || 0) + 1;

        // "most alerted" = count transitions into alerting (or alerting events)
        if (e.state === 'alerting') {
          noisyCounts.set(e.title, (noisyCounts.get(e.title) || 0) + 1);
        }
      }

      const topNoisy = Array.from(noisyCounts.entries())
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Active alerts snapshot (fallback-only; still useful to show something)
      const activeSummary = Array.isArray(activeAlerts)
        ? activeAlerts.slice(0, 200).map((a: any) => ({
            title: a?.labels?.alertname || a?.labels?.rule || a?.labels?.alert || 'unknown',
            state: a?.status?.state || 'active',
            startsAt: a?.startsAt,
            endsAt: a?.endsAt,
            labels: a?.labels || {},
          }))
        : [];

      // Optional drilldown for a specific alert key
      let drilldown: any = null;
      if (alertKey) {
        const key = String(alertKey);
        const matching = events.filter((e) => e.title === key);
        const ddStateCounts: Record<string, number> = {};
        const ddHourly: Record<string, number> = {};
        let alertingCount = 0;
        let transitions = 0;
        let lastState: string | null = null;

        for (const e of matching.slice().sort((a, b) => a.time - b.time)) {
          ddStateCounts[e.state] = (ddStateCounts[e.state] || 0) + 1;
          const hour = bucketHour(e.time);
          ddHourly[hour] = (ddHourly[hour] || 0) + 1;
          if (e.state === 'alerting') alertingCount++;
          if (lastState !== null && e.state !== lastState) transitions++;
          lastState = e.state;
        }

        const firstSeen = matching.length ? Math.min(...matching.map((e) => e.time)) : null;
        const lastSeen = matching.length ? Math.max(...matching.map((e) => e.time)) : null;

        // Best-effort rule lookup for deep link
        let rule: any = null;
        try {
          const rules = await trackIntegrationCall('grafana', 'listAlerts', () =>
            listAlerts(ctx.tenant.organizationId, credentialId)
          );
          const found = (rules || []).find(
            (r: any) => String(r?.title || '').trim().toLowerCase() === key.trim().toLowerCase()
          );
          if (found?.uid) {
            const view = new URL(`/grafana/alerting/grafana/${encodeURIComponent(found.uid)}/view`, request.url);
            const edit = new URL(`/grafana/alerting/grafana/${encodeURIComponent(found.uid)}/edit`, request.url);
            if (credentialId) {
              view.searchParams.set('credentialId', credentialId);
              edit.searchParams.set('credentialId', credentialId);
            }
            rule = {
              uid: found.uid,
              title: found.title,
              folderTitle: found.folderTitle,
              portalViewUrl: view.pathname + view.search,
              portalEditUrl: edit.pathname + edit.search,
            };
          }
        } catch {
          rule = null;
        }

        // Extract key/value tags (best-effort)
        const kv: Record<string, string> = {};
        const tags = new Set<string>();
        for (const e of matching.slice(0, 50)) {
          (e.tags || []).forEach((t: string) => {
            tags.add(t);
            const m = String(t).match(/^([^=:]+)[=:](.+)$/);
            if (m) kv[m[1].trim()] = m[2].trim();
          });
        }

        drilldown = {
          alertKey: key,
          firstSeen,
          lastSeen,
          totalEvents: matching.length,
          alertingCount,
          transitions,
          stateCounts: ddStateCounts,
          hourly: ddHourly,
          recent: matching.slice(0, 50),
          tags: Array.from(tags).slice(0, 200),
          tagKv: kv,
          rule,
        };
      }

      return successResponse({
        window: { fromMs, toMs, rangeMs },
        usedFallback,
        stats: {
          totalEvents: events.length,
          stateCounts,
        },
        topNoisy,
        recent10,
        hourly,
        activeSummary,
        drilldown,
      });
    } catch (e: any) {
      return errorResponse('GRAFANA_INSIGHTS_FAILED', e?.message || 'Failed to build insights', 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

