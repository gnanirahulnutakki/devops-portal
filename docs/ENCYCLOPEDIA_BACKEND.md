Below is a comprehensive, developer‑oriented documentation of the Backstage-based DevOps Portal (GitOps) codebase, with exact file paths and concise code examples.

**Architecture Overview**

- **Monorepo structure (Yarn workspaces)**: root workspace with `packages/*` and `plugins/*`. See `package.json`.
  - `packages/app` — Backstage frontend app shell, routes, themes, auth UI, API registration.
  - `packages/backend` — Backstage backend app shell (core services + plugin wiring).
  - `plugins/gitops` — Frontend GitOps plugin (UI, hooks, API client).
  - `plugins/gitops-backend` — Backend GitOps plugin (router, services, auth utilities, validation, DB).
- **Plugin integration**
  - Frontend plugin exported in `plugins/gitops/src/plugin.ts`, routable at `/gitops`.
  - App routes mount GitOps and related pages in `packages/app/src/App.tsx`.
  - API client registered in `packages/app/src/apis.ts` (discovery‑based).
- **Backend API base path**
  - Backstage plugin uses service discovery: frontend uses `discoveryApi.getBaseUrl('gitops')`, which maps to backend `/api/gitops` behind Backstage (see `plugins/gitops/src/api/GitOpsApi.ts`).
- **Persistence**
  - PostgreSQL via Backstage `database` service.
  - Tables used: `audit_logs`, `bulk_operations` (see `plugins/gitops-backend/src/services/AuditService.ts`, `BulkOperationService.ts`).
- **External integrations**
  - GitHub (Octokit), GitHub Actions (REST), ArgoCD (REST), Grafana (REST), GitLab (REST), Uptime Kuma (REST).
- **Security & middleware**
  - Security headers, JSON body limit, request logging, and rate limiting applied in `plugins/gitops-backend/src/service/router.ts` and middleware.

**Backend Services (plugins/gitops-backend/src/services/)**  
(Methods listed with parameters and return types)

1) **ArgoCDService** — `plugins/gitops-backend/src/services/ArgoCDService.ts`  
- `constructor(config: ArgoCDServiceConfig)`  
- `listApplications(filter?: string): Promise<ArgoCDApplication[]>`  
- `getApplication(appName: string): Promise<ArgoCDApplication>`  
- `syncApplication(appName: string, syncRequest?: ArgoCDSyncRequest): Promise<ArgoCDSyncResponse>`  
- `syncApplications(appNames: string[], syncRequest?: ArgoCDSyncRequest): Promise<ArgoCDSyncResponse[]>`  
- `getApplicationsByBranch(branch: string): Promise<ArgoCDApplication[]>`  
- `getApplicationHealth(appName: string): Promise<{ health: string; sync: string }>`  
- (Private) mock data helpers: `getMockApplications`, `getMockSyncResponse`

2) **AuditService** — `plugins/gitops-backend/src/services/AuditService.ts`  
- `constructor(config: AuditServiceConfig)`  
- `log(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<string>`  
- `logRead(params: {...}): Promise<string>`  
- `logUpdate(params: {...}): Promise<string>`  
- `logCommit(params: {...}): Promise<string>`  
- `logSync(params: {...}): Promise<string>`  
- `getLogs(filters: {...}): Promise<{ logs: AuditLog[]; total: number }>`  
- `getUserActivity(userId: string, limit = 20): Promise<AuditLog[]>`  
- `getRepositoryActivity(repository: string, limit = 100): Promise<AuditLog[]>`  
- `getBranchActivity(repository: string, branch: string, limit = 100): Promise<AuditLog[]>`  
- `getFailedOperations(limit = 50): Promise<AuditLog[]>`  
- `getStatistics(params: {...}): Promise<{ total_operations; successful_operations; failed_operations; operations_by_type; top_users }>`  

3) **AuthTokenService** — `plugins/gitops-backend/src/services/AuthTokenService.ts`  
- `constructor(config: AuthTokenServiceConfig)`  
- `getUserFromRequest(req: Request): Promise<AuthenticatedUser | null>`  
- `getGitHubToken(req: Request): Promise<string | null>`  
- `getGitLabToken(req: Request): Promise<string | null>`  
- `checkPermissions(req: Request, requiredScopes: string[]): Promise<{ allowed: boolean; reason?: string }>`  
- `getUserOrganizations(req: Request): Promise<string[]>`  
- (Private) `extractGitHubToken`, `extractGitLabToken`

