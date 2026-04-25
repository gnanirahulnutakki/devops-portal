# DevOps Portal API Reference

This document describes the current root-runtime API surface at a practical level.

For a route-level schema reference, use:

- `GET /api/openapi`
- `src/lib/openapi.ts`
- the route handlers under `src/app/api/`

## Base Model

The portal is a single Next.js application. There is no separate Express backend.

- UI pages and API routes are served from the same app
- most business APIs live under `/api/*`
- most authenticated APIs are tenant-aware

## Authentication And Tenant Context

Most routes require:

- a valid NextAuth session
- organization selection
- a valid `x-organization-id` header or `organization-id` cookie

Middleware validates JWT membership claims and injects:

- `x-organization-id`
- `x-user-id`
- `x-user-role`
- `x-request-id`

### Important exceptions

- `/api/auth/*` is public to support the auth flow
- `/api/health` is public
- `/api/metrics` is org-optional but protected by bearer token in production
- `/api/openapi` is implemented as a plain route, but middleware still treats it like a normal authenticated API path unless the public-path rules change

## Common Response Shape

Most API handlers use this envelope:

```json
{
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 20
  }
}
```

Not every route uses the envelope consistently. Some operational routes return raw JSON instead.

## Common Error Patterns

| HTTP | Typical meaning |
| --- | --- |
| `400` | missing org header, invalid request, invalid query |
| `401` | no auth session or missing metrics/health token |
| `403` | valid session but no organization access or insufficient role |
| `404` | target resource not found |
| `429` | rate limit exceeded |
| `500` | handler or integration failure |
| `503` | endpoint intentionally unavailable, such as metrics in production without token config |

## Operational Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | public; `?verbose=true` requires bearer token in production |
| `GET` | `/api/metrics` | Prometheus text; bearer token required in production |
| `GET` | `/api/openapi` | OpenAPI JSON; currently still behind normal API middleware behavior |
| `GET` | `/api/features` | returns effective feature policy for current org and membership |
| `GET` | `/api/queue/stats` | queue health and BullMQ counts; disabled if Redis queue is unavailable |

## Auth And User Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `ALL` | `/api/auth/[...nextauth]` | NextAuth provider/session flow |
| `GET` | `/api/auth/connections` | linked OAuth providers for current user |
| `GET`, `POST` | `/api/users` | org-scoped users; admin writes |
| `PATCH`, `DELETE` | `/api/users/[id]` | update or remove member |
| `GET`, `PUT` | `/api/user-preferences` | current user preference record |

## Organization Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET`, `POST` | `/api/organizations` | organization listing and creation |
| `GET`, `PATCH`, `DELETE` | `/api/organizations/[id]` | org record management |
| `GET`, `PUT` | `/api/organizations/settings` | org settings JSON, including feature and integration pointers |

## Cluster And Kubernetes Endpoints

Representative routes:

- `GET /api/clusters`
- `POST /api/clusters`
- `GET /api/clusters/[id]`
- `GET /api/clusters/[id]/overview`
- `GET /api/clusters/[id]/nodes`
- `GET /api/clusters/[id]/namespaces`
- `GET /api/clusters/[id]/pods`
- `GET /api/clusters/[id]/pods/[name]/logs`
- `GET /api/clusters/[id]/services`
- `GET /api/clusters/[id]/ingresses`
- `GET /api/clusters/[id]/workloads`
- `GET /api/clusters/[id]/helm`
- `GET /api/clusters/[id]/crds`
- `POST /api/clusters/validate`

These routes depend on org-scoped kubeconfig or cluster credentials.

## ArgoCD Endpoints

Representative routes:

- `GET /api/argocd/applications`
- `GET /api/argocd/applications/[name]`
- `GET /api/argocd/applications/[name]/resources`
- `GET /api/argocd/applications/[name]/history`
- `POST /api/argocd/applications/[name]/refresh`
- `POST /api/argocd/applications/[name]/sync`

