import { Exec } from '@kubernetes/client-node';
import { PrismaClient } from '@prisma/client';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

// Stub: @kubernetes/client-node 1.x doesn't export TerminalSizeQueue. Resize
// is best-effort; applyResize() detects whether the runtime exposes a push or
// resize method and gracefully reports "Resize ignored" if neither is found.
class TerminalSizeQueue {}
import { PassThrough } from 'node:stream';
import { WebSocketServer, WebSocket, type RawData } from 'ws';

import { loadKubeConfigFromClusterAsync } from '@/lib/services/kubernetes';
import type { PodExecRouteParams } from './dispatch';
import { verifyWebSocketSession, type VerifiedWebSocketSession } from './auth';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_K8S_BYTES_PER_SESSION = 10 * 1024 * 1024;
const MAX_SESSIONS_PER_USER = 5;
const CLIENT_WS_MAX_PAYLOAD_BYTES = 1024 * 1024;
const MAX_CONTROL_MESSAGE_BYTES = 4096;

const NAMESPACE_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const CONTAINER_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const ALLOWED_COMMANDS = ['/bin/sh', '/bin/bash', 'sh', 'bash'] as const;

type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

type ValidatedExecQuery = {
  namespace: string;
  container: string | undefined;
  command: AllowedCommand;
};

type QueryValidationResult =
  | { ok: true; value: ValidatedExecQuery }
  | { ok: false; reason: string };

type ExecWithTerminalSize = {
  exec(
    namespace: string,
    podName: string,
    containerName: string | undefined,
    command: string[],
    stdout: NodeJS.WritableStream | null,
    stderr: NodeJS.WritableStream | null,
    stdin: NodeJS.ReadableStream | null,
    tty: boolean,
    statusCallback?: (status: unknown) => void,
    terminalSizeQueue?: unknown,
  ): Promise<unknown>;
};

type KubernetesExecSocket = {
  close: (code?: number, reason?: string) => void;
  terminate?: () => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => KubernetesExecSocket;
  readyState?: number;
};

type TerminalResizeSink = {
  push?: (size: { Width: number; Height: number }) => void;
  resize?: (cols: number, rows: number) => void;
};

type ClientStatusMessage = {
  type: 'status';
  status: 'opening' | 'connected' | 'closed' | 'error' | 'kubernetes_status';
  message?: string;
  reason?: string;
  source?: 'server' | 'kubernetes';
  code?: number;
  metadata?: Record<string, unknown>;
};

const activeSessionsByUser = new Map<string, number>();
const activeClientSockets = new Set<WebSocket>();

export async function handlePodExecUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  params: PodExecRouteParams,
): Promise<void> {
  const session = await verifyWebSocketSession(req);
  if (!session.valid) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!canOpenPodExec(session)) {
    console.warn('pod-exec: rejected upgrade: insufficient role');
    sendHttpUpgradeError(socket, 403, 'Forbidden');
    return;
  }

  const query = validateExecQuery(req.url);
  if (!query.ok) {
    console.warn(`pod-exec: rejected upgrade: ${query.reason}`);
    sendHttpUpgradeError(socket, 400, 'Bad Request');
    return;
  }

  if (!acquireUserSession(session.userId)) {
    console.warn('pod-exec: rejected upgrade: concurrent session limit exceeded');
    sendHttpUpgradeError(socket, 429, 'Too Many Requests');
    return;
  }

  const prisma = new PrismaClient();
  let upgraded = false;

  try {
    const cluster = await prisma.cluster.findUnique({
      where: {
        id_organizationId: {
          id: params.clusterId,
          organizationId: session.organizationId,
        },
      },
    });

    if (!cluster) {
      sendHttpUpgradeError(socket, 404, 'Not Found');
      return;
    }

    const kubeConfig = await loadKubeConfigFromClusterAsync(cluster);
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: CLIENT_WS_MAX_PAYLOAD_BYTES,
    });

    wss.handleUpgrade(req, socket, head, (ws) => {
      upgraded = true;
      void bridgePodExec({
        ws,
        wss,
        prisma,
        session,
        clusterId: params.clusterId,
        podName: params.podName,
        namespace: query.value.namespace,
        container: query.value.container,
        command: query.value.command,
        kubeConfig,
      });
    });
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('prepare upgrade', error);
    console.error(wrapped.message);
    if (!socket.destroyed) {
      sendHttpUpgradeError(socket, 500, 'Internal Server Error');
    }
  } finally {
    if (!upgraded) {
      releaseUserSession(session.userId);
      await disconnectPrisma(prisma);
    }
  }
}