4) **BulkOperationService** — `plugins/gitops-backend/src/services/BulkOperationService.ts`  
- `constructor(db: Knex, githubService: GitHubService, auditService: AuditService)`  
- `createBulkUpdate(params: {...}): Promise<string>`  
- `getOperation(operationId: string): Promise<BulkOperation | null>`  
- `listOperations(filters: {...}): Promise<{ operations: BulkOperation[]; total: number }>`  
- `getActiveOperations(): Promise<BulkOperation[]>`  
- `getUserOperations(userId: string, limit = 10): Promise<BulkOperation[]>`  
- `cancelOperation(operationId: string): Promise<boolean>`  
- `getStatistics(params: {...}): Promise<{ total_operations; by_status; by_type; avg_success_rate; total_branches_updated }>`  
- (Private) `processBulkUpdate(...)`

5) **CostService** — `plugins/gitops-backend/src/services/CostService.ts`  
- `constructor(config: Config)`  
- `getCostSummary(period: 'daily' | 'weekly' | 'monthly', serviceName?: string): Promise<CostSummary>`  
- `getRecommendations(): Promise<CostRecommendation[]>`  
- `getAnomalies(): Promise<any[]>`  
- `getForecast(months = 3): Promise<any>`  
- (Private) `getAWSCostSummary`, `getGCPCostSummary`, `getAzureCostSummary`, `getMockCostSummary`, `generateServiceCost`

6) **GitHubActionsService** — `plugins/gitops-backend/src/services/GitHubActionsService.ts`  
- `constructor(config: Config, logger: Logger)`  
- `listWorkflows(repo: string): Promise<Workflow[]>`  
- `getWorkflowRuns(repo: string, options?: {...}): Promise<{ runs: WorkflowRun[]; total_count: number }>`  
- `getWorkflowRun(repo: string, runId: number): Promise<WorkflowRun>`  
- `getWorkflowRunJobs(repo: string, runId: number): Promise<WorkflowJob[]>`  
- `getWorkflowRunLogsUrl(repo: string, runId: number): Promise<string>`  
- `rerunWorkflow(repo: string, runId: number): Promise<void>`  
- `rerunFailedJobs(repo: string, runId: number): Promise<void>`  
- `cancelWorkflowRun(repo: string, runId: number): Promise<void>`  
- `triggerWorkflow(repo: string, workflowId: number | string, ref: string, inputs?: Record<string,string>): Promise<void>`  
- `getBuildStatusSummary(repo: string, branch?: string): Promise<{ lastRun; recentRuns; stats }>`  
- `getWorkflowUsage(repo: string): Promise<{ billable... } | null>`

7) **GitHubService** — `plugins/gitops-backend/src/services/GitHubService.ts`  
- `constructor(config: GitHubServiceConfig)`  
- `listRepositories(filter?: string): Promise<GitHubRepository[]>`  
- `listBranches(repository: string, filter?: string): Promise<GitHubBranch[]>`  
- `getFileTree(repository: string, branch: string, path = ''): Promise<GitHubFileTreeEntry[]>`  
- `getFileContent(repository: string, branch: string, path: string): Promise<GitHubFileContent>`  
- `updateFile(request: GitHubUpdateFileRequest): Promise<GitHubUpdateFileResponse>`  
- `compareBranches(repository: string, base: string, head: string): Promise<any>`  
- `createPullRequest(repository: string, title: string, head: string, base: string, body?: string): Promise<any>`  
- `createBranch(repository: string, newBranchName: string, fromBranch: string): Promise<any>`  
- `listPullRequests(repository: string, state?: ..., sort?: ..., direction?: ...): Promise<any[]>`  
- `getPullRequest(repository: string, pullNumber: number): Promise<any>`  
- `getPullRequestFiles(repository: string, pullNumber: number): Promise<any[]>`  
- `mergePullRequest(repository: string, pullNumber: number, commitTitle?: string, commitMessage?: string, mergeMethod?: ...): Promise<any>`  
- `addReviewers(repository: string, pullNumber: number, reviewers: string[], teamReviewers?: string[]): Promise<any>`  
- `assignPullRequest(repository: string, pullNumber: number, assignees: string[]): Promise<any>`  
- `getPullRequestComments(repository: string, pullNumber: number): Promise<any[]>`  
- `addPullRequestComment(repository: string, pullNumber: number, body: string): Promise<any>`  
- `getPullRequestStatusChecks(repository: string, pullNumber: number): Promise<any[]>`  
- `getPullRequestReviews(repository: string, pullNumber: number): Promise<any[]>`  
- `getPullRequestTimeline(repository: string, pullNumber: number): Promise<any[]>`  

