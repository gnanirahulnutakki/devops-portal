export { gitopsPlugin, GitOpsPage } from './plugin';
export { GitOpsApi, gitOpsApiRef } from './api';
export type {
  Repository,
  Branch,
  FileTreeEntry,
  FileContent,
  UpdateFileRequest,
  BulkOperation,
  ArgoCDApplication,
} from './api';

// Export standalone pages
export { GrafanaPage } from './components/GrafanaPage';
export { S3Page } from './components/S3Page';
export { DocumentationPage } from './components/DocumentationPage';
export { GitHubActionsPage } from './components/GitHubActionsPage';

// Export components for embedding
export { GitHubActionsDashboard } from './components/GitHubActions';
export { GoldenSignalsCard } from './components/GoldenSignals';
export { MyPullRequestsWidget, MyServicesWidget } from './components/HomeWidgets';
export { MaturityScorecard } from './components/MaturityScorecard';
export { CostInsightsCard } from './components/CostInsights';

// Export AI Search components
export { AISearchCard } from './components/AISearch';

// Export Day-2 Operations components
export { Day2OperationsCard } from './components/Day2Operations';

// Export permission components and hooks
export { RequirePermission, NoPermission, withPermission } from './components/Permission';
export { usePermissions, Permission, Role } from './hooks';
export type { PermissionContext, UsePermissionsResult } from './hooks';
