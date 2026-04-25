# Legacy Docs And Workflows Cleanup Plan

This plan tracks cleanup of historical Backstage-era documentation and GitHub workflow drift so the repository presents the root Next.js runtime as the primary implementation.

## Status

Completed in the current pass:

- `README.md`, `docs/README.md`, and `docs/index.md` now point to current-runtime docs first
- obvious Backstage-era planning docs were moved under `docs/legacy/backstage-era/`
- mixed deployment, API, FAQ, admin, troubleshooting, security, getting-started, and user guides were rewritten for the current runtime
- preserved legacy source trees are now explicitly labeled in `docs/legacy/SOURCE_TREE_STATUS.md`
- `.github/workflows/v2-ci.yml` was removed
- `.github/workflows/docker-build-push.yml` was retargeted to the root runtime
- `.github/workflows/README.md` was rewritten for the current workflow set

Still remaining:

- decide whether `deployment/docker/`, `packages/`, and `plugins/` should remain as historical source long term or be deleted in a separate follow-up change

## Objective

- Make current-runtime documentation the default path for maintainers.
- Remove or rewrite GitHub workflows that target nonexistent or legacy layouts.
- Archive historical Backstage material without losing it.
- Reduce the chance that engineers follow stale instructions and break the active runtime.

## Findings

The repository still contains several legacy signals:

- docs that describe the portal as a Backstage app/plugin system
- a legacy Backstage production image under `deployment/docker/Dockerfile`
- docs that still reference `app-config.yaml`, `packages/backend`, and `plugins/gitops*`
- legacy source trees under `packages/`, `plugins/`, and `deployment/docker/`

## Recommended Execution Order

### Phase 1: Fix navigation first

- Keep `README.md`, `docs/README.md`, and `docs/index.md` pointing to:
  - `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
  - `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`
  - this cleanup plan
- Replace remaining “main overview” language that still presents the Backstage implementation as active.
- Add a `docs/legacy/README.md` explaining that archived documents are historical and may not match the current runtime.

### Phase 2: Clean up workflows

#### Remove or replace immediately

- `.github/workflows/v2-ci.yml`

Reason:

- it only watches `v2/**`
- it assumes `working-directory: v2`
- it builds `./v2/Dockerfile`
- there is no maintained `v2` application tree or supported `v2` Docker build target in the current runtime

Status:

- completed in this pass

#### Rewrite in place

- `.github/workflows/docker-build-push.yml`

Current problems:

- path filters are focused on `packages/**`, `plugins/**`, `deployment/docker/Dockerfile`, and `app-config*.yaml`
- it ignores most root Next.js runtime changes under `src/`, `prisma/`, `public/`, root `Dockerfile`, and `helm/devops-portal/`
- it builds the legacy Backstage image path via `deployment/docker/Dockerfile`, not the root `Dockerfile`
- the test job uses `continue-on-error: true`, which weakens quality gating

Status:

- completed in this pass

#### Rewrite or delete low-value metadata

- `.github/workflows/README.md`

Current problems:

- describes the repo as a Backstage GitOps portal
- documents legacy workflow behavior and path filters

Status:

- rewritten in this pass

## Documentation Triage

### Keep as current docs

These are already aligned enough to keep as current or near-current:

- `README.md`
- `docs/README.md`
- `docs/index.md`
- `docs/getting-started.md`
- `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`
- `docs/deployment/DEPLOY_GUIDE.md`
- `docs/guides/admin-guide.md`
- `docs/guides/bulk-operations.md`
- `docs/guides/pr-workflow.md`
- `docs/guides/troubleshooting.md`
- `docs/guides/user-guide.md`
- `docs/operations/AUTHENTICATION_AND_USERS.md`
- `docs/operations/DEPLOYMENT_RUNBOOK.md`
- `docs/operations/SECRETS_AND_VAULT.md`
- `docs/operations/SECURITY_AND_RELIABILITY.md`
- `docs/reference/api-reference.md`
- `docs/reference/faq.md`

### Archive with minimal edits

These are strongly tied to the Backstage-era implementation and were moved under `docs/legacy/backstage-era/`:

- `docs/legacy/backstage-era/architecture/PROJECT-STRUCTURE.md`
- `docs/legacy/backstage-era/deployment/DEPLOY_GUIDE.md`
- `docs/legacy/backstage-era/deployment/QUICKSTART.md`
- `docs/legacy/backstage-era/getting-started.md`
- `docs/legacy/backstage-era/development/IMPLEMENTATION-STATUS.md`
- `docs/legacy/backstage-era/development/NEXT-STEPS.md`
- `docs/legacy/backstage-era/development/SESSION-SUMMARY-2025-10-28.md`
- `docs/legacy/backstage-era/development/PR_ENHANCEMENTS_SUMMARY.md`
- `docs/legacy/backstage-era/development/PR_IMPLEMENTATION.md`
- `docs/legacy/backstage-era/development/PR_INTEGRATION_SUMMARY.md`
- `docs/legacy/backstage-era/CHANGES_AND_ENTERPRISE_ROADMAP.md`
- `docs/legacy/backstage-era/guides/admin-guide.md`
- `docs/legacy/backstage-era/guides/bulk-operations.md`
- `docs/legacy/backstage-era/guides/pr-workflow.md`
- `docs/legacy/backstage-era/guides/troubleshooting.md`
- `docs/legacy/backstage-era/guides/user-guide.md`
- `docs/legacy/backstage-era/operations/SECURITY_AND_RELIABILITY.md`
- `docs/legacy/backstage-era/reference/api-reference.md`
- `docs/legacy/backstage-era/reference/faq.md`

## Adjacent Legacy Assets To Review

These are not docs/workflows, but they directly affect cleanup decisions:

- `deployment/docker/Dockerfile`
  - legacy Backstage image build
- `packages/app`
- `packages/backend`
- `plugins/gitops`
- `plugins/gitops-backend`

Recommended action:

- keep them explicitly labeled as legacy until deletion is approved
- if yes, keep but clearly mark them as legacy in a repo-level note
- if no, delete them in a separate cleanup change after confirming they are unused

## Proposed Repository End State

- Current runtime docs stay under normal `docs/` navigation.
- Historical docs move to `docs/legacy/backstage-era/`.
- `docs/legacy/README.md` explains that archived files are preserved for repo archaeology only.
- GitHub workflows reference only the root runtime.
- No top-level documentation page claims Backstage is the active implementation.

## Acceptance Criteria

- A maintainer landing on `README.md`, `docs/README.md`, or `docs/index.md` reaches current-runtime documentation first.
- No active GitHub workflow references a nonexistent `v2/` directory.
- No active GitHub workflow builds the legacy Backstage image unless intentionally preserved and labeled.
- Historical Backstage docs are archived or clearly labeled as legacy.
- The current runtime has one canonical architecture doc and one short maintainer handoff.

## Risks During Cleanup

- Moving docs will break relative links unless redirects or index updates are handled in the same change.
- Some historical docs may contain operational details still useful for live environments; archive only after extracting reusable content.
- If `packages/` or `plugins/` are still used in any external process, deleting them prematurely could break undocumented workflows.

## Suggested Implementation Shape

Do the remaining cleanup in small follow-up PRs:

1. Navigation and labeling
   - add `docs/legacy/README.md`
   - update doc indexes and current-runtime links

2. Workflow correction
   - remove `v2-ci.yml`
   - rewrite `docker-build-push.yml`
   - update or delete workflow README

3. Doc archival
   - move historical Backstage docs into `docs/legacy/backstage-era/`
   - rewrite or remove mixed docs one by one

This sequence limits merge conflict risk and keeps each change reviewable.
