# DevOps Portal v2 - Development Guide

## Project Overview

**DevOps Portal** is an enterprise-grade management portal built to replace the previous Backstage-based implementation. It provides a modern, security-first approach to managing Kubernetes deployments, GitOps workflows, and infrastructure monitoring.

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TailwindCSS, Radix UI |
| **Backend** | Next.js API Routes, Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis (optional) |
| **Authentication** | NextAuth v5 (GitHub OAuth + Credentials) |
| **State Management** | Zustand (persisted to localStorage) |
| **Code Editor** | Monaco Editor |
| **Testing** | Vitest, React Testing Library |

### Key Features

- **Dashboard**: Overview of deployments, health status, ArgoCD sync status
- **Repositories**: GitHub repository listing and management
- **Pull Requests**: View and manage PRs across repositories
- **GitOps Studio** (Admin-only): Advanced Git operations with file editing, bulk commits, and PR creation
- **ArgoCD Integration**: Application sync status and management
- **Grafana Integration**: Embedded dashboards and metrics
- **Prometheus Integration**: Direct metrics access
- **Multi-tenant**: Organization-based access control with RBAC (ADMIN, READWRITE, USER)

---

## Build Process

### Local Development

```bash
# Install dependencies
npm ci --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
```

### Production Build

```bash
# Full build (generates Prisma client + Next.js build)
npm run build

# The build outputs to .next/ directory
# - .next/standalone/ for production server
# - .next/static/ for static assets
```

---

## Docker Build Process

### Dockerfile Overview

The Dockerfile uses a **multi-stage build** for optimization:

1. **Stage 1 (deps)**: Install npm dependencies
2. **Stage 2 (builder)**: Build the Next.js application
3. **Stage 3 (runner)**: Minimal production image

### Building for AMD64/Linux (Production)

The Kubernetes cluster runs on **linux/amd64** architecture. When building from an Apple Silicon Mac, you must specify the target platform:

```bash
# Build for linux/amd64 and push to Docker Hub
docker buildx build \
  --platform linux/amd64 \
  -t rahulnutakki/devops-portal:v2-gitops-studio \
  --push \
  .
```

**Important**: Without `--platform linux/amd64`, the image will be built for ARM64 and will fail with `exec format error` on the cluster.

### Image Tags

| Tag | Purpose |
|-----|---------|
| `v2-latest` | Latest stable release |
| `v2-gitops-studio` | Current development version with GitOps Studio feature |

### Docker Hub Repository

- **Repository**: `rahulnutakki/devops-portal`
- **Full Image**: `docker.io/rahulnutakki/devops-portal:v2-gitops-studio`

---

## Kubernetes Deployment

### Cluster & Namespace

| Setting | Value |
|---------|-------|
| **Cluster** | `self-managed-test-dev01` |
| **Namespace** | `duploservices-saasops1` |
| **Node Selector** | `tenantname: duploservices-saasops1` |

### Kubeconfig

```bash
# Set the kubeconfig for the deployment cluster
export KUBECONFIG=/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml
```

### Deployment Commands

```bash
# Restart deployment to pull new image
kubectl rollout restart deployment/devops-portal -n duploservices-saasops1

# Check rollout status
kubectl rollout status deployment/devops-portal -n duploservices-saasops1 --timeout=120s

# View pods
kubectl get pods -n duploservices-saasops1

# View logs
kubectl logs -f deployment/devops-portal -n duploservices-saasops1
```

### Quick Deploy Script

```bash
# Full build and deploy cycle
cd /Users/nutakki/Documents/github/devops-portal

# 1. Build Next.js
npm run build

# 2. Build and push Docker image for AMD64
docker buildx build --platform linux/amd64 \
  -t rahulnutakki/devops-portal:v2-gitops-studio \
  --push .

# 3. Restart Kubernetes deployment
export KUBECONFIG=/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml
kubectl rollout restart deployment/devops-portal -n duploservices-saasops1
kubectl rollout status deployment/devops-portal -n duploservices-saasops1 --timeout=120s
```

---

## Helm Chart Configuration

### Chart Location

```
helm/devops-portal/
├── Chart.yaml
├── values.yaml              # Default values
├── values-dev.yaml          # Development overrides
├── values-prod.yaml         # Production overrides
├── values-saasops1.yaml     # Current deployment values
└── templates/
    ├── _helpers.tpl
    ├── configmap.yaml
    ├── deployment.yaml
    ├── hpa.yaml
    ├── ingress.yaml
    ├── networkpolicy.yaml
    ├── pdb.yaml
    ├── sealed-secret.yaml
    ├── service.yaml
    ├── serviceaccount.yaml
    └── servicemonitor.yaml
```

### Current Values File: `values-saasops1.yaml`

Key configuration settings:

```yaml
# Image Configuration
image:
  repository: rahulnutakki/devops-portal
  tag: "v2-latest"  # Update to v2-gitops-studio for latest
  pullPolicy: Always

# Node Selector (DuploCloud requirement)
nodeSelector:
  tenantname: duploservices-saasops1

# Database (External PostgreSQL)
externalDatabase:
  host: "devops-portal-postgres"
  port: 5432
  database: "devops_portal"

# Integrations
integrations:
  argocd:
    enabled: true
    url: "https://argocd-server.duploservices-saasops1.svc.cluster.local"
  grafana:
    enabled: true
    url: "http://grafana-local.duploservices-saasops1.svc.cluster.local:80"
  prometheus:
    enabled: true
    url: "http://prom-local-prometheus-server.duploservices-saasops1.svc.cluster.local:80"
  github:
    enabled: true
```

### Secrets

All secrets are stored in a Kubernetes secret named `devops-portal-secrets`:

