# Authentication System Documentation

## Overview

The DevOps Portal supports multiple authentication methods:

1. **Keycloak OIDC** (Recommended for Enterprise)
2. **GitHub OAuth** (For developers)
3. **Local Username/Password** (For testing/fallback)
4. **Guest Access** (For development only)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      SignInPage.tsx                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│   │
│  │  │ Keycloak │ │  GitHub  │ │  Guest   │ │ Username/Password ││   │
│  │  │  Button  │ │  Button  │ │  Button  │ │      Form         ││   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘│   │
│  └───────┼────────────┼────────────┼─────────────────┼──────────┘   │
└──────────┼────────────┼────────────┼─────────────────┼──────────────┘
           │            │            │                 │
           ▼            ▼            ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Backstage Auth Provider                          │
│  /api/auth/oidc     /api/auth/github   /api/auth/guest               │
└──────────┬────────────┬────────────────────┬─────────────────────────┘
           │            │                    │
           ▼            ▼                    ▼
┌──────────────┐ ┌──────────────┐   ┌──────────────────────────────────┐
│   Keycloak   │ │    GitHub    │   │   GitOps Backend LocalAuthService │
│   Server     │ │    OAuth     │   │   /api/gitops/auth/local/*        │
└──────────────┘ └──────────────┘   └──────────────────────────────────┘
```

## Configuration

### 1. Keycloak OIDC (app-config.yaml)

```yaml
auth:
  environment: production
  providers:
    oidc:
      production:
        clientId: ${KEYCLOAK_CLIENT_ID}
        clientSecret: ${KEYCLOAK_CLIENT_SECRET}
        metadataUrl: ${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration
        prompt: auto
        signIn:
          resolvers:
            - resolver: emailMatchingUserEntityProfileEmail
```

### 2. GitHub OAuth

```yaml
auth:
  providers:
    github:
      development:
        clientId: ${GITHUB_OAUTH_CLIENT_ID}
        clientSecret: ${GITHUB_OAUTH_CLIENT_SECRET}
        additionalScopes:
          - repo
          - read:org
          - workflow
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
              dangerouslyAllowSignInWithoutUserInCatalog: true
```

### 3. Guest Access (Development Only)

```yaml
auth:
  environment: development
  providers:
    guest:
      dangerouslyAllowOutsideDevelopment: true
      signIn:
        resolvers:
          - resolver: guestSessionResolver
```

### 4. Local Authentication

```yaml
localAuth:
  enabled: true
  passwordPolicy:
    minLength: 12
    requireUppercase: true
    requireLowercase: true
    requireDigit: true
    requireSpecial: true
  session:
    maxAge: 86400
    secure: true
  lockout:
    maxAttempts: 5
    durationSeconds: 900
```

## Default Users

The system creates default users on first startup:

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| admin | Admin@123! | admin | Full administrative access |
| developer | Dev@123456! | developer | Standard development access |
| viewer | View@123456! | viewer | Read-only access |

## API Endpoints

### Local Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gitops/auth/local/login` | POST | Login with username/password |
| `/api/gitops/auth/local/register` | POST | Register new user |
| `/api/gitops/auth/local/refresh` | POST | Refresh access token |
| `/api/gitops/auth/local/logout` | POST | Logout and revoke session |
| `/api/gitops/auth/local/me` | GET | Get current user profile |
| `/api/gitops/auth/local/change-password` | POST | Change password |

### Request/Response Examples

#### Login

```bash
curl -X POST https://devops-portal.example.com/api/gitops/auth/local/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123!"}'
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@devops-portal.local",
    "displayName": "Portal Admin",
    "role": "admin"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 86400
}
```

## Frontend Implementation

### SignInPage Component

Location: `packages/app/src/components/auth/SignInPage.tsx`

Key features:
- OAuth provider detection from config
- Guest login button (when enabled)
- Collapsible local auth form
- Registration form
- Password visibility toggle
- Error/success alerts

### Key Code Sections

1. **OAuth Button Handler** (L326-336):
```typescript
const handleOAuthSignIn = (provider: OAuthProvider) => {
  window.location.href = `/api/auth/${provider.id}/start?env=${authEnv}`;
};
```

2. **Guest Login Handler** (L339-350):
```typescript
const handleGuestSignIn = async () => {
  window.location.href = `/api/auth/guest/start?env=${authEnv}`;
};
```

3. **Local Login Handler** (L353-394):
```typescript
const handleLocalSignIn = async (e: React.FormEvent) => {
  const response = await fetch(`${backendUrl}/api/gitops/auth/local/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  // ... handle response
};
```

## Keycloak Setup

### 1. Create Realm

1. Login to Keycloak admin console
2. Create new realm: `devops-portal`
3. Enable user registration if needed

### 2. Create Client

1. Clients → Create Client
2. Client ID: `devops-portal`
3. Client Protocol: `openid-connect`
4. Access Type: `confidential`
5. Valid Redirect URIs: `https://devops-portal.example.com/api/auth/oidc/handler/frame`
6. Web Origins: `https://devops-portal.example.com`

### 3. Get Client Secret

1. Clients → devops-portal → Credentials
2. Copy the Client Secret

### 4. Configure Backstage

Update `app-config.production.yaml`:
```yaml
auth:
  providers:
    oidc:
      production:
        clientId: devops-portal
        clientSecret: ${KEYCLOAK_CLIENT_SECRET}
        metadataUrl: https://keycloak.example.com/realms/devops-portal/.well-known/openid-configuration
```

## Troubleshooting

### Issue: Guest login not working

1. Check `auth.environment` is set to `development`
2. Check `auth.providers.guest.dangerouslyAllowOutsideDevelopment` is `true`
3. Verify guest resolver is configured in `signIn.resolvers`

### Issue: GitHub OAuth returns "Bad credentials"

1. Verify `GITHUB_TOKEN` is valid
2. Check token has required scopes: `repo`, `read:org`, `workflow`
3. Ensure `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` are correct

### Issue: Local auth form not visible

1. Check `localAuth.enabled` is `true`
2. Click "Username & Password" to expand the form
3. Verify frontend build includes latest SignInPage

## Security Considerations

1. **Never** enable guest access in production
2. Use HTTPS for all authentication endpoints
3. Rotate secrets regularly
4. Enable 2FA for admin accounts
5. Monitor failed login attempts
6. Use secure session storage

---

Last Updated: 2026-02-05
