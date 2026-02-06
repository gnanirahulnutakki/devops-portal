import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

// Schema for updating a user
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['USER', 'READWRITE', 'ADMIN']).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

// Get a single user
export const GET = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const userId = request.url.split('/users/')[1]?.split('/')[0]?.split('?')[0];
      if (!userId) {
        return errorResponse('INVALID_REQUEST', 'User ID is required', 400);
      }

      const membership = await ctx.db.membership.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              createdAt: true,
              emailVerified: true,
            },
          },
        },
      });

      if (!membership) {
        return errorResponse('USER_NOT_FOUND', 'User not found in this organization', 404);
      }

      return successResponse({
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        image: membership.user.image,
        role: membership.role,
        createdAt: membership.user.createdAt,
        emailVerified: membership.user.emailVerified,
        membershipId: membership.id,
      });
    } catch (error) {
      return errorResponse('USER_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);

// Update a user's role or details
export const PATCH = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const userId = request.url.split('/users/')[1]?.split('/')[0]?.split('?')[0];
      if (!userId) {
        return errorResponse('INVALID_REQUEST', 'User ID is required', 400);
      }

      // Validate request body
      const validation = await validateRequest(request, updateUserSchema);
      if ('error' in validation) return validation.error;
      
      const { name, role, password } = validation.data;

      // Find membership
      const membership = await ctx.db.membership.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          userId,
        },
        include: {
          user: true,
        },
      });

      if (!membership) {
        return errorResponse('USER_NOT_FOUND', 'User not found in this organization', 404);
      }

      // Prevent self-demotion from admin
      if (userId === ctx.tenant.userId && role && role !== 'ADMIN' && membership.role === 'ADMIN') {
        // Check if there's another admin
        const adminCount = await ctx.db.membership.count({
          where: {
            organizationId: ctx.tenant.organizationId,
            role: 'ADMIN',
          },
        });

        if (adminCount === 1) {
          return errorResponse('CANNOT_DEMOTE', 'Cannot demote the only admin', 400);
        }
      }

      // Update user details if name provided
      if (name) {
        await ctx.db.user.update({
          where: { id: userId },
          data: { name },
        });
      }

      // Update password if provided
      if (password) {
        const passwordHash = await hashPassword(password);
        await ctx.db.user.update({
          where: { id: userId },
          data: { 
            passwordHash,
            emailVerified: membership.user.emailVerified ?? new Date(), // Mark verified if setting password
          },
        });
      }

      // Update role if provided
      if (role) {
        await ctx.db.membership.update({
          where: { id: membership.id },
          data: { role },
        });
      }

      return successResponse({
        id: userId,
        name: name || membership.user.name,
        role: role || membership.role,
        updated: true,
      });
    } catch (error) {
      return errorResponse('USER_UPDATE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN',
  }
);

// Remove a user from the organization
export const DELETE = withTenantApiHandler(
  async (request, ctx) => {
    try {
      const userId = request.url.split('/users/')[1]?.split('/')[0]?.split('?')[0];
      if (!userId) {
        return errorResponse('INVALID_REQUEST', 'User ID is required', 400);
      }

      // Prevent self-removal
      if (userId === ctx.tenant.userId) {
        return errorResponse('CANNOT_REMOVE_SELF', 'Cannot remove yourself from the organization', 400);
      }

      // Find membership
      const membership = await ctx.db.membership.findFirst({
        where: {
          organizationId: ctx.tenant.organizationId,
          userId,
        },
      });

      if (!membership) {
        return errorResponse('USER_NOT_FOUND', 'User not found in this organization', 404);
      }

      // Check if removing the last admin
      if (membership.role === 'ADMIN') {
        const adminCount = await ctx.db.membership.count({
          where: {
            organizationId: ctx.tenant.organizationId,
            role: 'ADMIN',
          },
        });

        if (adminCount === 1) {
          return errorResponse('CANNOT_REMOVE_LAST_ADMIN', 'Cannot remove the only admin', 400);
        }
      }

      // Remove membership (not the user account)
      await ctx.db.membership.delete({
        where: { id: membership.id },
      });

      return successResponse({ removed: userId });
    } catch (error) {
      return errorResponse('USER_DELETE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN',
  }
);