8) **GitLabService** — `plugins/gitops-backend/src/services/GitLabService.ts`  
- `constructor(config: GitLabServiceConfig)`  
- `withToken(token: string): GitLabService`  
- `listProjects(options?: {...}): Promise<GitLabProject[]>`  
- `getProject(projectId: string | number): Promise<GitLabProject>`  
- `listBranches(projectId: string | number): Promise<GitLabBranch[]>`  
- `getTree(projectId: string | number, options?: {...}): Promise<GitLabTreeItem[]>`  
- `getFile(projectId: string | number, filePath: string, ref?: string): Promise<GitLabFile>`  
- `getRawFile(projectId: string | number, filePath: string, ref?: string): Promise<string>`  
- `updateFile(projectId: string | number, filePath: string, content: string, options: {...}): Promise<GitLabCommit>`  
- `deleteFile(projectId: string | number, filePath: string, options: {...}): Promise<void>`  
- `listMergeRequests(projectId: string | number, options?: {...}): Promise<GitLabMergeRequest[]>`  
- `createMergeRequest(projectId: string | number, options: {...}): Promise<GitLabMergeRequest>`  
- `acceptMergeRequest(projectId: string | number, mergeRequestIid: number, options?: {...}): Promise<GitLabMergeRequest>`  
- `listPipelines(projectId: string | number, options?: {...}): Promise<GitLabPipeline[]>`  
- `triggerPipeline(projectId: string | number, ref: string, variables?: Record<string,string>): Promise<GitLabPipeline>`  
- `getCurrentUser(): Promise<{ id; username; name; email }>`  
- `listGroups(options?: {...}): Promise<Array<{ id; name; path; full_path }>>`  
- `healthCheck(): Promise<{ healthy: boolean; message: string }>`  

9) **GrafanaService** — `plugins/gitops-backend/src/services/GrafanaService.ts`  
- `constructor(config: { url: string; token: string })`  
- `listDashboards(): Promise<GrafanaDashboardDetail[]>`  
- `getDashboard(uid: string): Promise<any>`  
- `listFolders(): Promise<GrafanaFolder[]>`  
- `searchDashboards(query: string): Promise<GrafanaDashboardDetail[]>`  

10) **HealthService** — `plugins/gitops-backend/src/services/HealthService.ts`  
- `constructor(config: HealthServiceConfig)`  
- `getHealth(forceRefresh = false): Promise<HealthStatus>`  
- `getLiveness(): Promise<{ status: 'ok' }>`  
- `getReadiness(): Promise<{ ready: boolean; message?: string }>`  
- (Private) `checkDatabase`, `checkGitHub`, `checkArgoCD`, `checkGrafana`

11) **MaturityService** — `plugins/gitops-backend/src/services/MaturityService.ts`  
- `constructor(config: Config)`  
- `evaluateMaturity(owner: string, repo: string): Promise<MaturityResult>`  
- (Private helpers): `fileExists`, `getRepoDetails`, `getWorkflows`, and `evaluateDocumentation`, `evaluateTesting`, `evaluateCICD`, `evaluateMonitoring`, `evaluateSecurity`, `evaluateInfrastructure`, `calculateCategoryScore`.

12) **PermissionService** — `plugins/gitops-backend/src/services/PermissionService.ts`  
- `constructor(config?: PermissionServiceConfig)`  
- `getUserPermissions(req: Request): UserPermissionContext`  
- `hasPermission(context, permission): boolean`  
- `hasAnyPermission(context, permissions): boolean`  
- `hasAllPermissions(context, permissions): boolean`  
- `hasRole(context, role): boolean`  
- `getAvailableRoles(): Role[]`  
- `getPermissionsForRole(role): Permission[]`  
- `getAllPermissions(): Permission[]`  
- Middleware exports:
  - `requirePermission(permissionService, ...permissions)`
  - `requireRole(permissionService, ...roles)`

13) **UptimeKumaService** — `plugins/gitops-backend/src/services/UptimeKumaService.ts`  
- `constructor(config: UptimeKumaConfig)`  
- `login(username: string, password: string): Promise<boolean>`  
- `getMonitors(): Promise<Monitor[]>`  
- `getMonitor(id: number): Promise<Monitor>`  
- `getMonitorStatus(id: number): Promise<MonitorStatus>`  
- `getHeartbeats(monitorId: number, hours = 24): Promise<Heartbeat[]>`  
- `getUptime(monitorId: number, hours: number): Promise<number>`  
- `createMonitor(monitor: Partial<Monitor>): Promise<Monitor>`  
- `updateMonitor(id: number, updates: Partial<Monitor>): Promise<Monitor>`  
- `deleteMonitor(id: number): Promise<void>`  
- `pauseMonitor(id: number): Promise<void>`  
- `resumeMonitor(id: number): Promise<void>`  
- `getStatusPages(): Promise<StatusPage[]>`  
- `getPublicStatusPage(slug: string): Promise<{ config; incident; publicGroupList }>`  
- `getNotifications(): Promise<Notification[]>`  
- `getTags(): Promise<Tag[]>`  
- `getStats(): Promise<UptimeStats>`  
- `getMonitorsByTag(tagName: string): Promise<Monitor[]>`  
- `healthCheck(): Promise<{ healthy; message; version? }>`  
- `getDashboardSummary(): Promise<{ status; upCount; downCount; totalCount; uptimePercent }>`  

