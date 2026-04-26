import type { IncomingMessage } from 'node:http';
import { decode } from 'next-auth/jwt';

export type WebSocketRole = 'USER' | 'READWRITE' | 'ADMIN';

export type VerifiedWebSocketSession = {
  valid: true;
  userId: string;
  organizationId: string;
  role: WebSocketRole;
};

export type InvalidWebSocketSession = {
  valid: false;
  reason: string;
};

export type WebSocketSessionVerification = VerifiedWebSocketSession | InvalidWebSocketSession;

const SESSION_COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'] as const;
const ORG_COOKIE_NAME = 'organization-id';

export async function verifyWebSocketSession(
  req: IncomingMessage,
): Promise<WebSocketSessionVerification> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return authFailure('missing AUTH_SECRET');
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieName = pickCookieName(cookies);
  if (!cookieName) {
    return authFailure('missing session cookie');
  }
  const token = readSessionToken(cookies, cookieName);
  if (!token) {
    return authFailure('empty session cookie');
  }

  // NextAuth v5 uses encrypted JWE; decode handles that. The salt is the cookie name.
  let payload: Record<string, unknown> | null;
  try {
    payload = (await decode({ token, secret, salt: cookieName })) as Record<string, unknown> | null;
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'decode failed';
    return authFailure(`session decode error: ${reason}`);
  }

  if (!payload) {
    return authFailure('invalid session token');
  }

  if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
    return authFailure('expired session token');
  }

  const userId = typeof payload.userId === 'string' && payload.userId.length > 0
    ? payload.userId
    : (typeof payload.sub === 'string' ? payload.sub : '');
  if (!userId) {
    return authFailure('missing userId claim');
  }

  const memberships = payload.memberships;
  if (!memberships || typeof memberships !== 'object') {
    return authFailure('missing memberships claim');
  }

  // Active org: query string overrides cookie (caller may target a non-default org).
  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryOrg = url.searchParams.get('orgId');
  const cookieOrg = cookies.get(ORG_COOKIE_NAME);
  const organizationId = (queryOrg && queryOrg.trim()) || (cookieOrg && cookieOrg.trim()) || '';
  if (!organizationId) {
    return authFailure('missing organization context');
  }

  const role = (memberships as Record<string, unknown>)[organizationId];
  if (!isWebSocketRole(role)) {
    return authFailure('not a member of organization');
  }

  return {
    valid: true,
    userId,
    organizationId,
    role,
  };
}

function pickCookieName(cookies: Map<string, string>): typeof SESSION_COOKIE_NAMES[number] | undefined {
  for (const name of SESSION_COOKIE_NAMES) {
    if (cookies.has(name) || hasChunkedCookie(cookies, name)) {
      return name;
    }
  }
  return undefined;
}

function readSessionToken(cookies: Map<string, string>, cookieName: string): string | undefined {
  const direct = cookies.get(cookieName);
  if (direct) return direct;

  const chunks: Array<{ index: number; value: string }> = [];
  for (const [name, value] of cookies.entries()) {
    if (!name.startsWith(`${cookieName}.`)) continue;
    const indexText = name.slice(cookieName.length + 1);
    const index = Number.parseInt(indexText, 10);
    if (Number.isInteger(index) && index >= 0) {
      chunks.push({ index, value });
    }
  }
  if (chunks.length === 0) return undefined;
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map((c) => c.value).join('');
}

function hasChunkedCookie(cookies: Map<string, string>, cookieName: string): boolean {
  for (const name of cookies.keys()) {
    if (name.startsWith(`${cookieName}.`)) return true;
  }
  return false;
}

function parseCookieHeader(header: string | string[] | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return cookies;

  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf('=');
    if (sep <= 0) continue;
    const name = trimmed.slice(0, sep);
    const rawValue = trimmed.slice(sep + 1);
    cookies.set(name, safeDecodeCookieValue(rawValue));
  }
  return cookies;
}

function safeDecodeCookieValue(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function isWebSocketRole(value: unknown): value is WebSocketRole {
  return value === 'USER' || value === 'READWRITE' || value === 'ADMIN';
}

function authFailure(reason: string): InvalidWebSocketSession {
  console.warn(`websocket auth failed: ${reason}`);
  return { valid: false, reason };
}
