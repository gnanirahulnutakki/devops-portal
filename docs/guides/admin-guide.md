# DevOps Portal Administrator Guide

This guide is for operators and maintainers of the active root-runtime application.

Use it together with:

- `README.md`
- `docs/deployment/DEPLOY_GUIDE.md`
- `docs/operations/AUTHENTICATION_AND_USERS.md`
- `docs/operations/SECRETS_AND_VAULT.md`
- `docs/operations/DEPLOYMENT_RUNBOOK.md`

## Administrator Responsibilities

Typical responsibilities for this runtime are:

- configure auth providers and org bootstrap behavior
- manage runtime secrets and integration credentials
- deploy and upgrade the app container and Helm chart
- monitor health, metrics, and background behavior
- manage organization, team, and feature access
- verify storage, queue, and security-scan dependencies

## Runtime Components You Own

As an operator, assume ownership of these components:

- root Next.js app under `src/`
- Prisma/PostgreSQL schema and migrations
- Redis-backed queue, rate limiting, and token storage
- S3 or MinIO storage integration
- Helm chart and Kubernetes deployment resources
- external integration connectivity for ArgoCD, Grafana, GitHub, Prometheus, and optional LLM systems

## Authentication And Access Control

### Auth modes

- default: `AUTH_MODE=keycloak-only`
- optional multi-provider mode: `AUTH_MODE=multi`

In `keycloak-only` mode, the app expects:

- `KEYCLOAK_ID`
- `KEYCLOAK_SECRET`
- `KEYCLOAK_ISSUER`

If these are missing, auth is unhealthy and sign-in will not behave correctly.

### Credentials login

If you need local or fallback credentials login:

```bash
AUTH_MODE=multi
ENABLE_CREDENTIALS_AUTH=true
```

### Org membership enforcement

Middleware enforces organization access using JWT membership claims. Client state alone does not grant access.

That means:

- a user must have a valid org membership
- API requests must carry valid org context
- page access also depends on a selected org cookie

## Team And Organization Administration

Current admin surfaces live in the app itself:

- Settings → Team
- organization settings routes
- user and membership APIs

Admins can generally:

- create or remove members
- change org roles
- manage organization settings JSON
- control feature policy exposure

## Integration Administration

The portal supports org-scoped encrypted integration credentials for providers such as:

- ArgoCD
- Grafana
- GitHub
- S3
- LLM
- Uptime Kuma
- Supabase
- Vanta

Operationally, admins should prefer DB-backed encrypted credentials over loose env-only setups where possible.

### Current caveat

Credential sourcing is not fully normalized yet. Some services can still fall back to:

- org settings JSON
- per-user Redis tokens
- process environment variables

That increases drift risk and should be reviewed during incident analysis.

## Deployment Administration

Primary deployment assets:

- root `Dockerfile`
- `docker-compose.yml`
- `helm/devops-portal/`

The Helm chart currently manages:

- app deployment
- probes and HPA
- service account and network policy
- bundled PostgreSQL, Redis, and MinIO when enabled
- optional Sealed Secrets, External Secrets, CSI secret integration, and Trivy Operator support

## Operational Endpoints

Key endpoints for operators:

- `/api/health`
- `/api/metrics`
- `/api/features`
- `/api/queue/stats`
- `/api/openapi`

### Important behaviors

- `/api/metrics` should be protected with `METRICS_AUTH_TOKEN`
- verbose health output requires bearer auth in production
- `/api/openapi` is not effectively public today because middleware still applies normal API auth behavior

## Reliability Checks

Regular checks should include:

- app health status
- readiness and rollout behavior in Kubernetes
- DB connectivity
- Redis availability
- object storage reachability
- integration credential health
- BullMQ queue health and worker presence
- security-scan job execution if vulnerability features are enabled

## Backup And Recovery

The portal depends on multiple state stores:

- PostgreSQL
- object storage
- Kubernetes secrets or secret backends

Minimum recovery plan:

1. backup PostgreSQL regularly
2. preserve object storage buckets if used for tenant data or artifacts
3. back up or regenerate secret material, especially:
   - `AUTH_SECRET` or `NEXTAUTH_SECRET`
   - `TOKEN_ENCRYPTION_KEY`
   - integration credentials or their backing secret sources

If `TOKEN_ENCRYPTION_KEY` is lost or rotated incorrectly, encrypted integration credentials may become unreadable.

## Security Defaults To Keep

- run with non-root containers
- keep network policies enabled unless intentionally replaced
- avoid plaintext secrets in Git
- protect `/api/metrics`
- prefer least-privilege credentials for external systems
- review security-scan service account permissions before broadening them

## Known Risks

- worker startup is not clearly wired from the inspected startup paths
- some org-backed models still rely on explicit route filtering rather than centralized Prisma auto-scoping
- Redis behavior in local `localhost` mode disables some runtime capabilities
- mixed credential sources can produce drift between org settings, DB records, and env vars

## Historical Version

The replaced Backstage-era administrator guide now lives at:

- `docs/legacy/backstage-era/guides/admin-guide.md`
