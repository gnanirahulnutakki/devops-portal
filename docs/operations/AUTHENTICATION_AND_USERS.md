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
  - `GITHUB_ALLOWED_ORG` (e.g. `radiantlogic-devops`)

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

