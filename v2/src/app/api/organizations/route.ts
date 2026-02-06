// =============================================================================
// Organizations API - List user's organizations
// =============================================================================

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, unauthorizedError, serverError } from '@/lib/api';

/**
 * GET /api/organizations
 * List all organizations the current user belongs to
 * This endpoint doesn't require organization context
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return unauthorizedError();
    }
    
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
      orderBy: {
        organization: {
          name: 'asc',
        },
      },
    });
    
    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logoUrl: m.organization.logoUrl,
      role: m.role,
      joinedAt: m.createdAt,
    }));
    
    return successResponse(organizations);
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return serverError('Failed to fetch organizations');
  }
}
