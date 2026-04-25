# DevOps Portal User Guide

This guide describes the current user-facing portal flow at a high level.

It focuses on the active root-runtime pages rather than the older Backstage-specific UI model.

## What The Portal Is Good At

The portal is designed to give teams one place to work across:

- GitHub repositories and pull requests
- GitOps and ArgoCD workflows
- Kubernetes clusters
- Grafana-based monitoring
- storage access
- scorecards and security views

## How Access Works

Your experience depends on three things:

1. whether you are authenticated
2. which organization you selected
3. which features and roles are enabled for your membership

The same deployment can show different nav items for different users.

## Main Navigation Areas

### Dashboard

Use this as the landing page for current activity and summaries.

### Repositories

Use this page to:

- browse available GitHub repositories
- choose the active GitHub account or credential
- search repository inventory
- open repositories in GitHub

### Pull Requests

Use this page to:

- review open, merged, and closed PRs
- filter by repository and branch
- inspect changed files
- merge or update PR state when permitted

### GitOps

The GitOps landing page links the major GitOps surfaces:

- ArgoCD
- Clusters
- Deployments
- GitOps Studio

### GitOps Studio

This is the admin-only editing surface.

Use it to:

- select a repository
- pick a branch
- browse files
- open file content in the Monaco editor
- stage changes
- commit multiple file changes
- optionally create pull requests after commit

### Monitoring

Use the monitoring pages for:

- Grafana dashboards
- Grafana alerts and insights
- DORA metrics
- scorecards
- vulnerability and scan results
- logs and uptime surfaces when configured

### Settings

Use Settings to manage:

- organization configuration
- team and user access
- integration credentials
- feature exposure

## Typical Workflows

## Review Repo Inventory

1. open **Repositories**
2. pick the correct GitHub account
3. search for the repo you need
4. inspect metadata or open it in GitHub

## Review Or Merge Pull Requests

1. open **Pull Requests**
2. filter by repository or branch
3. inspect the diff and changed files
4. merge, close, or reopen when your role allows it

## Edit GitOps-Tracked Files

1. open **GitOps Studio**
2. choose a repository and branch
3. browse to the target file
4. edit in Monaco
5. stage the change
6. commit the staged changes
7. optionally create a pull request back to a base branch

## Check Runtime Health

1. open **ArgoCD** for application state
2. open **Clusters** for Kubernetes inventory
3. open **Monitoring** for dashboards and alerts
4. open **Scorecards** or **Vulnerability** if those features are enabled

## Things To Know

### Org selection is not optional

Most business features and APIs are organization-scoped.

### Feature access can differ by user

If a page is missing from the sidebar, it may be disabled by feature policy or your role.

### Some integrations are optional

A page may render but show an empty or not-configured state if the current organization has not connected the relevant external system yet.

## Where To Go Next

- `docs/guides/bulk-operations.md`
- `docs/guides/pr-workflow.md`
- `docs/guides/troubleshooting.md`
- `docs/reference/api-reference.md`

## Historical Version

The replaced historical user guide now lives at:

- `docs/legacy/backstage-era/guides/user-guide.md`
