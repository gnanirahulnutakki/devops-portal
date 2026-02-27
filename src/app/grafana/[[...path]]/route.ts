import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getGrafanaCredentials } from '@/lib/services/integration-credentials';

export const runtime = 'nodejs';

const GRAFANA_PROXY_PREFIX = '/grafana';

function stripHopByHopHeaders(headers: Headers) {
  // https://www.rfc-editor.org/rfc/rfc7230#section-6.1
  const hopByHop = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'host',
  ];
  hopByHop.forEach((h) => headers.delete(h));
}

function rewriteLocationHeader(location: string, baseUrl: string) {
  try {
    const loc = new URL(location, baseUrl);
    const base = new URL(baseUrl);
    // If redirect points back to grafana origin, rewrite to proxy prefix.
    if (loc.origin === base.origin) {
      return `${GRAFANA_PROXY_PREFIX}${loc.pathname}${loc.search}${loc.hash}`;
    }
    return location;
  } catch {
    return location;
  }
}

function rewriteGrafanaHtml(html: string) {
  // Make Grafana behave as if it's hosted under /grafana.
  // This keeps all subsequent SPA navigation and API calls routed through this proxy.

  // Base href (covers relative urls)
  html = html.replace(/<base\s+href="\/"\s*\/?>/i, `<base href="${GRAFANA_PROXY_PREFIX}/" />`);

  // Grafana boot data uses appSubUrl to build URLs.
  html = html.replace(/"appSubUrl"\s*:\s*""/g, `"appSubUrl":"${GRAFANA_PROXY_PREFIX}"`);
  html = html.replace(/"appSubUrl"\s*:\s*"\/"/g, `"appSubUrl":"${GRAFANA_PROXY_PREFIX}"`);

  // Rewrite absolute asset URLs in HTML to include /grafana prefix.
  // (base href doesn't affect root-absolute paths)
  html = html.replace(/(src|href)="\/public\//g, `$1="${GRAFANA_PROXY_PREFIX}/public/`);
  html = html.replace(/(src|href)="\/build\//g, `$1="${GRAFANA_PROXY_PREFIX}/build/`);

  return html;
}

async function getOrgAndCreds(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } }, { status: 401 });
  }

  // Prefer org header for XHR calls, fallback to cookie for iframe navigation.
  const organizationId = request.headers.get('x-organization-id') || request.cookies.get('organization-id')?.value;
  if (!organizationId) {
    return NextResponse.json(
      { error: { code: 'ORGANIZATION_REQUIRED', message: 'Organization required' } },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId,
      },
    },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'No access to organization' } }, { status: 403 });
  }

  const url = new URL(request.url);
  const credentialIdFromQuery = url.searchParams.get('credentialId') || undefined;

  // Fall back to org settings grafana.credentialId
  let effectiveCredentialId = credentialIdFromQuery;
  if (!effectiveCredentialId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    effectiveCredentialId = settings?.grafana?.credentialId || undefined;
  }

  const creds = await getGrafanaCredentials(organizationId, { credentialId: effectiveCredentialId });
  if (!creds) {
    return NextResponse.json(
      { error: { code: 'GRAFANA_NOT_CONFIGURED', message: 'Grafana is not configured for this organization' } },
      { status: 400 }
    );
  }

  return { organizationId, membershipRole: membership.role, credentialId: effectiveCredentialId, creds };
}

async function proxy(request: NextRequest) {
  const incomingPathname = new URL(request.url).pathname;
  console.log(`[grafana-proxy] ${request.method} ${incomingPathname}`);

  const authz = await getOrgAndCreds(request);
  if (authz instanceof NextResponse) {
    console.log(`[grafana-proxy] AUTH FAILED for ${incomingPathname}: status=${(authz as any).status}`);
    return authz;
  }

  const { creds } = authz;
  const baseUrl = creds.url.replace(/\/$/, '');

  const incomingUrl = new URL(request.url);
  const pathname = incomingUrl.pathname;

  // Strip /grafana prefix to get the upstream path.
  let upstreamPath = pathname.startsWith(GRAFANA_PROXY_PREFIX)
    ? pathname.slice(GRAFANA_PROXY_PREFIX.length)
    : pathname;
  if (!upstreamPath) upstreamPath = '/';

  const upstreamUrl = new URL(baseUrl + upstreamPath);

  // Copy query params, but do not forward credentialId upstream.
  incomingUrl.searchParams.forEach((value, key) => {
    if (key === 'credentialId') return;
    upstreamUrl.searchParams.set(key, value);
  });

  const headers = new Headers(request.headers);
  stripHopByHopHeaders(headers);

  // Never forward portal cookies upstream.
  headers.delete('cookie');

  // Inject Grafana service account token.
  headers.set('Authorization', `Bearer ${creds.apiKey}`);
  headers.set('Accept', headers.get('Accept') || '*/*');

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  console.log(`[grafana-proxy] → upstream ${method} ${upstreamUrl.pathname}`);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl.toString(), {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
      // @ts-expect-error node fetch streaming
      duplex: hasBody ? 'half' : undefined,
      cache: 'no-store',
    });
  } catch (err: any) {
    console.error(`[grafana-proxy] FETCH ERROR for ${upstreamUrl.pathname}: ${err.message}`);
    return NextResponse.json({ error: 'Upstream fetch failed', detail: err.message }, { status: 502 });
  }

  console.log(`[grafana-proxy] ← upstream ${upstreamRes.status} ${upstreamUrl.pathname} (${upstreamRes.headers.get('content-type') || 'unknown'})`);

  const resHeaders = new Headers(upstreamRes.headers);
  stripHopByHopHeaders(resHeaders);

  const loc = resHeaders.get('location');
  if (loc) resHeaders.set('location', rewriteLocationHeader(loc, baseUrl));

  // Prevent Grafana from setting cookies on the portal domain.
  // Auth should always be via injected Bearer token.
  resHeaders.delete('set-cookie');

  // Strip upstream headers that break embedding inside the portal.
  resHeaders.delete('x-frame-options');
  resHeaders.delete('content-security-policy');
  resHeaders.delete('content-security-policy-report-only');

  const contentType = upstreamRes.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await upstreamRes.text();
    const rewritten = rewriteGrafanaHtml(text);
    resHeaders.set('content-type', contentType);
    resHeaders.set('cache-control', 'no-store');
    return new NextResponse(rewritten, { status: upstreamRes.status, headers: resHeaders });
  }

  return new NextResponse(upstreamRes.body, { status: upstreamRes.status, headers: resHeaders });
}

export async function GET(request: NextRequest) {
  return proxy(request);
}
export async function HEAD(request: NextRequest) {
  return proxy(request);
}
export async function POST(request: NextRequest) {
  return proxy(request);
}
export async function PUT(request: NextRequest) {
  return proxy(request);
}
export async function PATCH(request: NextRequest) {
  return proxy(request);
}
export async function DELETE(request: NextRequest) {
  return proxy(request);
}

