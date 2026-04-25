import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';

const settingsSchema = z.object({
  mcp: z
    .object({
      fastworkflowEnabled: z.boolean().optional(),
      fastworkflowUrl: z.string().url().optional(),
      fastworkflowToolName: z.string().min(1).max(100).optional(),
      mcpServerUrl: z.string().url().optional(),
    })
    .optional(),
  llm: z
    .object({
      mode: z.enum(['hosted', 'self-hosted', 'byo']).optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
      baseUrl: z.string().url().optional(),
      credentialId: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      credentialId: z.string().optional(),
    })
    .optional(),
  duplo: z
    .object({
      jitTemplateUrl: z.string().url().optional(),
    })
    .optional(),
  uptimeKuma: z
    .object({
      credentialId: z.string().optional(),
    })
    .optional(),
  grafana: z
    .object({
      credentialId: z.string().optional(),
    })
    .optional(),
  argocd: z
    .object({
      credentialId: z.string().optional(),
    })
    .optional(),
  features: z
    .record(
      z.string(),
      z
        .object({
          enabled: z.boolean().optional(),
          minRole: z.enum(['USER', 'READWRITE', 'ADMIN']).optional(),
        })
        .optional()
    )
    .optional(),
});

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.tenant.organizationId },
        select: { settings: true },
      });
      const settings = (org?.settings as Record<string, unknown>) || {};
      const mcp = (settings as any).mcp || {};
      const enriched = {
        ...settings,
        mcp: {
          fastworkflowEnabled: mcp.fastworkflowEnabled ?? true,
          ...mcp,
        },
      };
      return successResponse(enriched);
    } catch (error) {
      return errorResponse('SETTINGS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

export const PUT = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, settingsSchema);
    if ('error' in validation) return validation.error;

    try {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.tenant.organizationId },
        select: { settings: true },
      });
      const current = (org?.settings as Record<string, unknown>) || {};
      const next = {
        ...current,
        ...validation.data,
        mcp: {
          ...(current as any).mcp,
          ...(validation.data.mcp || {}),
        },
        features: {
          ...(current as any).features,
          ...(validation.data.features || {}),
        },
        llm: {
          ...(current as any).llm,
          ...(validation.data.llm || {}),
        },
        duplo: {
          ...(current as any).duplo,
          ...(validation.data.duplo || {}),
        },
        uptimeKuma: {
          ...(current as any).uptimeKuma,
          ...(validation.data.uptimeKuma || {}),
        },
        github: {
          ...(current as any).github,
          ...(validation.data.github || {}),
        },
        grafana: {
          ...(current as any).grafana,
          ...(validation.data.grafana || {}),
        },
        argocd: {
          ...(current as any).argocd,
          ...(validation.data.argocd || {}),
        },
      };

      await ctx.db.organization.update({
        where: { id: ctx.tenant.organizationId },
        data: { settings: next },
      });

      return successResponse(next);
    } catch (error) {
      return errorResponse('SETTINGS_UPDATE_FAILED', (error as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'ADMIN' }
);
