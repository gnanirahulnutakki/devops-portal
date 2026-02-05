import { useState, useEffect, useCallback } from 'react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export enum Permission {
  // Repository operations
  REPO_READ = 'repository.read',
  REPO_WRITE = 'repository.write',
  REPO_DELETE = 'repository.delete',
  
  // Branch operations
  BRANCH_CREATE = 'branch.create',
  BRANCH_DELETE = 'branch.delete',
  
  // File operations
  FILE_READ = 'file.read',
  FILE_WRITE = 'file.write',
  FILE_BULK_UPDATE = 'file.bulk_update',
  
  // Pull request operations
  PR_CREATE = 'pullrequest.create',
  PR_MERGE = 'pullrequest.merge',
  PR_APPROVE = 'pullrequest.approve',
  PR_COMMENT = 'pullrequest.comment',
  
  // ArgoCD operations
  ARGOCD_READ = 'argocd.read',
  ARGOCD_SYNC = 'argocd.sync',
  ARGOCD_ROLLBACK = 'argocd.rollback',
  ARGOCD_DELETE = 'argocd.delete',
  
  // GitHub Actions operations
  ACTIONS_READ = 'actions.read',
  ACTIONS_TRIGGER = 'actions.trigger',
  ACTIONS_CANCEL = 'actions.cancel',
  ACTIONS_RERUN = 'actions.rerun',
  
  // Grafana operations
  GRAFANA_READ = 'grafana.read',
  GRAFANA_EDIT = 'grafana.edit',
  
  // Admin operations
  ADMIN_USERS = 'admin.users',
  ADMIN_SETTINGS = 'admin.settings',
  ADMIN_AUDIT = 'admin.audit',
}

export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export interface PermissionContext {
  userId: string;
  email?: string;
  displayName?: string;
  roles: Role[];
  permissions: Permission[];
  groups?: string[];
}

export interface UsePermissionsResult {
  loading: boolean;
  error: string | null;
  context: PermissionContext | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (role: Role) => boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isDeveloper: boolean;
  isViewer: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to access user permissions and roles
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, isAdmin, hasRole } = usePermissions();
 * 
 * if (hasPermission(Permission.ARGOCD_SYNC)) {
 *   // Show sync button
 * }
 * 
 * if (isAdmin) {
 *   // Show admin panel
 * }
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<PermissionContext | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/api/gitops/permissions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      
      const data = await response.json();
      setContext(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default viewer context on error
      setContext({
        userId: 'anonymous',
        roles: [Role.VIEWER],
        permissions: [Permission.REPO_READ, Permission.FILE_READ, Permission.ARGOCD_READ, Permission.ACTIONS_READ, Permission.GRAFANA_READ],
      });
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return context?.permissions.includes(permission) ?? false;
    },
    [context]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.some(p => context?.permissions.includes(p) ?? false);
    },
    [context]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.every(p => context?.permissions.includes(p) ?? false);
    },
    [context]
  );

  const hasRole = useCallback(
    (role: Role): boolean => {
      return context?.roles.includes(role) ?? false;
    },
    [context]
  );

  return {
    loading,
    error,
    context,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin: hasRole(Role.ADMIN),
    isOperator: hasRole(Role.OPERATOR) || hasRole(Role.ADMIN),
    isDeveloper: hasRole(Role.DEVELOPER) || hasRole(Role.OPERATOR) || hasRole(Role.ADMIN),
    isViewer: context !== null,
    refresh: fetchPermissions,
  };
}

/**
 * Component wrapper for permission-based rendering
 */
export interface RequirePermissionProps {
  permission: Permission | Permission[];
  mode?: 'any' | 'all';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}
