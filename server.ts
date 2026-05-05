import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import next from 'next';

import { closeAllWebSocketConnections, dispatchWebSocketUpgrade } from './src/lib/ws/dispatch';

const dev = process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`server: invalid PORT: ${process.env.PORT ?? '3000'}`);
}

const app = next({ dev, port });
const handle = app.getRequestHandler();

let shuttingDown = false;

async function main(): Promise<void> {
  await app.prepare();

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    handle(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`server: request handler failed: ${message}`);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } else {
        res.end();
      }
    });
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = getPathname(req.url);

    if (!pathname.startsWith('/api/ws/')) {
      socket.destroy();
      return;
    }

    dispatchWebSocketUpgrade(req, socket, head).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`server: websocket upgrade dispatch failed: ${message}`);
      socket.destroy();
    });
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`server: received ${signal}, shutting down`);

    const forcedExit = setTimeout(() => {
      console.error('server: graceful shutdown timed out');
      process.exit(1);
    }, 10_000);
    forcedExit.unref();

    try {
      await closeAllWebSocketConnections(1001, 'Server shutting down');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`server: websocket shutdown failed: ${message}`);
    }

    httpServer.close((error?: Error) => {
      clearTimeout(forcedExit);
      if (error) {
        console.error(`server: http shutdown failed: ${error.message}`);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  httpServer.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

function getPathname(rawUrl: string | undefined): string {
  try {
    return new URL(rawUrl ?? '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`server: startup failed: ${message}`);
  process.exit(1);
});