export async function closeAllPodExecSessions(
  code = 1001,
  reason = 'Server shutting down',
): Promise<void> {
  const sockets = Array.from(activeClientSockets);

  for (const ws of sockets) {
    closeClientWebSocket(ws, code, reason);
  }

  await Promise.race([
    Promise.allSettled(sockets.map((ws) => waitForWebSocketClose(ws))),
    delay(5_000),
  ]);
}

async function bridgePodExec(input: {
  ws: WebSocket;
  wss: WebSocketServer;
  prisma: PrismaClient;
  session: VerifiedWebSocketSession;
  clusterId: string;
  podName: string;
  namespace: string;
  container: string | undefined;
  command: AllowedCommand;
  kubeConfig: ConstructorParameters<typeof Exec>[0];
}): Promise<void> {
  const {
    ws,
    wss,
    prisma,
    session,
    clusterId,
    podName,
    namespace,
    container,
    command,
    kubeConfig,
  } = input;

  const startedAt = Date.now();
  const resource = `cluster/${clusterId}/pod/${namespace}/${podName}/${container || 'default'}`;
  const stdinStream = new PassThrough();
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  const terminalSizeQueue = new TerminalSizeQueue();

  let finalized = false;
  let idleTimer: NodeJS.Timeout | undefined;
  let totalBytesFromK8s = 0;
  let k8sSocket: KubernetesExecSocket | undefined;

  const markActivity = (): void => {
    if (finalized) return;

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      sendStatus(ws, {
        type: 'status',
        status: 'closed',
        source: 'server',
        reason: 'idle_timeout',
        message: 'Pod exec session closed after 30 minutes of inactivity',
      });
      closeBoth(1000, 'Idle timeout');
    }, IDLE_TIMEOUT_MS);
    idleTimer.unref();
  };

  const closeBoth = (code: number, reason: string): void => {
    closeKubernetesSocket(k8sSocket);
    stdinStream.end();
    closeClientWebSocket(ws, code, reason);

    if (ws.readyState === WebSocket.CLOSED) {
      void finalize(reason);
    }
  };

  const finalize = async (reason: string): Promise<void> => {
    if (finalized) return;
    finalized = true;

    if (idleTimer) clearTimeout(idleTimer);
    activeClientSockets.delete(ws);
    closeKubernetesSocket(k8sSocket);
    stdinStream.destroy();
    stdoutStream.destroy();
    stderrStream.destroy();
    releaseUserSession(session.userId);

    const durationMs = Date.now() - startedAt;

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.userId,
          action: 'POD_EXEC_CLOSE',
          resource,
          success: true,
          metadata: {
            durationMs,
            reason,
            bytesFromK8s: totalBytesFromK8s,
          },
        },
      });
    } catch (error: unknown) {
      const wrapped = wrapPodExecError('audit close', error);
      console.error(wrapped.message);
    } finally {
      await disconnectPrisma(prisma);
      wss.close();
    }
  };

  activeClientSockets.add(ws);
  markActivity();

  ws.on('message', (data, isBinary) => {
    markActivity();

    if (isBinary) {
      const bytes = rawDataToBuffer(data);
      try {
        stdinStream.write(bytes);
      } catch (error: unknown) {
        const wrapped = wrapPodExecError('write stdin', error);
        console.error(wrapped.message);
        sendStatus(ws, {
          type: 'status',
          status: 'error',
          source: 'server',
          message: wrapped.message,
        });
        closeBoth(1011, 'Stdin write failed');
      }
      return;
    }

    handleControlMessage(ws, data, terminalSizeQueue, closeBoth, markActivity);
  });

  ws.on('close', () => {
    void finalize('client_close');
  });

  ws.on('error', (error: unknown) => {
    const wrapped = wrapPodExecError('client websocket error', error);
    console.error(wrapped.message);
    closeBoth(1011, 'Client websocket error');
  });

  stdoutStream.on('data', (chunk: Buffer) => {
    forwardKubernetesBytes(ws, chunk, 'stdout', markActivity, (reason) => closeBoth(1009, reason), {
      get totalBytesFromK8s() {
        return totalBytesFromK8s;
      },
      set totalBytesFromK8s(value: number) {
        totalBytesFromK8s = value;
      },
    });
  });

  stderrStream.on('data', (chunk: Buffer) => {
    forwardKubernetesBytes(ws, chunk, 'stderr', markActivity, (reason) => closeBoth(1009, reason), {
      get totalBytesFromK8s() {
        return totalBytesFromK8s;
      },
      set totalBytesFromK8s(value: number) {
        totalBytesFromK8s = value;
      },
    });
  });

  stdoutStream.on('error', (error: unknown) => {
    const wrapped = wrapPodExecError('stdout stream error', error);
    console.error(wrapped.message);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'kubernetes',
      message: wrapped.message,
    });
    closeBoth(1011, 'Kubernetes stdout error');
  });

  stderrStream.on('error', (error: unknown) => {
    const wrapped = wrapPodExecError('stderr stream error', error);
    console.error(wrapped.message);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'kubernetes',
      message: wrapped.message,
    });
    closeBoth(1011, 'Kubernetes stderr error');
  });

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: 'POD_EXEC_OPEN',
        resource,
        success: true,
        metadata: { command },
      },
    });
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('audit open', error);
    console.error(wrapped.message);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'server',
      message: wrapped.message,
    });
    closeBoth(1011, 'Audit logging failed');
    return;
  }

  try {
    sendStatus(ws, {
      type: 'status',
      status: 'opening',
      source: 'server',
      metadata: { namespace, podName, container: container ?? 'default', command },
    });

    const exec = new Exec(kubeConfig) as unknown as ExecWithTerminalSize;
    const execSocket = await exec.exec(
      namespace,
      podName,
      container,
      [command],
      stdoutStream,
      stderrStream,
      stdinStream,
      true,
      (status: unknown) => {
        const sanitizedStatus = sanitizeKubernetesStatus(status);
        const failure = isKubernetesFailureStatus(status);

        if (failure) {
          const wrapped = wrapPodExecError(
            'kubernetes status failure',
            extractKubernetesStatusMessage(status),
          );
          console.error(wrapped.message);
        }

        sendStatus(ws, {
          type: 'status',
          status: failure ? 'error' : 'kubernetes_status',
          source: 'kubernetes',
          metadata: sanitizedStatus,
        });

        markActivity();

        if (failure) {
          closeBoth(1011, 'Kubernetes exec failed');
        }
      },
      terminalSizeQueue,
    );

    k8sSocket = execSocket as KubernetesExecSocket;

    if (finalized) {
      closeKubernetesSocket(k8sSocket);
      return;
    }

    attachKubernetesSocketHandlers(k8sSocket, ws, markActivity, closeBoth);

    sendStatus(ws, {
      type: 'status',
      status: 'connected',
      source: 'server',
    });
    markActivity();
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('start kubernetes exec', error);
    console.error(wrapped.message);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'kubernetes',
      message: wrapped.message,
    });
    closeBoth(1011, 'Kubernetes exec failed');
  }
}

