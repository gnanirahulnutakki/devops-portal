# DevOps Portal - Keycloak Integration Guide

> **CRITICAL REQUIREMENT**: This portal uses a **single, consolidated authentication flow** only:
> - **Primary**: Keycloak for identity/SSO
> - **Secondary**: Direct GitHub OAuth provider (separate connection) for API token scopes
> - **Security Model**: All tokens stored server-side only (encrypted in Redis)
> - **Deprecated**: Dual auth paths, Keycloak token mappers, client-side token exposure
>
> See §"GitHub Token Access (Single Auth Path)" below for implementation details.

## Overview

Keycloak serves as the central Identity Provider (IdP) for the DevOps Portal, exactly as it does for EOC. This document details how Keycloak integrates with the custom stack.

## Why Keycloak?

| Feature | Keycloak | Auth0 | Okta | Firebase Auth |
|---------|----------|-------|------|---------------|
| Self-Hosted | Yes | No | No | No |
| Cost | Free (OSS) | $$$$ | $$$$ | $ |
| LDAP/AD Integration | Yes | Limited | Yes | No |
| Identity Brokering | Yes | Yes | Yes | Limited |
| Custom Themes | Yes | Limited | Limited | No |
| EOC Alignment | Same stack | Different | Different | Different |

**Key Benefits:**
- Already deployed and configured in our infrastructure
- Proven reliability in EOC production
- Full control over user data
- Supports all required auth methods

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IDENTITY PROVIDERS                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  GitHub  │  │  Google  │  │Microsoft │  │  LDAP/AD │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└───────┬─────────────┬─────────────┬─────────────┬───────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         KEYCLOAK                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    devops-portal realm                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │   Clients    │  │    Roles     │  │ Identity Brokers │  │ │
│  │  │ - portal-ui  │  │ - admin      │  │ - github         │  │ │
│  │  │ - portal-api │  │ - developer  │  │ - google         │  │ │
│  │  │              │  │ - viewer     │  │ - microsoft      │  │ │
│  │  │              │  │ - guest      │  │                  │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DEVOPS PORTAL                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      NextAuth.js                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ Keycloak     │  │   Session    │  │   JWT Token      │  │ │
│  │  │ Provider     │  │   Storage    │  │   Callbacks      │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Keycloak Configuration

### 1. Realm Setup

Create a dedicated realm for DevOps Portal:

```json
{
  "realm": "devops-portal",
  "enabled": true,
  "displayName": "DevOps Portal",
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": true,
  "editUsernameAllowed": false,
  "bruteForceProtected": true,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 36000,
  "accessTokenLifespan": 300,
  "accessTokenLifespanForImplicitFlow": 900,
  "offlineSessionIdleTimeout": 2592000,
  "offlineSessionMaxLifespan": 5184000
}
```

### 2. Client Configuration

**Client: `portal-frontend`** (Public client for browser)
```json
{
  "clientId": "portal-frontend",
  "name": "DevOps Portal Frontend",
  "enabled": true,
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false,
  "protocol": "openid-connect",
  "rootUrl": "https://portal.radiantlogic.io",
  "baseUrl": "/",
  "redirectUris": [
    "https://portal.radiantlogic.io/*",
    "http://localhost:3000/*"
  ],
  "webOrigins": [
    "https://portal.radiantlogic.io",
    "http://localhost:3000"
  ],
  "defaultClientScopes": [
    "openid",
    "profile",
    "email",
    "roles"
  ],
  "optionalClientScopes": [
    "offline_access"
  ]
}
```

**Client: `portal-backend`** (Confidential client for API)
```json
{
  "clientId": "portal-backend",
  "name": "DevOps Portal Backend",
  "enabled": true,
  "publicClient": false,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true,
  "serviceAccountsEnabled": true,
  "protocol": "openid-connect",
  "secret": "${KEYCLOAK_CLIENT_SECRET}",
  "redirectUris": [
    "https://portal.radiantlogic.io/api/auth/*",
    "http://localhost:3000/api/auth/*"
  ]
}
```

### 3. Roles

