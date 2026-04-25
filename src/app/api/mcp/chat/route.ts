import { withTenantApiHandler, successResponse, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';
import { searchKnowledge } from '@/lib/knowledge/portal-knowledge';
import { chatWithLLM, chatWithOllama, chatWithOllamaTools } from '@/lib/services/llm';
import { getAvailableTools, TOOL_PROVIDERS, executeTool, buildToolSystemPrompt } from '@/lib/tools';
import { isGrafanaConfigured } from '@/lib/services/grafana';
import { logger } from '@/lib/logger';

/**
 * Validate that a URL does not target internal/private network addresses (SSRF protection).
 */
function isExternalUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    // Block private/internal ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('192.168.') ||
      hostname === 'metadata.google.internal' ||
      hostname === '169.254.169.254' // cloud metadata
    ) {
      return false;
    }
    // Block non-http(s) schemes
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.string().max(2000).optional(),
  preferredSource: z.enum(['auto', 'fastworkflow', 'mcp', 'knowledge', 'llm', 'ollama', 'tools']).optional(),
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

    // MCP server routing
    if (preferredSource === 'mcp') {
      if (!mcpServerUrl) {
        return errorResponse('MCP_NOT_CONFIGURED', 'MCP server URL is not configured', 400);
      }
      // SSRF protection: block requests to internal/private network addresses
      if (!isExternalUrl(mcpServerUrl)) {
        return errorResponse('MCP_INVALID_URL', 'MCP server URL must be an external HTTPS/HTTP endpoint', 400);
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

    // Direct Ollama routing (in-cluster, no credentials needed)
    if (preferredSource === 'ollama') {
      const ollamaUrl = (settings.ollama?.url as string) || process.env.OLLAMA_URL;
      const ollamaModel = settings.ollama?.model as string | undefined;
      const ollamaResponse = await chatWithOllama(
        [{ role: 'user', content: enrichedMessage }],
        ollamaUrl,
        ollamaModel
      );
      if (ollamaResponse) {
        return successResponse({
          response: ollamaResponse,
          source: 'ollama',
        });
      }
      return errorResponse(
        'OLLAMA_UNAVAILABLE',
        'Ollama is not reachable. Check that Ollama is deployed in the cluster.',
        502
      );
    }

    // Tool-calling mode: Ollama + live data tools
    if (preferredSource === 'tools') {
      const ollamaUrl = (settings.ollama?.url as string) || process.env.OLLAMA_URL;
      const ollamaModel = settings.ollama?.model as string | undefined;

      // Detect which providers are configured
      const configuredProviders = new Set<string>();
      try {
        // ArgoCD — check if credentials/settings exist
        const argoSettings = settings.argocd || {};
        if (argoSettings.credentialId || settings.argocdUrl) {
          configuredProviders.add('argocd');
        }
        // Also try the integration credentials table
        const argoCreds = await ctx.db.integrationCredential.findFirst({
          where: { organizationId: ctx.tenant.organizationId, provider: 'ARGOCD' },
          select: { id: true },
        });
        if (argoCreds) configuredProviders.add('argocd');
      } catch { /* not configured */ }

      try {
        const grafanaReady = await isGrafanaConfigured(ctx.tenant.organizationId);
        if (grafanaReady) configuredProviders.add('grafana');
      } catch { /* not configured */ }

      try {
        const ghCreds = await ctx.db.integrationCredential.findFirst({
          where: { organizationId: ctx.tenant.organizationId, provider: 'GITHUB' },
          select: { id: true },
        });
        if (ghCreds || process.env.GITHUB_TOKEN) configuredProviders.add('github');
      } catch { /* not configured */ }

      try {
        const clusters = await ctx.db.cluster.count({
          where: { organizationId: ctx.tenant.organizationId },
        });
        if (clusters > 0) configuredProviders.add('kubernetes');
      } catch { /* not configured */ }

      const tools = getAvailableTools(configuredProviders);
      const systemPrompt = buildToolSystemPrompt(configuredProviders);

      const toolCtx = {
        orgId: ctx.tenant.organizationId,
        userId: ctx.tenant.userId,
        db: ctx.db,
      };

      try {
        const result = await chatWithOllamaTools(
          [{ role: 'user', content: enrichedMessage }],
          tools,
          (name, args) => executeTool(name, args, toolCtx),
          { systemPrompt, ollamaUrl, model: ollamaModel }
        );

        if (result.text) {
          // Map tool names to provider badges
          const toolBadges = [...new Set(result.toolsUsed.map((t) => TOOL_PROVIDERS[t]).filter(Boolean))];
          return successResponse({
            response: result.text,
            source: 'ollama',
            tools_used: toolBadges,
          });
        }
        return errorResponse(
          'TOOLS_FAILED',
          'Tool-calling failed. Ollama may be unreachable or the model does not support function calling.',
          502
        );
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Tool-calling route error');
        return errorResponse(
          'TOOLS_ERROR',
          `Tool-calling error: ${(error as Error).message}`,
          500
        );
      }
    }

    // Direct LLM routing
    if (preferredSource === 'llm') {
      const llmResponse = await chatWithLLM(
        [{ role: 'user', content: enrichedMessage }],
        ctx.tenant.organizationId,
        ctx.db
      );
      if (llmResponse) {
        return successResponse({
          response: llmResponse,
          source: 'llm',
        });
      }
      return errorResponse(
        'LLM_NOT_CONFIGURED',
        'LLM is not configured. Add an LLM account in Settings > Integrations.',
        400
      );
    }

    // Fastworkflow routing
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
          // Fall through to next source
        }
      } else if (preferredSource === 'fastworkflow') {
        return errorResponse('FASTWORKFLOW_NOT_CONFIGURED', 'Fastworkflow is not configured', 400);
      }
    }

    // Auto mode: try Ollama (in-cluster) → cloud LLM after fastworkflow
    if (preferredSource === 'auto') {
      // Try Ollama first if it's configured/available
      const ollamaEnabled = settings.ollama?.enabled !== false;
      if (ollamaEnabled) {
        const ollamaUrl = (settings.ollama?.url as string) || process.env.OLLAMA_URL;
        const ollamaModel = settings.ollama?.model as string | undefined;
        try {
          const ollamaResponse = await chatWithOllama(
            [{ role: 'user', content: enrichedMessage }],
            ollamaUrl,
            ollamaModel
          );
          if (ollamaResponse) {
            return successResponse({
              response: ollamaResponse,
              source: 'ollama',
            });
          }
        } catch {
          // Fall through to cloud LLM
        }
      }

      // Fall back to cloud LLM
      const llmResponse = await chatWithLLM(
        [{ role: 'user', content: enrichedMessage }],
        ctx.tenant.organizationId,
        ctx.db
      );
      if (llmResponse) {
        return successResponse({
          response: llmResponse,
          source: 'llm',
        });
      }
    }

    // Knowledge base (explicit or fallback)
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

    // Final fallback
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
  { rateLimit: 'general', requiredRole: 'USER', requiredFeature: 'mcp' }
);
