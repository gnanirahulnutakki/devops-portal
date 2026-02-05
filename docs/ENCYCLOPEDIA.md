# DevOps Portal - Comprehensive Encyclopedia

**Version:** 2.0.0
**Last Updated:** February 4, 2026
**Purpose:** Complete reference for developers and LLMs to understand and continue development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Backend Services](#3-backend-services)
4. [Frontend Components](#4-frontend-components)
5. [API Reference](#5-api-reference)
6. [Configuration](#6-configuration)
7. [Authentication](#7-authentication)
8. [Deployment](#8-deployment)
9. [Development Guide](#9-development-guide)
10. [Implementation Status](#10-implementation-status)

---

## 1. Project Overview

### What is DevOps Portal?

DevOps Portal is an enterprise-grade **Internal Developer Platform (IDP)** built on [Backstage](https://backstage.io/). It provides a unified interface for managing:

- **350+ deployment branches** across 35+ repositories
- **ArgoCD applications** and GitOps workflows
- **Pull requests** and code review
- **GitHub Actions** CI/CD pipelines
- **Grafana dashboards** and observability
- **Cloud costs** and FinOps insights
- **Day-2 operations** (restart, scale, rollback)

### Key Value Proposition

| Before | After |
|--------|-------|
| 4-6 hours to update 350 branches | <15 minutes with bulk operations |
| 10+ browser tabs | Single pane of glass |
| Manual deployment tracking | Real-time ArgoCD status |
| Scattered documentation | Unified search and TechDocs |

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Backstage v1.47.3 |
| Frontend | React 18, TypeScript, Material UI v4 |
| Backend | Node.js 18+, Express, TypeScript |
| Database | PostgreSQL 14+ |
| Caching | Redis (optional) |
| Container | Docker (linux/amd64) |
| Orchestration | Kubernetes, Helm v3 |
| CI/CD | GitHub Actions, ArgoCD |

---

## 2. Architecture

### Repository Structure

```
devops-portal/
├── packages/
│   ├── app/                          # Frontend application
│   │   └── src/
│   │       ├── App.tsx               # Main app with routes
│   │       └── components/
│   │           └── auth/
│   │               └── SignInPage.tsx # Multi-provider auth
│   └── backend/                      # Backend application
│       └── src/
│           └── index.ts              # Backend entry point
├── plugins/
│   ├── gitops/                       # Frontend plugin
│   │   └── src/
│   │       ├── components/           # 30+ React components
│   │       ├── hooks/                # Custom React hooks
│   │       ├── api/                  # API client
│   │       └── index.ts              # Plugin exports
│   └── gitops-backend/               # Backend plugin
│       └── src/
│           ├── services/             # 12+ service classes
│           ├── service/
│           │   └── router.ts         # 2200+ line API router
│           ├── middleware/           # Express middleware
│           └── validation/           # Request validation
├── deployment/
│   ├── helm/                         # Kubernetes Helm chart
│   │   ├── Chart.yaml               # Chart metadata v2.0.0
│   │   ├── values.yaml              # Default configuration
│   │   └── templates/               # 14 K8s templates
│   └── docker/                      # Docker configuration
├── config/
│   ├── app-config.yaml              # Development config
│   └── app-config.production.yaml   # Production config
└── docs/                            # 28+ documentation files
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  SignInPage → GitOpsPage → Components (RepositoryBrowser, etc.) │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP/REST
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Express)                        │
│  router.ts → Services (GitHubService, ArgoCDService, etc.)      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
    ┌───────────┐         ┌───────────┐          ┌───────────┐
    │  GitHub   │         │  ArgoCD   │          │  Grafana  │
    │    API    │         │    API    │          │    API    │
    └───────────┘         └───────────┘          └───────────┘
```

---

## 3. Backend Services

### Service Directory: `plugins/gitops-backend/src/services/`

#### Core Services

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| GitHubService | `GitHubService.ts` | 1400+ | GitHub API operations |
| GitLabService | `GitLabService.ts` | 600+ | GitLab API operations |
| ArgoCDService | `ArgoCDService.ts` | 400+ | ArgoCD sync/status |
| GrafanaService | `GrafanaService.ts` | 300+ | Dashboard embedding |

#### Operational Services

| Service | File | Purpose |
|---------|------|---------|
| BulkOperationService | `BulkOperationService.ts` | Parallel multi-branch updates |
| AuditService | `AuditService.ts` | Change tracking and logging |
| HealthService | `HealthService.ts` | K8s probes and health checks |
| AuthTokenService | `AuthTokenService.ts` | OAuth token management |

#### Feature Services (NEW - Phase 2-6)

| Service | File | Purpose |
|---------|------|---------|
| GitHubActionsService | `GitHubActionsService.ts` | Workflow runs, triggers, cancellation |
| PermissionService | `PermissionService.ts` | RBAC with 4 roles, 20+ permissions |
| MaturityService | `MaturityService.ts` | Service grading (Bronze→Platinum) |
| CostService | `CostService.ts` | Cloud spend tracking |
| AISearchService | `AISearchService.ts` | LLM-powered semantic search |
| Day2OperationsService | `Day2OperationsService.ts` | Restart, scale, rotate, rollback |

### Service Template

```typescript
// plugins/gitops-backend/src/services/ExampleService.ts
import { Config } from '@backstage/config';
import { Logger } from 'winston';

export interface ExampleServiceConfig {
  apiUrl: string;
  token: string;
}

export class ExampleService {
  private config: ExampleServiceConfig;
  private logger: Logger;

  constructor(config: Config, logger: Logger) {
    this.logger = logger;
    this.config = {
      apiUrl: config.getOptionalString('gitops.example.url') || '',
      token: config.getOptionalString('gitops.example.token') || '',
    };
  }

  async doSomething(): Promise<Result> {
    this.logger.info('Doing something');
    // Implementation
  }
}
```

### Key Service Details

#### GitHubService (1400+ lines)

**Capabilities:**
- Repository listing with filtering
- Branch management (list, create, delete)
- File operations (read, write, delete)
- Pull request full lifecycle
- Commit history
- Mock data mode for development

**Key Methods:**
```typescript
listRepositories(filter?: string): Promise<Repository[]>
listBranches(repo: string, filter?: string): Promise<Branch[]>
getFileTree(repo: string, branch: string, path?: string): Promise<FileTreeEntry[]>
getFileContent(repo: string, branch: string, path: string): Promise<FileContent>
updateFile(repo: string, request: UpdateFileRequest): Promise<UpdateFileResult>
createPullRequest(repo: string, request: CreatePRRequest): Promise<PullRequest>
mergePullRequest(repo: string, prNumber: number, method: string): Promise<MergeResult>
```

#### PermissionService

**Roles:**
```typescript
enum Role {
  ADMIN = 'admin',       // All permissions
  OPERATOR = 'operator', // Deploy, sync, restart
  DEVELOPER = 'developer', // Read, create PRs
  VIEWER = 'viewer',     // Read-only
}
```

**Permissions (20+):**
```typescript
enum Permission {
  REPO_READ, REPO_WRITE, REPO_DELETE,
  BRANCH_CREATE, BRANCH_DELETE,
  FILE_READ, FILE_WRITE, FILE_BULK_UPDATE,
  PR_CREATE, PR_MERGE, PR_APPROVE, PR_COMMENT,
  ARGOCD_READ, ARGOCD_SYNC, ARGOCD_ROLLBACK, ARGOCD_DELETE,
  ACTIONS_READ, ACTIONS_TRIGGER, ACTIONS_CANCEL, ACTIONS_RERUN,
  GRAFANA_READ, GRAFANA_EDIT,
  ADMIN_USERS, ADMIN_SETTINGS, ADMIN_AUDIT,
}
```

#### Day2OperationsService

**Operations:**
| Operation | Risk | Approval | Permission |
|-----------|------|----------|------------|
| restart_service | Low | No | RESTART_APPLICATION |
| scale_replicas | Low | No | SCALE_APPLICATION |
| force_sync | Low | No | SYNC_ARGOCD_APPS |
| rollback | Medium | Yes | SYNC_ARGOCD_APPS |
| rotate_secrets | High | Yes | MANAGE_SECRETS |
| update_config | Medium | No | EDIT_REPOSITORIES |
| clear_cache | Low | No | RESTART_APPLICATION |
| export_logs | Low | No | VIEW_AUDIT_LOGS |
| create_backup | High | Yes | ADMIN_SETTINGS |
| restore_backup | Critical | Yes | ADMIN_SETTINGS |

---

## 4. Frontend Components

### Component Directory: `plugins/gitops/src/components/`

#### Page Components

| Component | File | Purpose |
|-----------|------|---------|
| GitOpsPage | `GitOpsPage/GitOpsPage.tsx` | Main tabbed layout |
| GrafanaPage | `GrafanaPage/GrafanaPage.tsx` | Grafana dashboards page |
| GitHubActionsPage | `GitHubActionsPage/GitHubActionsPage.tsx` | CI/CD pipelines page |
| S3Page | `S3Page/S3Page.tsx` | S3 file browser |
| DocumentationPage | `DocumentationPage/DocumentationPage.tsx` | TechDocs integration |

#### Feature Components

| Component | Purpose |
|-----------|---------|
| RepositoryBrowser | Browse repos, branches, files |
| FileEditor | Monaco editor with YAML validation |
| FieldSelector | Field-level bulk updates |
| PRManagement | Pull request lifecycle |
| PullRequestList | List PRs with filtering |
| PullRequestDetails | Full PR view with diffs |
| DiffViewer | Side-by-side diff display |
| ArgoCDDashboard | ArgoCD app status grid |
| OperationsTracker | Bulk operation progress |
| AuditLogViewer | Change history table |
| GrafanaDashboards | Embedded Grafana panels |

#### Widget Components (Home Page)

| Component | Purpose |
|-----------|---------|
| MyPullRequestsWidget | User's open PRs |
| MyServicesWidget | User's ArgoCD apps |
| GoldenSignalsCard | Latency/Traffic/Errors/Saturation |
| MaturityScorecard | Service grade display |
| CostInsightsCard | Cloud spend visualization |

#### NEW Components (Phase 7-8)

| Component | Purpose |
|-----------|---------|
| AISearchCard | AI-powered semantic search |
| Day2OperationsCard | Operational actions UI |

### Component Template

```tsx
// plugins/gitops/src/components/NewFeature/NewFeature.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@material-ui/core';
import { InfoCard, Progress } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

interface NewFeatureProps {
  title?: string;
}

export const NewFeature: React.FC<NewFeatureProps> = ({ title = 'New Feature' }) => {
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/gitops/new-endpoint`);
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [backendUrl]);

  if (loading) return <Progress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <InfoCard title={title}>
      <Box>{JSON.stringify(data)}</Box>
    </InfoCard>
  );
};

export default NewFeature;
```

---

## 5. API Reference

### Base URL

- **Development:** `http://localhost:7007/api/gitops`
- **Production:** `https://<domain>/api/gitops`

### Endpoints Summary

#### Repository Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repositories` | List repositories |
| GET | `/repositories/:repo/branches` | List branches |
| GET | `/repositories/:repo/tree` | Get file tree |
| GET | `/repositories/:repo/content` | Get file content |
| PUT | `/repositories/:repo/files` | Update file |
| DELETE | `/repositories/:repo/files` | Delete file |

#### Pull Request Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repositories/:repo/pulls` | List PRs |
| GET | `/repositories/:repo/pulls/:number` | Get PR details |
| POST | `/repositories/:repo/pulls` | Create PR |
| PUT | `/repositories/:repo/pulls/:number/merge` | Merge PR |

#### ArgoCD Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/argocd/applications` | List apps |
| POST | `/argocd/applications/:name/sync` | Sync app |
| GET | `/argocd/applications/:name/resource-tree` | Get resources |

#### GitHub Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/actions/:repo/workflows` | List workflows |
| GET | `/actions/:repo/runs` | List workflow runs |
| POST | `/actions/:repo/runs/:id/rerun` | Rerun workflow |
| POST | `/actions/:repo/runs/:id/cancel` | Cancel workflow |

#### AI Search (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?q=...` | Search docs/code |
| POST | `/search/ask` | Ask AI a question |
| GET | `/search/status` | Get search status |
| POST | `/search/index` | Index a document |

#### Day-2 Operations (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/operations/definitions` | Get available operations |
| POST | `/operations/execute` | Execute operation |
| POST | `/operations/:id/approve` | Approve pending op |
| POST | `/operations/:id/cancel` | Cancel pending op |
| GET | `/operations/history` | Get operation history |

#### Maturity & Cost
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/maturity/:owner/:repo` | Get service maturity |
| GET | `/maturity/:owner/:repo/badge` | Get maturity badge SVG |
| GET | `/cost/summary` | Get cost summary |
| GET | `/cost/recommendations` | Get cost recommendations |

---

## 6. Configuration

### app-config.yaml Structure

```yaml
app:
  title: DevOps Portal
  baseUrl: http://localhost:3000

backend:
  baseUrl: http://localhost:7007
  database:
    client: pg
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
      database: ${POSTGRES_DB}

auth:
  environment: development
  providers:
    github:
      development:
        clientId: ${GITHUB_OAUTH_CLIENT_ID}
        clientSecret: ${GITHUB_OAUTH_CLIENT_SECRET}
    guest: {}  # Development only

gitops:
  github:
    organization: ${GITHUB_ORG}
    token: ${GITHUB_TOKEN}
    useOAuthToken: true

  argocd:
    enabled: true
    url: ${ARGOCD_URL}
    token: ${ARGOCD_TOKEN}
    namespace: argocd

  grafana:
    enabled: true
    url: ${GRAFANA_URL}
    token: ${GRAFANA_TOKEN}

  gitlab:
    enabled: false
    baseUrl: https://gitlab.com
    token: ${GITLAB_TOKEN}

  aiSearch:
    enabled: false
    provider: openai
    apiKey: ${OPENAI_API_KEY}
    model: gpt-4o-mini

  operations:
    kubernetesApiUrl: ${KUBERNETES_API_URL}
    kubernetesToken: ${KUBERNETES_TOKEN}
    historyLimit: 100

  permissions:
    defaultRole: developer
    superAdmins:
      - admin@example.com
```

### Helm values.yaml Key Sections

```yaml
# Authentication
auth:
  github:
    enabled: true
    clientId: ""
    clientSecret: ""
  google:
    enabled: false
  guest:
    enabled: false  # Never in production

# Integrations
argocd:
  enabled: true
  url: "https://argocd.example.com"
  token: ""

grafana:
  enabled: true
  url: "https://grafana.example.com"
  token: ""

# Database
postgres:
  enabled: true
  host: "postgres"
  database: "backstage"

# Redis (optional)
redis:
  enabled: false

# Secrets Management
secrets:
  provider: kubernetes  # or sealed-secrets, external-secrets
```

---

## 7. Authentication

### Supported Providers

| Provider | Production | Development |
|----------|------------|-------------|
| GitHub OAuth | ✅ Recommended | ✅ |
| Google OAuth | ✅ | ✅ |
| Microsoft Azure AD | ✅ | ✅ |
| GitLab OAuth | ✅ | ✅ |
| OIDC (Okta, Auth0) | ✅ | ✅ |
| Guest Mode | ❌ Never | ✅ Dev only |

### Authentication Flow

1. User clicks "Sign in with GitHub"
2. Redirect to GitHub OAuth
3. GitHub returns authorization code
4. Backend exchanges code for access token
5. Session created with `AUTH_SESSION_SECRET`
6. User's GitHub token stored (if `useOAuthToken: true`)
7. API calls use user's token (not service token)

### Required Environment Variables

```bash
# OAuth
GITHUB_OAUTH_CLIENT_ID=Ov23li...
GITHUB_OAUTH_CLIENT_SECRET=...
AUTH_SESSION_SECRET=$(openssl rand -hex 32)

# Service Tokens (fallback)
GITHUB_TOKEN=ghp_...
ARGOCD_TOKEN=...
GRAFANA_TOKEN=glsa_...
```

---

## 8. Deployment

### Docker Build

```bash
# Build for K8s (must be linux/amd64)
docker buildx build \
  --platform linux/amd64 \
  -t rahulnutakki/backstage-gitops:v7 \
  --push \
  .
```

### Helm Deploy

```bash
# Install
helm install devops-portal ./deployment/helm \
  -n devops-portal \
  --create-namespace \
  -f values-production.yaml

# Upgrade
helm upgrade devops-portal ./deployment/helm \
  -n devops-portal \
  --set image.tag=v7
```

### Quick Deploy to saasops1

```bash
helm upgrade devops-portal ./deployment/helm \
  -n duploservices-saasops1 \
  --set image.repository=rahulnutakki/backstage-gitops \
  --set image.tag=v7 \
  --set auth.github.enabled=true \
  --set ingress.enabled=false \
  --set nodeSelector.tenantname=saasops1

# Port forward for access
kubectl port-forward svc/devops-portal 59359:80 -n duploservices-saasops1
```

---

## 9. Development Guide

### Local Setup

```bash
# Clone
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal

# Install
yarn install

# Start (with environment)
./start-with-env.sh
# OR manually:
export GITHUB_TOKEN=ghp_...
yarn dev
```

### Adding a New Feature

1. **Backend Service:**
   ```bash
   # Create service
   touch plugins/gitops-backend/src/services/NewService.ts

   # Add to router.ts
   const newService = new NewService(config, logger);
   router.get('/new-endpoint', async (req, res) => {
     const data = await newService.getData();
     res.json(data);
   });
   ```

2. **Frontend Component:**
   ```bash
   # Create component directory
   mkdir plugins/gitops/src/components/NewFeature
   touch plugins/gitops/src/components/NewFeature/NewFeature.tsx
   touch plugins/gitops/src/components/NewFeature/index.ts

   # Export from plugin
   # Edit plugins/gitops/src/index.ts
   export { NewFeature } from './components/NewFeature';
   ```

3. **Add Route (if page):**
   ```tsx
   // packages/app/src/App.tsx
   <Route path="/new-feature" element={<NewFeaturePage />} />
   ```

### Testing

```bash
# Unit tests
yarn test

# Type checking
yarn tsc

# Lint
yarn lint

# Build
yarn build
```

---

## 10. Implementation Status

### Completed Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Core Infrastructure (Auth, Helm, Redis) | ✅ Complete |
| 2 | CI/CD Visibility (GitHub Actions) | ✅ Complete |
| 3 | Permission Framework (RBAC) | ✅ Complete |
| 4 | Observability (Golden Signals, Widgets) | ✅ Complete |
| 5 | Service Maturity (Scorecards) | ✅ Complete |
| 6 | Cost Insights (FinOps) | ✅ Complete |
| 7 | AI-Powered Search | ✅ Complete |
| 8 | Day-2 Operations Templates | ✅ Complete |

### Files Created Today

**Backend Services:**
- `plugins/gitops-backend/src/services/AISearchService.ts`
- `plugins/gitops-backend/src/services/Day2OperationsService.ts`

**Frontend Components:**
- `plugins/gitops/src/components/AISearch/AISearchCard.tsx`
- `plugins/gitops/src/components/Day2Operations/Day2OperationsCard.tsx`

**Router Updates:**
- Added 15+ new endpoints for AI Search and Day-2 Operations

### Next Steps

1. **Build v7 image** with all Phase 1-8 code
2. **Deploy to saasops1** for testing
3. **Index documentation** for AI Search
4. **Configure LLM provider** (OpenAI/Anthropic/Ollama)
5. **Test all operations** in staging environment

---

## Quick Reference

### Important File Paths

| Purpose | Path |
|---------|------|
| Main Router | `plugins/gitops-backend/src/service/router.ts` |
| GitHub Service | `plugins/gitops-backend/src/services/GitHubService.ts` |
| Permission Service | `plugins/gitops-backend/src/services/PermissionService.ts` |
| Main Page | `plugins/gitops/src/components/GitOpsPage/GitOpsPage.tsx` |
| Plugin Exports | `plugins/gitops/src/index.ts` |
| Helm Chart | `deployment/helm/Chart.yaml` |
| Values | `deployment/helm/values.yaml` |
| App Config | `config/app-config.yaml` |

### Key Environment Variables

```bash
GITHUB_TOKEN          # GitHub API token
GITHUB_ORG            # GitHub organization
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
AUTH_SESSION_SECRET   # 32-byte hex string
POSTGRES_HOST
POSTGRES_PASSWORD
ARGOCD_URL
ARGOCD_TOKEN
GRAFANA_URL
GRAFANA_TOKEN
OPENAI_API_KEY        # For AI Search
```

---

*This encyclopedia is maintained as part of the DevOps Portal codebase. Update this document when adding new features.*