```json
{
  "roles": {
    "realm": [
      {
        "name": "portal-admin",
        "description": "Full administrative access to DevOps Portal"
      },
      {
        "name": "portal-developer",
        "description": "Developer access - can view and modify own resources"
      },
      {
        "name": "portal-viewer",
        "description": "Read-only access to portal dashboards"
      },
      {
        "name": "portal-guest",
        "description": "Limited guest access - view only public dashboards"
      }
    ]
  }
}
```

### 4. Identity Providers (Brokering)

**GitHub Identity Provider:**
```json
{
  "alias": "github",
  "providerId": "github",
  "enabled": true,
  "trustEmail": true,
  "storeToken": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${GITHUB_CLIENT_ID}",
    "clientSecret": "${GITHUB_CLIENT_SECRET}",
    "defaultScope": "user:email read:org repo",
    "syncMode": "IMPORT"
  }
}
```

**Google Identity Provider:**
```json
{
  "alias": "google",
  "providerId": "google",
  "enabled": true,
  "trustEmail": true,
  "config": {
    "clientId": "${GOOGLE_CLIENT_ID}",
    "clientSecret": "${GOOGLE_CLIENT_SECRET}",
    "defaultScope": "openid profile email"
  }
}
```

**Microsoft Identity Provider:**
```json
{
  "alias": "microsoft",
  "providerId": "microsoft",
  "enabled": true,
  "config": {
    "clientId": "${AZURE_CLIENT_ID}",
    "clientSecret": "${AZURE_CLIENT_SECRET}",
    "defaultScope": "openid profile email"
  }
}
```

---

## NextAuth.js Integration

### Configuration

```typescript
// lib/auth.ts
import NextAuth, { AuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import { JWT } from "next-auth/jwt"

// Extend types for custom properties
declare module "next-auth" {
  interface Session {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    roles?: string[]
    error?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    accessTokenExpires?: number
    roles?: string[]
    error?: string
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) throw refreshedTokens

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      idToken: refreshedTokens.id_token,
    }
  } catch (error) {
    console.error("Error refreshing access token", error)
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const authOptions: AuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email roles",
        },
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign in
      if (account && profile) {
        const roles = (profile as any).realm_access?.roles ?? []
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          accessTokenExpires: account.expires_at! * 1000,
          roles: roles.filter((r: string) => r.startsWith("portal-")),
        }
      }

      // Return previous token if still valid
      if (Date.now() < (token.accessTokenExpires ?? 0)) {
        return token
      }

      // Token expired, try to refresh
      return refreshAccessToken(token)
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.idToken = token.idToken
      session.roles = token.roles
      session.error = token.error
      return session
    },
  },

  events: {
    async signOut({ token }) {
      // Logout from Keycloak as well
      if (token?.idToken) {
        const logoutUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
        await fetch(logoutUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            id_token_hint: token.idToken as string,
            client_id: process.env.KEYCLOAK_CLIENT_ID!,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
          }),
        })
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
}

export default NextAuth(authOptions)
```

### API Route Handler

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

---

## Protecting Routes

### Server Components

```typescript
// app/(dashboard)/layout.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Check for refresh error
  if (session.error === "RefreshAccessTokenError") {
    redirect("/login?error=session_expired")
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

### API Routes

```typescript
// lib/auth-utils.ts
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "./auth"

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  return session
}

export function requireRole(session: any, roles: string[]) {
  const userRoles = session.roles ?? []
  const hasRole = roles.some(r => userRoles.includes(r))
  
  if (!hasRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  return null
}

// Usage in API route
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  
  const forbidden = requireRole(session, ["portal-admin", "portal-developer"])
  if (forbidden) return forbidden
  
  // Handle request...
}
```

### Client Components

```typescript
// hooks/useAuth.ts
"use client"

import { useSession, signIn, signOut } from "next-auth/react"

export function useAuth() {
  const { data: session, status } = useSession()

  return {
    session,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    user: session?.user,
    roles: session?.roles ?? [],
    signIn: () => signIn("keycloak"),
    signOut: () => signOut({ callbackUrl: "/" }),
    hasRole: (role: string) => session?.roles?.includes(role) ?? false,
    isAdmin: () => session?.roles?.includes("portal-admin") ?? false,
  }
}