**Frontend Components (plugins/gitops/src/components/)**  
Props + usage

- `GitOpsPage` — `plugins/gitops/src/components/GitOpsPage/GitOpsPage.tsx`  
  - Props: none.  
  - Usage: Mounted at `/gitops` in `packages/app/src/App.tsx`. Tabs render `RepositoryBrowser`, `PRManagement`, `ArgoCDDashboard`, `OperationsTracker`, `AuditLogViewer`.

- `RepositoryBrowser` — `plugins/gitops/src/components/RepositoryBrowser/RepositoryBrowser.tsx`  
  - Props: none.  
  - Usage: `GitOpsPage` tab “Repository Browser”.  
  - Uses `gitOpsApiRef` to list repos/branches/files and opens `FileEditor`.

- `FileEditor` — `plugins/gitops/src/components/FileEditor/FileEditor.tsx`  
  - Props:  
    - `open: boolean`, `onClose: () => void`  
    - `repository: string`  
    - `fileContent: FileContent | null`  
    - `branches: Branch[]`, `currentBranch: string`  
    - `onSuccess?: () => void`  
  - Usage: rendered by `RepositoryBrowser`.

- `FieldSelector` — `plugins/gitops/src/components/FieldSelector/FieldSelector.tsx`  
  - Props:  
    - `repository: string`  
    - `fileContent: FileContent | null`  
    - `branches: Branch[]`  
    - `selectedBranches: string[]`  
    - `onFieldChange?: (fieldPath: string, newValue: string) => void`  
  - Usage: inside `FileEditor` for field-level YAML updates.

- `CreatePullRequestDialog` — `plugins/gitops/src/components/CreatePullRequestDialog/CreatePullRequestDialog.tsx`  
  - Props:  
    - `open`, `onClose`, `repository`, `currentBranch`  
    - `onPullRequestCreated?: (pullRequest: any) => void`  
    - `allowBranchCreation?: boolean`  
    - `fileContent?: { path; content?; sha }`  
    - `commitMessage?: string`, `fieldPath?: string`, `fieldValue?: string`  
  - Usage: `PRManagement` + `FileEditor` (branch+PR workflow).

- `CommitToBranchDialog` — `plugins/gitops/src/components/CommitToBranchDialog/CommitToBranchDialog.tsx`  
  - Props:  
    - `open`, `onClose`, `repository`, `currentBranch`  
    - `onCommitSuccess?: () => void`  
    - `fileContent?: { path; content?; sha }`  
    - `commitMessage?: string`, `fieldPath?: string`, `fieldValue?: string`  
  - Usage: `FileEditor` “Commit to New Branch”.

- `PRManagement` — `plugins/gitops/src/components/PRManagement/PRManagement.tsx`  
  - Props: none.  
  - Usage: `GitOpsPage` tab “Pull Requests”.  
  - Orchestrates `PullRequestList` + `PullRequestDetails`.

- `PullRequestList` — `plugins/gitops/src/components/PullRequestList/PullRequestList.tsx`  
  - Props: `repository: string`, `onPullRequestClick?: (prNumber: number) => void`  
  - Usage: `PRManagement`.

- `PullRequestDetails` — `plugins/gitops/src/components/PullRequestDetails/PullRequestDetails.tsx`  
  - Props: `repository: string`, `pullNumber: number`, `onClose?: () => void`  
  - Usage: `PRManagement`. Renders `PRStatusChecks`, `PRReviewStatus`, `DiffViewer`, `PRComments`, `PRTimeline`.

- `DiffViewer` — `plugins/gitops/src/components/DiffViewer/DiffViewer.tsx`  
  - Props: `files: { filename; status; additions; deletions; changes; patch?; previous_filename? }[]`  
  - Usage: `PullRequestDetails`.

- `PRStatusChecks` — `plugins/gitops/src/components/PRStatusChecks/PRStatusChecks.tsx`  
  - Props: `repository: string`, `pullNumber: number`  
  - Usage: `PullRequestDetails`.

- `PRReviewStatus` — `plugins/gitops/src/components/PRReviewStatus/PRReviewStatus.tsx`  
  - Props: `repository: string`, `pullNumber: number`  
  - Usage: `PullRequestDetails`.

