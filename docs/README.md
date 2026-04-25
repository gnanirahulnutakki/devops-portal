# DevOps Portal Docs

This docs tree mixes active runtime documentation with historical material from the earlier Backstage/plugin implementation.

Use the current-runtime docs first. Treat everything else as unverified until cross-checked against code.

## Current Runtime First

Primary references for the live application:

- [Current Runtime Architecture Deep Dive](architecture/CURRENT_RUNTIME_ARCHITECTURE.md)
- [Current Runtime Maintainer Handoff](development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md)
- [Notion-Ready Architecture Summary](architecture/CURRENT_RUNTIME_ARCHITECTURE_NOTION_READY.md)
- [Legacy Docs And Workflows Cleanup Plan](development/LEGACY_DOCS_AND_WORKFLOWS_CLEANUP_PLAN.md)
- [Root README](../README.md)

## What Actually Runs

The active runtime is the root Next.js application:

- app and API routes in `src/app`
- shared runtime logic in `src/lib`
- schema in `prisma/schema.prisma`
- container and deployment assets in `Dockerfile`, `docker-compose.yml`, and `helm/devops-portal/`

The old `packages/`, `plugins/`, and `deployment/docker/` layout is not the primary runtime path anymore.

## Recommended Reading Order

For a maintainer or new engineer:

1. [Root README](../README.md)
2. [Current Runtime Architecture Deep Dive](architecture/CURRENT_RUNTIME_ARCHITECTURE.md)
3. [Current Runtime Maintainer Handoff](development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md)
4. [Authentication And Users](operations/AUTHENTICATION_AND_USERS.md)
5. [Deployment Runbook](operations/DEPLOYMENT_RUNBOOK.md)
6. [Secrets And Vault](operations/SECRETS_AND_VAULT.md)

## Legacy Archive

Archived Backstage-era docs live under:

- [Legacy Archive Landing Page](legacy/README.md)
- [Backstage-Era Archive](legacy/backstage-era/README.md)
- [Legacy Source Tree Status](legacy/SOURCE_TREE_STATUS.md)

## Verification Limits

This documentation cleanup and architecture pass were done from static repo inspection only.

- no build
- no lint
- no typecheck
- no tests
- no local runtime start

Those checks are blocked in this shell because `node` and `npm` are unavailable.
