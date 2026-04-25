# Legacy Source Tree Status

This note explains which source directories are preserved for historical reference and which paths actually power the live portal.

## Active Runtime

The runtime that should be maintained and deployed today is:

- `src/` for the Next.js application and API routes
- `prisma/schema.prisma` for the active database schema
- `Dockerfile` and `docker-compose.yml` at the repo root
- `helm/devops-portal/` for the Kubernetes deployment path

## Preserved Historical Source

These directories are not the primary runtime anymore:

### `packages/`

- `packages/app` is an older Backstage frontend package
- `packages/backend` is an older Backstage backend package
- both still declare Backstage package roles and depend on `backstage-cli`

### `plugins/`

- `plugins/gitops` is a Backstage frontend plugin
- `plugins/gitops-backend` is a Backstage backend plugin
- these directories still contain plugin packaging and migration artifacts from the earlier implementation

### `deployment/docker/`

- contains a Backstage-era Dockerfile, compose file, and README
- targets the older `packages/` runtime assumptions and port `7007`
- should not be used for the active Next.js runtime

## How To Treat These Paths

- keep them only for repo archaeology unless there is a confirmed external dependency
- do not point active CI, deployment, or onboarding docs at them
- prefer the archived docs under `docs/legacy/backstage-era/` for historical context

## Removal Decision Still Pending

These paths are now explicitly labeled as legacy, but deletion should happen only after confirming:

- no external automation or release job still reads them
- no maintainer still depends on them for migration context
- no downstream repo or internal runbook still references the old Backstage layout

Until that review is complete, preserving them is lower risk than deleting them.
