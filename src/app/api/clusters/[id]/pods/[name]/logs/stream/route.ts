import { NextResponse } from 'next/server';
import { withTenantApiHandler, errorResponse } from '@/lib/api';
import { getClusterOrThrow } from '@/app/api/clusters/utils';
import { loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
import * as k8s from '@kubernetes/client-node';

/**
 * GET /api/clusters/[id]/pods/[name]/logs/stream
 *
 * Server-Sent Events stream of pod logs (follow=true).
 *
 * Query params:
 * - namespace (required)
 * - container (optional; defaults to first container)
 * - tailLines (optional; defaults to 200)
 *
 * Each log line becomes a single SSE `data: ...\n\n` chunk.
 * The stream ends when the client disconnects (request.signal.abort) or when
 * the upstream pod log stream ends.
 */
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const clusterId = segments[segments.indexOf('clusters') + 1];
    const podName = segments[segments.indexOf('pods') + 1];
    if (!clusterId || !podName) {
      return errorResponse('VALIDATION_ERROR', 'cluster id and pod name are required', 400);
    }

    const namespace = url.searchParams.get('namespace');
    if (!namespace) {
      return errorResponse('VALIDATION_ERROR', 'namespace query param is required', 400);
    }
    const container = url.searchParams.get('container') || undefined;
    const tailLines = parseInt(url.searchParams.get('tailLines') || '200', 10);

    const cluster = await getClusterOrThrow(ctx, clusterId);
    const kubeConfig = await loadKubeConfigFromClusterAsync({
      id: cluster.id,
      name: cluster.name,
      kubeconfig: cluster.kubeconfig,
      config: cluster.config,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: string) => {
          // Each line as its own data: chunk; multiple `data:` lines for multi-line logs are valid SSE.
          for (const line of data.split('\n')) {
            controller.enqueue(encoder.encode(`data: ${line}\n`));
          }
          controller.enqueue(encoder.encode('\n'));
        };

        // Send a heartbeat comment every 25s so proxies don't time out the connection.
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
          }
        }, 25_000);

        const log = new k8s.Log(kubeConfig);
        // Use a writable stream that pushes chunks to the SSE controller.
        const { Writable } = await import('node:stream');
        const sink = new Writable({
          write(chunk, _enc, cb) {
            try {
              sendEvent(chunk.toString('utf8'));
              cb();
            } catch (err) {
              cb(err as Error);
            }
          },
        });

        // Abort the upstream log stream when the client disconnects.
        const abort = new AbortController();
        request.signal.addEventListener('abort', () => abort.abort());

        try {
          // log() resolves when the stream ends (or rejects on error).
          await new Promise<void>((resolve, reject) => {
            log.log(
              namespace,
              podName,
              container || '',
              sink as any,
              (err) => {
                if (err) reject(err);
                else resolve();
              },
              { follow: true, tailLines, timestamps: true },
            );
            abort.signal.addEventListener('abort', () => {
              sink.destroy();
              resolve();
            });
          });
        } catch (err) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${(err as Error).message.replace(/\n/g, ' ')}\n\n`),
          );
        } finally {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch { /* already closed */ }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);