- `PRComments` — `plugins/gitops/src/components/PRComments/PRComments.tsx`  
  - Props: `repository: string`, `pullNumber: number`  
  - Usage: `PullRequestDetails`.

- `PRTimeline` — `plugins/gitops/src/components/PRTimeline/PRTimeline.tsx`  
  - Props: `repository: string`, `pullNumber: number`  
  - Usage: `PullRequestDetails`.

- `ArgoCDDashboard` — `plugins/gitops/src/components/ArgoCDDashboard/ArgoCDDashboard.tsx`  
  - Props: none.  
  - Usage: `GitOpsPage` tab “ArgoCD Applications”.

- `OperationsTracker` — `plugins/gitops/src/components/OperationsTracker/OperationsTracker.tsx`  
  - Props: none.  
  - Usage: `GitOpsPage` tab “Operations”.

- `AuditLogViewer` — `plugins/gitops/src/components/AuditLogViewer/AuditLogViewer.tsx`  
  - Props: none.  
  - Usage: `GitOpsPage` tab “Audit Logs”.

- `GrafanaDashboards` — `plugins/gitops/src/components/GrafanaDashboards/GrafanaDashboards.tsx`  
  - Props: none.  
  - Usage: `GrafanaPage`.

- `GrafanaPage` — `plugins/gitops/src/components/GrafanaPage/GrafanaPage.tsx`  
  - Props: none.  
  - Usage: Mounted at `/grafana` in `packages/app/src/App.tsx`.

- `GitHubActionsDashboard` — `plugins/gitops/src/components/GitHubActions/GitHubActionsDashboard.tsx`  
  - Props:  
    - `repository: string`  
    - `branch?: string`  
    - `showSummary?: boolean`  
    - `maxRuns?: number`  
  - Usage: `GitHubActionsPage`.

- `GitHubActionsPage` — `plugins/gitops/src/components/GitHubActionsPage/GitHubActionsPage.tsx`  
  - Props: none.  
  - Usage: Mounted at `/github-actions`.

- `S3FileBrowser` — `plugins/gitops/src/components/S3FileBrowser/S3FileBrowser.tsx`  
  - Props: none.  
  - Usage: `S3Page`. Uses mock data only.

- `S3Page` — `plugins/gitops/src/components/S3Page/S3Page.tsx`  
  - Props: none.  
  - Usage: Mounted at `/s3`.

- `Documentation` — `plugins/gitops/src/components/Documentation/Documentation.tsx`  
  - Props: none.  
  - Usage: `DocumentationPage`. Loads markdown from `/docs/*.md`.

- `DocumentationPage` — `plugins/gitops/src/components/DocumentationPage/DocumentationPage.tsx`  
  - Props: none.  
  - Usage: Mounted at `/documentation`.

- `GoldenSignalsCard` — `plugins/gitops/src/components/GoldenSignals/GoldenSignalsCard.tsx`  
  - Props:  
    - `serviceName: string`  
    - `namespace?: string`  
    - `grafanaDashboardUrl?: string`  
    - `refreshInterval?: number`  
    - `showCharts?: boolean`  
  - Usage: not wired into main routes (available for dashboard embedding).

- `CostInsightsCard` — `plugins/gitops/src/components/CostInsights/CostInsightsCard.tsx`  
  - Props:  
    - `serviceName?: string`  
    - `period?: 'daily' | 'weekly' | 'monthly'`  
    - `showBreakdown?: boolean`  
  - Usage: not wired into main routes (available for dashboard embedding).

- `MaturityScorecard` — `plugins/gitops/src/components/MaturityScorecard/MaturityScorecard.tsx`  
  - Props:  
    - `serviceName: string`  
    - `showDetails?: boolean`  
    - `compact?: boolean`  
  - Usage: not wired into main routes (available for dashboard embedding).

- `HomeWidgets/MyPullRequestsWidget` — `plugins/gitops/src/components/HomeWidgets/MyPullRequestsWidget.tsx`  
  - Props:  
    - `maxItems?: number`  
    - `filter?: 'created' | 'assigned' | 'review' | 'all'` (filter not yet enforced)  
    - `refreshInterval?: number`  
  - Usage: Home widgets (not used in `GitOpsPage`).

- `HomeWidgets/MyServicesWidget` — `plugins/gitops/src/components/HomeWidgets/MyServicesWidget.tsx`  
  - Props:  
    - `maxItems?: number`  
    - `refreshInterval?: number`  
    - `navigateOnClick?: boolean`  
  - Usage: Home widgets (not used in `GitOpsPage`).

- `Permission/RequirePermission` — `plugins/gitops/src/components/Permission/RequirePermission.tsx`  
  - Props:  
    - `permission?: Permission | Permission[]`  
    - `role?: Role | Role[]`  
    - `mode?: 'any' | 'all'`  
    - `fallback?: React.ReactNode`  
    - `showLoading?: boolean`  
    - `children: React.ReactNode`  
  - Usage: generic guard, exported with `NoPermission` and `withPermission` HOC.