function validateExecQuery(rawUrl: string | undefined): QueryValidationResult {
  let url: URL;

  try {
    url = new URL(rawUrl ?? '/', 'http://localhost');
  } catch {
    return { ok: false, reason: 'invalid request url' };
  }

  const namespace = getSingleQueryParam(url.searchParams, 'namespace');
  if (!namespace) {
    return { ok: false, reason: 'missing namespace' };
  }
  if (namespace.duplicate) {
    return { ok: false, reason: 'duplicate namespace' };
  }
  if (!isValidNamespace(namespace.value)) {
    return { ok: false, reason: 'invalid namespace' };
  }

  const container = getOptionalSingleQueryParam(url.searchParams, 'container');
  if (container.duplicate) {
    return { ok: false, reason: 'duplicate container' };
  }
  if (container.value !== undefined && !isValidContainerName(container.value)) {
    return { ok: false, reason: 'invalid container' };
  }

  const commandParam = getOptionalSingleQueryParam(url.searchParams, 'command');
  if (commandParam.duplicate) {
    return { ok: false, reason: 'duplicate command' };
  }

  const command = commandParam.value ?? '/bin/sh';
  if (!isAllowedCommand(command)) {
    return { ok: false, reason: 'command not allowed' };
  }

  return {
    ok: true,
    value: {
      namespace: namespace.value,
      container: container.value,
      command,
    },
  };
}

