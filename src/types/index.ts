// =============================================================================
// DevOps Portal v2 - Type Definitions
// =============================================================================

// Re-export types from integrations
export type {
  GitHubRepository,
  GitHubBranch,
  GitHubFileContent,
  GitHubFileTreeEntry,
  GitHubPullRequest,
  UpdateFileParams,
  CreatePullRequestParams,
} from '@/lib/integrations/github';

export type {
  ArgoCDApplication,
  ArgoCDApplicationResource,
  ArgoCDSyncResult,
  ArgoCDHistory,
} from '@/lib/integrations/argocd';

// Re-export validation types
export type * from '@/lib/validations/schemas';

// =============================================================================
// Common Types
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// =============================================================================
// UI Types
// =============================================================================

export type Status = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type SyncStatus = 'synced' | 'out-of-sync' | 'syncing' | 'unknown';

export interface StatusIndicator {
  status: Status;
  label: string;
  description?: string;
}

export interface NavigationItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavigationItem[];
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface MetricData {
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  status?: 'success' | 'failed' | 'pending';
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Organization Types
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: 'USER' | 'READWRITE' | 'ADMIN';
  createdAt: string;
}

// =============================================================================
// Cluster Types
// =============================================================================

export interface Cluster {
  id: string;
  name: string;
  slug: string;
  provider: 'aws' | 'gcp' | 'azure' | 'on-prem';
  region: string;
  environment: 'production' | 'staging' | 'development';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  argocdUrl?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string;
}

// =============================================================================
// Deployment Types
// =============================================================================

export interface Deployment {
  id: string;
  name: string;
  namespace: string;
  repository: string;
  branch: string;
  path: string;
  argoAppName?: string;
  syncStatus: SyncStatus;
  healthStatus: Status;
  currentVersion?: string;
  targetVersion?: string;
  organizationId: string;
  clusterId: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

// =============================================================================
// Bulk Operation Types
// =============================================================================

export interface BulkOperation {
  id: string;
  type: 'FILE_UPDATE' | 'SYNC' | 'ROLLBACK' | 'SCALE' | 'RESTART';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  errors?: Record<string, unknown>;
  organizationId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}