**API Endpoints (plugins/gitops-backend/src/service/router.ts)**  
Base path is `/api/gitops` in Backstage. Requests validated in `plugins/gitops-backend/src/validation/schemas.ts`.

1) **Health**
- `GET /health`  
  - Query: `detailed=true|false`  
  - Response: `{ status: 'ok' }` or `HealthStatus`.
- `GET /health/live` → `{ status: 'ok' }`
- `GET /health/ready` → `{ ready: boolean; message?: string }`

2) **Repositories / Files**
- `GET /repositories?filter=...` → `{ repositories, total }`
- `GET /repositories/:repo/branches?filter=...` → `{ branches, total }`
- `GET /repositories/:repo/tree?branch=...&path=...` → `{ entries, path }`
- `GET /repositories/:repo/content?branch=...&path=...` → `{ content, sha, path, branch, size, name }`
- `POST /repositories/:repo/files/update` (bulk update)  
  - Body: `UpdateFileRequest`  
  - Response: `202 { operation_id, status: 'pending', total_branches, message }`

3) **Bulk Operations**
- `GET /bulk-operations/:operation_id` → `{ operation }` or 404 error
- `GET /bulk-operations?user_id&status&operation_type&limit&offset` → `{ operations, total, limit, offset }`

4) **Audit Logs**
- `GET /audit-logs?...` → `{ logs, total, limit, offset }`

5) **ArgoCD**
- `GET /argocd/applications?filter&branch` → `{ applications, total }`
- `GET /argocd/applications/:appName` → `{ application }`
- `POST /argocd/sync` body `{ applications[], prune?, dryRun? }` → `{ results, total, successful, failed }`

6) **Grafana**
- `GET /grafana/dashboards` → `{ dashboards, total }`
- `GET /grafana/dashboards/:uid` → `{ dashboard }`
- `GET /grafana/folders` → `{ folders, total }`
- `GET /grafana/search?query=` → `{ dashboards, total }`

7) **GitLab**
- `GET /gitlab/projects?search&page&per_page` → `{ projects, total }`
- `GET /gitlab/projects/:projectId` → `{ project }`
- `GET /gitlab/projects/:projectId/branches` → `{ branches, total }`
- `GET /gitlab/projects/:projectId/tree?ref&path&recursive` → `{ tree, total }`
- `GET /gitlab/projects/:projectId/files?path&ref` → `{ ...file, decodedContent }`
- `PUT /gitlab/projects/:projectId/files` body `{ path, content, branch, commitMessage }` → `{ result }`
- `GET /gitlab/projects/:projectId/merge_requests?state` → `{ mergeRequests, total }`
- `POST /gitlab/projects/:projectId/merge_requests` body `{ sourceBranch, targetBranch, title, description }` → `{ mergeRequest }`
- `GET /gitlab/projects/:projectId/pipelines?ref&status` → `{ pipelines, total }`
- `GET /gitlab/health` → `{ healthy, message }`

8) **Uptime Kuma**
- `GET /uptime-kuma/monitors` → `{ monitors, total }`
- `GET /uptime-kuma/monitors/:id` → `MonitorStatus`
- `GET /uptime-kuma/stats` → `UptimeStats`
- `GET /uptime-kuma/dashboard` → `{ status, upCount, downCount, totalCount, uptimePercent }`
- `GET /uptime-kuma/status-pages` → `{ statusPages, total }`
- `GET /uptime-kuma/health` → `{ healthy, message }`
- `POST /uptime-kuma/monitors/:id/pause` → `{ success: true, message }`
- `POST /uptime-kuma/monitors/:id/resume` → `{ success: true, message }`

9) **GitHub Actions**
- `GET /repositories/:repo/actions/workflows` → `{ workflows, total }`
- `GET /repositories/:repo/actions/runs?workflow_id&branch&status&per_page&page` → `{ runs, total }`
- `GET /repositories/:repo/actions/runs/:runId` → `{ run }`
- `GET /repositories/:repo/actions/runs/:runId/jobs` → `{ jobs, total }`
- `GET /repositories/:repo/actions/summary?branch` → `Build summary`
- `POST /repositories/:repo/actions/runs/:runId/rerun` → `{ success, message }`
- `POST /repositories/:repo/actions/runs/:runId/rerun-failed` → `{ success, message }`
- `POST /repositories/:repo/actions/runs/:runId/cancel` → `{ success, message }`
- `POST /repositories/:repo/actions/workflows/:workflowId/dispatches`  
  - Body: `{ ref, inputs? }`  
  - Response: `202 { success, message }`

