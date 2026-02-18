import { withTenantApiHandler, successResponse, errorResponse } from '@/lib/api';
import { canAccessFeature, defaultFeaturePolicy, mergeFeaturePolicy, type FeatureKey, type MembershipFeatureOverrides } from '@/lib/features';

export const GET = withTenantApiHandler(
  async (_request, ctx) => {
    try {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.tenant.organizationId },
        select: { settings: true },
      });
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.tenant.userId,
            organizationId: ctx.tenant.organizationId,
          },
        },
        select: { featureFlags: true },
      });

      const settings = (org?.settings as any) || {};
      const policy = mergeFeaturePolicy(defaultFeaturePolicy(), (settings.features || {}) as any);
      const overrides = (membership?.featureFlags as MembershipFeatureOverrides) || {};

      const effective = Object.fromEntries(
        (Object.keys(policy) as FeatureKey[]).map((k) => [k, canAccessFeature(ctx.tenant.userRole, policy, k, overrides)])
      );

      return successResponse({
        policy,
        overrides,
        effective,
      });
    } catch (e) {
      return errorResponse('FEATURES_FETCH_FAILED', (e as Error).message, 500);
    }
  },
  { rateLimit: 'general', requiredRole: 'USER' }
);