// Usage
function AdminButton() {
  const { isAdmin } = useAuth()
  
  if (!isAdmin()) return null
  
  return <Button>Admin Action</Button>
}
```

---

## GitHub Token Access (Single Auth Path)

> **DECISION (Feb 2026)**: Use a single, consolidated auth flow:
> - **Primary**: Keycloak for identity/SSO
> - **Secondary**: Direct GitHub OAuth for API token scopes
> - **Deprecated**: Keycloak token mapper approach (removed to avoid dual issuance/claims drift)

### Recommended: Direct GitHub Provider (Server-Side Token Storage)

For GitHub API access, configure GitHub as a direct NextAuth provider alongside Keycloak. **Critical**: GitHub tokens are stored server-side in Redis (encrypted), never exposed to client sessions.

#### Architecture Overview

```
User → GitHub OAuth → NextAuth JWT callback → Encrypt token → Redis (15min TTL)
                                             ↓
                                   Session callback → NEVER expose token to client
                                             ↓
                            Client gets: session.hasGitHubConnection = true (boolean only)

API Route → Get userId from session → Decrypt token from Redis → Call GitHub API
```

#### Implementation

```typescript
// lib/auth.ts
import KeycloakProvider from "next-auth/providers/keycloak"
import GitHubProvider from "next-auth/providers/github"
import { storeGitHubToken } from "./auth/token-store"

export const authOptions: AuthOptions = {
  providers: [
    // Primary: Keycloak for SSO/identity
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
    // Secondary: Direct GitHub for API tokens
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo read:org",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "github" && account.access_token) {
        // CRITICAL: Store encrypted token in Redis, NOT in JWT
        await storeGitHubToken(
          token.sub!,
          account.access_token,
          900 // 15 minutes (matches access token lifespan from §2.1)
        )
        // Mark that user has GitHub connection (boolean only)
        token.hasGitHubConnection = true
      }
      return token
    },
    async session({ session, token }) {
      // CRITICAL: Do NOT expose githubAccessToken to client
      // ❌ NEVER DO THIS: session.githubToken = token.githubAccessToken
      // ✅ ONLY expose boolean flag:
      session.hasGitHubConnection = !!token.hasGitHubConnection
      return session
    },
  },
}
```

#### Server-Side Token Retrieval

GitHub tokens are retrieved server-side only, decrypted from Redis:

```typescript
// lib/github.ts
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { getToken } from "next-auth/jwt"
import { getGitHubToken as getStoredGitHubToken } from "./auth/token-store"
import { cookies } from "next/headers"

export async function getGitHubToken(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  // Retrieve encrypted token from Redis and decrypt
  const token = await getStoredGitHubToken(session.user.id)
  return token
}

// Usage in API route
export async function GET() {
  const githubToken = await getGitHubToken()
  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub connection required", action: "connect_github" },
      { status: 401 }
    )
  }

  // Use token for GitHub API calls
  const response = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  })

  return NextResponse.json(await response.json())
}
```

### ~~DEPRECATED: Keycloak Token Mapper~~

> **Note**: The Keycloak token mapper approach is deprecated due to:
> - Complexity in maintaining claim synchronization
> - Potential for dual token issuance
> - Difficulty debugging auth issues
>
> Use the direct GitHub provider approach above instead.

---

## Token Storage Architecture (Server-Side Only)

### Overview

All sensitive tokens (GitHub access tokens, refresh tokens) are stored server-side in Redis with encryption. Tokens are **never** transmitted to the client browser or included in JWT session payloads.

### Encryption Specifications

| Property | Value | Notes |
|----------|-------|-------|
| Algorithm | AES-256-GCM | Authenticated encryption with associated data (AEAD) |
| Key Size | 256 bits (32 bytes) | Generates 64-character hex strings |
| Key Ring | Multi-version support | Enables zero-downtime key rotation |
| IV Size | 128 bits (16 bytes) | Random IV per encryption operation |
| Auth Tag Size | 128 bits (16 bytes) | GCM authentication tag |
| Storage Format | `{kid}:{iv}:{ciphertext}:{authTag}` | Example: `v2:a1b2c3...:d4e5f6...:g7h8i9...` |

### Token Expiry Policy

| Token Type | Expiry | Reasoning |
|------------|--------|-----------|
| GitHub Access Token | 15 minutes | Matches Keycloak access token lifespan (§2.1 line 84) |
| GitHub Refresh Token | 8 hours | Matches session max lifespan (§2.1 line 87) |
| Redis Key TTL | Same as token expiry | Automatic cleanup, no manual deletion needed |

### Implementation: Token Store

```typescript
// lib/auth/token-store.ts
import { Redis } from 'ioredis'
import crypto from 'crypto'