10) **Auth & Permissions**
- `GET /auth/user` → `{ authenticated, user? }`
- `GET /auth/organizations` → `{ organizations }`
- `GET /permissions` → `{ userId, email, displayName, roles, permissions, groups }`
- `POST /permissions/check` body `{ permissions: string[] }` → `{ userId, roles, results }`
- `GET /permissions/roles` → `{ roles: [{ role, permissions }] }`
- `GET /permissions/all` → `{ permissions, roles }` (admin‑only)

11) **Pull Requests**
- `GET /repositories/:repo/compare/:base...:head` → `{ comparison }`
- `POST /repositories/:repo/branches` body `{ branch, from_branch }` → `{ branch }`
- `GET /repositories/:repo/pulls?state&sort&direction` → `{ pulls, total }`
- `POST /repositories/:repo/pulls` body `{ title, body?, head, base }` → `{ pull }`
- `POST /repositories/:repo/pulls/with-changes` body `{ title, body?, base, newBranchName, baseBranch, filePath, commitMessage, content? | fieldPath/fieldValue }` → `{ pull }`
- `GET /repositories/:repo/pulls/:number` → `{ pull }`
- `GET /repositories/:repo/pulls/:number/files` → `{ files, total }`
- `POST /repositories/:repo/pulls/:number/merge` body `{ commit_title?, commit_message?, merge_method? }` → `{ result }`
- `POST /repositories/:repo/pulls/:number/reviewers` body `{ reviewers[], team_reviewers? }` → `{ result }`
- `POST /repositories/:repo/pulls/:number/assignees` body `{ assignees[] }` → `{ result }`
- `GET /repositories/:repo/pulls/:number/comments` → `{ comments }`
- `POST /repositories/:repo/pulls/:number/comments` body `{ body }` → `{ comment }`
- `GET /repositories/:repo/pulls/:number/status-checks` → `{ checks }`
- `GET /repositories/:repo/pulls/:number/reviews` → `{ reviews }`
- `GET /repositories/:repo/pulls/:number/timeline` → `{ events }`

12) **Maturity / Cost**
- `GET /maturity/:owner/:repo` → `MaturityResult`
- `GET /maturity/:owner/:repo/badge` → SVG
- `GET /cost/summary?period&service` → `CostSummary`
- `GET /cost/recommendations` → `{ recommendations }`
- `GET /cost/anomalies` → `{ anomalies }`
- `GET /cost/forecast?months` → forecast payload

**Hooks (plugins/gitops/src/hooks/)**

