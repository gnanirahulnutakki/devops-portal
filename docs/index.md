# DevOps Portal Documentation

This documentation set now has two buckets:

- current-runtime docs for the root Next.js application that actually runs today
- archived Backstage-era material kept for repo archaeology

## Start Here

If you are maintaining the active portal runtime, start with these documents in order:

1. [Current Runtime Architecture Deep Dive](architecture/CURRENT_RUNTIME_ARCHITECTURE.md)
2. [Current Runtime Maintainer Handoff](development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md)
3. [Notion-Ready Architecture Summary](architecture/CURRENT_RUNTIME_ARCHITECTURE_NOTION_READY.md)
4. [Legacy Docs And Workflows Cleanup Plan](development/LEGACY_DOCS_AND_WORKFLOWS_CLEANUP_PLAN.md)
5. [Root README](../README.md)

## Active Runtime

The current application is:

- the root Next.js 15 app under `src/`
- the root Prisma schema in `prisma/schema.prisma`
- the root deployment assets:
  - `Dockerfile`
  - `docker-compose.yml`
  - `helm/devops-portal/`

The following repo areas are not the primary runtime:

- `packages/`
- `plugins/`
- `deployment/docker/`
- older Backstage-oriented docs and workflows

## Current Runtime References

Architecture and maintainer references:

- [Current Runtime Architecture Deep Dive](architecture/CURRENT_RUNTIME_ARCHITECTURE.md)
- [Current Runtime Maintainer Handoff](development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md)
- [Notion-Ready Architecture Summary](architecture/CURRENT_RUNTIME_ARCHITECTURE_NOTION_READY.md)

Operational references that still align with the active runtime:

- [Authentication And Users](operations/AUTHENTICATION_AND_USERS.md)
- [Deployment Runbook](operations/DEPLOYMENT_RUNBOOK.md)
- [Secrets And Vault](operations/SECRETS_AND_VAULT.md)

## Legacy Archive

Historical documents that were clearly tied to the older Backstage/plugin implementation have been moved under:

- [Legacy Archive Landing Page](legacy/README.md)
- [Backstage-Era Archive](legacy/backstage-era/README.md)
- [Legacy Source Tree Status](legacy/SOURCE_TREE_STATUS.md)

Those files are preserved intentionally, but they are not authoritative for the live runtime.

## Verification Limits

The current-runtime documentation set was produced from static repo inspection in this shell.

- `node` and `npm` are not available here
- build, lint, typecheck, tests, and runtime startup remain unverified in this environment
