# AUTH Track Quick Reference

**For**: Developers implementing the DevOps Portal authentication
**Updated**: 2026-02-05

---

## 🚨 Critical Security Rules

1. **NEVER** expose GitHub tokens to client sessions
2. **ALWAYS** store tokens server-side in Redis with encryption
3. **ONLY** expose boolean flags to clients (e.g., `hasGitHubConnection`)
4. **USE** server-side helpers (`getGitHubToken()`) in API routes

---

## Single Auth Flow Architecture

```
User Login → Keycloak (SSO) → NextAuth Session
                                    ↓
                         (Optional) GitHub OAuth
                                    ↓
                      Token → Encrypt → Redis
                                    ↓
                      Client sees: hasGitHubConnection = true
```

**Key Points:**
- Keycloak is PRIMARY (SSO, identity, roles)
- GitHub is SECONDARY (API tokens only)
- No dual auth paths
- No Keycloak token mappers

---

## Quick Implementation Guide

### 1. Install Dependencies

```bash
npm install next-auth@5 @auth/prisma-adapter ioredis
npm install -D @types/node
```

### 2. Set Environment Variables

```bash
NEXTAUTH_URL=https://portal.radiantlogic.io
NEXTAUTH_SECRET=$(openssl rand -base64 32)
KEYCLOAK_ISSUER=https://keycloak.radiantlogic.io/realms/devops-portal
KEYCLOAK_CLIENT_ID=portal-backend
KEYCLOAK_CLIENT_SECRET=<from-keycloak>
GITHUB_CLIENT_ID=<from-github-oauth>
GITHUB_CLIENT_SECRET=<from-github-oauth>
ENCRYPTION_KEYS=$(echo "{\"v1\":\"$(openssl rand -hex 32)\"}")
CURRENT_KEY_ID=v1
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/devops_portal
```

### 3. Implement Token Store

Copy from: `06-IMPLEMENTATION-GUIDE.md` lines 530-603

**Key Functions:**
- `storeGitHubToken(userId, token, expiresIn)` - Encrypt and store
- `getGitHubToken(userId)` - Decrypt and retrieve
- `revokeGitHubToken(userId)` - Delete on logout

### 4. Update NextAuth Config

Copy from: `06-IMPLEMENTATION-GUIDE.md` lines 316-500

**Key Changes:**
- JWT callback: Store token server-side, NOT in JWT
- Session callback: Only expose boolean flag
- Events: Revoke tokens on logout

### 5. Create GitHub Helper

Copy from: `06-IMPLEMENTATION-GUIDE.md` lines 605-648

**Usage:**
```typescript
// In API route
const githubToken = await getGitHubToken()
if (!githubToken) {
  return NextResponse.json({ error: "GitHub connection required" }, { status: 401 })
}
```

---

## Code Patterns

### ❌ NEVER Do This

```typescript
// DON'T expose token to client
async session({ session, token }) {
  session.githubToken = token.githubToken  // ❌ INSECURE
  return session
}
```

### ✅ ALWAYS Do This

```typescript
// DO store token server-side
async jwt({ token, account }) {
  if (account?.provider === "github") {
    await storeGitHubToken(token.sub!, account.access_token, 900)
    token.hasGitHubConnection = true  // Boolean only
  }
  return token
}

async session({ session, token }) {
  session.hasGitHubConnection = !!token.hasGitHubConnection  // Boolean only
  return session
}
```

---

## API Route Pattern

```typescript
// app/api/github/repos/route.ts
import { getGitHubToken } from "@/lib/github"

export async function GET() {
  // ✅ SECURE: Retrieve from Redis
  const githubToken = await getGitHubToken()

  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub connection required" },
      { status: 401 }
    )
  }

  // Use token for GitHub API
  const response = await fetch("https://api.github.com/user/repos", {
    headers: { Authorization: `Bearer ${githubToken}` },
  })

  return NextResponse.json(await response.json())
}
```

---

## Token Expiry

| Type | Expiry | Purpose |
|------|--------|---------|
| Access Token | 15 minutes | Matches Keycloak token lifespan |
| Session | 15 minutes | Auto-refresh every 5 minutes |
| Redis TTL | 15 minutes | Automatic cleanup |

