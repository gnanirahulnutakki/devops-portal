# DevOps Portal Security And Reliability Guide

This guide describes the current root-runtime posture, not the older Backstage/plugin implementation.

## Security Model

## Authentication Defaults

The runtime uses NextAuth with JWT sessions and Prisma persistence.

- default auth mode: `keycloak-only`
- optional auth mode: `AUTH_MODE=multi`
- optional credentials auth: `ENABLE_CREDENTIALS_AUTH=true`

Operational consequence:

- if you leave the app in `keycloak-only` mode without Keycloak configured, auth is effectively broken by configuration

## Tenant Enforcement

The primary request boundary is `src/middleware.ts`.

Middleware:

- validates session auth
- validates org membership from JWT claims
- rejects access to orgs not present in the token
- injects `x-organization-id`, `x-user-id`, `x-user-role`, and `x-request-id`

Tenant routes then use AsyncLocalStorage and tenant-aware API wrappers.

## Data Protection

Sensitive integration credentials are stored encrypted in the database.

This depends on:

- `TOKEN_ENCRYPTION_KEY`
- optional rotation keys such as `TOKEN_ENCRYPTION_KEY_2`

If these keys drift from stored data, credential decryption fails.

## Secret Management

Recommended production approaches:

1. Sealed Secrets
2. External Secrets Operator
3. Secrets Store CSI Driver

Do not keep plaintext production secrets in Git or inline Helm values.

## Endpoint Protection

### Metrics

`/api/metrics` should be protected with `METRICS_AUTH_TOKEN`.

In production, if no metrics token is configured, the endpoint returns `503` rather than exposing metrics anonymously.

### Health

`/api/health` is public, but verbose health output in production requires bearer auth using `HEALTH_AUTH_TOKEN` or `METRICS_AUTH_TOKEN`.

### OpenAPI

`/api/openapi` exists, but current middleware behavior still means it is not effectively public by default.

## Runtime Security Controls

The current Helm chart and container config include:

- non-root container execution
- dropped Linux capabilities
- runtime default seccomp profile
- readiness, liveness, and startup probes on `/api/health`
- optional network policies
- optional service monitor and Prometheus rule objects

## Reliability Model

## Health And Probes

The app uses `/api/health` for:

- Docker image health check
- Kubernetes startup probe
- Kubernetes readiness probe
- Kubernetes liveness probe

Health evaluation checks:

- database
- Redis
- queue behavior when Redis is available
- auth configuration
- optional verbose external integration checks

## Scaling And Availability

The Helm chart defaults to:

- multiple replicas
- HPA enabled
- Pod Disruption Budget enabled
- anti-affinity preferences

That is the correct baseline for production unless your environment has a deliberate reason to simplify it.

## Initialization

The chart runs init containers to:

1. wait for the database
2. apply schema changes with `prisma db push`

That improves first-start behavior, but it also means rollout success depends on DB reachability and schema application.

## Queue And Background Work

The runtime has BullMQ queue support and worker code, but the startup path for workers is not clearly wired from the inspected entrypoints.

That is a reliability risk for features that assume a live background worker.

## Operational Risks

Current repo-grounded risks to track:

- worker startup wiring is unclear
- credential sourcing is fragmented across DB, Redis, org settings JSON, and env fallbacks
- Prisma tenant auto-scoping does not cover every org-backed model
- local Redis behavior disables Redis when `REDIS_URL` contains `localhost`

## Production Checklist

- set `AUTH_SECRET` or `NEXTAUTH_SECRET`
- set `NEXTAUTH_URL`
- set `TOKEN_ENCRYPTION_KEY`
- set `METRICS_AUTH_TOKEN`
- choose and document one secret-management strategy
- verify external integration credentials per organization
- verify database backups and restore path
- verify object-storage backup or retention policy
- confirm queue expectations and worker behavior
- confirm network policy and service account permissions
- verify vulnerability scanning RBAC before enabling broad scan use

## Cost Notes

The current reliability defaults have real infrastructure cost:

- HPA plus multi-replica deployment increases steady-state compute usage
- bundled PostgreSQL, Redis, and MinIO consume persistent volumes
- Prometheus scraping and retention increase monitoring cost
- Trivy-based image scanning adds compute and registry traffic

Those are reasonable trade-offs for production, but they should be intentional.

## Related Docs

- `docs/operations/AUTHENTICATION_AND_USERS.md`
- `docs/operations/SECRETS_AND_VAULT.md`
- `docs/deployment/DEPLOY_GUIDE.md`
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`

## Historical Version

The replaced Backstage-era security and reliability guide now lives at:

- `docs/legacy/backstage-era/operations/SECURITY_AND_RELIABILITY.md`
