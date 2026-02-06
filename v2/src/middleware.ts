// =============================================================================
// Next.js Middleware - Organization Enforcement with Membership Validation
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Paths that don't require organization context
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/health',
  '/_next',
  '/favicon.ico',
];

// Paths that require auth but not organization context
const ORG_OPTIONAL_PATHS = [
  '/api/organizations',
  '/select-organization',
];

// JWT token type with memberships
interface TokenWithMemberships {
  userId: string;
  memberships?: Record<string, string>; // { orgId: role }
  membershipsUpdatedAt?: number;
}

/**
 * Validate organization membership from JWT token
 * Returns the user's role if valid, null if not a member
 */
function validateMembership(
  token: TokenWithMemberships,
  organizationId: string
): string | null {
  if (!token.memberships) return null;
  return token.memberships[organizationId] || null;
}

/**
 * Organization enforcement middleware
 * 
 * SECURITY: This middleware:
 * 1. Validates authentication via JWT
 * 2. Validates organization membership from JWT claims (no DB call needed)
 * 3. Rejects requests to organizations user doesn't belong to
 * 4. Adds validated context to request headers
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get session token with memberships
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  }) as TokenWithMemberships | null;

  // Redirect to login if not authenticated
  if (!token || !token.userId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Skip organization validation for org-optional paths
  if (ORG_OPTIONAL_PATHS.some((path) => pathname.startsWith(path))) {
    // Still add user context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.userId);
    requestHeaders.set('x-request-id', crypto.randomUUID());
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Get organization ID from header or cookie
  const organizationId =
    request.headers.get('x-organization-id') ||
    request.cookies.get('organization-id')?.value;

  // For API routes, require and validate organization
  if (pathname.startsWith('/api/')) {
    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ORGANIZATION_REQUIRED',
            message: 'x-organization-id header is required',
          },
        },
        { status: 400 }
      );
    }

    // CRITICAL: Validate membership from JWT claims
    const userRole = validateMembership(token, organizationId);
    if (!userRole) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization',
          },
        },
        { status: 403 }
      );
    }

    // Clone request headers and add validated organization context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-organization-id', organizationId);
    requestHeaders.set('x-user-id', token.userId);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-request-id', crypto.randomUUID());

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For page routes, redirect to org selection if no org selected
  if (!organizationId) {
    const selectOrgUrl = new URL('/select-organization', request.url);
    selectOrgUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(selectOrgUrl);
  }

  // CRITICAL: Validate membership for page routes too
  const userRole = validateMembership(token, organizationId);
  if (!userRole) {
    // Clear invalid org cookie and redirect to selection
    const selectOrgUrl = new URL('/select-organization', request.url);
    selectOrgUrl.searchParams.set('callbackUrl', pathname);
    selectOrgUrl.searchParams.set('error', 'invalid_org');
    const response = NextResponse.redirect(selectOrgUrl);
    response.cookies.delete('organization-id');
    return response;
  }

  // Add organization ID to response cookies for persistence
  const response = NextResponse.next();
  response.cookies.set('organization-id', organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