function getSingleQueryParam(
  params: URLSearchParams,
  name: string,
): { value: string; duplicate: false } | { duplicate: true } | undefined {
  const values = params.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length > 1) return { duplicate: true };
  return { value: values[0], duplicate: false };
}

function getOptionalSingleQueryParam(
  params: URLSearchParams,
  name: string,
): { value: string | undefined; duplicate: boolean } {
  const result = getSingleQueryParam(params, name);
  if (!result) return { value: undefined, duplicate: false };
  if (result.duplicate) return { value: undefined, duplicate: true };
  return { value: result.value, duplicate: false };
}

function isValidNamespace(namespace: string): boolean {
  return (
    namespace.length >= 1 &&
    namespace.length <= 253 &&
    NAMESPACE_PATTERN.test(namespace)
  );
}

function isValidContainerName(container: string): boolean {
  return (
    container.length >= 1 &&
    container.length <= 63 &&
    CONTAINER_PATTERN.test(container)
  );
}

function isAllowedCommand(command: string): command is AllowedCommand {
  return (ALLOWED_COMMANDS as readonly string[]).includes(command);
}

function canOpenPodExec(session: VerifiedWebSocketSession): boolean {
  return session.role === 'READWRITE' || session.role === 'ADMIN';
}

function acquireUserSession(userId: string): boolean {
  const current = activeSessionsByUser.get(userId) ?? 0;
  if (current >= MAX_SESSIONS_PER_USER) return false;

  activeSessionsByUser.set(userId, current + 1);
  return true;
}

function releaseUserSession(userId: string): void {
  const current = activeSessionsByUser.get(userId) ?? 0;
  if (current <= 1) {
    activeSessionsByUser.delete(userId);
    return;
  }

  activeSessionsByUser.set(userId, current - 1);
}

function handleControlMessage(
  ws: WebSocket,
  data: RawData,
  terminalSizeQueue: TerminalSizeQueue,
  closeBoth: (code: number, reason: string) => void,
  markActivity: () => void,
): void {
  const buffer = rawDataToBuffer(data);
  if (buffer.byteLength > MAX_CONTROL_MESSAGE_BYTES) {
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'server',
      message: 'Control message too large',
    });
    closeBoth(1009, 'Control message too large');
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'server',
      message: 'Invalid control message JSON',
    });
    closeBoth(1003, 'Invalid control message');
    return;
  }

  if (!isResizeMessage(parsed)) {
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'server',
      message: 'Unsupported control message',
    });
    closeBoth(1003, 'Unsupported control message');
    return;
  }

  const applied = applyResize(terminalSizeQueue, parsed.cols, parsed.rows);
  if (!applied) {
    console.warn('pod-exec: resize ignored: kubernetes client resize queue unsupported');
    sendStatus(ws, {
      type: 'status',
      status: 'kubernetes_status',
      source: 'server',
      message: 'Resize ignored by server runtime',
    });
    return;
  }

  markActivity();
}

function isResizeMessage(value: unknown): value is { type: 'resize'; cols: number; rows: number } {
  if (!isRecord(value)) return false;
  if (value.type !== 'resize') return false;
  const { cols, rows } = value;
  if (typeof cols !== 'number' || !Number.isInteger(cols) || cols < 1 || cols > 1000) return false;
  if (typeof rows !== 'number' || !Number.isInteger(rows) || rows < 1 || rows > 1000) return false;
  return true;
}

function applyResize(
  terminalSizeQueue: TerminalSizeQueue,
  cols: number,
  rows: number,
): boolean {
  const sink = terminalSizeQueue as unknown as TerminalResizeSink;

  if (typeof sink.push === 'function') {
    sink.push({ Width: cols, Height: rows });
    return true;
  }

  if (typeof sink.resize === 'function') {
    sink.resize(cols, rows);
    return true;
  }

  return false;
}