- `usePermissions` — `plugins/gitops/src/hooks/usePermissions.ts`  
  - Fetches `/api/gitops/permissions`, returns:  
    - `loading`, `error`, `context`  
    - `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `hasRole`  
    - `isAdmin`, `isOperator`, `isDeveloper`, `isViewer`  
    - `refresh`  
  - Used by `RequirePermission` component (guards UI)

**Configuration**

1) **app-config.yaml** — `app-config.yaml`  
Key sections:
- `app` — title, baseUrl
- `backend` — baseUrl, listen, CSP, CORS, database (Postgres)
- `auth` — provider configs: guest, GitHub, Google, Microsoft, GitLab, OIDC; session secret
- `integrations` — GitHub/GitLab tokens for Backstage integrations
- `gitops` — plugin settings: GitHub org/token/useOAuthToken, GitLab enabled/baseUrl/token/useOAuthToken, auth allowUnauthenticated, ArgoCD, Grafana, Uptime Kuma
- `catalog`, `techdocs` — standard Backstage config

2) **Helm values.yaml** — `deployment/helm/values.yaml`  
Key sections:
- `image`, `service`, `ingress`, `resources`, `autoscaling`, `nodeSelector`, `affinity`, probes
- `postgres` (embedded or external)
- `auth` (providers and guest policy)
- `gitopsAuth`, `gitops` (use OAuth token)
- `grafana`, `gitlab`, `uptimeKuma`
- `redis` (optional)
- `backstage`, `scaffolder`, `catalog`
- `secrets` (kubernetes / sealed / external secrets)
- `haproxy` optional internal LB

**Authentication Flow (OAuth/SSO end-to-end)**

1) **Frontend sign‑in**  
- Backstage handles auth providers configured under `auth` in `app-config.yaml`.  
- OAuth dialogs and session management are handled by Backstage core (`OAuthRequestDialog`, `SignInPage`) in `packages/app/src/App.tsx`.

2) **Backend auth policy**  
- GitOps backend registers auth policy in `plugins/gitops-backend/src/plugin.ts`.  
- If `gitops.auth.allowUnauthenticated` is true, plugin routes allow unauthenticated requests. Otherwise `user-cookie` is required.

3) **User context + token extraction**  
- Backstage auth middleware attaches user info to `req.user` and headers.  
- `AuthTokenService` (`plugins/gitops-backend/src/services/AuthTokenService.ts`) extracts tokens from:
  - `req.credentials.token` (Backstage credentials)
  - session (`req.session.passport.user.accessToken`)
  - custom headers (`x-github-token`, `x-gitlab-token`)
  - auth header `Bearer github:...`

4) **Permissions**  
- `PermissionService` reads `x-backstage-user-*` headers to build roles/permissions.  
- `GET /api/gitops/permissions` is used by `usePermissions` hook in the UI.

5) **Important note**  
- Current GitHub/GitLab service calls in `router.ts` instantiate `GitHubService`/`GitLabService` with static tokens (config).  
- `AuthTokenService` is used for `/auth/*` endpoints and organization listing, but **user‑scoped tokens are not currently wired into `GitHubService`**. This is a gap if you intend to fully use OAuth user tokens for all GitHub operations.

**Data Flow (UI → Backend → External Services)**

1) **Repository browsing + file read**
- UI: `RepositoryBrowser` → `GitOpsApi.listRepositories/ listBranches/ getFileContent`.
- Backend: `/repositories`, `/repositories/:repo/branches`, `/repositories/:repo/content`.
- Service: `GitHubService` → GitHub API (or mock).
- UI shows file preview and opens `FileEditor`.

2) **Bulk file update**
- UI: `FileEditor` → `GitOpsApi.updateFile` (bulk update).
- Backend: `/repositories/:repo/files/update` → `BulkOperationService.createBulkUpdate`.
- Service: `BulkOperationService` spawns async tasks → `GitHubService.updateFile`.
- Audit: `AuditService.logCommit` per branch.
- UI: `OperationsTracker` polls `/bulk-operations` and shows progress.

3) **PR creation (with changes)**
- UI: `CreatePullRequestDialog` → `POST /pulls/with-changes`.
- Backend: create branch → get file → apply YAML field update or full content → commit → create PR.

4) **PR review flow**
- UI: `PullRequestList`/`PullRequestDetails` → PR endpoints.
- Backend: GitHubService methods for PR details, files, comments, reviews, status checks, merge.

5) **ArgoCD**
- UI: `ArgoCDDashboard` → `/argocd/applications`.
- Backend: `ArgoCDService` → ArgoCD API (or mock).
- Sync: `POST /argocd/sync` → `ArgoCDService.syncApplications` + audit logs.

6) **Grafana dashboards**
- UI: `GrafanaDashboards` uses discovery API → `/grafana/dashboards`.
- Backend: `GrafanaService` queries Grafana.

7) **GitHub Actions**
- UI: `GitHubActionsDashboard` uses REST endpoints for workflows/runs/jobs.
- Backend: `GitHubActionsService` calls GitHub API.

8) **Audit + permissions**
- UI: `AuditLogViewer` uses `/audit-logs`.
- UI: `usePermissions` uses `/permissions`; `RequirePermission` gates UI.

**Code Examples**

1) **Frontend API usage (GitOps API client)**  
`plugins/gitops/src/api/GitOpsApi.ts`
```ts
const gitOpsApi = useApi(gitOpsApiRef);
const { repositories } = await gitOpsApi.listRepositories();
const { entries } = await gitOpsApi.getFileTree('rli-use2', 'master', 'app/charts');
```

2) **Bulk update call from UI**  
`plugins/gitops/src/components/FileEditor/FileEditor.tsx`
```ts
await gitOpsApi.updateFile(repository, {
  branches: selectedBranches,
  path: fileContent.path,
  message: commitMessage,
  fieldPath,
  fieldValue,
});
```

3) **Backend route signature (bulk update)**  
`plugins/gitops-backend/src/service/router.ts`
```ts
router.post('/repositories/:repo/files/update', bulkOperationsRateLimiter, asyncHandler(async (req, res) => {
  const params = validate<UpdateFileRequest>(updateFileSchema, { repository: repo, ...req.body });
  const operationId = await bulkOperationService.createBulkUpdate({ ... });
  res.status(202).json({ operation_id: operationId, status: 'pending' });
}));
```

**Suggested Next Steps**

1) If you want per‑user OAuth tokens to be used for GitHub/GitLab calls, wire `AuthTokenService.getGitHubToken/getGitLabToken` into `GitHubService`/`GitLabService` construction in `plugins/gitops-backend/src/service/router.ts`.  
2) Decide whether to replace mock data in `ArgoCDService`, `CostService`, `GoldenSignalsCard`, and `S3FileBrowser` with real backends.