const redis = new Redis(process.env.REDIS_URL!)

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_RING: Record<string, string> = JSON.parse(process.env.ENCRYPTION_KEYS!)
const CURRENT_KID = process.env.CURRENT_KEY_ID || 'v1'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Encrypts plaintext using AES-256-GCM with current key from key ring
 * @returns Format: "kid:iv:ciphertext:authTag"
 */
function encrypt(plaintext: string): string {
  const key = Buffer.from(KEY_RING[CURRENT_KID], 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag().toString('hex')

  // Format: kid:iv:ciphertext:authTag
  return `${CURRENT_KID}:${iv.toString('hex')}:${encrypted}:${authTag}`
}

/**
 * Decrypts ciphertext using key identified by kid
 * Supports multiple key versions for zero-downtime rotation
 */
function decrypt(ciphertext: string): string {
  const [kid, ivHex, encrypted, authTagHex] = ciphertext.split(':')

  if (!KEY_RING[kid]) {
    throw new Error(`Key version ${kid} not found in key ring`)
  }

  const key = Buffer.from(KEY_RING[kid], 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Store encrypted GitHub token in Redis with TTL
 * @param userId - User ID from NextAuth session
 * @param token - GitHub access token (plaintext)
 * @param expiresIn - TTL in seconds (default: 900 = 15 minutes)
 */
export async function storeGitHubToken(
  userId: string,
  token: string,
  expiresIn: number = 900
): Promise<void> {
  const encrypted = encrypt(token)
  const key = `github:token:${userId}`

  await redis.setex(key, expiresIn, encrypted)
}

/**
 * Retrieve and decrypt GitHub token from Redis
 * @returns Decrypted token or null if not found/expired
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const key = `github:token:${userId}`
  const encrypted = await redis.get(key)

  if (!encrypted) {
    return null // Token expired or never stored
  }

  try {
    return decrypt(encrypted)
  } catch (error) {
    console.error('Failed to decrypt GitHub token:', error)
    // Delete corrupted token
    await redis.del(key)
    return null
  }
}

/**
 * Manually revoke GitHub token (e.g., on explicit disconnect)
 */
export async function revokeGitHubToken(userId: string): Promise<void> {
  const key = `github:token:${userId}`
  await redis.del(key)
}

/**
 * Refresh GitHub token TTL (call on successful API use)
 */
export async function refreshGitHubTokenTTL(
  userId: string,
  expiresIn: number = 900
): Promise<void> {
  const key = `github:token:${userId}`
  await redis.expire(key, expiresIn)
}
```

### Key Rotation Strategy

To rotate encryption keys without service downtime:

1. **Add new key** to `ENCRYPTION_KEYS` environment variable:
   ```bash
   # Generate new key
   openssl rand -hex 32
   # Output: a1b2c3d4e5f6...

   # Update env
   ENCRYPTION_KEYS='{"v1":"old-key-hex","v2":"new-key-hex"}'
   CURRENT_KEY_ID=v2  # Switch to new key for encryption
   ```

2. **Deploy with both keys**: Old tokens (encrypted with `v1`) can still be decrypted
3. **Wait for token expiry**: After 15 minutes (max GitHub token TTL), all tokens are re-encrypted with `v2`
4. **Remove old key**: After confirming no `v1`-encrypted tokens remain

### Security Best Practices

- ✅ **Use Redis AUTH**: Set `requirepass` in `redis.conf` or use `rediss://` URL with password
- ✅ **Enable Redis TLS**: Use `rediss://` protocol in production
- ✅ **Rotate keys quarterly**: Schedule key rotation every 90 days
- ✅ **Monitor Redis memory**: Set `maxmemory-policy allkeys-lru` for automatic eviction
- ✅ **Use Redis Sentinel/Cluster**: High availability for production
- ❌ **Never log tokens**: Avoid logging decrypted tokens or encryption keys

---

## Back-Channel Logout Implementation

Keycloak supports back-channel logout (OIDC standard) to invalidate sessions when users log out from Keycloak admin console or another application.

### Keycloak Configuration

Enable back-channel logout in the `portal-backend` client:

```json
{
  "clientId": "portal-backend",
  "attributes": {
    "backchannel.logout.url": "https://portal.radiantlogic.io/api/auth/backchannel-logout",
    "backchannel.logout.session.required": "true",
    "backchannel.logout.revoke.offline.tokens": "true"
  }
}
```

### NextAuth Event Handler

Add back-channel logout handler to NextAuth configuration:

```typescript
// lib/auth.ts
export const authOptions: AuthOptions = {
  // ... providers, callbacks ...

  events: {
    async signOut({ token }) {
      // 1. Call Keycloak back-channel logout endpoint
      if (token?.idToken) {
        const logoutUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
        try {
          await fetch(logoutUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              id_token_hint: token.idToken as string,
              client_id: process.env.KEYCLOAK_CLIENT_ID!,
              client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
            }),
          })
        } catch (error) {
          console.error('Keycloak logout failed:', error)
        }
      }

      // 2. Revoke GitHub token from Redis
      if (token?.sub) {
        await revokeGitHubToken(token.sub)
      }
    },
  },

  // ... session, pages ...
}
```

### Back-Channel Logout API Route

Create endpoint for Keycloak to call when initiating logout:

```typescript
// app/api/auth/backchannel-logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revokeGitHubToken } from '@/lib/auth/token-store'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const logoutToken = formData.get('logout_token') as string

    if (!logoutToken) {
      return NextResponse.json({ error: 'Missing logout_token' }, { status: 400 })
    }

    // Verify and decode logout token (JWT)
    const decoded = await verifyLogoutToken(logoutToken)

    // Extract user ID from token
    const userId = decoded.sub

    if (userId) {
      // Revoke GitHub token
      await revokeGitHubToken(userId)

      // Optionally: Add to session blacklist if implementing session management
      // await addToSessionBlacklist(decoded.sid)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Back-channel logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

async function verifyLogoutToken(token: string) {
  // Verify JWT signature with Keycloak public key
  // Parse claims: sub (user ID), sid (session ID), events (logout event)
  // See: https://openid.net/specs/openid-connect-backchannel-1_0.html
  const jose = await import('jose')
  const JWKS = jose.createRemoteJWKSet(
    new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`)
  )

  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: process.env.KEYCLOAK_ISSUER,
    audience: process.env.KEYCLOAK_CLIENT_ID,
  })

  return payload
}
```

---

## Organization Context Integration

### Extracting `org_id` from Keycloak Token

Keycloak tokens can include custom claims for organization context. There are two approaches:

#### Approach 1: Custom Claim (Recommended)

Add `org_id` as a custom claim in Keycloak client mappers:

**Keycloak Client Mapper Configuration:**
```json
{
  "name": "org_id",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-attribute-mapper",
  "config": {
    "user.attribute": "org_id",
    "claim.name": "org_id",
    "jsonType.label": "String",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true"
  }
}
```

**NextAuth JWT Callback:**
```typescript
// lib/auth.ts
export const authOptions: AuthOptions = {
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Extract org_id from Keycloak token
        token.orgId = (profile as any).org_id || null
      }
      return token
    },
    async session({ session, token }) {
      session.user.orgId = token.orgId as string | null
      return session
    },
  },
}
```

#### Approach 2: Group-Based Mapping

Map Keycloak groups to organizations using naming convention `org:{orgId}`:

**NextAuth JWT Callback:**
```typescript
// lib/auth/org-context.ts
import { JWT } from 'next-auth/jwt'

