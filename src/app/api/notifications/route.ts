import { withTenantApiHandler, successResponse } from '@/lib/api';
import {
  isGrafanaConfigured,
  listAlertmanagerAlerts,
} from '@/lib/services/grafana';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    const notifications: any[] = [];

    try {
      const configured = await isGrafanaConfigured(ctx.tenant.organizationId);
      if (configured) {
        const alerts = await listAlertmanagerAlerts(ctx.tenant.organizationId);
        for (const a of (alerts || []).slice(0, 10)) {
          const name =
            a.labels?.alertname || a.annotations?.summary || 'Grafana Alert';
          notifications.push({
            id: `grafana-${name}-${a.startsAt || ''}`,
            type: 'alert',
            title: name,
            description:
              a.annotations?.description ||
              a.annotations?.summary ||
              `State: ${a.status?.state || 'active'}`,
            time: a.startsAt
              ? new Date(a.startsAt).toLocaleString()
              : 'Unknown',
            read: false,
          });
        }
      }
    } catch {
      /* Grafana not reachable, skip */
    }

    return successResponse(notifications);
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
