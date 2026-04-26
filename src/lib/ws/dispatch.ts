import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { closeAllPodExecSessions, handlePodExecUpgrade } from './pod-exec';

export type PodExecRouteParams = {
  clusterId: string;
  podName: string;
};

const K8S_DNS_SUBDOMAIN_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const CLUSTER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export async function dispatchWebSocketUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  const match = matchPodExecPath(req.url);
  if (!match) {
    socket.destroy();
    return;
  }

  await handlePodExecUpgrade(req, socket, head, match);
}

export async function closeAllWebSocketConnections(
  code = 1001,
  reason = 'Server shutting down',
): Promise<void> {
  await closeAllPodExecSessions(code, reason);
}

function matchPodExecPath(rawUrl: string | undefined): PodExecRouteParams | null {
  let pathname: string;

  try {
    pathname = new URL(rawUrl ?? '/', 'http://localhost').pathname;
  } catch {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (
    segments.length !== 7 ||
    segments[0] !== 'api' ||
    segments[1] !== 'ws' ||
    segments[2] !== 'clusters' ||
    segments[4] !== 'pods' ||
    segments[6] !== 'exec'
  ) {
    return null;
  }

  const clusterId = decodePathSegment(segments[3]);
  const podName = decodePathSegment(segments[5]);

  if (!clusterId || !podName) return null;
  if (!CLUSTER_ID_PATTERN.test(clusterId)) return null;
  if (podName.length > 253 || !K8S_DNS_SUBDOMAIN_PATTERN.test(podName)) return null;

  return { clusterId, podName };
}

function decodePathSegment(segment: string): string | null {
  if (/%2f/i.test(segment) || /%5c/i.test(segment)) return null;

  try {
    const decoded = decodeURIComponent(segment);
    if (decoded.includes('/') || decoded.includes('\\')) return null;
    return decoded;
  } catch {
    return null;
  }
}
