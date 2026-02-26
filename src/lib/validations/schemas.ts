import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const idSchema = z.object({
  id: z.string().cuid(),
});

export const slugSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

// =============================================================================
// Organization Schemas
// =============================================================================

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// =============================================================================
// Cluster Schemas
// =============================================================================

export const createClusterSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  provider: z.enum(['aws', 'gcp', 'azure', 'on-prem']),
  region: z.string().max(50).optional().or(z.literal('')),
  environment: z.enum(['production', 'staging', 'development']),
  argocdUrl: z.string().url().optional(),
  // Standard auth
  kubeconfig: z.string().min(10).optional(),
  // Auth type routing
  authType: z.enum(['standard', 'duplo', 'eks']).default('standard'),
  // Duplo credentials
  duploHost: z.string().optional(),
  duploToken: z.string().optional(),
  planId: z.string().optional(),
  duploIsAdmin: z.boolean().optional(),
  // EKS credentials
  eksClusterName: z.string().optional(),
  eksRegion: z.string().optional(),
  eksEndpoint: z.string().optional(),
  eksCaData: z.string().optional(),
  eksAccessKeyId: z.string().optional(),
  eksSecretAccessKey: z.string().optional(),
  eksRoleArn: z.string().optional(),
});

export const updateClusterSchema = createClusterSchema.partial();

// =============================================================================
// Deployment Schemas
// =============================================================================

export const createDeploymentSchema = z.object({
  name: z.string().min(2).max(100),
  namespace: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
  repository: z.string().min(1).max(200),
  branch: z.string().min(1).max(100),
  path: z.string().default('.'),
  clusterId: z.string().cuid(),
  argoAppName: z.string().optional(),
});

export const updateDeploymentSchema = createDeploymentSchema.partial().omit({ clusterId: true });

// =============================================================================
// GitHub Schemas
// =============================================================================

export const listRepositoriesSchema = z.object({
  filter: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(30),
});

export const listBranchesSchema = z.object({
  repository: z.string().min(1),
  filter: z.string().optional(),
});

export const getFileContentSchema = z.object({
  repository: z.string().min(1),
  branch: z.string().min(1),
  path: z.string().min(1),
});

export const updateFileSchema = z.object({
  repository: z.string().min(1),
  branch: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  message: z.string().min(1).max(200),
  sha: z.string(),
});

export const createPullRequestSchema = z.object({
  repository: z.string().min(1),
  title: z.string().min(1).max(200),
  head: z.string().min(1),
  base: z.string().min(1),
  body: z.string().optional(),
});

export const listPullRequestsSchema = z.object({
  repository: z.string().min(1).optional(),
  state: z.enum(['open', 'closed', 'all']).default('open'),
});

export const listPullRequestFilesSchema = z.object({
  repository: z.string().min(1),
  number: z.coerce.number().int().min(1),
});

export const updatePullRequestSchema = z.object({
  repository: z.string().min(1),
  number: z.coerce.number().int().min(1),
  action: z.enum(['draft', 'ready', 'close', 'reopen']),
});

export const mergePullRequestSchema = z.object({
  repository: z.string().min(1),
  number: z.coerce.number().int().min(1),
  method: z.enum(['merge', 'squash', 'rebase']).optional(),
});

export const listDependabotAlertsSchema = z.object({
  repository: z.string().min(1),
  state: z.enum(['open', 'dismissed', 'fixed', 'all']).default('open'),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(50),
});

export const createSecurityScanSchema = z.object({
  type: z.enum(['TRIVY_IMAGE']),
  target: z.string().min(3).max(500), // image ref
  namespace: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/).optional(),
});

export const listSecurityScansSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const listCodeScanningAlertsSchema = z.object({
  repository: z.string().min(1),
  // GitHub code scanning alerts endpoint supports: open, dismissed, fixed
  state: z.enum(['open', 'dismissed', 'fixed']).default('open'),
  toolName: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(50),
});

// =============================================================================
// ArgoCD Schemas
// =============================================================================

export const syncApplicationSchema = z.object({
  appName: z.string().min(1),
  revision: z.string().optional(),
  prune: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export const rollbackApplicationSchema = z.object({
  appName: z.string().min(1),
  revisionId: z.string(),
});

// =============================================================================
// Bulk Operation Schemas
// =============================================================================

export const bulkFileUpdateSchema = z.object({
  branches: z.array(z.string()).min(1).max(50),
  updates: z.array(z.object({
    path: z.string().min(1),
    content: z.string(),
    message: z.string().min(1).max(200),
  })).min(1).max(10),
});

export const bulkSyncSchema = z.object({
  appNames: z.array(z.string()).min(1).max(50),
  prune: z.boolean().default(false),
});

// =============================================================================
// Alert Rule Schemas
// =============================================================================

export const createAlertRuleSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['cpu', 'memory', 'sync_failure', 'health_degraded', 'custom']),
  condition: z.object({
    threshold: z.number(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    duration: z.number().optional(), // in seconds
  }),
  channels: z.array(z.enum(['email', 'slack', 'webhook'])).min(1),
  recipients: z.array(z.string()).min(1),
  enabled: z.boolean().default(true),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial();

// =============================================================================
// User Preference Schemas
// =============================================================================

export const updateUserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  sidebarCollapsed: z.boolean().optional(),
  dashboardLayout: z.record(z.unknown()).optional(),
  emailNotifications: z.boolean().optional(),
  slackNotifications: z.boolean().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Pagination = z.infer<typeof paginationSchema>;
export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type CreateCluster = z.infer<typeof createClusterSchema>;
export type UpdateCluster = z.infer<typeof updateClusterSchema>;
export type CreateDeployment = z.infer<typeof createDeploymentSchema>;
export type UpdateDeployment = z.infer<typeof updateDeploymentSchema>;
export type ListRepositories = z.infer<typeof listRepositoriesSchema>;
export type ListBranches = z.infer<typeof listBranchesSchema>;
export type GetFileContent = z.infer<typeof getFileContentSchema>;
export type UpdateFile = z.infer<typeof updateFileSchema>;
export type CreatePullRequest = z.infer<typeof createPullRequestSchema>;
export type ListPullRequests = z.infer<typeof listPullRequestsSchema>;
export type ListPullRequestFiles = z.infer<typeof listPullRequestFilesSchema>;
export type UpdatePullRequest = z.infer<typeof updatePullRequestSchema>;
export type MergePullRequest = z.infer<typeof mergePullRequestSchema>;
export type ListDependabotAlerts = z.infer<typeof listDependabotAlertsSchema>;
export type CreateSecurityScan = z.infer<typeof createSecurityScanSchema>;
export type ListSecurityScans = z.infer<typeof listSecurityScansSchema>;
export type ListCodeScanningAlerts = z.infer<typeof listCodeScanningAlertsSchema>;
export type SyncApplication = z.infer<typeof syncApplicationSchema>;
export type RollbackApplication = z.infer<typeof rollbackApplicationSchema>;
export type BulkFileUpdate = z.infer<typeof bulkFileUpdateSchema>;
export type BulkSync = z.infer<typeof bulkSyncSchema>;
export type CreateAlertRule = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRule = z.infer<typeof updateAlertRuleSchema>;
export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;