These routes depend on org-scoped ArgoCD integration credentials or configured fallbacks.

## GitHub And GitOps Endpoints

### GitHub views

- `GET /api/github/repositories`
- `GET /api/github/branches`
- `GET /api/github/pull-requests`
- `GET /api/github/pull-requests/files`
- `POST /api/github/pull-requests/merge`
- `GET /api/github/actions/runs`
- `POST /api/github/actions/runs/[runId]/rerun`
- `POST /api/github/actions/runs/[runId]/cancel`

### GitOps editing flow

- `GET /api/gitops/branches`
- `POST /api/gitops/branches/create`
- `GET /api/gitops/tree`
- `GET /api/gitops/contents`
- `GET /api/gitops/pulls`
- `POST /api/gitops/bulk-commit`

These routes mix per-user GitHub OAuth access, org-scoped credentials, and settings-based integration pointers depending on the exact path.

## Monitoring And Grafana Endpoints

Representative routes:

- `GET /api/monitoring/dora`
- `GET /api/monitoring/grafana/dashboards`
- `GET /api/monitoring/grafana/folders`
- `GET /api/monitoring/grafana/alerts`
- `GET /api/monitoring/grafana/panels`
- `GET /api/monitoring/grafana/insights`
- `GET /api/monitoring/grafana/render`

The embedded Grafana UI is proxied separately through `/grafana/*`, not through these JSON routes alone.

## Storage Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/storage/s3` | list objects |
| `POST` | `/api/storage/s3` | signed upload or download URL |
| `DELETE` | `/api/storage/s3` | delete object; admin only |

Storage is org-scoped and depends on S3 or MinIO credentials.

## Integration Credential Endpoints

Representative routes:

- `/api/integrations/argocd/accounts`
- `/api/integrations/github/accounts`
- `/api/integrations/grafana/accounts`
- `/api/integrations/llm/accounts`
- `/api/integrations/supabase/accounts`
- `/api/integrations/uptime-kuma/accounts`

Local worktree also currently includes credential-health endpoints:

- `GET /api/integrations/credentials/health`
- `GET /api/integrations/credentials/expiring`
- `POST /api/integrations/credentials/[id]/check`

Those paths exist in the current worktree but are not part of the previously committed baseline.

## Assistant And MCP Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/mcp/chat` | assistant execution path with LLM, MCP, Fastworkflow, Ollama, and tool-calling options |

This route is feature-sensitive and depends on org settings and integration credentials for some modes.

## Scorecards And Security Endpoints

Representative routes:

- `GET /api/scorecards`
- `GET /api/scorecards/[id]`
- `POST /api/scorecards/evaluate`
- `GET /api/scorecards/results`
- `POST /api/scorecards/seed`
- `GET /api/security/scans`
- `POST /api/security/scans`
- `GET /api/security/scans/[id]`
- `GET /api/security/scans/[id]/download`
- `GET /api/security/cluster/trivy/reports`
- `GET /api/security/code-scanning/alerts`
- `GET /api/security/dependabot/alerts`
- `GET /api/security/vanta/vulnerabilities`

Some of these routes are feature-gated, especially vulnerability and security scanning paths.

## Feature Gates And Roles

Many routes are protected by a combination of:

- role checks: `USER`, `READWRITE`, `ADMIN`
- rate-limit buckets: `general`, `bulk`, `sync`, `auth`, `render`
- feature flags from org policy and membership overrides

Common examples:

- destructive storage actions require higher roles
- vulnerability routes can be hidden by feature policy
- monitoring and credential-health routes can be feature-gated

## Practical Guidance

- use `/api/openapi` as the closest thing to a live schema source
- check `src/app/api/*/route.ts` for exact method behavior
- check `src/lib/api.ts` for wrapper behavior, error shape, and rate limiting
- check `src/middleware.ts` before assuming a route is public

## Historical Version

The replaced Backstage-era API reference now lives at:

- `docs/legacy/backstage-era/reference/api-reference.md`
