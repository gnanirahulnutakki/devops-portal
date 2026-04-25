# DevOps Portal FAQ

## What is the portal now?

The active application is a root-level Next.js 15 portal with React 19, Prisma, PostgreSQL, Redis support, and external DevOps integrations such as ArgoCD, Grafana, GitHub, Kubernetes, and S3.

It is not the older Backstage/plugin layout that still exists in historical parts of the repository.

## Why do some repo areas still mention Backstage?

Because the repository evolved from an earlier Backstage-oriented implementation plan.

Those historical docs and plans are now archived under `docs/legacy/backstage-era/` for reference only.

## Is there a separate backend service?

No separate application backend in the old sense.

The UI and API run from the same Next.js app. Business APIs live under `src/app/api`.

## How does authentication work?

The runtime uses NextAuth with JWT sessions.

- default auth mode is `keycloak-only`
- `AUTH_MODE=multi` enables additional providers
- organization access is enforced in middleware from JWT membership claims

## Why do API calls need `x-organization-id`?

Because most business APIs are tenant-aware.

The request must identify the organization, and middleware validates that the signed-in user is actually a member of that organization before the request reaches the handler.

## Why am I getting redirected to `/select-organization`?

Because you are authenticated but have not selected an organization yet, or your saved org cookie no longer matches a valid membership.

## Why are some features missing in the UI?

Feature visibility is determined by:

- organization-level feature policy
- membership-specific feature overrides
- your role: `USER`, `READWRITE`, or `ADMIN`

The effective policy is available from `/api/features`.

## Where are integration credentials stored?

Mostly in the `IntegrationCredential` table as encrypted org-scoped records.

There are still multiple credential paths in the codebase:

- encrypted org credentials in Postgres
- per-user OAuth tokens in Redis
- org settings JSON pointers
- env fallbacks for some integrations

## Why does the queue sometimes show as disabled?

Because queue support depends on Redis. If Redis is unavailable, queue routes return a disabled status.

There is also a current code path in `src/lib/redis.ts` that disables Redis when `REDIS_URL` contains `localhost`, which affects local testing.

## Why does `/api/metrics` return `401` or `503`?

- `401` means the bearer token did not match `METRICS_AUTH_TOKEN`
- `503` in production means `METRICS_AUTH_TOKEN` was not configured at all

## Why might `/api/openapi` not load even though the route exists?

Because middleware still treats it like a normal API path unless the public-path rules are expanded. In practice, session auth and org context may still be required.

## What is the source of truth for the API?

Use:

- `/api/openapi`
- `src/lib/openapi.ts`
- `src/app/api/**/route.ts`

Do not trust the old Backstage-era API docs for the live runtime.

## What still needs validation?

The current documentation pass was grounded in code inspection, but build and runtime verification still require a shell with:

- `node`
- `npm`
- the required runtime dependencies and secrets

## Historical Version

The replaced Backstage-era FAQ now lives at:

- `docs/legacy/backstage-era/reference/faq.md`
