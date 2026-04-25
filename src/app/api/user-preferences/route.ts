import { 
  withTenantApiHandler,
  successResponse, 
  errorResponse,
  validateRequest,
} from '@/lib/api';
import { updateUserPreferencesSchema } from '@/lib/validations/schemas';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const prefs = await ctx.db.userPreference.findUnique({
        where: { userId: ctx.tenant.userId },
      });

      return successResponse(
        prefs || {
          theme: 'system',
          sidebarCollapsed: false,
          dashboardLayout: null,
          emailNotifications: true,
          slackNotifications: false,
        }
      );
    } catch (error) {
      return errorResponse('PREFERENCES_FETCH_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);

export const PUT = withTenantApiHandler(
  async (request, ctx) => {
    const validation = await validateRequest(request, updateUserPreferencesSchema);
    if ('error' in validation) return validation.error;

    try {
      const prefs = await ctx.db.userPreference.upsert({
        where: { userId: ctx.tenant.userId },
        create: {
          userId: ctx.tenant.userId,
          ...validation.data,
        },
        update: {
          ...validation.data,
        },
      });
      return successResponse(prefs);
    } catch (error) {
      return errorResponse('PREFERENCES_UPDATE_FAILED', (error as Error).message, 500);
    }
  },
  {
    rateLimit: 'general',
    requiredRole: 'USER',
  }
);
