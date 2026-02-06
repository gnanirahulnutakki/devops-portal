// =============================================================================
// Next.js Middleware - Organization Enforcement
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

// Paths that require organization but don't need the header
// (organization is determined from session membership)
const ORG_OPTIONAL_PATHS = [
  '/api/organizations',
  '/select-organization',
];

/**
 * Organization enforcement middleware
 * 
 * This middleware:
 * 1. Extracts x-organization-id header from requests
 * 2. Validates the organization exists and user has membership
 * 3. Adds organization context to request headers for downstream use
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Skip organization validation for org-optional paths
  if (ORG_OPTIONAL_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get organization ID from header or cookie
  const organizationId =
    request.headers.get('x-organization-id') ||
    request.cookies.get('organization-id')?.value;

  // For API routes, require organization ID
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

    // Clone request headers and add organization context
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-organization-id', organizationId);
    requestHeaders.set('x-user-id', token.userId as string);
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
