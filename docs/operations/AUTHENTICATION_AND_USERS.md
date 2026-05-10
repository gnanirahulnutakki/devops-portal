# Authentication & User Management

This portal uses **NextAuth (JWT sessions)** with a **Prisma adapter** (PostgreSQL) for user/account persistence.

## Supported login methods

- **Keycloak (OIDC)**: provider id `keycloak`
- **GitHub (OAuth)**: provider id `github`
- **Google (OAuth)**: provider id `google`
- **Microsoft Entra ID / Azure AD (OIDC)**: provider id `azure-ad`
- **Email + Password (Credentials)**: provider id `credentials` (disabled by default)

The login page automatically renders whichever providers are configured (via `/api/auth/providers`).

## How users get created / added

- **OAuth/SSO sign-in (recommended)**:
  - On the user’s **first successful login**, NextAuth auto-creates:
    - `User` row
    - `Account` row for the provider
  - The portal also **auto-provisions org membership** for OAuth users:
    - Controlled by `DEFAULT_ORG_SLUG` (default: `default`)
    - Role controlled by `DEFAULT_ORG_ROLE` (default: `USER`)

- **Manual user creation (admin)**:
  - Go to **Settings → Team** and use **Add Member**.
  - If you set a password, the user can log in via **Credentials** (only when `ENABLE_CREDENTIALS_AUTH=true`).

## Managing users & roles

- **Settings → Team**:
  - Add/remove users
  - Change roles: `USER`, `READWRITE`, `ADMIN`
  - Reset passwords (for credentials-auth users)

### Role hierarchy

Internally, role gating is implemented in `src/lib/api-context.ts` via `requireRole(ctx, role)` and the `withApiContext` `requiredRole` option. The hierarchy is numeric — passing the threshold satisfies the gate:

| Role        | Level | Intent                                                  |
|-------------|-------|---------------------------------------------------------|
| `USER`      | 1     | Read-only across the org's resources                    |
| `READWRITE` | 2     | Mutating operations that act on cluster/tenant state    |
| `ADMIN`     | 3     | Full administrative access — including team & integrations management |

`requireRole(ctx, 'USER')` is satisfied by USER, READWRITE, or ADMIN; `requireRole(ctx, 'READWRITE')` is satisfied by READWRITE or ADMIN; only ADMIN satisfies `requireRole(ctx, 'ADMIN')`.

### What each role can do

This matrix is sourced from `requiredRole` declarations on the route handlers (`src/app/api/**/route.ts`) and the explicit `membership.role !== 'ADMIN'` checks in user/organization handlers. Roles inherit downward — entries list the **minimum** role required.

| Capability                                                              | Min role     |
|-------------------------------------------------------------------------|--------------|
| Browse clusters, namespaces, pods, workloads, services, ingresses, CRDs | `USER`       |
| Stream pod logs (SSE), view events, view YAML (read, with redactions)   | `USER`       |
| Read Grafana dashboards / folders / panels (rendered or proxied)        | `USER`       |
| List ArgoCD applications / projects / applicationsets                   | `USER`       |
| Browse S3 / MinIO buckets, generate **GET** pre-signed URLs             | `USER`       |
| List GitHub repos, PRs, branches, Actions runs                          | `USER`       |
| List org integrations / scorecards / credentials, view queue stats      | `USER`       |
| Read user preferences, notifications, dashboard summaries, features     | `USER`       |
| Use the MCP chat endpoint (`POST /api/mcp/chat`)                        | `USER`       |
| Generate **PUT** pre-signed URLs (S3 upload) — handler self-checks      | `USER` *     |
| Run a scorecard evaluation (`POST /api/scorecards/evaluate`)            | `READWRITE`  |
| Run an integration credential health check                              | `READWRITE`  |
| Open a pod-exec websocket session                                       | `READWRITE`  |
| Apply a YAML manifest (server-side apply on `PUT /api/clusters/[id]/yaml`) | `READWRITE` |
| Delete an S3 object                                                     | `ADMIN`      |
| Seed scorecard definitions                                              | `ADMIN`      |
| Create / update / delete ArgoCD or GitHub integration accounts          | `ADMIN`      |
| Update organization settings (`PUT /api/organizations/settings`)        | `ADMIN`      |
| Add / remove org members, change member roles                           | `ADMIN`      |
| Update / delete the organization itself                                 | `ADMIN`      |

\* Some routes (e.g. S3 upload) declare `USER` as the base gate but do an additional check inside the handler before mutation.

**Caveat**: this matrix reflects the v0.1 read-mostly portal. Most cluster mutations (scale, restart, exec, apply) are *currently* gated at `READWRITE`+; additional capabilities will land in v0.5+ behind the security review tracked in `SECURITY.md`.

## “Connections” (linked accounts)

- **Settings → Connections** shows the user’s linked OAuth accounts and allows:
  - **Connect**: starts OAuth flow for the provider
  - **Disconnect**: unlinks an OAuth account (deletes the provider `Account` row)
    - Note: **Keycloak unlink is blocked** from the UI to avoid lockouts.

## Environment variables (server)

### Core

- `AUTH_SECRET` (required): session/JWT signing secret
- `NEXTAUTH_URL` (required in production): public base URL for callbacks

### Keycloak

- `KEYCLOAK_ID`
- `KEYCLOAK_SECRET`
- `KEYCLOAK_ISSUER` (e.g. `https://<keycloak-host>/realms/<realm>`)

### GitHub

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- Optional org gate:
  - `GITHUB_ALLOWED_ORG` (e.g. `my-github-org`)

### Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Microsoft Entra ID / Azure AD

- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID` (optional; if omitted, “common” behavior depends on the provider defaults)

### Auto-provisioning

- `DEFAULT_ORG_SLUG` (default `default`)
- `DEFAULT_ORG_ROLE` (default `USER`)

### Credentials auth (optional)

- `ENABLE_CREDENTIALS_AUTH=true` to enable email/password login
- `BCRYPT_ROUNDS` (default `12`)

## OAuth redirect/callback URLs

All OAuth providers must allow this callback URL:

- `<NEXTAUTH_URL>/api/auth/callback/<provider-id>`

Examples:

- GitHub: `/api/auth/callback/github`
- Google: `/api/auth/callback/google`
- Microsoft: `/api/auth/callback/azure-ad`
- Keycloak: `/api/auth/callback/keycloak`

## Kubernetes deployment (where to set these)

In-cluster, these env vars are typically provided via the `devops-portal-secrets` Secret (mounted via `envFrom`).
Add keys there for any providers you enable.

