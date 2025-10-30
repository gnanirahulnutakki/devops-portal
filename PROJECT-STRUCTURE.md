# Project Structure

Complete directory structure for the Backstage GitOps Management Portal.

```
backstage-gitops/
├── README.md                           # Main project documentation
├── package.json                        # Root package.json with workspaces
├── app-config.yaml                     # Backstage main configuration
├── docker-compose.yml                  # Local PostgreSQL setup
├── .env.example                        # Environment variables template
├── .gitignore                          # Git ignore patterns
├── tsconfig.json                       # TypeScript configuration
├── lerna.json                          # Lerna configuration (optional)
│
├── plugins/                            # Custom Backstage plugins
│   ├── gitops/                         # Frontend plugin
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── dev/
│   │   │   └── index.tsx              # Development setup
│   │   └── src/
│   │       ├── index.ts               # Plugin exports
│   │       ├── plugin.ts              # Plugin definition
│   │       ├── routes.ts              # Route references
│   │       ├── components/            # React components
│   │       │   ├── GitOpsPage/        # Main page
│   │       │   ├── InfraSelector/     # Repository selector
│   │       │   ├── BranchList/        # Branch multi-select
│   │       │   ├── FileBrowser/       # Directory tree
│   │       │   ├── FileEditor/        # Monaco editor
│   │       │   ├── CommitDialog/      # Commit UI
│   │       │   ├── ArgoCDPanel/       # ArgoCD integration
│   │       │   └── AuditLog/          # Audit trail viewer
│   │       ├── api/                   # API clients
│   │       │   ├── GitOpsClient.ts    # Main API client
│   │       │   └── types.ts           # API types
│   │       ├── hooks/                 # React hooks
│   │       │   ├── useRepositories.ts
│   │       │   ├── useBranches.ts
│   │       │   ├── useFileContent.ts
│   │       │   ├── useCommit.ts
│   │       │   └── useArgoCD.ts
│   │       ├── store/                 # State management
│   │       │   └── gitopsStore.ts     # Zustand store
│   │       └── types/                 # TypeScript types
│   │           └── index.ts
│   │
│   └── gitops-backend/                # Backend plugin
│       ├── package.json
│       ├── README.md
│       ├── config.d.ts                # Config schema
│       ├── knexfile.ts                # Knex configuration
│       ├── migrations/                # Database migrations
│   │       ├── 001_initial.ts
│   │       └── 002_add_bulk_operations.ts
│       └── src/
│           ├── index.ts               # Plugin exports
│           ├── plugin.ts              # Plugin registration
│           ├── service/               # Business logic
│           │   ├── router.ts          # Express router
│           │   ├── GitHubService.ts   # GitHub operations
│           │   ├── ArgoCDService.ts   # ArgoCD operations
│           │   ├── AuditService.ts    # Audit logging
│           │   ├── FileService.ts     # File operations
│           │   └── BulkOperationService.ts  # Bulk commits
│           ├── api/                   # API routes
│           │   ├── repositories.ts
│           │   ├── branches.ts
│           │   ├── files.ts
│           │   ├── content.ts
│           │   ├── commit.ts
│           │   ├── argocd.ts
│           │   └── audit.ts
│           ├── database/              # Database layer
│           │   └── AuditDatabase.ts
│           ├── types/                 # TypeScript types
│           │   ├── api.ts
│           │   ├── github.ts
│           │   ├── argocd.ts
│           │   └── audit.ts
│           ├── validation/            # Input validation
│           │   └── schemas.ts         # Joi schemas
│           ├── middleware/            # Express middleware
│           │   ├── errorHandler.ts
│           │   └── validate.ts
│           └── errors/                # Custom errors
│               └── GitOpsError.ts
│
├── helm/                              # Kubernetes deployment
│   ├── Chart.yaml                     # Helm chart metadata
│   ├── values.yaml                    # Default values
│   ├── values-dev.yaml                # Dev environment values
│   ├── values-staging.yaml            # Staging values
│   ├── values-prod.yaml               # Production values
│   ├── README.md                      # Deployment guide
│   └── templates/                     # Kubernetes manifests
│       ├── _helpers.tpl               # Template helpers
│       ├── deployment.yaml            # Backstage deployment
│       ├── service.yaml               # Service definition
│       ├── configmap.yaml             # ConfigMap
│       ├── secret.yaml                # Secret template
│       ├── ingress.yaml               # Ingress configuration
│       ├── rbac.yaml                  # RBAC permissions
│       ├── postgres-statefulset.yaml  # PostgreSQL (if enabled)
│       ├── postgres-service.yaml      # PostgreSQL service
│       └── postgres-pvc.yaml          # Persistent volume claim
│
├── .github/                           # GitHub workflows
│   └── workflows/
│       ├── ci.yml                     # CI pipeline
│       ├── build.yml                  # Docker build
│       └── deploy.yml                 # Deployment pipeline
│
├── scripts/                           # Utility scripts
│   ├── setup-local.sh                 # Local development setup
│   ├── create-secrets.sh              # Create Kubernetes secrets
│   ├── test-bulk-commit.ts            # Test bulk operations
│   └── load-test.js                   # k6 load tests
│
└── docs/                              # Additional documentation
    ├── API.md                         # API documentation
    ├── DEPLOYMENT.md                  # Deployment guide
    ├── DEVELOPMENT.md                 # Development guide
    └── TROUBLESHOOTING.md             # Common issues

```