export function extractOrgIdFromToken(token: JWT): string | null {
  // Option 1: From custom claim
  const orgId = token.org_id as string | undefined
  if (orgId) return orgId

  // Option 2: From Keycloak groups (format: "org:uuid")
  const groups = (token.groups as string[]) || []
  const orgGroup = groups.find(g => g.startsWith('org:'))
  return orgGroup?.replace('org:', '') || null
}
```

### Validating Organization Access

Middleware to validate user has access to requested organization:

```typescript
// lib/middleware/tenant-context.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function tenantMiddleware(request: NextRequest) {
  const token = await getToken({ req: request })

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract org_id from X-Organization-Id header (user switching orgs)
  const requestedOrgId = request.headers.get('x-organization-id')

  if (!requestedOrgId) {
    return NextResponse.json(
      { error: 'Missing X-Organization-Id header' },
      { status: 400 }
    )
  }

  // Validate user has membership in this organization
  const membership = await prisma.membership.findFirst({
    where: {
      userId: token.sub!,
      organizationId: requestedOrgId,
    },
  })

  if (!membership) {
    return NextResponse.json(
      { error: 'Access denied to organization', orgId: requestedOrgId },
      { status: 403 }
    )
  }

  // Add validated org_id to request headers for downstream use
  request.headers.set('x-validated-org-id', requestedOrgId)

  return NextResponse.next()
}
```

### Setting `app.current_org_id` for RLS

Use Postgres Row-Level Security (RLS) with application-level context:

```typescript
// lib/db/rls-context.ts
import { prisma } from '@/lib/prisma'