| Key | Description |
|-----|-------------|
| `NEXTAUTH_SECRET` | NextAuth session encryption key |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_TOKEN` | GitHub Personal Access Token (for API access) |
| `ARGOCD_TOKEN` | ArgoCD API token |
| `GRAFANA_API_KEY` | Grafana API key |

---

## Testing

### Test Framework

- **Vitest**: Fast unit test runner
- **React Testing Library**: Component testing
- **Test coverage**: V8 coverage provider

### Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/app/api/gitops/__tests__/gitops-api.test.ts
```

### Test Files

| File | Description |
|------|-------------|
| `src/lib/__tests__/api.test.ts` | API utility tests |
| `src/lib/__tests__/encryption.test.ts` | Encryption helper tests |
| `src/lib/__tests__/rate-limit.test.ts` | Rate limiting tests |
| `src/lib/__tests__/metrics.test.ts` | Metrics collection tests |
| `src/lib/__tests__/prisma-tenant.test.ts` | Multi-tenant Prisma tests |
| `src/lib/__tests__/queue-metrics.test.ts` | Queue metrics tests |
| `src/app/api/gitops/__tests__/gitops-api.test.ts` | GitOps API tests |
| `src/components/gitops/__tests__/gitops-components.test.tsx` | GitOps component tests |

### Current Test Count

**128 tests** across all test files.

---

## Application Architecture

### Directory Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, select-org)
│   ├── (dashboard)/      # Dashboard pages
│   │   ├── alerts/
│   │   ├── argocd/
│   │   ├── clusters/
│   │   ├── dashboard/
│   │   ├── deployments/
│   │   ├── gitops-studio/   # NEW: Admin-only Git operations
│   │   ├── monitoring/
│   │   ├── pull-requests/
│   │   ├── repositories/
│   │   ├── settings/
│   │   ├── storage/
│   │   └── team/
│   └── api/              # API routes
│       ├── argocd/
│       ├── deployments/
│       ├── gitops/       # NEW: GitOps API endpoints
│       ├── grafana/
│       ├── health/
│       ├── organizations/
│       ├── prometheus/
│       ├── pull-requests/
│       └── repositories/
├── components/
│   ├── dashboard/        # Dashboard layout components
│   ├── gitops/           # GitOps Studio components
│   └── ui/               # Reusable UI components (ShadCN)
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── api.ts           # API handler wrapper with auth/rate-limit
│   ├── auth.ts          # NextAuth configuration
│   ├── prisma.ts        # Prisma client
│   └── github.ts        # GitHub API client
└── store/               # Zustand stores
    └── organization-store.ts
```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full access, including GitOps Studio |
| **READWRITE** | Read/write access to standard features |
| **USER** | Read-only access |

---

## What's Missing in the UI

### High Priority (Not Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| **GitOps Studio visibility** | 🔴 Broken | Role not loading from store - needs debugging |
| **User Management UI** | 🔴 Missing | Backend models exist, no UI for adding users |
| **Organization Management** | 🔴 Missing | Can't create/edit organizations from UI |
| **Team/Membership Management** | 🟡 Partial | Team page exists but limited functionality |

### Medium Priority (Partially Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| **Deployments Page** | 🟡 Partial | Basic listing, no create/edit |
| **Clusters Page** | 🟡 Partial | Shows placeholder content |
| **Storage Page** | 🟡 Partial | S3/MinIO integration not complete |
| **Alerts Page** | 🟡 Partial | Basic listing from mock data |

### Low Priority / Nice-to-Have

| Feature | Status | Notes |
|---------|--------|-------|
| **Dark Mode Toggle** | 🟡 Partial | Theme switching exists but inconsistent |
| **Search Functionality** | 🔴 Missing | Global search in header is non-functional |
| **Notifications** | 🔴 Missing | Bell icon exists but no real notifications |
| **Activity Feed** | 🟡 Partial | Dashboard shows mock data |

### GitOps Studio Feature Checklist

| Feature | Status |
|---------|--------|
| Repository selection | ✅ Done |
| Branch selection | ✅ Done |
| File tree browsing | ✅ Done |
| File content viewing | ✅ Done |
| Monaco editor integration | ✅ Done |
| File editing | ✅ Done |
| Stage changes | ✅ Done |
| Commit changes | ✅ Done |
| Bulk commit across repos | ✅ Done |
| Create Pull Request | ✅ Done |
| Admin-only access | ✅ Done (but role loading broken) |
| File filtering (values.yaml) | ✅ Done |
| Create new branch | 🔴 UI exists in backend, not in UI |
| Delete files | 🔴 Missing |
| View file diff | 🔴 Missing |

---

## Current Issue: GitOps Studio Not Visible

### Root Cause

The organization's `role` field is not being populated in the Zustand store. The sidebar checks `isAdmin(currentOrganization?.role)` which returns `false` when role is `undefined`.

### Attempted Fixes

1. ✅ Updated `select-organization/page.tsx` to set role in store when selecting org
2. ✅ Added `useEffect` in sidebar to refresh org data if role is missing
3. 🔴 Still not working - organization may not be in store at all

### Debug Steps

1. Open browser DevTools → Application → Local Storage
2. Look for `organization-storage` key
3. Check if it has `role: "ADMIN"`

### Manual Fix (Temporary)

Clear localStorage and log in again:
```javascript
// In browser console
localStorage.removeItem('organization-storage');
location.reload();
```

Then log in again through the organization selection flow.

---

## URLs & Access

| Service | URL |
|---------|-----|
| **DevOps Portal** | https://devops-portal.dev01.radiantlogic.io |
| **ArgoCD** | https://argocd.dev01.radiantlogic.io |
| **Grafana** | https://grafana.dev01.radiantlogic.io |

---

## Contact

- **Repository**: `/Users/nutakki/Documents/github/devops-portal`
- **Kubeconfig**: `/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/`
