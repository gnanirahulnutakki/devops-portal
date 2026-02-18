import type { Role } from '@prisma/client';

export type FeatureKey =
  | 'repositories'
  | 'pullRequests'
  | 'githubActions'
  | 'gitOpsStudio'
  | 'monitoring'
  | 'argocd'
  | 'clusters'
  | 'deployments'
  | 'uptimeKuma'
  | 'alerts'
  | 'vulnerability'
  | 'storage'
  | 'helm'
  | 'diagrams'
  | 'mcp'
  | 'apiDocs'
  | 'organizations'
  | 'team'
  | 'settings';

export type FeaturePolicy = Record<
  FeatureKey,
  {
    enabled: boolean;
    minRole: Role; // role required to see/access the feature by default
  }
>;

export type MembershipFeatureOverrides = Partial<
  Record<
    FeatureKey,
    {
      enabled?: boolean;
    }
  >
>;

const roleHierarchy: Record<Role, number> = {
  USER: 1,
  READWRITE: 2,
  ADMIN: 3,
};

export function defaultFeaturePolicy(): FeaturePolicy {
  return {
    repositories: { enabled: true, minRole: 'USER' },
    pullRequests: { enabled: true, minRole: 'USER' },
    githubActions: { enabled: true, minRole: 'USER' },
    gitOpsStudio: { enabled: true, minRole: 'ADMIN' },
    monitoring: { enabled: true, minRole: 'USER' },
    argocd: { enabled: true, minRole: 'USER' },
    clusters: { enabled: true, minRole: 'USER' },
    deployments: { enabled: true, minRole: 'USER' },
    uptimeKuma: { enabled: true, minRole: 'USER' },
    alerts: { enabled: true, minRole: 'USER' },
    vulnerability: { enabled: true, minRole: 'USER' },
    storage: { enabled: true, minRole: 'USER' },
    helm: { enabled: true, minRole: 'READWRITE' },
    diagrams: { enabled: true, minRole: 'USER' },
    mcp: { enabled: true, minRole: 'READWRITE' },
    apiDocs: { enabled: true, minRole: 'USER' },
    organizations: { enabled: true, minRole: 'USER' },
    team: { enabled: true, minRole: 'ADMIN' },
    settings: { enabled: true, minRole: 'USER' },
  };
}

export function mergeFeaturePolicy(base: FeaturePolicy, override: Partial<FeaturePolicy>): FeaturePolicy {
  const next: FeaturePolicy = { ...base };
  for (const key of Object.keys(override) as FeatureKey[]) {
    const v = override[key];
    if (!v) continue;
    next[key] = {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : next[key].enabled,
      minRole: v.minRole ?? next[key].minRole,
    };
  }
  return next;
}

export function canAccessFeature(
  userRole: Role,
  policy: FeaturePolicy,
  feature: FeatureKey,
  membershipOverrides?: MembershipFeatureOverrides | null
): boolean {
  const p = policy[feature];
  if (!p?.enabled) return false;

  const override = membershipOverrides?.[feature];
  if (override && typeof override.enabled === 'boolean') {
    return override.enabled;
  }

  return roleHierarchy[userRole] >= roleHierarchy[p.minRole];
}

