import { Request } from 'express';

/**
 * Permission definitions for DevOps Portal operations
 * 
 * Roles:
 * - admin: Full access to all operations
 * - operator: Can perform deployments, syncs, and restarts
 * - developer: Can view, create PRs, but limited deployment access
 * - viewer: Read-only access
 * 
 * Permissions follow the format: resource.action
 */

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

// Role to permissions mapping
const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission), // Admin has all permissions
  
  [Role.OPERATOR]: [
    Permission.REPO_READ,
    Permission.REPO_WRITE,
    Permission.BRANCH_CREATE,
    Permission.FILE_READ,
    Permission.FILE_WRITE,
    Permission.FILE_BULK_UPDATE,
    Permission.PR_CREATE,
    Permission.PR_MERGE,
    Permission.PR_APPROVE,
    Permission.PR_COMMENT,
    Permission.ARGOCD_READ,
    Permission.ARGOCD_SYNC,
    Permission.ARGOCD_ROLLBACK,
    Permission.ACTIONS_READ,
    Permission.ACTIONS_TRIGGER,
    Permission.ACTIONS_CANCEL,
    Permission.ACTIONS_RERUN,
    Permission.GRAFANA_READ,
  ],
  
  [Role.DEVELOPER]: [
    Permission.REPO_READ,
    Permission.BRANCH_CREATE,
    Permission.FILE_READ,
    Permission.FILE_WRITE,
    Permission.PR_CREATE,
    Permission.PR_COMMENT,
    Permission.ARGOCD_READ,
    Permission.ACTIONS_READ,
    Permission.ACTIONS_TRIGGER,
    Permission.GRAFANA_READ,
  ],
  
  [Role.VIEWER]: [
    Permission.REPO_READ,
    Permission.FILE_READ,
    Permission.ARGOCD_READ,
    Permission.ACTIONS_READ,
    Permission.GRAFANA_READ,
  ],
};

export interface UserPermissionContext {
  userId: string;
  email?: string;
  displayName?: string;
  roles: Role[];
  permissions: Permission[];
  groups?: string[];
}

export interface PermissionServiceConfig {
  // Map GitHub/GitLab usernames to roles
  userRoleMapping?: Record<string, Role[]>;
  // Map groups to roles (e.g., GitHub teams)
  groupRoleMapping?: Record<string, Role[]>;
  // Default role for authenticated users
  defaultRole?: Role;
  // Allow guest access (maps to viewer role)
  allowGuest?: boolean;
  // Super admins (always have admin role)
  superAdmins?: string[];
}

export class PermissionService {
  private config: PermissionServiceConfig;

  constructor(config: PermissionServiceConfig = {}) {
    this.config = {
      defaultRole: Role.DEVELOPER,
      allowGuest: false,
      ...config,
    };
  }

  /**
   * Get user permissions from request
   */
  getUserPermissions(req: Request): UserPermissionContext {
    // Extract user info from request headers (set by auth middleware)
    const userId = req.headers['x-backstage-user-id'] as string || 'anonymous';
    const email = req.headers['x-backstage-user-email'] as string;
    const displayName = req.headers['x-backstage-user-display-name'] as string;
    const groupsHeader = req.headers['x-backstage-user-groups'] as string;
    const groups = groupsHeader ? groupsHeader.split(',').map(g => g.trim()) : [];

    // Determine roles
    const roles = this.determineRoles(userId, email, groups);
    
    // Get permissions for roles
    const permissions = this.getPermissionsForRoles(roles);

    return {
      userId,
      email,
      displayName,
      roles,
      permissions,
      groups,
    };
  }

  /**
   * Determine user roles based on config
   */
  private determineRoles(userId: string, email?: string, groups?: string[]): Role[] {
    const roles: Set<Role> = new Set();

    // Check if super admin
    if (this.config.superAdmins?.includes(userId) || 
        (email && this.config.superAdmins?.includes(email))) {
      roles.add(Role.ADMIN);
      return Array.from(roles);
    }

    // Check user role mapping
    if (this.config.userRoleMapping) {
      const userRoles = this.config.userRoleMapping[userId] || 
                       (email ? this.config.userRoleMapping[email] : undefined);
      if (userRoles) {
        userRoles.forEach(r => roles.add(r));
      }
    }

    // Check group role mapping
    if (this.config.groupRoleMapping && groups) {
      for (const group of groups) {
        const groupRoles = this.config.groupRoleMapping[group];
        if (groupRoles) {
          groupRoles.forEach(r => roles.add(r));
        }
      }
    }

    // Apply default role if no roles found
    if (roles.size === 0 && userId !== 'anonymous') {
      roles.add(this.config.defaultRole || Role.DEVELOPER);
    }

    // Guest/anonymous users
    if (userId === 'anonymous' && this.config.allowGuest) {
      roles.add(Role.VIEWER);
    }

    return Array.from(roles);
  }

  /**
   * Get all permissions for given roles
   */
  private getPermissionsForRoles(roles: Role[]): Permission[] {
    const permissions: Set<Permission> = new Set();
    
    for (const role of roles) {
      const rolePerms = rolePermissions[role] || [];
      rolePerms.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(context: UserPermissionContext, permission: Permission): boolean {
    return context.permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(context: UserPermissionContext, permissions: Permission[]): boolean {
    return permissions.some(p => context.permissions.includes(p));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(context: UserPermissionContext, permissions: Permission[]): boolean {
    return permissions.every(p => context.permissions.includes(p));
  }

  /**
   * Check if user has a specific role
   */
  hasRole(context: UserPermissionContext, role: Role): boolean {
    return context.roles.includes(role);
  }

  /**
   * Get available roles
   */
  getAvailableRoles(): Role[] {
    return Object.values(Role);
  }

  /**
   * Get permissions for a role
   */
  getPermissionsForRole(role: Role): Permission[] {
    return rolePermissions[role] || [];
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Permission[] {
    return Object.values(Permission);
  }
}

/**
 * Express middleware for permission checking
 */
export function requirePermission(permissionService: PermissionService, ...permissions: Permission[]) {
  return (req: Request, res: any, next: any) => {
    const context = permissionService.getUserPermissions(req);
    
    if (!permissionService.hasAnyPermission(context, permissions)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
          requiredPermissions: permissions,
          userPermissions: context.permissions,
        },
      });
    }

    // Attach permission context to request for downstream use
    (req as any).permissionContext = context;
    next();
  };
}

/**
 * Express middleware for role checking
 */
export function requireRole(permissionService: PermissionService, ...roles: Role[]) {
  return (req: Request, res: any, next: any) => {
    const context = permissionService.getUserPermissions(req);
    
    const hasRequiredRole = roles.some(role => context.roles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have the required role to perform this action',
          requiredRoles: roles,
          userRoles: context.roles,
        },
      });
    }

    (req as any).permissionContext = context;
    next();
  };
}