/**
 * Set organization context for RLS policies
 * Call this before any database queries in API routes
 */
export async function setRLSContext(orgId: string) {
  // Set Postgres session variable for RLS
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_org_id = '${orgId}'`
  )
}

// Usage in API route
export async function GET(request: NextRequest) {
  const orgId = request.headers.get('x-validated-org-id')!

  // Set RLS context
  await setRLSContext(orgId)

  // All queries now filtered by org_id via RLS policies
  const dashboards = await prisma.dashboard.findMany()

  return NextResponse.json(dashboards)
}
```

**Postgres RLS Policy Example:**
```sql
-- Enable RLS on dashboards table
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see dashboards from their current organization
CREATE POLICY dashboard_tenant_isolation ON dashboards
  FOR ALL
  TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);
```

### Complete Organization Context Flow

```typescript
// lib/api/org-context.ts
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { setRLSContext } from '@/lib/db/rls-context'

export async function getOrgContext(request: NextRequest) {
  const token = await getToken({ req: request })

  if (!token) {
    throw new Error('Unauthorized')
  }

  // 1. Try explicit org switch via header
  let orgId = request.headers.get('x-organization-id')

  // 2. Fall back to default org from Keycloak token
  if (!orgId) {
    orgId = extractOrgIdFromToken(token)
  }

  if (!orgId) {
    throw new Error('No organization context available')
  }

  // 3. Validate user has access to this organization
  const membership = await prisma.membership.findFirst({
    where: {
      userId: token.sub!,
      organizationId: orgId,
    },
  })

  if (!membership) {
    throw new Error(`Access denied to organization ${orgId}`)
  }

  // 4. Set RLS context for all subsequent queries
  await setRLSContext(orgId)

  return {
    orgId,
    userId: token.sub!,
    role: membership.role,
  }
}
```

**Usage in API Route:**
```typescript
// app/api/dashboards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/api/org-context'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get and validate organization context
    const { orgId, userId, role } = await getOrgContext(request)

    // RLS is now active - queries automatically filtered by orgId
    const dashboards = await prisma.dashboard.findMany({
      where: { userId }, // Additional filter: user's own dashboards
    })

    return NextResponse.json({ dashboards, context: { orgId, role } })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('Unauthorized') ? 401 : 403 }
    )
  }
}
```

---

## Environment Variables

### Complete Configuration

```bash
# .env.local - DevOps Portal Environment Variables

# ============================================
# NextAuth Configuration
# ============================================
NEXTAUTH_URL=https://portal.radiantlogic.io
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# ============================================
# Keycloak (Primary Identity Provider)
# ============================================
KEYCLOAK_ISSUER=https://keycloak.radiantlogic.io/realms/devops-portal
KEYCLOAK_CLIENT_ID=portal-backend
KEYCLOAK_CLIENT_SECRET=<from-keycloak-client-config>

# ============================================
# GitHub OAuth (Direct Provider for API Access)
# ============================================
GITHUB_CLIENT_ID=<github-oauth-app-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-app-client-secret>

# ============================================
# Token Encryption (AES-256-GCM)
# ============================================
# Generate keys with: openssl rand -hex 32
# Format: JSON object with version-keyed entries
ENCRYPTION_KEYS='{"v1":"<64-char-hex-key>","v2":"<64-char-hex-key>"}'
CURRENT_KEY_ID=v1

# ============================================
# Redis (Token Storage & Caching)
# ============================================
# Development (local)
REDIS_URL=redis://localhost:6379

# Production (with TLS and auth)
# REDIS_URL=rediss://username:password@redis.radiantlogic.io:6379

# ============================================
# Database (PostgreSQL with RLS)
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/devops_portal?sslmode=require

# ============================================
# Security Settings
# ============================================
ENABLE_GUEST_ACCESS=false  # Set to true only for demo environments
```

### Generating Secure Values

```bash
# NextAuth secret (base64, 32 bytes)
openssl rand -base64 32

# Encryption keys (hex, 32 bytes = 64 hex chars)
openssl rand -hex 32

# Complete ENCRYPTION_KEYS JSON
echo "{\"v1\":\"$(openssl rand -hex 32)\",\"v2\":\"$(openssl rand -hex 32)\"}"
```

### Security Notes

| Variable | Security Level | Notes |
|----------|----------------|-------|
| `NEXTAUTH_SECRET` | **Critical** | Rotate every 90 days. Invalidates all sessions on change. |
| `KEYCLOAK_CLIENT_SECRET` | **Critical** | Managed in Keycloak, rotate quarterly. |
| `GITHUB_CLIENT_SECRET` | **Critical** | Managed in GitHub OAuth app settings. |
| `ENCRYPTION_KEYS` | **Critical** | Protect with Vault/Secrets Manager. Enable key rotation. |
| `REDIS_URL` | **High** | Use TLS (`rediss://`) and AUTH in production. |
| `DATABASE_URL` | **High** | Use SSL (`sslmode=require`). Consider certificate verification. |

### Production Checklist

- [ ] All secrets stored in Vault/AWS Secrets Manager/Azure Key Vault
- [ ] `REDIS_URL` uses `rediss://` with TLS
- [ ] `DATABASE_URL` has `sslmode=require`
- [ ] `ENCRYPTION_KEYS` has at least 2 keys for rotation
- [ ] `ENABLE_GUEST_ACCESS=false` in production
- [ ] Keycloak version >= 26.1.5 (for back-channel logout support)
- [ ] Redis `maxmemory-policy` set to `allkeys-lru`
- [ ] Redis AUTH enabled (`requirepass` in `redis.conf`)
```

---

## Guest Access

For limited guest access without full authentication:

```typescript
// lib/auth.ts
import CredentialsProvider from "next-auth/providers/credentials"

// Add to providers array
CredentialsProvider({
  id: "guest",
  name: "Guest Access",
  credentials: {},
  async authorize(credentials, req) {
    // Check if guest access is enabled
    if (process.env.ENABLE_GUEST_ACCESS !== "true") {
      return null
    }
    
    return {
      id: "guest-user",
      name: "Guest User",
      email: "guest@portal.local",
      role: "portal-guest",
    }
  },
}),
```

Guest access UI:
```tsx
// components/auth/GuestAccess.tsx
"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function GuestAccess() {
  if (process.env.NEXT_PUBLIC_ENABLE_GUEST_ACCESS !== "true") {
    return null
  }

  return (
    <div className="mt-6 text-center">
      <p className="text-sm text-muted-foreground">
        Or continue as guest with limited access
      </p>
      <Button
        variant="ghost"
        onClick={() => signIn("guest", { callbackUrl: "/dashboard" })}
        className="mt-2"
      >
        Continue as Guest
      </Button>
    </div>
  )
}
```

---

## Summary

Keycloak integration provides:

1. **Single Sign-On** with multiple identity providers
2. **Role-based access control** with fine-grained permissions
3. **Token refresh** for long-lived sessions
4. **Federated tokens** for accessing external APIs (GitHub, etc.)
5. **Guest access** for limited public access
6. **Consistent auth** across all RadiantLogic applications

---

*Next: [04-FEATURE-COMPARISON.md](./04-FEATURE-COMPARISON.md)*
