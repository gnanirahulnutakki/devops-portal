import { NextResponse } from 'next/server';
import { withTenantApiHandler, errorResponse, validateRequest } from '@/lib/api';
import { z } from 'zod';

const executeSchema = z.object({
  agent_name: z.string().min(1),
  adapter_name: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
});

const GATEWAY_TIMEOUT_MS = 90_000;

export const POST = withTenantApiHandler(
  async (request, _ctx) => {
    const validation = await validateRequest(request, executeSchema);
    if ('error' in validation) return validation.error;

    const gatewayBase = process.env.PROTOCOL_GATEWAY_URL?.trim();
    if (!gatewayBase) {
      return errorResponse(
        'PROTOCOL_GATEWAY_NOT_CONFIGURED',
        'PROTOCOL_GATEWAY_URL is not set',
        500
      );
    }

    const token = process.env.PROTOCOL_GATEWAY_TOKEN ?? '';
    const { agent_name, adapter_name, params } = validation.data;

    const executeUrl = new URL('/execute', gatewayBase.endsWith('/') ? gatewayBase : `${gatewayBase}/`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const upstream = await fetch(executeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ agent_name, adapter_name, params }),
        signal: controller.signal,
      });

      const body = await upstream.arrayBuffer();
      const contentType = upstream.headers.get('content-type') ?? 'application/json';

      return new NextResponse(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'content-type': contentType,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse('PROTOCOL_GATEWAY_TIMEOUT', 'Gateway request timed out after 90 seconds', 504);
      }
      return errorResponse(
        'PROTOCOL_GATEWAY_REQUEST_FAILED',
        error instanceof Error ? error.message : 'Failed to reach protocol gateway',
        502
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