---

## Back-Channel Logout

### Keycloak Client Config

```json
{
  "clientId": "portal-backend",
  "attributes": {
    "backchannel.logout.url": "https://portal.radiantlogic.io/api/auth/backchannel-logout",
    "backchannel.logout.session.required": "true"
  }
}
```

### NextAuth Event Handler

```typescript
events: {
  async signOut({ token }) {
    // 1. Logout from Keycloak
    await fetch(`${KEYCLOAK_ISSUER}/protocol/openid-connect/logout`, {
      method: 'POST',
      body: new URLSearchParams({
        id_token_hint: token.idToken,
        client_id: KEYCLOAK_CLIENT_ID,
      }),
    })

    // 2. Revoke GitHub token
    await revokeGitHubToken(token.sub!)
  }
}
```

---

## Organization Context

### Extract from Keycloak Token

```typescript
async jwt({ token, profile }) {
  if (profile) {
    // From custom claim
    token.orgId = (profile as any).org_id || null

    // OR from groups (format: "org:uuid")
    const groups = (profile as any).groups || []
    const orgGroup = groups.find(g => g.startsWith('org:'))
    token.orgId = orgGroup?.replace('org:', '') || null
  }
  return token
}
```

### Validate in Middleware

```typescript
// lib/middleware/tenant-context.ts
const orgId = request.headers.get('x-organization-id')

const membership = await prisma.membership.findFirst({
  where: { userId: token.sub, organizationId: orgId }
})

if (!membership) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 })
}
```

### Set RLS Context

```typescript
// lib/db/rls-context.ts
await prisma.$executeRawUnsafe(
  `SET LOCAL app.current_org_id = '${orgId}'`
)
```

---

## Troubleshooting

### Token Not Found in Redis
- Check Redis is running: `redis-cli ping`
- Verify `REDIS_URL` is correct
- Check TTL: `redis-cli TTL github:token:{userId}`

### Encryption Errors
- Verify `ENCRYPTION_KEYS` is valid JSON
- Check key length is 64 hex chars (32 bytes)
- Ensure `CURRENT_KEY_ID` exists in key ring

### Session Expires Too Fast
- Increase `session.maxAge` (default: 15 minutes)
- Decrease `session.updateAge` for more frequent refresh (default: 5 minutes)

### Back-Channel Logout Not Working
- Verify Keycloak URL is correct in client config
- Check NextAuth event handler is configured
- Test logout endpoint: `curl -X POST https://portal.../api/auth/backchannel-logout`

---

## Testing Checklist

### Manual Testing
- [ ] Login via Keycloak works
- [ ] GitHub connection flow works
- [ ] GitHub API calls succeed
- [ ] Logout clears both sessions
- [ ] Session auto-refreshes

### Security Testing
- [ ] GitHub token NOT in browser DevTools
- [ ] Redis contains encrypted token
- [ ] Token expires after 15 minutes
- [ ] Unauthorized org access blocked

### Load Testing
- [ ] 100 concurrent logins
- [ ] Token encryption latency < 10ms
- [ ] Redis handles 1000 req/s

---

## Resources

- **Full Documentation**: `03-KEYCLOAK-INTEGRATION.md`, `06-IMPLEMENTATION-GUIDE.md`
- **Implementation Summary**: `AUTH-TRACK-IMPLEMENTATION-SUMMARY.md`
- **Verification Report**: `AUTH-TRACK-VERIFICATION.md`
- **Project Management**: `PROJECT-MANAGEMENT.md` §4.3 (AUTH track)
- **Refined Strategy**: `13-REFINED-STRATEGY.md`

---

## Support

- **AUTH Track Lead**: See `PROJECT-MANAGEMENT.md`
- **Security Questions**: Contact Security Lead
- **Keycloak Issues**: Contact IAM Team
- **Redis Issues**: Contact Ops Team

---

**Quick Start**: Copy code snippets from `06-IMPLEMENTATION-GUIDE.md` Section 2.2
**Reference**: See `03-KEYCLOAK-INTEGRATION.md` for complete architecture
