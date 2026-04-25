# Pull Request Workflow Guide

This guide describes the current PR workflow in the portal.

The active runtime supports both:

- PR review and merge flows from the **Pull Requests** page
- optional PR creation after GitOps Studio commits

## Main PR Surfaces

### Pull Requests page

Use this page to:

- list PRs by repository
- filter by branch and state
- inspect changed files
- merge PRs
- update PR state

### GitOps Studio

Use this page when you are editing files and want to:

- commit staged changes
- optionally create a PR from the edited branch to a selected base branch

## Standard Review Flow

1. select the right GitHub account or credential
2. open **Pull Requests**
3. filter to the target repository
4. inspect the PR title, state, author, and branch information
5. expand files or diffs as needed
6. merge or update state if your role and GitHub permissions allow it

## Create-After-Commit Flow

From **GitOps Studio**:

1. select the repository and branch
2. edit and stage file changes
3. open the commit dialog
4. enter the commit message
5. enable **Create Pull Request after commit**
6. choose the target base branch
7. submit the commit

The portal will:

- commit the changes to the working branch
- attempt to create a PR back to the selected base branch

## Practical Guidance

Use PRs when:

- the branch is protected
- the change affects production-like workflows
- review or auditability matters
- you want a clean review artifact in GitHub

Direct commit paths are more appropriate when:

- you are performing low-risk admin maintenance
- the change is isolated and intentionally non-review-gated
- the branch and process allow it

## Current Limitations

- PR creation from GitOps Studio is best-effort and happens after the commit succeeds
- if a PR already exists, creation may fail silently except for warning or toast behavior
- final merge permissions still depend on GitHub-side permissions and branch rules

## Troubleshooting

If PR creation or merge fails, check:

- GitHub account configuration in the current organization
- branch selection
- repository permissions
- existing open PRs for the same branch pair

Then use:

- `docs/guides/troubleshooting.md`
- `docs/reference/api-reference.md`

## Historical Version

The replaced historical PR workflow guide now lives at:

- `docs/legacy/backstage-era/guides/pr-workflow.md`
