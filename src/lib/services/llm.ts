import { getCredentials, LlmCredentials } from '@/lib/services/integration-credentials';
import { logger } from '@/lib/logger';

// Accept any Prisma-like client (including tenant extensions)
interface PrismaLike {
  organization: {
    findUnique: (args: any) => Promise<any>;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are the DevOps Portal assistant. You help with Kubernetes, ArgoCD, Grafana, GitHub, Helm, and deployment questions. Be concise and actionable. When providing commands, use code blocks.`;

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
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
    headers['Authorization'] = `Bearer ${creds.apiKey}`;

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
