# Getting Started

This guide is for the current DevOps Portal runtime.

It assumes the active app is the root Next.js portal and not the older Backstage/plugin layout.

## Who This Is For

Use this guide if you need to:

- sign in to the portal for the first time
- select an organization
- connect the first integrations
- understand the main dashboard areas

## Before You Begin

You need:

- a working portal URL
- a user account or SSO access
- membership in at least one organization
- at least one configured integration if you want live GitHub, ArgoCD, Grafana, or S3 data

## First Sign-In

### Auth mode matters

The portal can run in different auth modes:

- `keycloak-only`
- `multi`

If your environment is SSO-first, follow your platform team’s Keycloak login instructions.

If your environment uses multi-provider auth, the login page may show:

- credentials login
- GitHub
- Google
- Azure AD
- Keycloak

## Select Your Organization

After sign-in, the portal may redirect you to `/select-organization`.

This is expected. Most pages and APIs are organization-scoped.

Choose the organization you want to work in before continuing.

## Initial Setup Checklist

For a new tenant or a fresh environment, the minimum useful setup is:

1. verify you can sign in
2. select an organization
3. open **Settings**
4. add the integrations your team actually uses
5. confirm feature access with the sidebar and `/api/features`

### Common first integrations

- GitHub account or org credential
- ArgoCD credential
- Grafana credential
- S3 or MinIO credential

## Main Areas Of The Portal

The current sidebar is organized around these sections:

### Launchpad

- Dashboard
- Repositories
- Pull Requests
- GitHub Actions
- Deployments
- ArgoCD
- Clusters
- GitOps Studio

### Monitoring

- Grafana Dashboards
- Alerts
- Grafana Insights
- Prometheus-facing alert views
- Scorecards
- DORA Metrics
- Vulnerability
- Credential Health
- Loki Logs
- Log Browser
- Uptime Kuma

### Tools

- Helm
- Diagrams
- MCP
- API Docs

### Settings

- general settings
- team and organization management
- configuration and integration setup

## Suggested First Tour

If the environment is already configured, this is a good first pass:

1. open **Dashboard**
2. open **Repositories** to confirm GitHub connectivity
3. open **Pull Requests** to confirm repo-scoped data is loading
4. open **ArgoCD** or **Clusters** if your org uses Kubernetes integrations
5. open **Monitoring** pages if Grafana is configured
6. open **Settings** to review org and integration configuration

## First Admin Tasks

If you are an admin, do these early:

1. confirm your org role is correct
2. review feature visibility in the sidebar
3. configure integration credentials under Settings
4. test health and metrics endpoints in the target environment
5. verify secrets management and auth settings with your platform team

## First GitOps Tasks

If your organization uses the GitOps features:

- use **Repositories** for browsing repository inventory
- use **Pull Requests** for review and merge workflows
- use **GitOps Studio** for admin-only file editing and commit workflows

## If Something Looks Wrong

Use these docs next:

- `docs/guides/user-guide.md`
- `docs/guides/troubleshooting.md`
- `docs/reference/api-reference.md`
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`

## Historical Version

The replaced historical getting-started guide now lives at:

- `docs/legacy/backstage-era/getting-started.md`
