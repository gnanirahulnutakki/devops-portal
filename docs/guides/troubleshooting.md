# DevOps Portal Troubleshooting Guide

This guide is for the current root-runtime application.

Start with code-grounded references if the issue is unclear:

- `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`

## First Checks

### 1. Verify basic app health

```bash
curl http://localhost:3000/api/health
```

If you need verbose output in production:

```bash
curl -H "Authorization: Bearer $HEALTH_AUTH_TOKEN" \
  "https://your-host/api/health?verbose=true"
```

### 2. Verify metrics access

```bash
curl -H "Authorization: Bearer $METRICS_AUTH_TOKEN" \
  http://localhost:3000/api/metrics
```

### 3. Check runtime configuration

Confirm the env groups are actually set:

```bash
printenv | grep -E "AUTH_MODE|NEXTAUTH_URL|AUTH_SECRET|DATABASE_URL|REDIS_URL|TOKEN_ENCRYPTION_KEY"
```

### 4. Check deployment state

For Kubernetes:

```bash
kubectl -n <namespace> get deploy,pods,svc,ingress
kubectl -n <namespace> rollout status deploy/devops-portal --timeout=10m
kubectl -n <namespace> logs deploy/devops-portal --tail=200
```

## Common Issues

## App does not start locally

### Symptoms

- `npm run dev` fails immediately
- build or runtime commands are missing
- Prisma or Next.js commands fail

### Checks

- confirm Node 22+ is installed
- run `npm ci --legacy-peer-deps`
- verify `DATABASE_URL` and `TOKEN_ENCRYPTION_KEY`

## Login page shows no useful providers

### Likely cause

The runtime defaults to `AUTH_MODE=keycloak-only`.

If Keycloak is not configured, the app logs an auth configuration error and local sign-in will not work the way a multi-provider dev setup expects.

### Fix

For local or non-Keycloak usage:

```bash
AUTH_MODE=multi
ENABLE_CREDENTIALS_AUTH=true
```

Then provide the provider-specific credentials you actually intend to use.

## API returns `400 ORGANIZATION_REQUIRED`

### Likely cause

The request reached a tenant-aware route without valid organization context.

### Fix

- select an organization in the UI first
- ensure the `organization-id` cookie is present
- if calling APIs directly, send `x-organization-id`

## API returns `403 FORBIDDEN` for a valid session

### Likely cause

The selected org is not present in the user’s JWT membership map, or the user lacks the required role.

### Fix

- verify the user has a membership in that organization
- re-authenticate if membership changed recently
- verify feature policy and role requirements for the route

## `/api/metrics` returns `401`

### Likely cause

Bearer token mismatch with `METRICS_AUTH_TOKEN`.

### Fix

Send:

```bash
Authorization: Bearer <METRICS_AUTH_TOKEN>
```

## `/api/metrics` returns `503` in production

### Likely cause

`METRICS_AUTH_TOKEN` is not configured.

### Fix

Set `METRICS_AUTH_TOKEN` and redeploy.

## Queue status shows disabled

### Likely causes

- Redis is unavailable
- `REDIS_URL` is unset
- current code disables Redis when `REDIS_URL` contains `localhost`

### What it affects

- BullMQ queue stats
- queue-backed bulk operations
- Redis-backed token storage behavior
- rate-limit analytics

### Fix

- ensure Redis is reachable
- use a non-`localhost` Redis hostname if you need the app to treat Redis as enabled

## Grafana pages or embedded assets fail oddly

### Likely causes

- Grafana integration credentials are missing or invalid
- proxy rewriting is breaking because requests are not flowing through `/grafana/*`
- org-specific Grafana settings are missing

### Checks

- test the JSON monitoring routes under `/api/monitoring/grafana/*`
- verify Grafana credentials for the current organization
- inspect browser network requests for root-relative asset requests

## ArgoCD routes fail

### Likely causes

- missing org-scoped ArgoCD credentials
- incorrect ArgoCD URL or token
- TLS or insecure-mode mismatch

### Checks

- verify the org has an ArgoCD credential record or valid fallback config
- verify connectivity from the runtime environment to the ArgoCD server

## S3 routes return `S3_NOT_CONFIGURED`

### Likely cause

The current organization has no usable S3 or MinIO credential path.

### Fix

- configure DB-backed S3 credentials for the org
- or ensure the runtime env fallback is intentionally configured

## Integration credentials fail to decrypt

### Symptoms

- integration calls suddenly stop working
- credential health or list routes show errors
- logs indicate decryption failure

### Likely cause

`TOKEN_ENCRYPTION_KEY` changed or is inconsistent with the data already stored.

### Fix

- restore the correct key
- or rotate and re-save credentials intentionally

## Security scans stay `RUNNING` or fail immediately

### Likely causes

- the app cannot create Kubernetes jobs
- RBAC is insufficient
- Trivy image pulls fail
- scan namespace selection is wrong

### Checks

- verify the app service account can create Jobs and read pods/logs
- inspect the generated Job and pod logs
- confirm the target image reference is valid and reachable

## `/api/openapi` is unexpectedly blocked

### Likely cause

Middleware still treats it like a normal API route.

### Fix

- test while authenticated with valid org context
- if you want it publicly accessible, the middleware path rules need to be changed deliberately

## When To Escalate

Escalate beyond basic troubleshooting when:

- health is unhealthy because database connectivity is failing
- encryption key mismatches threaten access to stored credentials
- org access appears to bypass or break membership validation
- production metrics are exposed without token protection
- background job behavior is required but no worker startup path is clearly active

## Historical Version

The replaced Backstage-era troubleshooting guide now lives at:

- `docs/legacy/backstage-era/guides/troubleshooting.md`
