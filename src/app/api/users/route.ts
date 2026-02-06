import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

// Schema for creating a user
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['USER', 'READWRITE', 'ADMIN']).default('USER'),
});

// List users in the organization
export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const members = await ctx.db.membership.findMany({
        where: { organizationId: ctx.tenant.organizationId },
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
        orderBy: { createdAt: 'desc' },
      });

      const users = members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        image: m.user.image,
        role: m.role,
        createdAt: m.user.createdAt,
        emailVerified: m.user.emailVerified,
        membershipId: m.id,
      }));

      return successResponse(users);
    } catch (error) {
      return errorResponse('USERS_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER', // Any member can view the team
  }
);

// Create a new user and add to organization
export const POST = withTenantApiHandler(
  async (request, ctx) => {
    try {
      // Validate request body
      const validation = await validateRequest(request, createUserSchema);
      if ('error' in validation) return validation.error;
      
      const { email, name, password, role } = validation.data;

      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email },
        include: {
          memberships: {
            where: { organizationId: ctx.tenant.organizationId },
          },
        },
      });

      if (existingUser) {
        // User exists, check if already member of this org
        if (existingUser.memberships.length > 0) {
          return errorResponse('USER_ALREADY_MEMBER', 'User is already a member of this organization', 400);
        }

        // Add existing user to organization
        const membership = await ctx.db.membership.create({
          data: {
            userId: existingUser.id,
            organizationId: ctx.tenant.organizationId,
            role,
          },
        });

        return successResponse({
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: membership.role,
          isNew: false,
        });
      }

      // Create new user
      const passwordHash = password ? await hashPassword(password) : null;
      
      const user = await ctx.db.user.create({
        data: {
          email,
          name,
          passwordHash,
          emailVerified: password ? new Date() : null, // Mark verified if password is set
          memberships: {
            create: {
              organizationId: ctx.tenant.organizationId,
              role,
            },
          },
        },
        include: {
          memberships: {
            where: { organizationId: ctx.tenant.organizationId },
          },
        },
      });

      return successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.memberships[0]?.role || role,
        isNew: true,
        hasPassword: !!password,
      });
    } catch (error) {
      return errorResponse('USER_CREATE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'ADMIN', // Only admins can add users
  }
);
