# Maintainer Notes

Short orientation for new contributors who need to work on the portal codebase. For the full architecture deep dive, see [`docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`](../architecture/CURRENT_RUNTIME_ARCHITECTURE.md).

## What Runs Today

- The active application is the Next.js app under `src/`.
- The active schema is `prisma/schema.prisma`.
- The active deployment assets are:
  - `Dockerfile`
  - `docker-compose.yml`
  - `helm/devops-portal/`

## Start Here

Read these files first, in order:

1. `README.md`
2. `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
3. `src/middleware.ts`
4. `src/lib/auth.ts`
5. `src/lib/api.ts`
6. `src/lib/api-context.ts`
7. `src/lib/tenant-context.ts`
8. `src/lib/prisma-tenant.ts`
9. `src/lib/services/integration-credentials.ts`
10. `prisma/schema.prisma`

If you are debugging a specific subsystem, then move to the matching route and service files under `src/app/api` and `src/lib/services`.

## Mental Model

The portal is a multi-tenant operations UI that fronts:

- PostgreSQL for org, user, cluster, audit, scorecard, and scan state
- Redis for rate limiting, encrypted token storage, and BullMQ queue support
- external systems such as ArgoCD, Grafana, GitHub, Kubernetes, S3/MinIO, and optional LLM/MCP endpoints

The main request path is:

1. User authenticates through NextAuth
2. JWT stores a map of org memberships
3. Middleware validates org access from JWT claims
4. Middleware injects `x-organization-id`, `x-user-id`, `x-user-role`, and `x-request-id`
5. `withTenantApiHandler` sets AsyncLocalStorage tenant context
6. Routes call services and Prisma using org-aware context

## Critical Runtime Boundaries

### Authentication and org access

- Default auth mode is `keycloak-only`
- `AUTH_MODE=multi` enables additional providers
- Org access is enforced by middleware, not by client state
- The selected org is persisted in the `organization-id` cookie and can also be sent in `x-organization-id`

### Tenant-safe data access

- Use `ctx.db` inside tenant routes whenever possible
- The Prisma tenant extension only auto-scopes:
  - `Cluster`
  - `Deployment`
  - `BulkOperation`
  - `AuditLog`
  - `AlertRule`
  - `IntegrationCredential`
- Other org-backed models still need explicit `organizationId` filtering in route/service code

### Credentials and secrets

- Org-scoped integration credentials are stored encrypted in `IntegrationCredential`
- Some services still fall back to org settings JSON or env vars
- OAuth-style tokens, especially GitHub, are stored in Redis via `src/lib/token-store.ts`

### Embedded Grafana

- Grafana is not just a REST integration
- `src/app/grafana/[[...path]]/route.ts` is a reverse proxy for the embedded Grafana SPA
- `src/middleware.ts` contains special rewrite logic to keep Grafana root-relative requests inside the proxy path

## Subsystems You Will Touch Most Often

- Dashboard shell: `src/app/(dashboard)` and `src/components/dashboard`
- Auth and provider wiring: `src/lib/auth.ts`
- API wrapper and response model: `src/lib/api.ts`
- Tenant enforcement: `src/middleware.ts`, `src/lib/api-context.ts`, `src/lib/prisma-tenant.ts`
- Integrations:
  - ArgoCD: `src/lib/services/argocd.ts`
  - Grafana: `src/lib/services/grafana.ts`
  - Kubernetes: `src/lib/services/kubernetes.ts`
  - S3: `src/lib/services/s3.ts`
  - scorecards: `src/lib/services/scorecards.ts`
  - security scans: `src/lib/services/security-scans.ts`
  - assistant/LLM: `src/app/api/mcp/chat/route.ts`, `src/lib/services/llm.ts`, `src/lib/tools/*`

## Known Gaps And Risks

- Worker startup is not obvious from the scanned entrypoints:
  - `startWorker()` exists
  - `startCredentialHealthWorker()` exists in local uncommitted work
  - neither was found wired into startup during static inspection
- BullMQ worker handlers still contain TODOs for real bulk GitHub updates, ArgoCD syncs, and deployment restarts
- Tenant isolation is not completely centralized because the Prisma extension does not cover every org-backed model
- Integration configuration can come from DB credentials, org settings, or env vars, which increases drift risk
- Docs and CI are partially stale and still reference Backstage-era layouts

## First-time setup checklist

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

All five should succeed cleanly on `main`. If any fail, that's a bug — please open an issue.

## Areas with active follow-up work

- The Prisma tenant-context extension currently auto-scopes 6 models (`Cluster`, `Deployment`, `BulkOperation`, `AuditLog`, `AlertRule`, `IntegrationCredential`). Extending coverage to `SecurityScan`, `Scorecard`, and `ScorecardResult` is on the roadmap.
- BullMQ worker handlers contain TODOs for real bulk GitHub updates, ArgoCD syncs, and deployment restarts (`src/lib/queue.ts`).
- Integration configuration today can come from DB credentials, org settings JSON, or env-var fallback. Consolidating onto encrypted DB credentials is in progress.
