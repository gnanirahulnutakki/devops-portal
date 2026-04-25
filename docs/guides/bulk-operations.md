# Bulk Operations Guide

This guide describes bulk GitOps edits in the current portal runtime.

The practical bulk-edit surface today is **GitOps Studio**, which is admin-only by default.

## What Bulk Operations Mean In This Runtime

Bulk operations here mean:

- staging one or more file edits in GitOps Studio
- committing those edits across repo and branch targets
- optionally creating pull requests after the commit

The bulk commit API is:

- `POST /api/gitops/bulk-commit`

It is protected by:

- authenticated session
- valid organization context
- `ADMIN` role
- bulk rate limiting

## When To Use Bulk Operations

Good use cases:

- repeated manifest or values-file updates
- synchronized edits across a few branches
- admin-driven GitOps maintenance
- creating commit-plus-PR batches from a controlled edit session

Bad use cases:

- changes that need per-environment customization
- changes you have not validated in a single branch first
- workflows that need richer review gates than the current bulk path provides

## Current GitOps Studio Flow

1. open **GitOps Studio**
2. select the repository
3. select the branch
4. browse to the target file
5. edit the file
6. stage the change
7. repeat for other files as needed
8. open the commit dialog
9. provide a commit message
10. optionally enable **Create Pull Request after commit**
11. commit the staged changes

## What The Commit Dialog Does

The current commit dialog supports:

- grouped staged-file review by repository
- one commit message for the submitted change set
- optional PR creation
- base-branch selection for PR creation

The resulting API call submits:

- repo
- path
- branch
- content
- optional existing file SHA
- commit message
- optional PR request and target branch

## Current Constraints

- admin only
- depends on a working GitHub credential path for the current user and org
- the route currently commits file changes sequentially
- PR creation is best-effort after successful commits
- there is no robust job queue orchestration documented for this flow yet

## Recommended Operating Pattern

1. validate the change on one branch first
2. keep the staged set narrow and easy to review
3. prefer PR creation for changes that need review
4. use descriptive commit messages
5. confirm the target base branch before creating PRs

## Common Failure Modes

- GitHub token not configured
- missing org context
- insufficient role
- invalid or stale file SHA
- target branch mismatch
- PR already exists for the same branch pair

If a bulk operation fails, use:

- `docs/guides/troubleshooting.md`
- the GitHub UI
- the route and service code under `src/app/api/gitops/` for exact behavior

## Historical Version

The replaced historical bulk-operations guide now lives at:

- `docs/legacy/backstage-era/guides/bulk-operations.md`
