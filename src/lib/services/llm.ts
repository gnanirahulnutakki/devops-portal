import { getCredentials, LlmCredentials } from '@/lib/services/integration-credentials';
import { logger } from '@/lib/logger';
import type { ToolDefinition } from '@/lib/tools';

// Accept any Prisma-like client (including tenant extensions)
interface PrismaLike {
  organization: {
    findUnique: (args: any) => Promise<any>;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolChatResult {
  text: string | null;
  toolsUsed: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the DevOps Portal assistant. You help with Kubernetes, ArgoCD, Grafana, GitHub, Helm, and deployment questions. Be concise and actionable. When providing commands, use code blocks.`;

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  ollama: 'qwen2.5:3b',
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: process.env.OLLAMA_URL || 'http://ollama:11434/v1',
};

/**
 * Send messages to an OpenAI-compatible LLM endpoint.
 * Supports OpenAI, Anthropic (via messages-to-openai proxy), local models, etc.
 */
export async function chatWithLLM(
  messages: ChatMessage[],
  orgId: string,
  db: PrismaLike
): Promise<string | null> {
  // Resolve LLM credentials from organization settings
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  const settings = (org?.settings as any) || {};
  const credentialId = settings?.llm?.credentialId as string | undefined;

  const creds = await getCredentials<LlmCredentials>(orgId, 'LLM', { credentialId });
  if (!creds?.apiKey) {
    return null;
  }

  const provider = creds.provider || 'openai';
  const model = creds.model || DEFAULT_MODELS[provider] || 'gpt-4o';
  const baseUrl = creds.baseUrl || DEFAULT_BASE_URLS[provider] || 'https://api.openai.com/v1';

  // Build the full message list with system prompt
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Anthropic uses a different auth header
    if (provider === 'anthropic' && !creds.baseUrl) {
      headers['x-api-key'] = creds.apiKey;
      headers['anthropic-version'] = '2023-06-01';

      // Use native Anthropic API
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: DEFAULT_SYSTEM_PROMPT,
          messages: messages.map((m) => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, body: errorText }, 'Anthropic API error');
        return null;
      }

      const data = await response.json();
      return data.content?.[0]?.text || null;
    }

    // OpenAI-compatible endpoint (works with OpenAI, local models, Gemini via OpenAI compat)
    // Ollama doesn't need auth — skip the header for local providers
    if (provider !== 'ollama') {
      headers['Authorization'] = `Bearer ${creds.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: fullMessages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'LLM API error');
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    logger.error({ error: (error as Error).message, provider }, 'LLM call failed');
    return null;
  }
}

/**
 * Direct Ollama chat — bypasses credential lookup.
 * Used when the chat route explicitly targets Ollama (in-cluster, no API key needed).
 */
export async function chatWithOllama(
  messages: ChatMessage[],
  ollamaUrl?: string,
  model?: string
): Promise<string | null> {
  const baseUrl = ollamaUrl || process.env.OLLAMA_URL || 'http://ollama:11434/v1';
  const ollamaModel = model || DEFAULT_MODELS.ollama;

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: fullMessages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'Ollama API error');
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Ollama call failed');
    return null;
  }
}

/**
 * Ollama chat with tool-calling (function calling) support.
 *
 * Flow:
 *   1. Send messages + tool schemas to Ollama
 *   2. If Ollama returns tool_calls, execute each via the callback
 *   3. Append tool results as role:'tool' messages
 *   4. Call Ollama again for the final natural-language answer
 *   5. Repeat up to maxRounds to prevent infinite loops
 */
export async function chatWithOllamaTools(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  executeToolFn: (name: string, args: Record<string, unknown>) => Promise<string>,
  options?: {
    systemPrompt?: string;
    ollamaUrl?: string;
    model?: string;
    maxRounds?: number;
  }
): Promise<ToolChatResult> {
  const baseUrl = options?.ollamaUrl || process.env.OLLAMA_URL || 'http://ollama:11434/v1';
  const model = options?.model || DEFAULT_MODELS.ollama;
  const maxRounds = options?.maxRounds ?? 3;

  const conversationMessages: any[] = [
    { role: 'system', content: options?.systemPrompt || DEFAULT_SYSTEM_PROMPT },
    ...messages,
  ];

  const toolsUsed: string[] = [];

  for (let round = 0; round < maxRounds; round++) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: conversationMessages,
        max_tokens: 2048,
        temperature: 0.7,
      };

      // Only include tools on the first round or when there are tools available
      if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, body: errorText }, 'Ollama tools API error');
        return { text: null, toolsUsed };
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) {
        return { text: null, toolsUsed };
      }

      const message = choice.message;

      // If no tool calls, we have our final answer
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return { text: message.content || null, toolsUsed };
      }

      // Append the assistant message with tool_calls to conversation
      conversationMessages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function?.name;
        if (!fnName) continue;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        logger.info({ tool: fnName, args }, 'Executing tool call');
        toolsUsed.push(fnName);

        const result = await executeToolFn(fnName, args);

        // Append tool result for the next round
        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue to next round — Ollama will now see the tool results
    } catch (error) {
      logger.error({ error: (error as Error).message, round }, 'Ollama tool-calling round failed');
      return { text: null, toolsUsed };
    }
  }

  // If we exhausted all rounds, return whatever we have
  logger.warn({ maxRounds }, 'Tool-calling reached max rounds');
  return { text: 'I was unable to complete the request within the allowed number of steps.', toolsUsed };
}
