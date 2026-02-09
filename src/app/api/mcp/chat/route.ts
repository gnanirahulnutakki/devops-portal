import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { searchKnowledge } from '@/lib/knowledge/portal-knowledge';

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.string().max(2000).optional(),
  preferredSource: z.enum(['auto', 'fastworkflow', 'mcp', 'knowledge']).optional(),
  mcpServerUrl: z.string().url().optional(),
});

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function callFastworkflow(
  baseUrl: string,
  message: string,
  toolName?: string
): Promise<{ text: string; tool: string } | null> {
  const url = baseUrl.replace(/\/$/, '');
  const requestId = Date.now();

  let resolvedTool = toolName?.trim();

  if (!resolvedTool) {
    const listRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/list',
          params: {},
        }),
      },
      6000
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const tools = listData?.result?.tools || [];
      const preferred = ['command', 'chat', 'router', 'assistant', 'run', 'help'];
      resolvedTool =
        tools.find((tool: any) => preferred.includes(String(tool.name).toLowerCase()))?.name ||
        tools[0]?.name;
    }
  }

  if (!resolvedTool) return null;

  const callRes = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId + 1,
        method: 'tools/call',
        params: {
          name: resolvedTool,
          arguments: { command: message },
        },
      }),
    },
    10000
  );

  if (!callRes.ok) return null;
  const callData = await callRes.json();
  const content = callData?.result?.content || [];
  const text = content.map((item: any) => item?.text).filter(Boolean).join('\n');
  if (!text) return null;
  return { text, tool: resolvedTool };
}

async function callMcpServer(
  baseUrl: string,
  message: string,
  toolName?: string
): Promise<{ text: string; tool: string } | null> {
  return callFastworkflow(baseUrl, message, toolName);
}

export const POST = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, chatSchema);
    if ('error' in validation) return validation.error;

    const org = await ctx.db.organization.findUnique({
      where: { id: ctx.tenant.organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const mcp = settings.mcp || {};
    const fastworkflowEnabled = mcp.fastworkflowEnabled ?? true;
    const fastworkflowUrl = mcp.fastworkflowUrl as string | undefined;
    const fastworkflowToolName = mcp.fastworkflowToolName as string | undefined;
    const mcpServerUrl = validation.data.mcpServerUrl || (mcp.mcpServerUrl as string | undefined);

    const preferredSource = validation.data.preferredSource || 'auto';
    const enrichedMessage = validation.data.context
      ? `${validation.data.message}\n\nContext:\n${validation.data.context}`
      : validation.data.message;

    if (preferredSource === 'mcp') {
      if (!mcpServerUrl) {
        return errorResponse('MCP_NOT_CONFIGURED', 'MCP server URL is not configured', 400);
      }
      const result = await callMcpServer(mcpServerUrl, enrichedMessage);
      if (result) {
        return successResponse({
          response: result.text,
          source: 'mcp',
          tool: result.tool,
        });
      }
      return errorResponse('MCP_NO_RESPONSE', 'MCP server returned no response', 502);
    }

    if (preferredSource === 'fastworkflow' || preferredSource === 'auto') {
      if (fastworkflowEnabled && fastworkflowUrl) {
        try {
          const result = await callFastworkflow(fastworkflowUrl, enrichedMessage, fastworkflowToolName);
          if (result) {
            return successResponse({
              response: result.text,
              source: 'fastworkflow',
              tool: result.tool,
            });
          }
        } catch {
          // Fall back to knowledge base
        }
      } else if (preferredSource === 'fastworkflow') {
        return errorResponse('FASTWORKFLOW_NOT_CONFIGURED', 'Fastworkflow is not configured', 400);
      }
    }

    if (preferredSource === 'knowledge' || preferredSource === 'auto') {
      const match = searchKnowledge(validation.data.message);
      if (match) {
        return successResponse({
          response: match.answer,
          source: 'knowledge',
          links: match.links || [],
          title: match.title,
        });
      }
    }

    const match = searchKnowledge(validation.data.message);
    if (match) {
      return successResponse({
        response: match.answer,
        source: 'knowledge',
        links: match.links || [],
        title: match.title,
      });
    }

    return errorResponse(
      'NO_MATCH',
      'No direct match found. Try a more specific Kubernetes or Helm command.',
      404
    );
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
