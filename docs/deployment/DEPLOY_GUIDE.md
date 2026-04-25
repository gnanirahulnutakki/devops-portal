# DevOps Portal Deployment Guide

This guide covers deployment of the active root-level Next.js runtime.

It replaces the older Backstage-oriented deployment instructions that are now archived under `docs/legacy/backstage-era/`.

## Scope

This guide applies to:

- the root `Dockerfile`
- `docker-compose.yml`
- `helm/devops-portal/`
- the root Prisma schema and Next.js API runtime

It does not describe `packages/`, `plugins/`, or `deployment/docker/` as the primary deployment path.

## Deployment Modes

The repository supports three practical deployment modes:

1. local development with root `npm` scripts plus `docker-compose`
2. container image build from the root `Dockerfile`
3. Kubernetes deployment via `helm/devops-portal`

## Prerequisites

- Node.js 22+
- Docker and Docker Compose
- access to PostgreSQL, Redis, and S3-compatible object storage
- required auth and integration secrets
- Helm 3 for Kubernetes deployments

## Required Configuration Categories

At minimum, plan for these env/config groups:

- app and auth:
  - `NEXTAUTH_URL`
  - `AUTH_SECRET` or `NEXTAUTH_SECRET`
  - `AUTH_MODE`
  - `ENABLE_CREDENTIALS_AUTH`
- database and cache:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `TOKEN_ENCRYPTION_KEY`
- object storage:
  - `S3_BUCKET`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - optional `S3_ENDPOINT`
- integration endpoints and credentials:
  - ArgoCD
  - Grafana
  - Prometheus
  - GitHub OAuth or PAT
  - optional LLM, Uptime Kuma, Supabase, Vanta
- operational security:
  - `METRICS_AUTH_TOKEN`
  - optional `HEALTH_AUTH_TOKEN`

See `.env.example`, `docs/operations/AUTHENTICATION_AND_USERS.md`, and `docs/operations/SECRETS_AND_VAULT.md` for current examples.

## Local Development Bring-Up

Start infrastructure:

```bash
docker-compose up -d
```

Create local env:

```bash
cp .env.example .env
```

If you are not using Keycloak locally, set:

```bash
AUTH_MODE=multi
ENABLE_CREDENTIALS_AUTH=true
```

Then initialize and run:

```bash
npm ci --legacy-peer-deps
npm run db:migrate
npm run db:seed
npm run dev
```

Access the app at `http://localhost:3000`.

### Local Redis caveat

The current `src/lib/redis.ts` disables Redis when `REDIS_URL` contains `localhost`.

That means queue, rate-limit analytics, and Redis-backed token behavior are effectively disabled in that mode. If you need Redis-backed behavior in local testing, use a non-`localhost` hostname that resolves from the app environment.

## Docker Image Build

Build from the root runtime:

```bash
docker build \
  --build-arg DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/devops_portal?schema=public" \
  --build-arg NEXTAUTH_URL="http://localhost:3000" \
  -t devops-portal:local \
  .
```

Notes:

- the Docker build uses the root `Dockerfile`
- Prisma generate runs during build
- `NEXTAUTH_SECRET` should be supplied at runtime, not baked into the image
- the image exposes port `3000` and uses `/api/health` as its health check

Run the image:

```bash
docker run --rm -p 3000:3000 \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e AUTH_SECRET=replace-me \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/devops_portal?schema=public \
  -e TOKEN_ENCRYPTION_KEY=replace-me \
  devops-portal:local
```

## Kubernetes Deployment With Helm

The primary chart is `helm/devops-portal/`.

### Chart characteristics

- deploys the root app container on port `3000`
- defaults to HPA-enabled multi-replica deployment
- uses `/api/health` for startup, readiness, and liveness probes
- supports bundled PostgreSQL, Redis, MinIO, Sealed Secrets, and Trivy Operator dependencies
- supports External Secrets Operator and Secrets Store CSI Driver as alternatives
- runs init containers to wait for the database and apply schema via `prisma db push`

### Install dependencies

```bash
cd helm/devops-portal
helm dependency update
```

### Choose a secret strategy

Recommended production options:

1. Sealed Secrets
2. External Secrets Operator
3. Secrets Store CSI Driver

Do not commit plaintext runtime secrets to Git.

### Minimum Helm values to review

- `config.baseUrl`
- `image.repository`
- `image.tag`
- `ingress.*`
- `postgresql.enabled` versus `externalDatabase.*`
- `redis.enabled` versus `externalRedis.*`
- `minio.enabled` versus `externalS3.*`
- `integrations.*`
- `serviceMonitor.enabled`
- `networkPolicy.enabled`
- `initContainers.*`

### Install or upgrade

```bash
helm upgrade --install devops-portal ./helm/devops-portal \
  -n devops-portal \
  --create-namespace \
  -f helm/devops-portal/values-prod.yaml
```

If you are pinning the image tag from CI:

```bash
helm upgrade --install devops-portal ./helm/devops-portal \
  -n devops-portal \
  --create-namespace \
  -f helm/devops-portal/values-prod.yaml \
  --set image.repository=rahulnutakki/devops-portal \
  --set image.tag=latest
```

## Post-Deploy Verification

Check rollout status:

```bash
kubectl -n devops-portal get deploy,pods,svc,ingress
kubectl -n devops-portal rollout status deploy/devops-portal --timeout=10m
```

Check health:

```bash
curl https://your-host/api/health
curl -H "Authorization: Bearer $METRICS_AUTH_TOKEN" https://your-host/api/metrics
```

Check auth mode behavior:

- if `AUTH_MODE=keycloak-only`, Keycloak must be configured or auth is unhealthy
- if `AUTH_MODE=multi`, verify the intended providers are present on the login screen

Check tenant behavior:

- sign in
- select an organization
- verify authenticated API calls carry valid org context

## Production Notes

### Security

- set `AUTH_SECRET` or `NEXTAUTH_SECRET`
- set `TOKEN_ENCRYPTION_KEY`
- set `METRICS_AUTH_TOKEN`
- prefer sealed or external secrets over inline secret values
- keep `networkPolicy.enabled=true` unless you have a deliberate reason not to
- review service account and security-scan RBAC before enabling in-cluster scans

### Reliability

- keep readiness and liveness probes on `/api/health`
- keep HPA and PDB enabled unless your environment has a reason to disable them
- review DB and object-storage persistence sizing before production rollout
- monitor init container failures; schema push happens before app start

### Cost

- bundled PostgreSQL, Redis, and MinIO are convenient but add stateful storage cost
- Trivy Operator and image scanning increase cluster workload and registry traffic
- Prometheus scraping and long retention can materially increase monitoring cost

## Known Runtime Gaps

- worker startup is not clearly wired from the inspected startup paths
- credential sourcing is still split between encrypted DB credentials, Redis token storage, org settings JSON, and env fallback
- some multi-tenant enforcement still depends on explicit route filtering rather than centralized Prisma auto-scoping

## Historical Version

The replaced Backstage-era deployment guide now lives at:

- `docs/legacy/backstage-era/deployment/DEPLOY_GUIDE.md`
