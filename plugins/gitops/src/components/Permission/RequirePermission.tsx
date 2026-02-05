import React from 'react';
import { usePermissions, Permission, Role } from '../../hooks/usePermissions';
import { Progress } from '@backstage/core-components';
import { Typography, Box } from '@material-ui/core';
import LockIcon from '@material-ui/icons/Lock';

interface RequirePermissionProps {
  /** Single permission or array of permissions to check */
  permission?: Permission | Permission[];
  /** Role to check (alternative to permission) */
  role?: Role | Role[];
  /** 'any' = user needs at least one permission, 'all' = user needs all permissions */
  mode?: 'any' | 'all';
  /** Content to show if user doesn't have permission (default: nothing) */
  fallback?: React.ReactNode;
  /** Show loading indicator while fetching permissions */
  showLoading?: boolean;
  /** Children to render if user has permission */
  children: React.ReactNode;
}

/**
 * Conditional rendering based on user permissions
 * 
 * Usage:
 * ```tsx
 * <RequirePermission permission={Permission.ARGOCD_SYNC}>
 *   <SyncButton />
 * </RequirePermission>
 * 
 * <RequirePermission 
 *   permission={[Permission.PR_MERGE, Permission.PR_APPROVE]} 
 *   mode="any"
 *   fallback={<Typography>You don't have permission to merge PRs</Typography>}
 * >
 *   <MergeButton />
 * </RequirePermission>
 * 
 * <RequirePermission role={Role.ADMIN}>
 *   <AdminPanel />
 * </RequirePermission>
 * ```
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  role,
  mode = 'any',
  fallback = null,
  showLoading = false,
  children,
}) => {
  const { loading, hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = usePermissions();

  if (loading && showLoading) {
    return <Progress />;
  }

  if (loading) {
    return null;
  }

  // Check roles
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    const hasRequiredRole = mode === 'all' 
      ? roles.every(r => hasRole(r))
      : roles.some(r => hasRole(r));
    
    if (!hasRequiredRole) {
      return <>{fallback}</>;
    }
  }

  // Check permissions
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasRequiredPermission = mode === 'all'
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    if (!hasRequiredPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

/**
 * Display a "no permission" message
 */
export const NoPermission: React.FC<{ message?: string }> = ({ 
  message = "You don't have permission to access this feature" 
}) => {
  return (
    <Box 
      display="flex" 
      alignItems="center" 
      justifyContent="center" 
      p={4}
      flexDirection="column"
    >
      <LockIcon style={{ fontSize: 48, color: '#757575', marginBottom: 16 }} />
      <Typography color="textSecondary" align="center">
        {message}
      </Typography>
    </Box>
  );
};

/**
 * Higher-order component for permission-based page protection
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: Permission | Permission[],
  options?: {
    mode?: 'any' | 'all';
    fallback?: React.ReactNode;
  }
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <RequirePermission
        permission={permission}
        mode={options?.mode}
        fallback={options?.fallback || <NoPermission />}
        showLoading
      >
        <WrappedComponent {...props} />
      </RequirePermission>
    );
  };
}

export default RequirePermission;
