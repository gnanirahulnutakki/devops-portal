# DevOps Portal - Complete Feature Inventory & Wiring Architecture

## Executive Summary

The **DevOps Portal** is a comprehensive Backstage-based platform for GitOps operations, multi-cloud monitoring, and developer productivity. It features:

- **15+ Core Features** across authentication, GitOps, monitoring, CI/CD, and operations
- **80+ API Endpoints** with RESTful architecture
- **7 Database Tables** with PostgreSQL for audit, operations, and user management
- **20+ Services** for GitHub, GitLab, ArgoCD, Grafana, Uptime Kuma integrations
- **45+ React Components** for rich UI experiences
- **Multi-Provider OAuth** (GitHub, Google, Microsoft, GitLab, OIDC)
- **Advanced Security** with 2FA, RBAC, rate limiting, and encrypted storage

---

## Table of Contents

1. [Complete Feature Inventory](#1-complete-feature-inventory)
   - [Authentication & Authorization](#11-authentication--authorization-features)
   - [GitOps & Repository Management](#12-gitops--repository-management-features)
   - [Continuous Deployment & ArgoCD](#13-continuous-deployment--argocd-features)
   - [CI/CD & GitHub Actions](#14-cicd--github-actions-features)
   - [Monitoring & Observability](#15-monitoring--observability-features)
   - [Operations & Administration](#16-operations--administration-features)
   - [AI & Analytics](#17-ai--analytics-features)
   - [Home Page Dashboard](#18-home-page-dashboard-features)
   - [Additional Features](#19-additional-features)

2. [Architecture & Wiring](#2-architecture--wiring)
   - [Project Structure](#21-project-structure)
   - [Data Flow Architecture](#22-data-flow-architecture)
   - [Authentication Flow](#23-authentication-flow)
   - [Database Schema](#24-database-schema)
   - [API Endpoint Inventory](#25-api-endpoint-inventory)
   - [Security Features](#26-security-features)

3. [Configuration Management](#3-configuration-management)
4. [Deployment Architecture](#4-deployment-architecture)
5. [Key Files Reference](#5-key-files-reference)
6. [Technology Stack](#6-technology-stack)

---

## 1. COMPLETE FEATURE INVENTORY

### 1.1 Authentication & Authorization Features

#### Multi-Provider OAuth Authentication
**Location:** `packages/app/src/components/auth/SignInPage.tsx`

**Providers Supported:**

1. **GitHub OAuth** ✅ (Recommended for developers)
   - Scopes: `repo`, `user`, `read:org`, `workflow`
   - User-scoped token passthrough for API calls
   - Organization membership verification

2. **Google OAuth** ✅ (Google Workspace users)
   - Email-based user matching
   - Profile photo integration

3. **Microsoft OAuth** ✅ (Azure AD / Microsoft 365)
   - Tenant-based authentication
   - Azure AD integration
   - Config: Client ID, Secret, Tenant ID

4. **GitLab OAuth** ✅ (GitLab.com and self-hosted)
   - Username-based matching
   - Self-hosted GitLab support

5. **Generic OIDC** ✅ (Enterprise SSO)
   - Compatible with: Okta, Auth0, Keycloak, OneLogin
   - Standard OIDC flow
   - Metadata URL-based discovery

6. **Guest Access** ✅ (Development mode only)
   - No authentication required
   - Uses static API tokens

**UI Features:**
- Branded login page (Radiant Logic gradient design)
- Provider selection cards with icons
- "Recommended" badges for preferred providers
- OAuth scope display
- Error handling with user-friendly messages
- Loading states and animations

#### Local Authentication System
**Migration:** `plugins/gitops-backend/migrations/003_create_users.ts`
**Service:** `plugins/gitops-backend/src/services/LocalAuthService.ts`

**Features:**
- Username/password authentication
- User registration with email verification
- Password requirements enforcement
- Bcrypt password hashing (cost factor 12)
- Password history tracking (prevent reuse)
- Password reset via email token
- Account lockout after failed attempts
- Brute force protection
- Force password change capability
- Admin-created user support

#### Two-Factor Authentication (2FA)
**Migration:** `plugins/gitops-backend/migrations/005_create_user_2fa.ts`
**Service:** `plugins/gitops-backend/src/services/TwoFactorAuthService.ts`

**Features:**
- **TOTP (Time-Based One-Time Password)** - RFC 6238 compliant
- **QR Code Generation** - Scan with Google Authenticator, Authy, etc.
- **8 Backup Codes** - One-time use, bcrypt hashed
- **Trusted Devices** - 30-day "remember this device" feature
- **Encrypted Secret Storage** - AES-256-GCM encryption at rest
- **Recovery Options** - Email/phone recovery tokens

**API Endpoints:**
- `POST /auth/2fa/setup` - Initialize 2FA for user
- `POST /auth/2fa/verify` - Verify TOTP token
- `POST /auth/2fa/disable` - Disable 2FA
- `GET /auth/2fa/backup-codes` - Regenerate backup codes

#### Session Management
**Migration:** `plugins/gitops-backend/migrations/004_create_user_sessions.ts`

**Features:**
- JWT token-based sessions
- Token hashing (SHA-256, never plaintext storage)
- Configurable expiration (default: 24 hours)
- Refresh token support with rotation
- Device fingerprinting
- IP address tracking
- User agent logging
- 2FA verification state tracking
- Trusted device management
- Session revocation (logout, admin revoke)
- Session types: web, api, mobile

#### Role-Based Access Control (RBAC)
**Service:** `plugins/gitops-backend/src/services/PermissionService.ts`

**Three-Tier Role Model:**

1. **USER** (Viewer)
   - Read-only access to repositories, PRs, deployments
   - View audit logs
   - View monitoring dashboards

2. **READWRITE** (Developer/Operator)
   - All USER permissions
   - Create/update files
   - Create pull requests
   - Bulk update operations
   - Trigger workflows
   - Comment on PRs

3. **ADMIN** (Administrator)
   - All READWRITE permissions
   - User management (create, update, delete)
   - System settings
   - Audit log management
   - Connector management
   - Permission assignment

**Granular Permissions (30+):**
- Repository: `read`, `write`, `delete`
- Branch: `create`, `delete`
- File: `read`, `write`, `bulk_update`
- Pull Request: `create`, `merge`, `approve`, `comment`
- ArgoCD: `read`, `sync`, `rollback`, `delete`
- GitHub Actions: `read`, `trigger`, `cancel`, `rerun`
- Grafana: `read`, `edit`
- Admin: `users`, `settings`, `audit`
- Connectors: `read`, `manage`
- Tasks: `read`, `create`, `cancel`, `manage`

**Middleware:**
- `requirePermission(permission)` - Check specific permission
- `requireRole(role)` - Check minimum role level
- Per-endpoint permission enforcement

#### OAuth Connector System
**Migration:** `plugins/gitops-backend/migrations/006_create_user_connectors.ts`
**Service:** `plugins/gitops-backend/src/services/ConnectorService.ts`

**Purpose:** Link external service accounts to DevOps Portal user

**Supported Providers:**
- GitHub
- GitLab
- Microsoft/Azure
- Google

**Features:**
- OAuth token storage (encrypted AES-256-GCM)
- Automatic token refresh
- Token expiration tracking
- Scopes management
- Connection status monitoring
- Disconnect/revoke capability
- CSRF protection (OAuth state parameter)
- One user can connect multiple providers

**Token Security:**
- Access tokens encrypted at rest
- Refresh tokens encrypted separately
- 50-minute client-side cache
- Automatic expiration handling

---

### 1.2 GitOps & Repository Management Features

#### Repository Browser
**Component:** `plugins/gitops/src/components/RepositoryBrowser/RepositoryBrowser.tsx`

**Features:**
- List all organization repositories
- Search/filter repositories
- Branch selection dropdown
- File tree navigation (directory browsing)
- Multi-repository view
- Repository metadata display (stars, forks, language)
- Last commit information
- User-scoped access (only sees repos they have access to)

**Backend Support:**
- `GET /api/gitops/repositories` - List repos with filters
- `GET /api/gitops/repositories/:repo/branches` - List branches
- `GET /api/gitops/repositories/:repo/tree` - Get file tree
- Uses GitHub OAuth token passthrough for user-scoped access

#### File Editor
**Component:** `plugins/gitops/src/components/FileEditor/FileEditor.tsx`

**Features:**
- **Monaco Editor** integration (VS Code-like experience)
- Syntax highlighting for YAML, JSON, JavaScript, TypeScript, etc.
- Line numbers and code folding
- Auto-completion and IntelliSense
- Diff viewer for changes
- Field-level YAML editing with dot notation (e.g., `fid.image.tag`)
- Commit message input
- Author/committer configuration
- Real-time validation

**Field Selector:**
- `plugins/gitops/src/components/FieldSelector/FieldSelector.tsx`
- YAML path picker (navigate nested fields)
- Auto-complete for YAML keys
- Value preview before update

**Utility:**
- `plugins/gitops-backend/src/utils/yamlUtils.ts` - YAML field manipulation

#### Bulk Multi-Branch Updates
**Service:** `plugins/gitops-backend/src/services/BulkOperationService.ts`
**Migration:** `plugins/gitops-backend/migrations/002_create_bulk_operations.ts`

**Purpose:** Update the same file across 50+ branches in parallel

**Features:**
- Target multiple branches simultaneously
- Field-level updates (change single YAML field across all branches)
- Full file replacement
- Commit message customization
- Progress tracking with percentages
- Per-branch results (success/failure with error messages)
- Rollback support
- Preview changes before commit
- Rate limiting (10 requests/min)

**Operation Lifecycle:**
```
pending → in_progress → completed/failed/partial
```

**Rollback:**
- Stores original commit SHAs
- Can revert all branches to previous state
- Audit trail of rollback operation

**API Endpoints:**
- `POST /api/gitops/repositories/:repo/files/update` - Create bulk operation
- `GET /api/gitops/bulk-operations/:id` - Get operation status
- `GET /api/gitops/bulk-operations` - List all operations

**Database Tracking:**
- Total targets, successful count, failed count, pending count
- Progress percentage (0-100)
- Results array: `[{branch, status, commit_sha, error}]`
- Metadata: IP address, user agent, timestamps

#### Pull Request Management
**Component:** `plugins/gitops/src/components/PRManagement/PRManagement.tsx`

**Features:**

**Pull Request List:**
- `plugins/gitops/src/components/PullRequestList/PullRequestList.tsx`
- Filter by state (open, closed, merged, draft)
- Sort by created, updated, comments
- Pagination support
- PR metadata: title, author, labels, assignees
- Status badges (draft, approved, changes requested)

**Pull Request Details:**
- `plugins/gitops/src/components/PullRequestDetails/PullRequestDetails.tsx`
- Full PR description with Markdown rendering
- Branch information (base → head)
- Merge conflict detection
- Mergeable status

**PR Reviews:**
- `plugins/gitops/src/components/PRReviewStatus/PRReviewStatus.tsx`
- Reviewer list with approval status
- Review comments count
- Approval/changes requested/pending states

**Status Checks:**
- `plugins/gitops/src/components/PRStatusChecks/PRStatusChecks.tsx`
- CI/CD pipeline status
- Required checks enforcement
- Check run details with logs

**Comments & Discussion:**
- `plugins/gitops/src/components/PRComments/PRComments.tsx`
- Comment threads
- Reply to comments
- Add new comments
- Inline code comments (file-level)

**Timeline:**
- `plugins/gitops/src/components/PRTimeline/PRTimeline.tsx`
- Event history (commits, comments, reviews, status changes)
- Chronological view
- User avatars and timestamps

**File Changes:**
- Files changed list with diff statistics (+/- lines)
- Syntax-highlighted diffs
- Side-by-side or unified diff view

**Create Pull Request:**
- `plugins/gitops/src/components/CreatePullRequestDialog/CreatePullRequestDialog.tsx`
- Title and description input
- Base and head branch selection
- Reviewer/assignee selection
- Label assignment
- Draft PR support
- Create PR with file changes (atomic operation)

**Merge Pull Request:**
- Merge strategies: merge commit, squash, rebase
- Commit message editing
- Delete branch after merge option

**API Endpoints:**
- `GET /api/gitops/repositories/:repo/pulls` - List PRs
- `POST /api/gitops/repositories/:repo/pulls` - Create PR
- `GET /api/gitops/repositories/:repo/pulls/:number` - PR details
- `GET /api/gitops/repositories/:repo/pulls/:number/files` - Changed files
- `GET /api/gitops/repositories/:repo/pulls/:number/comments` - Comments
- `POST /api/gitops/repositories/:repo/pulls/:number/comments` - Add comment
- `GET /api/gitops/repositories/:repo/pulls/:number/reviews` - Reviews
- `GET /api/gitops/repositories/:repo/pulls/:number/status-checks` - Checks
- `GET /api/gitops/repositories/:repo/pulls/:number/timeline` - Timeline
- `POST /api/gitops/repositories/:repo/pulls/:number/merge` - Merge PR
- `POST /api/gitops/repositories/:repo/pulls/:number/reviewers` - Add reviewers

#### Diff Viewer
**Component:** `plugins/gitops/src/components/DiffViewer/DiffViewer.tsx`

**Features:**
- Multi-file diff visualization
- Syntax highlighting
- Line-by-line comparison
- Unified or split view
- Added/removed/modified indicators
- Collapsible file sections

#### Commit to Branch Dialog
**Component:** `plugins/gitops/src/components/CommitToBranchDialog/CommitToBranchDialog.tsx`

**Features:**
- Multi-branch selection
- Commit message input
- Author/committer configuration
- Change preview
- Bulk commit support

#### GitLab Integration (Optional)
**Service:** `plugins/gitops-backend/src/services/GitLabService.ts`

**Features:**
- Project listing
- File tree navigation
- File content retrieval
- File updates with commits
- Merge request listing
- Create merge requests
- Pipeline monitoring

**Configuration:**
```yaml
gitops:
  gitlab:
    enabled: true
    baseUrl: https://gitlab.com  # or self-hosted URL
    token: ${GITLAB_TOKEN}
    useOAuthToken: true
```

**API Endpoints:**
- `GET /api/gitops/gitlab/projects` - List projects
- `GET /api/gitops/gitlab/projects/:id/branches` - Branches
- `GET /api/gitops/gitlab/projects/:id/tree` - File tree
- `GET /api/gitops/gitlab/projects/:id/files` - File content
- `PUT /api/gitops/gitlab/projects/:id/files` - Update file
- `GET /api/gitops/gitlab/projects/:id/merge_requests` - MRs
- `POST /api/gitops/gitlab/projects/:id/merge_requests` - Create MR

---

### 1.3 Continuous Deployment & ArgoCD Features

#### ArgoCD Dashboard
**Component:** `plugins/gitops/src/components/ArgoCDDashboard/ArgoCDDashboard.tsx`
**Service:** `plugins/gitops-backend/src/services/ArgoCDService.ts`

**Features:**

- **Application Listing**
  - All ArgoCD applications with health status
  - Filter by name, namespace, cluster
  - Search functionality
  - Sort by various fields

- **Application Details**
  - Health status (Healthy, Progressing, Degraded, Suspended, Missing)
  - Sync status (Synced, OutOfSync, Unknown)
  - Git repository and revision
  - Deployed resources (Pods, Services, Deployments, etc.)
  - Resource health per component

- **Sync Operations**
  - Manual sync trigger
  - Sync options: prune (delete removed resources), dry-run
  - Selective resource sync
  - Sync status tracking

- **Application History**
  - Deployment history
  - Revision comparison
  - Rollback capability

**Color-Coded Status:**
- 🟢 Green: Healthy + Synced
- 🟡 Yellow: Progressing or OutOfSync
- 🔴 Red: Degraded or Failed

**API Endpoints:**
- `GET /api/gitops/argocd/applications` - List applications
- `GET /api/gitops/argocd/applications/:name` - Application details
- `POST /api/gitops/argocd/applications/:name/sync` - Trigger sync
- `GET /api/gitops/argocd/applications/:name/sync-status` - Sync status

**Configuration:**
```yaml
gitops:
  argocd:
    enabled: true
    url: https://argocd.example.com
    token: ${ARGOCD_TOKEN}
    namespace: argocd  # optional
```

**Rate Limiting:**
- Sync operations: 30 requests/minute

---

### 1.4 CI/CD & GitHub Actions Features

#### GitHub Actions Dashboard
**Component:** `plugins/gitops/src/components/GitHubActionsPage/GitHubActionsPage.tsx`
**Service:** `plugins/gitops-backend/src/services/GitHubActionsService.ts`

**Features:**

**Workflow Management:**
- List all workflows in repository
- Workflow status summary by branch
- Enable/disable workflows

**Workflow Runs:**
- List workflow runs with filters:
  - Status: success, failure, in_progress, queued, cancelled
  - Branch filter
  - Actor filter (who triggered)
  - Event filter (push, pull_request, schedule, workflow_dispatch)
- Sort by created date
- Pagination support
- Run duration display
- Trigger type indicator

**Run Details:**
- Job list with status
- Step-by-step logs
- Artifact downloads
- Timing information
- Conclusion: success, failure, cancelled, skipped, timed_out

**Actions:**
- ▶️ **Rerun Workflow** - Restart entire workflow
- 🔄 **Rerun Failed Jobs** - Only rerun failed jobs
- ❌ **Cancel Run** - Stop running workflow
- 🚀 **Trigger Workflow** - Manual dispatch with inputs

**Build Status Summary:**
- Success/failure counts by branch
- Latest build status per branch
- Average build duration

**API Endpoints:**
- `GET /api/gitops/repositories/:repo/actions/workflows` - List workflows
- `GET /api/gitops/repositories/:repo/actions/runs` - Workflow runs
- `GET /api/gitops/repositories/:repo/actions/runs/:id` - Run details
- `GET /api/gitops/repositories/:repo/actions/runs/:id/jobs` - Jobs
- `POST /api/gitops/repositories/:repo/actions/runs/:id/rerun` - Rerun
- `POST /api/gitops/repositories/:repo/actions/runs/:id/rerun-failed` - Rerun failed
- `POST /api/gitops/repositories/:repo/actions/runs/:id/cancel` - Cancel
- `POST /api/gitops/repositories/:repo/actions/workflows/:id/dispatches` - Trigger

**Workflow Dispatch Inputs:**
- Custom input fields for manual triggers
- Type validation (string, boolean, choice, environment)
- Required/optional fields

---

### 1.5 Monitoring & Observability Features

#### Monitoring Dashboard (Unified)
**Component:** `plugins/gitops/src/components/MonitoringPage/MonitoringPage.tsx`

**Three-Tab Dashboard:**

**Tab 1: Uptime Monitors (Uptime Kuma)**
- Monitor cards with status indicators
- Monitor types: HTTP/HTTPS, DNS, TCP Port, Ping
- Uptime percentage (24h, 7d, 30d)
- Response time in milliseconds
- Last check timestamp
- 30-day uptime visualization (bar chart)
- Status: ✅ Up, ❌ Down, ⏸️ Paused, ⏳ Pending
- Color-coded borders based on status

**Tab 2: Grafana Dashboards**
- Dashboard selector dropdown
- Grid of 6 dashboard preview cards
- Tags and folder badges
- Embedded dashboard iframe (600px height)
- "Open in Grafana" button
- Dashboard search and filtering
- Auto-refresh support

**Tab 3: Alerts** (Coming Soon)
- Placeholder for alert management
- Intended for Grafana, Prometheus, Uptime Kuma alerts
- Alert severity levels
- Acknowledgement workflow

**Summary Cards:**
- 🟢 Services Up (count)
- 🔴 Services Down (count)
- 📊 Average Uptime (percentage)
- ⏱️ Average Response Time (ms)

**Service:** `plugins/gitops-backend/src/services/UptimeKumaService.ts`

**API Endpoints:**
- `GET /api/gitops/uptime-kuma/monitors` - List monitors
- `GET /api/gitops/uptime-kuma/monitors/:id` - Monitor details
- `GET /api/gitops/uptime-kuma/stats` - Overall statistics
- `GET /api/gitops/uptime-kuma/dashboard` - Dashboard summary
- `POST /api/gitops/uptime-kuma/monitors/:id/pause` - Pause monitor
- `POST /api/gitops/uptime-kuma/monitors/:id/resume` - Resume monitor

#### Grafana Integration
**Component:** `plugins/gitops/src/components/GrafanaPage/GrafanaPage.tsx`
**Service:** `plugins/gitops-backend/src/services/GrafanaService.ts`

**Features:**
- Dashboard listing with folders
- Dashboard search
- Embedded dashboards with iframe
- Theme synchronization (light/dark)
- Panel-level access
- Metrics query support
- Data source listing
- Auto-refresh via kiosk mode

**API Endpoints:**
- `GET /api/gitops/grafana/dashboards` - List dashboards
- `GET /api/gitops/grafana/dashboards/:uid` - Dashboard details
- `GET /api/gitops/grafana/folders` - Dashboard folders
- `GET /api/gitops/grafana/search` - Search dashboards

**Configuration:**
```yaml
gitops:
  grafana:
    enabled: true
    url: https://grafana.example.com
    token: ${GRAFANA_TOKEN}
```

#### Golden Signals Card
**Component:** `plugins/gitops/src/components/GoldenSignals/GoldenSignalsCard.tsx`

**Purpose:** Display key SLI (Service Level Indicators) metrics

**Four Golden Signals:**
1. **Latency** - Request response time
2. **Traffic** - Requests per second
3. **Errors** - Error rate percentage
4. **Saturation** - Resource utilization

**Features:**
- Real-time metric display
- Threshold-based color coding
- Sparkline charts
- Time range selector

---

### 1.6 Operations & Administration Features

#### Operations Tracker
**Component:** `plugins/gitops/src/components/OperationsTracker/OperationsTracker.tsx`
**Service:** `plugins/gitops-backend/src/services/BulkOperationService.ts`

**Purpose:** Monitor and track bulk operations and deployments

**Features:**
- Real-time progress bars
- Operation status (pending, in_progress, completed, failed, partial)
- Per-branch results
- Success/failure counts
- Error messages
- Retry failed operations
- Cancel pending operations
- Operation history with filters

**Tracked Operations:**
- Bulk file updates
- Multi-branch commits
- ArgoCD syncs
- Workflow triggers

**Status Indicators:**
- ⏳ Pending
- 🔄 In Progress (with percentage)
- ✅ Completed
- ❌ Failed
- ⚠️ Partial (some branches succeeded, some failed)

#### Audit Log Viewer
**Component:** `plugins/gitops/src/components/AuditLogViewer/AuditLogViewer.tsx`
**Migration:** `plugins/gitops-backend/migrations/001_create_audit_logs.ts`
**Service:** `plugins/gitops-backend/src/services/AuditService.ts`

**Purpose:** Complete audit trail of all operations

**Logged Operations:**
- `read` - File/resource reads
- `update` - File updates
- `commit` - Git commits
- `sync` - ArgoCD syncs
- `delete` - Deletions

**Captured Data:**
- User ID, email, name
- Operation type
- Resource type (repository, branch, file, argocd_app)
- Resource ID
- Old value → New value (for changes)
- Git diff
- Commit SHA
- IP address
- User agent
- Status (success, failure, pending)
- Error message (if failed)
- Timestamp

**Filtering:**
- Date range (start_date, end_date)
- User filter
- Operation type filter
- Resource type filter
- Status filter
- Repository/branch filter

**API Endpoints:**
- `GET /api/gitops/audit-logs` - Query logs with filters
- `GET /api/gitops/audit-logs/:id` - Log details

**Compliance Features:**
- Immutable log entries (no deletion)
- Tamper-proof timestamps
- Full change history

#### Orchestrator Service
**Migration:** `plugins/gitops-backend/migrations/007_create_orchestrator_tasks.ts`
**Service:** `plugins/gitops-backend/src/services/OrchestratorService.ts`

**Purpose:** Coordinate complex multi-service operations

**Task Types:**
- `bulk_update` - Bulk file updates
- `deployment` - Application deployments
- `sync` - ArgoCD syncs
- `rollback` - Rollback operations
- `pr_create` - Pull request creation
- `pr_merge` - Pull request merging
- `workflow_run` - CI/CD workflow execution
- `custom` - Custom tasks

**Features:**
- Task dependencies (depends_on, blocked_by)
- Workflow coordination
- Progress tracking with WebSocket updates
- Retry logic with exponential backoff
- Priority queue (1-10)
- Task cancellation
- Worker assignment
- Timeout enforcement
- Notification support (on completion)

**Task Lifecycle:**
```
pending → queued → running → completed/failed/cancelled/timeout
```

**Task Fields:**
- Total items, completed items, failed items
- Progress percentage and message
- Input data, output data, context (JSONB)
- Retry count, max retries
- Scheduled time, actual duration
- Error message, error stack, error code

#### Day-2 Operations
**Component:** `plugins/gitops/src/components/Day2Operations/Day2OperationsCard.tsx`
**Service:** `plugins/gitops-backend/src/services/Day2OperationsService.ts`

**Purpose:** Post-deployment operational tasks

**Operation Types:**
- Restart deployment
- Scale replicas
- Update configuration
- Run database migration
- Clear cache
- Backup database
- Restore from backup
- Health check
- Performance tuning

**Features:**
- Operation definitions with parameters
- Input validation (schema-based)
- Approval workflow (for dangerous operations)
- Execution history
- Rollback support
- Scheduled execution
- Operation templates

**API Endpoints:**
- `GET /api/gitops/operations/definitions` - Available operations
- `POST /api/gitops/operations/execute` - Execute operation
- `POST /api/gitops/operations/:id/approve` - Approve operation
- `POST /api/gitops/operations/:id/cancel` - Cancel operation
- `GET /api/gitops/operations/history` - Operation history

#### Admin Panel
**Component:** `plugins/gitops/src/components/AdminPanel/AdminPanel.tsx`

**Purpose:** User and system administration (Admin role only)

**Features:**

**User Management:**
- List all users
- Create new users
- Update user details (email, role, status)
- Deactivate/reactivate users
- Force password change
- Reset 2FA
- View user sessions
- Revoke sessions

**Role Assignment:**
- Assign roles: USER, READWRITE, ADMIN
- Bulk role updates
- Group/team mapping

**System Settings:**
- Configure integrations
- Rate limit settings
- Security settings
- Feature flags

**Audit:**
- View all audit logs
- Export audit logs
- Compliance reports

#### Connector Management
**Component:** `plugins/gitops/src/components/ConnectorsPage/ConnectorsPage.tsx`
**Service:** `plugins/gitops-backend/src/services/ConnectorService.ts`

**Purpose:** Manage external service connections

**Features:**
- List available providers (GitHub, GitLab, Microsoft, Google)
- Connect new providers via OAuth
- View connected accounts
- Refresh tokens
- Disconnect/revoke connections
- Default connector selection
- Connection status monitoring

**OAuth Flow:**
1. User clicks "Connect GitHub"
2. Backend generates OAuth state (CSRF protection)
3. Redirect to provider OAuth page
4. User authorizes
5. Provider redirects back with code
6. Backend exchanges code for access token
7. Token encrypted and stored
8. Connection status: active

**API Endpoints:**
- `GET /api/gitops/connectors/providers` - Available providers
- `POST /api/gitops/connectors/oauth/initiate` - Start OAuth flow
- `POST /api/gitops/connectors/oauth/callback` - OAuth callback
- `GET /api/gitops/connectors` - List user's connectors
- `DELETE /api/gitops/connectors/:id` - Disconnect

---

### 1.7 AI & Analytics Features

#### AI-Powered Search
**Component:** `plugins/gitops/src/components/AISearch/AISearchCard.tsx`
**Service:** `plugins/gitops-backend/src/services/AISearchService.ts`

**Purpose:** RAG (Retrieval Augmented Generation) search across codebase

**Features:**
- Semantic search across multiple sources
- Question answering with context
- Document indexing
- Search sources:
  - Documentation
  - Code repositories
  - Configuration files
  - Runbooks
  - API documentation

**API Endpoints:**
- `GET /api/gitops/search` - Search across sources
- `POST /api/gitops/search/ask` - Ask question
- `POST /api/gitops/search/index` - Index document
- `GET /api/gitops/search/stats` - Index statistics

#### Repository Maturity Scorecard
**Component:** `plugins/gitops/src/components/MaturityScorecard/MaturityScorecard.tsx`
**Service:** `plugins/gitops-backend/src/services/MaturityService.ts`

**Purpose:** Assess DevOps maturity of repositories

**Scoring Criteria:**
- ✅ README.md present
- ✅ CI/CD pipeline configured
- ✅ Tests present (unit, integration)
- ✅ Code coverage > 80%
- ✅ Documentation (docs/ folder)
- ✅ License file
- ✅ Contributing guidelines
- ✅ Issue templates
- ✅ PR templates
- ✅ Security policy
- ✅ Dependency updates (Dependabot)
- ✅ Branch protection rules

**Maturity Levels:**
- 🔴 **Initial** (0-25%) - Basic repository
- 🟡 **Developing** (26-50%) - Some best practices
- 🟢 **Defined** (51-75%) - Good practices
- 🔵 **Managed** (76-90%) - Excellent practices
- 🟣 **Optimizing** (91-100%) - Best-in-class

**API Endpoints:**
- `GET /api/gitops/maturity/:owner/:repo` - Repository score
- `GET /api/gitops/maturity/:owner/:repo/badge` - SVG badge

#### Cost Insights
**Component:** `plugins/gitops/src/components/CostInsights/CostInsightsCard.tsx`
**Service:** `plugins/gitops-backend/src/services/CostService.ts`

**Purpose:** Cloud cost analysis and FinOps

**Features:**
- Cost summary by period (daily, weekly, monthly)
- Optimization recommendations
- Cost anomaly detection
- Forecast projections
- Cost allocation by:
  - Service/application
  - Team/department
  - Environment (dev, staging, prod)
  - Resource type

**API Endpoints:**
- `GET /api/gitops/cost/summary` - Cost summary
- `GET /api/gitops/cost/recommendations` - Optimization tips
- `GET /api/gitops/cost/anomalies` - Anomaly detection
- `GET /api/gitops/cost/forecast` - Future projections

---

### 1.8 Home Page Dashboard Features

#### Home Page
**Component:** `packages/app/src/components/home/HomePage.tsx`

**Features:**

**Hero Section:**
- Time-based greeting ("Good morning/afternoon/evening")
- User avatar from GitHub
- User login display with PR count badge
- Global search bar (repositories, services, docs)

**Statistics Cards (4 cards with gradients):**
1. 📊 **Open Pull Requests** (blue gradient)
2. ✅ **Healthy Deployments** (green gradient)
3. 📦 **Repositories** (orange gradient)
4. 🏢 **Organizations** (purple gradient)

**Pull Requests Widget:**
- **Component:** `plugins/gitops/src/components/HomeWidgets/MyPullRequestsWidget.tsx`
- 6 most recent user PRs
- Repository name with icon
- PR title, status (draft/labels)
- Time ago indicator
- Comment count
- Clickable cards → GitHub PR

**Services Widget (ArgoCD):**
- **Component:** `plugins/gitops/src/components/HomeWidgets/MyServicesWidget.tsx`
- 8 most recent services
- Health status color-coded border
- Namespace information
- Sync status chip (Synced/OutOfSync)
- Service name with cloud icon

**Recent Repositories:**
- 4 most recent repositories
- Language badge
- Star count, fork count
- Repository description (2-line truncation)
- External link icon

**System Health:**
- 4 service monitors:
  - ✅ GitHub API (latency in ms)
  - ✅ PostgreSQL (connection status)
  - ✅ ArgoCD (API status)
  - ✅ Grafana (API status)
- Status icons: OK/Error/Warning/Pending
- Refresh button

**Quick Actions Grid (6 items):**
1. 📂 **Repositories** - Browse & edit code
2. 🔀 **Pull Requests** - Review & merge
3. 🚀 **Deployments** - ArgoCD apps
4. 📊 **Metrics** - Grafana dashboards
5. ⚙️ **CI/CD** - GitHub Actions
6. 📚 **Catalog** - Service catalog

**Data Loading:**
- GitHub OAuth token auto-detection
- Dashboard auto-refresh every 2 minutes
- Parallel data fetching with `Promise.allSettled()`
- Skeleton loaders during loading
- Empty state messaging

**API Endpoint:**
- `GET /api/gitops/user/dashboard` - Comprehensive dashboard data

---

### 1.9 Additional Features

#### S3 File Browser
**Component:** `plugins/gitops/src/components/S3Page/S3Page.tsx`

**Features:**
- Browse AWS S3 buckets
- File listing with metadata
- File download capability
- Folder navigation
- Search within bucket

#### Documentation Page
**Component:** `plugins/gitops/src/components/DocumentationPage/DocumentationPage.tsx`

**Features:**
- Integrated documentation viewing
- Markdown rendering
- Search functionality
- Table of contents
- Code syntax highlighting

#### Permission Component
**Component:** `plugins/gitops/src/components/Permission/RequirePermission.tsx`

**Purpose:** Conditional rendering based on permissions

**Usage:**
```tsx
<RequirePermission permission="repository.write">
  <EditButton />
</RequirePermission>
```

**Features:**
- Show/hide components based on permissions
- Fallback UI for unauthorized users
- Role-based rendering

---

## 2. ARCHITECTURE & WIRING

### 2.1 Project Structure

```
/Users/nutakki/Documents/github/devops-portal/
├── packages/
│   ├── app/                           # Frontend React application
│   │   ├── src/
│   │   │   ├── App.tsx               # Main app config & routing
│   │   │   ├── apis.ts               # API factory configuration
│   │   │   ├── theme.ts              # Custom Radiant Logic themes
│   │   │   └── components/
│   │   │       ├── auth/
│   │   │       │   └── SignInPage.tsx  # Multi-provider OAuth login
│   │   │       ├── home/
│   │   │       │   └── HomePage.tsx    # Dashboard
│   │   │       └── Root/
│   │   │           ├── Root.tsx        # Navigation layout
│   │   │           ├── LogoFull.tsx    # Brand logo
│   │   │           └── LogoIcon.tsx    # Icon logo
│   │   └── package.json
│   └── backend/                       # Backstage backend
│       ├── src/
│       │   └── index.ts              # Plugin initialization
│       └── package.json
│
├── plugins/
│   ├── gitops/                        # Frontend GitOps plugin
│   │   ├── src/
│   │   │   ├── plugin.ts             # Plugin registration
│   │   │   ├── routes.ts             # Route definitions
│   │   │   ├── api/
│   │   │   │   └── GitOpsApi.ts      # API client (OAuth token passthrough)
│   │   │   ├── components/           # 45+ React components
│   │   │   │   ├── GitOpsPage/       # Main GitOps page (5 tabs)
│   │   │   │   ├── RepositoryBrowser/
│   │   │   │   ├── FileEditor/       # Monaco editor
│   │   │   │   ├── PRManagement/     # Pull requests
│   │   │   │   ├── ArgoCDDashboard/  # ArgoCD integration
│   │   │   │   ├── MonitoringPage/   # Unified monitoring
│   │   │   │   ├── GrafanaPage/      # Grafana dashboards
│   │   │   │   ├── GitHubActionsPage/ # CI/CD
│   │   │   │   ├── S3Page/           # S3 browser
│   │   │   │   ├── OperationsTracker/
│   │   │   │   ├── AuditLogViewer/
│   │   │   │   ├── AdminPanel/       # User management
│   │   │   │   ├── ConnectorsPage/   # OAuth connectors
│   │   │   │   ├── HomeWidgets/      # Dashboard widgets
│   │   │   │   └── ...
│   │   │   └── utils/
│   │   │       └── yamlUtils.ts      # YAML manipulation
│   │   └── package.json
│   │
│   └── gitops-backend/                # Backend GitOps plugin
│       ├── src/
│       │   ├── index.ts              # Plugin export
│       │   ├── plugin.ts             # Backend plugin registration
│       │   ├── service/
│       │   │   └── router.ts         # Main API router (2925 lines, 80+ endpoints)
│       │   ├── services/             # 20+ business logic services
│       │   │   ├── GitHubService.ts  # GitHub API integration
│       │   │   ├── GitLabService.ts  # GitLab integration
│       │   │   ├── ArgoCDService.ts  # ArgoCD integration
│       │   │   ├── GrafanaService.ts # Grafana integration
│       │   │   ├── UptimeKumaService.ts # Uptime monitoring
│       │   │   ├── GitHubActionsService.ts # CI/CD
│       │   │   ├── AuditService.ts   # Audit logging
│       │   │   ├── BulkOperationService.ts # Bulk operations
│       │   │   ├── PermissionService.ts # RBAC
│       │   │   ├── LocalAuthService.ts # Local auth
│       │   │   ├── TwoFactorAuthService.ts # 2FA
│       │   │   ├── AuthTokenService.ts # OAuth tokens
│       │   │   ├── OrchestratorService.ts # Task orchestration
│       │   │   ├── ConnectorService.ts # OAuth connectors
│       │   │   ├── MaturityService.ts # Repository scoring
│       │   │   ├── CostService.ts    # Cost analysis
│       │   │   ├── AISearchService.ts # AI search
│       │   │   ├── Day2OperationsService.ts # Ops tasks
│       │   │   └── HealthService.ts  # Health checks
│       │   ├── middleware/           # Security & utilities
│       │   │   ├── rateLimiter.ts    # Rate limiting
│       │   │   ├── securityHeaders.ts # OWASP headers
│       │   │   └── requestLogger.ts  # Request logging
│       │   ├── errors/
│       │   │   └── index.ts          # Error handling
│       │   ├── validation/
│       │   │   └── schemas.ts        # Joi validation schemas
│       │   └── utils/
│       │       ├── logger.ts         # Winston logging
│       │       ├── yamlUtils.ts      # YAML utilities
│       │       └── parallelExecutor.ts # Parallel execution
│       ├── migrations/               # Database schema (7 migrations)
│       │   ├── 001_create_audit_logs.ts
│       │   ├── 002_create_bulk_operations.ts
│       │   ├── 003_create_users.ts
│       │   ├── 004_create_user_sessions.ts
│       │   ├── 005_create_user_2fa.ts
│       │   ├── 006_create_user_connectors.ts
│       │   └── 007_create_orchestrator_tasks.ts
│       ├── knexfile.ts               # Database config
│       └── package.json
│
├── config/
│   ├── app-config.yaml               # Development config
│   └── app-config.production.yaml    # Production config
│
├── deployment/
│   ├── helm/                         # Kubernetes Helm charts
│   ├── docker/
│   │   ├── Dockerfile                # Multi-stage build
│   │   └── docker-compose.yml        # Docker Compose setup
│   └── scripts/                      # Deployment automation
│
├── package.json                      # Root workspace config
└── yarn.lock
```

### 2.2 Data Flow Architecture

#### Frontend to Backend Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                      (Port 3000)                                 │
│                                                                   │
│  User Browser                                                    │
│      ↓                                                            │
│  React Component (e.g., RepositoryBrowser)                      │
│      ↓                                                            │
│  useQuery() [React Query Cache]                                 │
│      ↓                                                            │
│  GitOpsApi.listRepositories()                                   │
│      ↓                                                            │
│  getGitHubToken() → githubAuthApi (Backstage)                  │
│      ↓ (cached 50 minutes)                                      │
│  Backstage FetchApi                                             │
│      ↓                                                            │
│  HTTP Request with headers:                                      │
│    - Cookie: backstage-session (auth cookie)                   │
│    - x-github-token: user-oauth-token                          │
│      ↓                                                            │
└───────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│                      (Port 7007)                                 │
│                                                                   │
│  Express HTTP Server                                             │
│      ↓                                                            │
│  GET /api/gitops/repositories                                   │
│      ↓                                                            │
│  Middleware Stack:                                               │
│    1. requestLoggerMiddleware() [Log user context]             │
│    2. securityHeadersMiddleware() [OWASP headers]              │
│    3. generalRateLimiter() [100 req/min]                       │
│    4. asyncHandler() [Error handling]                          │
│      ↓                                                            │
│  Router Handler (router.ts:2925)                                │
│      ↓                                                            │
│  getUserContext(req) → Extract user info                        │
│      ↓                                                            │
│  AuthTokenService.getGitHubToken(req)                          │
│    ├─ Check x-github-token header                              │
│    └─ Fallback to static config token                          │
│      ↓                                                            │
│  GitHubService.listRepositories(filter)                        │
│    ├─ Check useMockData flag                                   │
│    ├─ If mock: Return mock data                                │
│    └─ Else: Call Octokit API with user token                   │
│      ↓                                                            │
│  (Optional) AuditService.log() → PostgreSQL                    │
│      ↓                                                            │
│  response.json({ repositories, total })                        │
│      ↓                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                       EXTERNAL APIs                              │
│                                                                   │
│  GitHub API (api.github.com)                                    │
│    ├─ Authentication: Bearer <user-oauth-token>                │
│    ├─ GET /orgs/:org/repos                                      │
│    ├─ GET /repos/:owner/:repo/branches                         │
│    └─ ...                                                        │
│                                                                   │
│  ArgoCD API (argocd.example.com)                               │
│    ├─ Authentication: Bearer <argocd-token>                    │
│    ├─ GET /api/v1/applications                                  │
│    └─ POST /api/v1/applications/:name/sync                     │
│                                                                   │
│  Grafana API (grafana.example.com)                             │
│    ├─ Authentication: Bearer <grafana-token>                   │
│    ├─ GET /api/dashboards                                       │
│    └─ GET /api/datasources                                      │
│                                                                   │
│  Uptime Kuma API (uptime-kuma.example.com)                     │
│    ├─ Authentication: API Key                                   │
│    └─ GET /api/monitors                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Database Persistence Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE OPERATIONS                            │
│                    PostgreSQL 14+                                │
│                                                                   │
│  Bulk Operation Example:                                         │
│                                                                   │
│  User clicks "Update 50 branches"                               │
│      ↓                                                            │
│  POST /api/gitops/repositories/:repo/files/update               │
│      ↓                                                            │
│  BulkOperationService.createBulkUpdate()                        │
│      ↓                                                            │
│  knex('bulk_operations').insert({                               │
│    id: UUID,                                                     │
│    user_id, repository, target_branches,                        │
│    file_path, status: 'pending',                                │
│    total_targets: 50, progress_percentage: 0                    │
│  })                                                              │
│      ↓                                                            │
│  Return operation_id (202 Accepted)                             │
│      ↓                                                            │
│  Frontend displays progress bar                                 │
│      ↓                                                            │
│  Background: OrchestratorService processes tasks                │
│    ├─ For each branch:                                          │
│    │   ├─ GitHubService.updateFile()                           │
│    │   ├─ Update bulk_operations table:                        │
│    │   │   - successful_count++                                 │
│    │   │   - progress_percentage = (completed/total) * 100     │
│    │   │   - results.push({branch, status, commit_sha})        │
│    │   └─ AuditService.log() → audit_logs table               │
│    └─ Final: status = 'completed'                              │
│      ↓                                                            │
│  Frontend polls: GET /bulk-operations/:id                       │
│      ↓                                                            │
│  React Query refetch on interval (5 seconds)                    │
│      ↓                                                            │
│  UI updates progress bar 0% → 100%                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Authentication Flow

#### OAuth Flow (GitHub Example)

```
┌─────────────────────────────────────────────────────────────────┐
│                    OAUTH AUTHENTICATION FLOW                     │
│                                                                   │
│  1. User visits http://localhost:3000                           │
│      ↓                                                            │
│  2. Redirected to /signin (SignInPage.tsx)                      │
│      ↓                                                            │
│  3. User clicks "Sign in with GitHub"                           │
│      ↓                                                            │
│  4. Backend auth endpoint:                                       │
│     GET /api/auth/github/start                                  │
│      ↓                                                            │
│  5. Redirect to GitHub OAuth:                                    │
│     https://github.com/login/oauth/authorize?                   │
│       client_id=xxx&                                             │
│       redirect_uri=http://localhost:7007/api/auth/github/handler │
│       scope=repo+user+read:org+workflow                         │
│      ↓                                                            │
│  6. User authorizes app on GitHub                               │
│      ↓                                                            │
│  7. GitHub redirects back:                                       │
│     GET /api/auth/github/handler?code=xxx                       │
│      ↓                                                            │
│  8. Backend exchanges code for token:                            │
│     POST https://github.com/login/oauth/access_token            │
│       code=xxx&client_id=xxx&client_secret=xxx                  │
│      ↓                                                            │
│  9. GitHub returns:                                              │
│     {                                                             │
│       access_token: "gho_xxxxx",                                │
│       token_type: "bearer",                                      │
│       scope: "repo,user,read:org,workflow"                      │
│     }                                                             │
│      ↓                                                            │
│  10. Backend:                                                    │
│      ├─ Creates Backstage session                              │
│      ├─ Stores OAuth token in session                          │
│      ├─ Sets session cookie                                     │
│      └─ Redirects to /                                          │
│      ↓                                                            │
│  11. User lands on HomePage (authenticated)                     │
│      ↓                                                            │
│  12. Future API calls:                                           │
│      GitOpsApi.getGitHubToken() retrieves token                │
│      Every API call includes x-github-token header             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Local Authentication with 2FA

```
┌─────────────────────────────────────────────────────────────────┐
│              LOCAL AUTH + 2FA FLOW                               │
│                                                                   │
│  1. User enters username + password                             │
│      ↓                                                            │
│  2. POST /api/gitops/auth/local/login                           │
│      {username: "john", password: "secret"}                     │
│      ↓                                                            │
│  3. LocalAuthService.login()                                    │
│      ├─ Query users table                                       │
│      ├─ bcrypt.compare(password, password_hash)                │
│      ├─ Check is_active && !locked_until                        │
│      └─ Check 2FA status                                        │
│      ↓                                                            │
│  4. If 2FA enabled:                                              │
│      ├─ Generate session without 2FA verification              │
│      ├─ Return: {requires_2fa: true, session_token}            │
│      └─ User sees 2FA prompt                                    │
│      ↓                                                            │
│  5. User enters TOTP code (6 digits)                            │
│      ↓                                                            │
│  6. POST /api/gitops/auth/2fa/verify                            │
│      {token: "123456", session_token, remember_device}          │
│      ↓                                                            │
│  7. TwoFactorAuthService.verifyTOTP()                           │
│      ├─ Query user_2fa table                                    │
│      ├─ Decrypt totp_secret (AES-256-GCM)                      │
│      ├─ Calculate expected TOTP (30-sec window)                │
│      ├─ Compare tokens                                          │
│      └─ If remember_device: store device fingerprint           │
│      ↓                                                            │
│  8. Update user_sessions:                                        │
│      ├─ is_2fa_verified = true                                  │
│      ├─ tfa_verified_at = NOW()                                 │
│      └─ device_trusted_until = NOW() + 30 days                 │
│      ↓                                                            │
│  9. Return: {token: "jwt_xxx", user: {...}}                     │
│      ↓                                                            │
│  10. Frontend stores token in localStorage                       │
│      ↓                                                            │
│  11. Future requests include:                                    │
│      Authorization: Bearer jwt_xxx                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Database Schema

#### 7 Database Tables (PostgreSQL)

**1. audit_logs** - Complete audit trail
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  operation VARCHAR(50) NOT NULL,  -- read, update, commit, sync, delete
  resource_type VARCHAR(50) NOT NULL,  -- repository, branch, file, argocd_app
  resource_id VARCHAR(500),
  repository VARCHAR(255),
  branch VARCHAR(255),
  file_path TEXT,
  old_value TEXT,
  new_value TEXT,
  diff TEXT,
  commit_sha VARCHAR(255),
  argocd_app_name VARCHAR(255),
  sync_status VARCHAR(50),
  ip_address VARCHAR(100),
  user_agent TEXT,
  metadata JSONB,
  status VARCHAR(50) NOT NULL,  -- success, failure, pending
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
```

**2. bulk_operations** - Bulk update tracking
```sql
CREATE TABLE bulk_operations (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  operation_type VARCHAR(50) NOT NULL,  -- bulk_update, bulk_commit, bulk_sync
  repository VARCHAR(255) NOT NULL,
  target_branches JSONB NOT NULL,  -- array of branch names
  file_path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,  -- pending, in_progress, completed, failed, partial
  total_targets INTEGER NOT NULL,
  successful_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  pending_count INTEGER,
  progress_percentage INTEGER DEFAULT 0,
  current_target VARCHAR(255),
  results JSONB,  -- [{branch, status, commit_sha, error}]
  error_message TEXT,
  summary JSONB,
  change_description TEXT,
  commit_message TEXT,
  change_preview JSONB,
  argocd_apps JSONB,
  sync_results JSONB,
  metadata JSONB,
  can_rollback BOOLEAN DEFAULT false,
  rolled_back_by UUID REFERENCES bulk_operations(id),
  rolled_back_at TIMESTAMP,
  ip_address VARCHAR(100),
  user_agent TEXT
);

CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX idx_bulk_operations_repository ON bulk_operations(repository);
```

**3. users** - Local authentication
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,  -- bcrypt, cost 12
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL,  -- user, readwrite, admin
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP,
  last_login TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_failed_login TIMESTAMP,
  password_changed_at TIMESTAMP,
  force_password_change BOOLEAN DEFAULT false,
  password_history JSONB,  -- array of previous password hashes
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  metadata JSONB
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

**4. user_sessions** - JWT session management
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,  -- SHA-256 hash of JWT
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_active_at TIMESTAMP,
  refreshed_at TIMESTAMP,
  ip_address VARCHAR(100),
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  device_name VARCHAR(255),
  is_2fa_verified BOOLEAN DEFAULT false,
  tfa_verified_at TIMESTAMP,
  remember_device BOOLEAN DEFAULT false,
  device_trusted_until TIMESTAMP,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(255),
  revoked_by VARCHAR(255),
  session_type VARCHAR(50),  -- web, api, mobile
  metadata JSONB
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

**5. user_2fa** - Two-factor authentication
```sql
CREATE TABLE user_2fa (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  totp_secret TEXT NOT NULL,  -- encrypted AES-256-GCM
  totp_algorithm VARCHAR(10) DEFAULT 'SHA1',
  totp_digits INTEGER DEFAULT 6,
  totp_period INTEGER DEFAULT 30,
  enabled_at TIMESTAMP,
  disabled_at TIMESTAMP,
  backup_codes JSONB,  -- array of 8 hashed codes
  backup_codes_remaining INTEGER DEFAULT 8,
  trusted_devices JSONB,  -- array of device fingerprints
  recovery_email VARCHAR(255),
  recovery_phone VARCHAR(50),
  recovery_token_hash VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_totp_verified_at TIMESTAMP,
  last_backup_code_used_at TIMESTAMP
);

CREATE INDEX idx_user_2fa_user_id ON user_2fa(user_id);
```

**6. user_connectors** - OAuth connector storage
```sql
CREATE TABLE user_connectors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- github, gitlab, microsoft, google
  provider_user_id VARCHAR(255),
  provider_username VARCHAR(255),
  provider_email VARCHAR(255),
  provider_avatar_url TEXT,
  access_token TEXT NOT NULL,  -- encrypted AES-256-GCM
  refresh_token TEXT,  -- encrypted AES-256-GCM
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  token_type VARCHAR(50),
  scopes JSONB,
  status VARCHAR(50) NOT NULL,  -- active, expired, revoked, error
  last_error TEXT,
  connected_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  disconnected_at TIMESTAMP,
  oauth_state VARCHAR(255),
  oauth_state_expires TIMESTAMP,
  metadata JSONB,
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_connectors_user_id ON user_connectors(user_id);
CREATE INDEX idx_user_connectors_provider ON user_connectors(provider);
```

**7. orchestrator_tasks** - Task orchestration
```sql
CREATE TABLE orchestrator_tasks (
  id UUID PRIMARY KEY,
  task_type VARCHAR(50) NOT NULL,  -- bulk_update, deployment, sync, rollback, etc.
  name VARCHAR(255),
  description TEXT,
  user_id VARCHAR(255),
  initiated_by VARCHAR(255),
  status VARCHAR(50) NOT NULL,  -- pending, queued, running, completed, failed, cancelled, timeout
  priority INTEGER DEFAULT 5,
  progress_percentage INTEGER DEFAULT 0,
  progress_message TEXT,
  total_items INTEGER,
  completed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  input_data JSONB,
  output_data JSONB,
  context JSONB,
  created_at TIMESTAMP NOT NULL,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  max_duration_seconds INTEGER,
  actual_duration_seconds INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  error_message TEXT,
  error_stack TEXT,
  error_code VARCHAR(50),
  depends_on UUID[],  -- array of task IDs
  blocked_by UUID[],  -- array of task IDs
  worker_id VARCHAR(255),
  worker_hostname VARCHAR(255),
  cancellation_requested BOOLEAN DEFAULT false,
  cancellation_requested_at TIMESTAMP,
  cancelled_by VARCHAR(255),
  cancellation_reason TEXT,
  notify_on_complete BOOLEAN DEFAULT false,
  notification_channels JSONB
);

CREATE INDEX idx_orchestrator_tasks_status ON orchestrator_tasks(status);
CREATE INDEX idx_orchestrator_tasks_created_at ON orchestrator_tasks(created_at);
```

### 2.5 API Endpoint Inventory

#### Complete List of 80+ Endpoints

**Base URL:** `http://localhost:7007/api/gitops`

**Health & Status:**
- `GET /health` - Comprehensive health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

**Authentication:**
- `GET /auth/user` - Current user info
- `GET /auth/organizations` - User's organizations
- `POST /auth/local/login` - Local login
- `POST /auth/local/register` - Register user
- `POST /auth/local/refresh` - Refresh token
- `POST /auth/local/logout` - Logout
- `GET /auth/local/me` - Current session user
- `POST /auth/local/change-password` - Change password
- `POST /auth/guest/login` - Guest access
- `POST /auth/2fa/setup` - Setup 2FA
- `POST /auth/2fa/verify` - Verify 2FA token
- `POST /auth/2fa/disable` - Disable 2FA
- `GET /auth/2fa/backup-codes` - Regenerate backup codes

**Repository Operations:**
- `GET /repositories` - List org repositories
- `GET /repositories/:repo/branches` - List branches
- `GET /repositories/:repo/tree` - File tree
- `GET /repositories/:repo/content` - File content
- `POST /repositories/:repo/files/update` - Bulk file update
- `POST /repositories/:repo/branches` - Create branch
- `GET /repositories/:repo/compare/:base...:head` - Branch diff

**Pull Requests:**
- `GET /repositories/:repo/pulls` - List PRs
- `POST /repositories/:repo/pulls` - Create PR
- `POST /repositories/:repo/pulls/with-changes` - Create PR with files
- `GET /repositories/:repo/pulls/:number` - PR details
- `GET /repositories/:repo/pulls/:number/files` - Changed files
- `GET /repositories/:repo/pulls/:number/comments` - PR comments
- `POST /repositories/:repo/pulls/:number/comments` - Add comment
- `GET /repositories/:repo/pulls/:number/reviews` - Reviews
- `GET /repositories/:repo/pulls/:number/status-checks` - CI/CD checks
- `GET /repositories/:repo/pulls/:number/timeline` - Event timeline
- `POST /repositories/:repo/pulls/:number/merge` - Merge PR
- `POST /repositories/:repo/pulls/:number/reviewers` - Add reviewers
- `POST /repositories/:repo/pulls/:number/assignees` - Assign users

**Bulk Operations:**
- `GET /bulk-operations/:id` - Operation status
- `GET /bulk-operations` - List operations

**ArgoCD:**
- `GET /argocd/applications` - List applications
- `GET /argocd/applications/:name` - Application details
- `POST /argocd/applications/:name/sync` - Trigger sync
- `GET /argocd/applications/:name/sync-status` - Sync status

**GitHub Actions:**
- `GET /repositories/:repo/actions/workflows` - List workflows
- `GET /repositories/:repo/actions/runs` - Workflow runs
- `GET /repositories/:repo/actions/runs/:id` - Run details
- `GET /repositories/:repo/actions/runs/:id/jobs` - Jobs
- `POST /repositories/:repo/actions/runs/:id/rerun` - Rerun workflow
- `POST /repositories/:repo/actions/runs/:id/rerun-failed` - Rerun failed
- `POST /repositories/:repo/actions/runs/:id/cancel` - Cancel run
- `POST /repositories/:repo/actions/workflows/:id/dispatches` - Trigger workflow
- `GET /repositories/:repo/actions/summary` - Build summary

**Grafana:**
- `GET /grafana/dashboards` - List dashboards
- `GET /grafana/dashboards/:uid` - Dashboard details
- `GET /grafana/folders` - Folders
- `GET /grafana/search` - Search dashboards

**Uptime Kuma:**
- `GET /uptime-kuma/monitors` - List monitors
- `GET /uptime-kuma/monitors/:id` - Monitor details
- `GET /uptime-kuma/stats` - Statistics
- `GET /uptime-kuma/dashboard` - Dashboard summary
- `GET /uptime-kuma/status-pages` - Status pages
- `POST /uptime-kuma/monitors/:id/pause` - Pause monitor
- `POST /uptime-kuma/monitors/:id/resume` - Resume monitor
- `GET /uptime-kuma/health` - Health check

**GitLab (Optional):**
- `GET /gitlab/projects` - List projects
- `GET /gitlab/projects/:id` - Project details
- `GET /gitlab/projects/:id/branches` - Branches
- `GET /gitlab/projects/:id/tree` - File tree
- `GET /gitlab/projects/:id/files` - File content
- `PUT /gitlab/projects/:id/files` - Update file
- `GET /gitlab/projects/:id/merge_requests` - Merge requests
- `POST /gitlab/projects/:id/merge_requests` - Create MR
- `GET /gitlab/projects/:id/pipelines` - Pipelines
- `GET /gitlab/health` - Health check

**Audit Logs:**
- `GET /audit-logs` - Query logs with filters
- `GET /audit-logs/:id` - Log details

**Permissions:**
- `GET /permissions` - User's permissions & roles
- `POST /permissions/check` - Check specific permissions
- `GET /permissions/roles` - Available roles
- `GET /permissions/all` - All permissions (admin)

**User Management (Admin):**
- `GET /users` - List users
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /users/:id/sessions` - User sessions
- `POST /users/:id/sessions/:sessionId/revoke` - Revoke session

**User Profile:**
- `GET /user/profile` - GitHub profile
- `GET /user/repos` - User's repositories
- `GET /user/pull-requests` - User's PRs
- `GET /user/issues` - User's issues
- `GET /user/organizations` - User's orgs
- `GET /user/starred` - Starred repos
- `GET /user/dashboard` - Comprehensive dashboard
- `GET /user/settings` - User settings
- `PUT /user/settings` - Update settings

**Connectors:**
- `GET /connectors/providers` - Available providers
- `POST /connectors/oauth/initiate` - Start OAuth
- `POST /connectors/oauth/callback` - OAuth callback
- `GET /connectors` - List user's connectors
- `GET /connectors/:id` - Connector details
- `POST /connectors/:id/refresh` - Refresh token
- `DELETE /connectors/:id` - Disconnect

**Maturity:**
- `GET /maturity/:owner/:repo` - Repository score
- `GET /maturity/:owner/:repo/badge` - SVG badge

**Cost Insights:**
- `GET /cost/summary` - Cost summary
- `GET /cost/recommendations` - Optimization tips
- `GET /cost/anomalies` - Anomalies
- `GET /cost/forecast` - Forecast

**AI Search:**
- `GET /search` - Search across sources
- `POST /search/ask` - Ask question
- `POST /search/index` - Index document
- `GET /search/stats` - Index stats

**Day-2 Operations:**
- `GET /operations/definitions` - Available operations
- `GET /operations/definition/:type` - Operation definition
- `POST /operations/execute` - Execute operation
- `POST /operations/:id/approve` - Approve operation
- `POST /operations/:id/cancel` - Cancel operation
- `GET /operations/history` - Operation history
- `GET /operations/:id` - Operation details

### 2.6 Security Features

#### Rate Limiting

**Three-Tier Rate Limiting:**
```typescript
// General API calls: 100 requests/minute
generalRateLimiter: {
  windowMs: 60000,
  max: 100,
  excludePaths: ['/health', '/health/live', '/health/ready']
}

// Bulk operations: 10 requests/minute
bulkOperationsRateLimiter: {
  windowMs: 60000,
  max: 10,
  paths: ['/files/update', '/sync']
}

// Authentication: 5 requests/minute
authRateLimiter: {
  windowMs: 60000,
  max: 5,
  paths: ['/auth/local/login', '/auth/2fa/verify']
}
```

**Response Headers:**
- `X-RateLimit-Limit` - Max requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Reset timestamp

#### Security Headers (OWASP)

```typescript
// Applied to all responses
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' // Production only
}
```

#### CORS Configuration

**Development:**
```yaml
cors:
  origin: http://localhost:3000
  methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
  credentials: true
```

**Production:**
```yaml
cors:
  origin: https://devops-portal.example.com
  methods: [GET, POST, PUT, DELETE]
  credentials: true
```

#### Encryption

**AES-256-GCM Encryption:**
- TOTP secrets (2FA)
- OAuth tokens (access/refresh)
- Backup codes (additional bcrypt hashing)

**Hashing:**
- Passwords: bcrypt (cost factor 12)
- Session tokens: SHA-256
- Backup codes: bcrypt

---

## 3. CONFIGURATION MANAGEMENT

### 3.1 Environment Variables

**Required:**
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage
POSTGRES_DB=backstage

# GitHub
GITHUB_TOKEN=ghp_xxxxx
GITHUB_OAUTH_CLIENT_ID=xxx
GITHUB_OAUTH_CLIENT_SECRET=xxx

# Authentication
AUTH_SESSION_SECRET=<32+ char random string>

# ArgoCD
ARGOCD_URL=https://argocd.example.com
ARGOCD_TOKEN=xxx

# Grafana
GRAFANA_URL=https://grafana.example.com
GRAFANA_TOKEN=xxx
```

**Optional:**
```bash
# OAuth Providers
GOOGLE_OAUTH_CLIENT_ID=xxx
GOOGLE_OAUTH_CLIENT_SECRET=xxx
MICROSOFT_OAUTH_CLIENT_ID=xxx
MICROSOFT_OAUTH_CLIENT_SECRET=xxx
MICROSOFT_TENANT_ID=xxx
GITLAB_OAUTH_CLIENT_ID=xxx
GITLAB_OAUTH_CLIENT_SECRET=xxx
OIDC_METADATA_URL=xxx
OIDC_CLIENT_ID=xxx
OIDC_CLIENT_SECRET=xxx

# GitLab
GITLAB_ENABLED=true
GITLAB_BASE_URL=https://gitlab.com
GITLAB_TOKEN=xxx

# Uptime Kuma
UPTIME_KUMA_ENABLED=true
UPTIME_KUMA_URL=https://uptime.example.com
UPTIME_KUMA_API_KEY=xxx

# Application
NODE_ENV=production
BACKSTAGE_BASE_URL=https://devops-portal.example.com
LOG_LEVEL=info
```

### 3.2 Configuration Files

**app-config.yaml** (Development)
```yaml
app:
  title: GitOps Management Portal
  baseUrl: http://localhost:3000

backend:
  baseUrl: http://localhost:7007
  listen:
    port: 7007
  database:
    client: pg
    connection:
      host: localhost
      port: 5432
      user: backstage
      password: backstage
      database: backstage

auth:
  environment: development
  providers:
    guest:
      dangerouslyAllowOutsideDevelopment: true
    github:
      development:
        clientId: ${GITHUB_OAUTH_CLIENT_ID}
        clientSecret: ${GITHUB_OAUTH_CLIENT_SECRET}

gitops:
  github:
    organization: radiantlogic-saas
    token: ${GITHUB_TOKEN}
    useOAuthToken: true
  argocd:
    enabled: true
    url: ${ARGOCD_URL}
    token: ${ARGOCD_TOKEN}
  grafana:
    enabled: true
    url: ${GRAFANA_URL}
    token: ${GRAFANA_TOKEN}
  auth:
    allowUnauthenticated: true  # Development only
```

**app-config.production.yaml** (Production)
```yaml
app:
  baseUrl: ${BACKSTAGE_BASE_URL}

backend:
  baseUrl: ${BACKSTAGE_BASE_URL}
  database:
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
      database: ${POSTGRES_DB}

auth:
  environment: production
  providers:
    guest:
      dangerouslyAllowOutsideDevelopment: false

gitops:
  github:
    organization: ${GITHUB_ORG}
    token: ${GITHUB_TOKEN}
  auth:
    allowUnauthenticated: false  # Enforce authentication
```

---

## 4. DEPLOYMENT ARCHITECTURE

### 4.1 Docker

**Multi-Stage Dockerfile:**
```dockerfile
# Stage 1: Copy packages
FROM node:20-bookworm-slim AS packages
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages packages/
COPY plugins plugins/

# Stage 2: Build
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=packages /app ./
RUN yarn install --frozen-lockfile
RUN yarn build:backend
RUN yarn build:all

# Stage 3: Production
FROM node:20-bookworm-slim
USER node
WORKDIR /app
COPY --from=build /app/packages/backend/dist ./
EXPOSE 7007
CMD ["node", "packages/backend", "--config", "app-config.yaml"]
```

### 4.2 Kubernetes (Helm)

**Helm Chart Structure:**
```
deployment/helm/
├── Chart.yaml
├── values.yaml
├── values-qa.yaml
├── values-production.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── postgres-deployment.yaml
│   ├── postgres-service.yaml
│   ├── postgres-pvc.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── external-secret.yaml
└── NOTES.txt
```

**Key Values:**
```yaml
replicaCount: 2
image:
  repository: rahulnutakki/devprotal
  tag: latest
resources:
  limits:
    cpu: 500m
    memory: 768Mi
  requests:
    cpu: 250m
    memory: 512Mi
ingress:
  enabled: true
  className: alb
  hosts:
    - backstage.example.com
postgres:
  enabled: true
  storage:
    size: 10Gi
    storageClass: gp3
```

### 4.3 Docker Compose

```yaml
version: '3.8'
services:
  backstage:
    image: rahulnutakki/devprotal:latest
    ports:
      - "3000:3000"
      - "7007:7007"
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: backstage
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    depends_on:
      - postgres

  postgres:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: backstage
      POSTGRES_USER: backstage
      POSTGRES_PASSWORD: backstage
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 5. KEY FILES REFERENCE

### Critical Files with Absolute Paths

**Frontend:**
- `/Users/nutakki/Documents/github/devops-portal/packages/app/src/App.tsx` - Main app routing
- `/Users/nutakki/Documents/github/devops-portal/packages/app/src/components/auth/SignInPage.tsx` - OAuth login
- `/Users/nutakki/Documents/github/devops-portal/packages/app/src/components/home/HomePage.tsx` - Dashboard
- `/Users/nutakki/Documents/github/devops-portal/packages/app/src/theme.ts` - Custom themes

**Backend:**
- `/Users/nutakki/Documents/github/devops-portal/packages/backend/src/index.ts` - Plugin initialization
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/plugin.ts` - GitOps plugin
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/service/router.ts` - API router (2925 lines)

**GitOps Plugin Frontend:**
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops/src/plugin.ts` - Plugin registration
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops/src/api/GitOpsApi.ts` - API client
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops/src/components/GitOpsPage/GitOpsPage.tsx` - Main page

**Services (20+ files):**
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/GitHubService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/ArgoCDService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/GrafanaService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/UptimeKumaService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/GitHubActionsService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/LocalAuthService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/TwoFactorAuthService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/AuditService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/BulkOperationService.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/src/services/PermissionService.ts`

**Migrations (7 files):**
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/001_create_audit_logs.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/002_create_bulk_operations.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/003_create_users.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/004_create_user_sessions.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/005_create_user_2fa.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/006_create_user_connectors.ts`
- `/Users/nutakki/Documents/github/devops-portal/plugins/gitops-backend/migrations/007_create_orchestrator_tasks.ts`

**Configuration:**
- `/Users/nutakki/Documents/github/devops-portal/config/app-config.yaml`
- `/Users/nutakki/Documents/github/devops-portal/config/app-config.production.yaml`

**Deployment:**
- `/Users/nutakki/Documents/github/devops-portal/deployment/docker/Dockerfile`
- `/Users/nutakki/Documents/github/devops-portal/deployment/docker/docker-compose.yml`
- `/Users/nutakki/Documents/github/devops-portal/deployment/helm/Chart.yaml`

---

## 6. TECHNOLOGY STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 18 | UI components |
| **UI Library** | Material-UI 4 | Component library |
| **Routing** | React Router 6 | Client-side routing |
| **State Management** | Zustand, React Query | State & server cache |
| **Code Editor** | Monaco Editor | VS Code-like editor |
| **Backstage Core** | Backstage Framework | Platform foundation |
| **Backend Framework** | Express.js | HTTP server |
| **API Client** | Octokit, Axios | GitHub & REST APIs |
| **Database** | PostgreSQL 14+ | Persistent storage |
| **Query Builder** | Knex.js | SQL query builder |
| **Authentication** | Backstage Auth | OAuth, JWT, 2FA |
| **Encryption** | crypto-js | AES-256-GCM |
| **Password Hashing** | bcrypt | Password security |
| **2FA** | otplib | TOTP implementation |
| **Logging** | Winston | Application logging |
| **Validation** | Joi | Schema validation |
| **Container** | Docker | Containerization |
| **Orchestration** | Kubernetes | Container orchestration |
| **Deployment** | Helm | K8s package manager |

---

## SUMMARY

The DevOps Portal is a **production-ready, enterprise-grade GitOps platform** with:

✅ **15+ Major Feature Areas**
✅ **80+ RESTful API Endpoints**
✅ **45+ React Components**
✅ **20+ Backend Services**
✅ **7 Database Tables** (PostgreSQL)
✅ **Multi-Provider OAuth** (6 providers)
✅ **Advanced Security** (2FA, RBAC, rate limiting, encryption)
✅ **Comprehensive Audit Trail**
✅ **Bulk Operations** (update 50+ branches in parallel)
✅ **Real-time Monitoring** (ArgoCD, Grafana, Uptime Kuma)
✅ **CI/CD Integration** (GitHub Actions)
✅ **AI-Powered Search** (RAG)
✅ **Cost Analytics** (FinOps)
✅ **Repository Maturity Scoring**
✅ **Day-2 Operations Framework**
✅ **Task Orchestration System**

**Complete Feature Coverage:** Every feature has been documented with file paths, component names, API endpoints, database tables, and wiring diagrams.

---

## Next Steps

This comprehensive inventory serves as:
1. **Technical documentation** for onboarding developers
2. **Architecture reference** for system design discussions
3. **Feature catalog** for stakeholder presentations
4. **Integration guide** for extending the platform
5. **Security audit reference** for compliance reviews

All features are documented with absolute file paths, making it easy to locate and review any component in the codebase.
