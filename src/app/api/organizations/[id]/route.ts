// =============================================================================
// Organization API - Update/Delete a single organization (admin only)
// =============================================================================

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  errorResponse,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
  validateRequest,
  successResponse,
} from '@/lib/api';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

async function requireOrgAdmin(userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: { role: true },
  });

  if (!membership) return { ok: false as const, reason: 'not_member' as const };
  if (membership.role !== 'ADMIN') return { ok: false as const, reason: 'not_admin' as const };
  return { ok: true as const };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorizedError();

    const { id } = await params;
    const validation = await validateRequest(request, updateOrganizationSchema);
    if ('error' in validation) return validation.error;

    const authz = await requireOrgAdmin(session.user.id, id);
    if (!authz.ok) {
      return forbiddenError(authz.reason === 'not_member' ? 'You are not a member of this organization' : undefined);
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existingOrg) return notFoundError('Organization');

    const { name, slug, description, logoUrl } = validation.data;
    if (slug && slug !== existingOrg.slug) {
      const conflict = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
      if (conflict) return errorResponse('CONFLICT', 'An organization with this slug already exists', 409);
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(typeof slug === 'string' ? { slug } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
      select: { id: true, name: true, slug: true, description: true, logoUrl: true, updatedAt: true },
    });

    return successResponse(updated);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorizedError();

    const { id } = await params;
    const authz = await requireOrgAdmin(session.user.id, id);
    if (!authz.ok) {
      return forbiddenError(authz.reason === 'not_member' ? 'You are not a member of this organization' : undefined);
    }

    const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!org) return notFoundError('Organization');

    await prisma.organization.delete({ where: { id } });
    return successResponse({ id: org.id, deleted: true });
  } catch (error) {
    return serverError(error);
  }
}

