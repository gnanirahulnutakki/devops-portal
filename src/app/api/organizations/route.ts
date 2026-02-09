// =============================================================================
// Organizations API - List and create organizations
// =============================================================================

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, unauthorizedError, serverError, errorResponse } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

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

/**
 * POST /api/organizations
 * Create a new organization and add the current user as ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return unauthorizedError();
    }
    
    const body = await request.json();
    const { name, slug, description } = body;
    
    // Validate required fields
    if (!name || !slug) {
      return errorResponse('VALIDATION_ERROR', 'Name and slug are required', 400);
    }
    
    // Validate slug format (lowercase, alphanumeric, hyphens)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return errorResponse('VALIDATION_ERROR', 'Slug must be lowercase alphanumeric with hyphens only', 400);
    }
    
    // Check if slug already exists
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });
    
    if (existing) {
      return errorResponse('CONFLICT', 'An organization with this slug already exists', 409);
    }
    
    // Create organization and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          description: description || null,
        },
      });
      
      // Add the creating user as ADMIN
      await tx.membership.create({
        data: {
          userId: session.user.id,
          organizationId: organization.id,
          role: 'ADMIN',
        },
      });
      
      return organization;
    });
    
    return NextResponse.json({
      data: {
        id: result.id,
        name: result.name,
        slug: result.slug,
        description: result.description,
        role: 'ADMIN',
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create organization:', error);
    return serverError('Failed to create organization');
  }
}