function forwardKubernetesBytes(
  ws: WebSocket,
  chunk: Buffer,
  streamName: 'stdout' | 'stderr',
  markActivity: () => void,
  closeWithReason: (reason: string) => void,
  byteCounter: { totalBytesFromK8s: number },
): void {
  const projectedTotal = byteCounter.totalBytesFromK8s + chunk.byteLength;

  if (projectedTotal > MAX_K8S_BYTES_PER_SESSION) {
    console.warn(`pod-exec: ${streamName} byte limit exceeded`);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'server',
      message: 'Pod exec output limit exceeded',
      metadata: { limitBytes: MAX_K8S_BYTES_PER_SESSION },
    });
    closeWithReason('Output limit exceeded');
    return;
  }

  byteCounter.totalBytesFromK8s = projectedTotal;
  markActivity();

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(chunk, { binary: true }, (error?: Error) => {
      if (error) {
        const wrapped = wrapPodExecError(`send ${streamName}`, error);
        console.error(wrapped.message);
      }
    });
  }
}

function attachKubernetesSocketHandlers(
  k8sSocket: KubernetesExecSocket,
  ws: WebSocket,
  markActivity: () => void,
  closeBoth: (code: number, reason: string) => void,
): void {
  if (typeof k8sSocket.on !== 'function') return;

  k8sSocket.on('close', (...args: unknown[]) => {
    const code = typeof args[0] === 'number' ? args[0] : undefined;
    markActivity();
    sendStatus(ws, {
      type: 'status',
      status: 'closed',
      source: 'kubernetes',
      code,
      message: 'Kubernetes exec connection closed',
    });
    closeBoth(1000, 'Kubernetes exec closed');
    return k8sSocket;
  });

  k8sSocket.on('error', (...args: unknown[]) => {
    const error = args[0];
    const wrapped = wrapPodExecError('kubernetes websocket error', error);
    console.error(wrapped.message);
    sendStatus(ws, {
      type: 'status',
      status: 'error',
      source: 'kubernetes',
      message: wrapped.message,
    });
    closeBoth(1011, 'Kubernetes exec error');
    return k8sSocket;
  });
}

function sendStatus(ws: WebSocket, message: ClientStatusMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify(message), { binary: false });
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('send status', error);
    console.error(wrapped.message);
  }
}

function closeClientWebSocket(ws: WebSocket, code: number, reason: string): void {
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(code, reason.slice(0, 120));
  }
}

function closeKubernetesSocket(k8sSocket: KubernetesExecSocket | undefined): void {
  if (!k8sSocket) return;

  try {
    k8sSocket.close(1000, 'Client session closed');
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('close kubernetes websocket', error);
    console.error(wrapped.message);
  }
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  // Defensive fallback — RawData should be covered by the cases above.
  return Buffer.from(String(data));
}

function sanitizeKubernetesStatus(status: unknown): Record<string, unknown> {
  if (!isRecord(status)) {
    return { message: String(status) };
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of ['status', 'reason', 'message', 'code']) {
    const value = status[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function isKubernetesFailureStatus(status: unknown): boolean {
  if (!isRecord(status)) return false;
  return status.status === 'Failure';
}

function extractKubernetesStatusMessage(status: unknown): string {
  if (!isRecord(status)) return String(status);
  const message = status.message;
  if (typeof message === 'string' && message.length > 0) return message;
  const reason = status.reason;
  if (typeof reason === 'string' && reason.length > 0) return reason;
  return 'unknown kubernetes status failure';
}

function sendHttpUpgradeError(socket: Duplex, statusCode: number, reasonPhrase: string): void {
  if (socket.destroyed) return;

  socket.write(`HTTP/1.1 ${statusCode} ${reasonPhrase}\r\n\r\n`);
  socket.destroy();
}

function wrapPodExecError(context: string, error: unknown): Error {
  return new Error(`pod-exec: ${context}: ${toErrorMessage(error)}`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function disconnectPrisma(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error: unknown) {
    const wrapped = wrapPodExecError('disconnect prisma', error);
    console.error(wrapped.message);
  }
}

function waitForWebSocketClose(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    ws.once('close', () => resolve());
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}