## Key Files

### Configuration
- **app-config.yaml** - Backstage configuration (GitHub, ArgoCD, database)
- **.env.example** - Environment variables template
- **docker-compose.yml** - Local PostgreSQL for development

### Frontend Plugin
- **plugins/gitops/src/plugin.ts** - Plugin definition and registration
- **plugins/gitops/src/components/GitOpsPage/** - Main UI page
- **plugins/gitops/src/api/GitOpsClient.ts** - Backend API client
- **plugins/gitops/src/store/gitopsStore.ts** - Global state management

### Backend Plugin
- **plugins/gitops-backend/src/plugin.ts** - Backend plugin registration
- **plugins/gitops-backend/src/service/router.ts** - Express API routes
- **plugins/gitops-backend/src/service/GitHubService.ts** - GitHub integration
- **plugins/gitops-backend/src/service/ArgoCDService.ts** - ArgoCD integration
- **plugins/gitops-backend/migrations/** - Database schema

### Deployment
- **helm/Chart.yaml** - Helm chart definition
- **helm/values.yaml** - Default configuration values
- **helm/templates/deployment.yaml** - Kubernetes deployment manifest

## Next Steps

1. **Phase 0: Setup** (See 05-IMPLEMENTATION-ROADMAP.md)
   - Bootstrap Backstage app
   - Create plugin scaffolding
   - Setup development environment

2. **Phase 1: Backend**
   - Implement GitHubService
   - Create database schema
   - Build REST API endpoints

3. **Phase 2: Frontend**
   - Build UI components
   - Integrate Monaco editor
   - Create state management

4. **Phase 3-6: Features**
   - GitHub integration
   - File management
   - ArgoCD integration
   - Production readiness

## File Count Summary

- **Configuration files:** 5
- **Frontend plugin files:** ~40
- **Backend plugin files:** ~30
- **Helm chart files:** 15
- **Scripts:** 4
- **Documentation:** 5
- **Total:** ~100 files

## Technology Stack

### Frontend
- React 18
- TypeScript 5
- Material-UI 4
- Monaco Editor
- Zustand (state)
- React Query (data fetching)

### Backend
- Node.js 18
- TypeScript 5
- Express 4
- Octokit (GitHub API)
- Knex (database)
- PostgreSQL 14

### Infrastructure
- Kubernetes 1.27+
- Helm 3
- Docker
- PostgreSQL 14
- Nginx Ingress

## Current Status

✅ Project structure created
✅ Configuration files ready
✅ Package.json files configured
✅ Helm chart scaffolded
⏳ Ready to begin implementation (Phase 0)

Refer to **05-IMPLEMENTATION-ROADMAP.md** for detailed implementation steps.
