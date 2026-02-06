# DevOps Portal - Implementation Guide

## Overview

This guide provides a step-by-step implementation plan for building the DevOps Portal using the custom stack, taking inspiration from EOC's architecture.

---

## CRITICAL: Reuse Strategy (70% from Existing Code)

> **See [12-SUGGESTION-VALIDATION-AND-REUSE.md](./12-SUGGESTION-VALIDATION-AND-REUSE.md) for complete analysis**

### Services to Migrate (Copy & Adapt)

| Source File | Migration Effort | Notes |
|-------------|-----------------|-------|
| `plugins/gitops-backend/src/services/GitHubService.ts` | Medium | Replace Express types with Next.js |
| `plugins/gitops-backend/src/services/ArgoCDService.ts` | Low | Keep logic, update types |
| `plugins/gitops-backend/src/services/GrafanaService.ts` | Low | Keep as-is |
| `plugins/gitops-backend/src/services/UptimeKumaService.ts` | Low | Keep as-is |
| `plugins/gitops-backend/src/services/BulkOperationService.ts` | Medium | Add BullMQ integration |
| `plugins/gitops-backend/src/services/AuditService.ts` | Low | Add OTel correlation |
| `plugins/gitops-backend/src/services/PermissionService.ts` | Medium | Add org scoping |
| `plugins/gitops-backend/src/middleware/rateLimiter.ts` | Low | Migrate to @upstash/ratelimit |
| `plugins/gitops-backend/src/middleware/securityHeaders.ts` | Low | Copy to next.config.ts |
| `plugins/gitops-backend/src/validation/schemas.ts` | Low | Keep Zod schemas |

### Theme/Colors (Direct Copy)

From `packages/app/src/theme.ts` → `tailwind.config.js`:

```javascript
// Radiant Logic Brand Colors (ALREADY DEFINED - DO NOT CHANGE)
colors: {
  'rl-navy': '#09143F',      // Primary
  'rl-orange': '#e25a1a',    // Accent
  'rl-blue': '#2ea3f2',      // Links
  'rl-green': '#00b12b',     // Success
}
fontFamily: '"Open Sans", "Arial", sans-serif'
```

### Middleware (Direct Copy)

From `plugins/gitops-backend/src/middleware/securityHeaders.ts` → `next.config.ts`:

```typescript
// Security headers (from existing securityHeaders.ts)
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Permissions-Policy', value: 'interest-cohort=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.github.com" },
    ],
  }];
}
```

### Rate Limiting (Adapt Pattern)

From `plugins/gitops-backend/src/middleware/rateLimiter.ts` configs:

| Limiter | Existing Config | Keep |
|---------|----------------|------|
| `general` | 100 req/min | ✅ |
| `bulk` | 10 req/min | ✅ |
| `sync` | 30 req/min | ✅ |
| `auth` | 5 req/min | ✅ |

---

## Phase 1: Project Setup (Week 1, Days 1-3)

### 1.1 Initialize Next.js Project

```bash
# Create new Next.js project
npx create-next-app@latest devops-portal-v2 \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd devops-portal-v2
```

### 1.2 Install Core Dependencies

```bash
# UI Components
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input label \
  dropdown-menu avatar badge tabs sheet dialog \
  table skeleton toast alert separator

# Dashboard charts
yarn add @tremor/react

# State & Data Fetching
yarn add @tanstack/react-query zustand

# Authentication
yarn add next-auth @auth/prisma-adapter

# Database
yarn add @prisma/client
yarn add -D prisma

# Queue
yarn add bullmq ioredis

# Integrations
yarn add @octokit/rest @kubernetes/client-node

# Validation
yarn add zod

# Dev tools
yarn add -D @types/node typescript prettier
```

### 1.3 Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Home dashboard
│   │   ├── github/
│   │   │   └── page.tsx
│   │   ├── argocd/
│   │   │   └── page.tsx
│   │   ├── monitoring/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── github/
│   │   │   └── [...path]/
│   │   │       └── route.ts
│   │   ├── argocd/
│   │   │   └── [...path]/
│   │   │       └── route.ts
│   │   └── prometheus/
│   │       └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn components
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── MetricCard.tsx
│   │   └── StatusBadge.tsx
│   ├── github/
│   │   ├── PullRequestList.tsx
│   │   └── RepoCard.tsx
│   ├── argocd/
│   │   ├── ApplicationCard.tsx
│   │   └── SyncButton.tsx
│   └── monitoring/
│       ├── MetricsChart.tsx
│       └── GrafanaEmbed.tsx
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── prisma.ts                 # Prisma client
│   ├── redis.ts                  # Redis client
│   ├── queue.ts                  # BullMQ setup
│   └── integrations/
│       ├── github.ts
│       ├── argocd.ts
│       ├── grafana.ts
│       ├── prometheus.ts
│       └── kubernetes.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useGitHub.ts
│   ├── useArgoCD.ts
│   └── useMetrics.ts
├── store/
│   └── ui.ts                     # Zustand store
├── types/
│   └── index.ts
└── prisma/
    └── schema.prisma
```

---

## Phase 2: Database & Auth Setup (Days 4-7)

### 2.1 Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// NextAuth models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String     @id @default(cuid())
  name          String?
  email         String?    @unique
  emailVerified DateTime?
  image         String?
  role          UserRole   @default(VIEWER)
  accounts      Account[]
  sessions      Session[]
  dashboards    Dashboard[]
  preferences   UserPreferences?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Application models
enum UserRole {
  ADMIN
  DEVELOPER
  VIEWER
  GUEST
}

model UserPreferences {
  id            String  @id @default(cuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  theme         String  @default("system")
  sidebarOpen   Boolean @default(true)
  defaultView   String  @default("dashboard")
  notifications Json    @default("{}")
}

model Dashboard {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  layout    Json     @default("[]")
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  widgets   Widget[]
}

model Widget {
  id          String    @id @default(cuid())
  dashboardId String
  dashboard   Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)
  type        String    // "github-prs", "argocd-apps", "metrics", etc.
  title       String
  config      Json      @default("{}")
  position    Json      @default("{\"x\": 0, \"y\": 0, \"w\": 4, \"h\": 2}")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### 2.2 NextAuth Configuration

> **SECURITY CRITICAL**: This configuration implements server-side-only token storage. GitHub tokens are **never** exposed to the client browser or included in session objects sent to the client.

```typescript
// lib/auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { storeGitHubToken, revokeGitHubToken } from "./auth/token-store"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Primary: Keycloak for SSO/identity
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
    // Secondary: Direct GitHub for API token access
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo read:org",
        },
      },
    }),
    // Guest access (optional, disabled by default)
    CredentialsProvider({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
        if (process.env.ENABLE_GUEST_ACCESS !== "true") {
          return null
        }
        return {
          id: "guest",
          name: "Guest User",
          email: "guest@portal.local",
          role: "GUEST",
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, profile }) {
      // Initial sign in - store provider-specific tokens
      if (account && profile) {
        token.provider = account.provider

        // Handle Keycloak tokens
        if (account.provider === "keycloak") {
          token.accessToken = account.access_token
          token.refreshToken = account.refresh_token
          token.idToken = account.id_token
          token.accessTokenExpires = account.expires_at! * 1000

          // Extract roles from Keycloak token
          const roles = (profile as any).realm_access?.roles ?? []
          token.roles = roles.filter((r: string) => r.startsWith("portal-"))

          // Extract org_id from Keycloak custom claim (if configured)
          token.orgId = (profile as any).org_id || null
        }

        // Handle GitHub tokens - CRITICAL: Store server-side only
        if (account.provider === "github" && account.access_token) {
          // ✅ SECURE: Store encrypted token in Redis, NOT in JWT
          await storeGitHubToken(
            token.sub!,
            account.access_token,
            900 // 15 minutes (matches Keycloak access token lifespan)
          )
          // Only store boolean flag in JWT
          token.hasGitHubConnection = true
        }
      }

      // Handle user object (from database adapter)
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }

      // Token refresh logic for Keycloak
      if (token.provider === "keycloak") {
        // Check if access token is still valid
        if (Date.now() < (token.accessTokenExpires as number)) {
          return token
        }

        // Token expired, attempt refresh
        return await refreshKeycloakToken(token)
      }

      return token
    },
    async session({ session, token }) {
      // ✅ SECURE: Only expose safe, non-sensitive data to client
      session.user.id = token.sub!
      session.user.role = token.role as string
      session.provider = token.provider as string

      // Keycloak session data
      if (token.provider === "keycloak") {
        session.roles = token.roles as string[]
        session.user.orgId = token.orgId as string | null
        // Expose error state for session refresh issues
        session.error = token.error as string | undefined
      }

      // ❌ CRITICAL: Do NOT expose GitHub token to client
      // ❌ NEVER DO THIS: session.githubToken = token.githubToken
      // ✅ ONLY expose boolean flag:
      session.hasGitHubConnection = !!token.hasGitHubConnection

      return session
    },
  },
  events: {
    async signOut({ token }) {
      // 1. Call Keycloak back-channel logout
      if (token?.idToken && token.provider === "keycloak") {
        const logoutUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
        try {
          await fetch(logoutUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              id_token_hint: token.idToken as string,
              client_id: process.env.KEYCLOAK_CLIENT_ID!,
              client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
            }),
          })
        } catch (error) {
          console.error("Keycloak logout failed:", error)
        }
      }

      // 2. Revoke GitHub token from Redis
      if (token?.sub) {
        await revokeGitHubToken(token.sub)
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes (matches access token lifespan)
    updateAge: 5 * 60, // Refresh session every 5 minutes
  },
}

/**
 * Refresh Keycloak access token using refresh token
 */
async function refreshKeycloakToken(token: any): Promise<any> {
  try {
    const url = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      idToken: refreshedTokens.id_token,
    }
  } catch (error) {
    console.error("Error refreshing Keycloak token:", error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}
```

#### Token Store Implementation

Create the server-side token storage module (referenced above):

```typescript
// lib/auth/token-store.ts
import { Redis } from 'ioredis'
import crypto from 'crypto'

const redis = new Redis(process.env.REDIS_URL!)

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_RING: Record<string, string> = JSON.parse(process.env.ENCRYPTION_KEYS!)
const CURRENT_KID = process.env.CURRENT_KEY_ID || 'v1'

/**
 * Encrypts plaintext using AES-256-GCM
 * @returns Format: "kid:iv:ciphertext:authTag"
 */
function encrypt(plaintext: string): string {
  const key = Buffer.from(KEY_RING[CURRENT_KID], 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${CURRENT_KID}:${iv.toString('hex')}:${encrypted}:${authTag}`
}

/**
 * Decrypts ciphertext using key identified by kid
 */
function decrypt(ciphertext: string): string {
  const [kid, ivHex, encrypted, authTagHex] = ciphertext.split(':')

  if (!KEY_RING[kid]) {
    throw new Error(`Key version ${kid} not found`)
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

export async function storeGitHubToken(
  userId: string,
  token: string,
  expiresIn: number = 900
): Promise<void> {
  const encrypted = encrypt(token)
  await redis.setex(`github:token:${userId}`, expiresIn, encrypted)
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const encrypted = await redis.get(`github:token:${userId}`)
  if (!encrypted) return null

  try {
    return decrypt(encrypted)
  } catch (error) {
    console.error('Failed to decrypt GitHub token:', error)
    await redis.del(`github:token:${userId}`)
    return null
  }
}

export async function revokeGitHubToken(userId: string): Promise<void> {
  await redis.del(`github:token:${userId}`)
}
```

#### Using GitHub Tokens in API Routes

Always retrieve tokens server-side, never from client sessions:

```typescript
// lib/github.ts
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { getGitHubToken as getStoredGitHubToken } from "./auth/token-store"

export async function getGitHubToken(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  // Retrieve and decrypt token from Redis
  return await getStoredGitHubToken(session.user.id)
}

// Usage in API route
// app/api/github/repos/route.ts
import { NextResponse } from "next/server"
import { getGitHubToken } from "@/lib/github"

export async function GET() {
  const githubToken = await getGitHubToken()

  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub connection required", action: "connect_github" },
      { status: 401 }
    )
  }

  // Use token for GitHub API
  const response = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  })

  return NextResponse.json(await response.json())
}
```

#### Environment Variables

Complete list of required environment variables for the auth system:

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

**Generate Secure Values:**
```bash
# NextAuth secret (base64, 32 bytes)
openssl rand -base64 32

# Encryption keys (hex, 32 bytes = 64 hex chars)
openssl rand -hex 32

# Complete ENCRYPTION_KEYS JSON
echo "{\"v1\":\"$(openssl rand -hex 32)\",\"v2\":\"$(openssl rand -hex 32)\"}"
```

**Security Notes:**

| Variable | Security Level | Notes |
|----------|----------------|-------|
| `NEXTAUTH_SECRET` | **CRITICAL** | Rotate every 90 days. Invalidates all sessions on change. |
| `KEYCLOAK_CLIENT_SECRET` | **CRITICAL** | Managed in Keycloak, rotate quarterly. |
| `GITHUB_CLIENT_SECRET` | **CRITICAL** | Managed in GitHub OAuth app settings. |
| `ENCRYPTION_KEYS` | **CRITICAL** | Store in Vault/Secrets Manager. Enable key rotation. |
| `REDIS_URL` | **HIGH** | Use TLS (`rediss://`) and AUTH in production. |
| `DATABASE_URL` | **HIGH** | Use SSL (`sslmode=require`). Consider certificate verification. |

---

## Phase 3: Core UI Components (Days 8-12)

### 3.1 Dashboard Layout

```tsx
// app/(dashboard)/layout.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { Header } from "@/components/dashboard/Header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 3.2 Home Dashboard

```tsx
// app/(dashboard)/page.tsx
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { GitHubWidget } from "@/components/github/GitHubWidget"
import { ArgoCDWidget } from "@/components/argocd/ArgoCDWidget"
import { MetricsWidget } from "@/components/monitoring/MetricsWidget"
import { Skeleton } from "@/components/ui/skeleton"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your projects
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<Skeleton className="h-32" />}>
          <MetricCard
            title="Open PRs"
            icon="git-pull-request"
            queryKey="github-prs"
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-32" />}>
          <MetricCard
            title="ArgoCD Apps"
            icon="cloud"
            queryKey="argocd-apps"
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-32" />}>
          <MetricCard
            title="Healthy Pods"
            icon="check-circle"
            queryKey="k8s-pods"
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-32" />}>
          <MetricCard
            title="Active Alerts"
            icon="alert-triangle"
            queryKey="alerts"
          />
        </Suspense>
      </div>

      {/* Main Widgets */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <GitHubWidget />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ArgoCDWidget />
        </Suspense>
      </div>

      {/* Metrics Chart */}
      <Suspense fallback={<Skeleton className="h-80" />}>
        <MetricsWidget />
      </Suspense>
    </div>
  )
}
```

### 3.3 Sidebar Component

```tsx
// components/dashboard/Sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/store/ui"
import {
  LayoutDashboard,
  Github,
  Cloud,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "GitHub", href: "/github", icon: Github },
  { name: "ArgoCD", href: "/argocd", icon: Cloud },
  { name: "Monitoring", href: "/monitoring", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-card transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b">
        {sidebarOpen ? (
          <span className="text-lg font-bold">DevOps Portal</span>
        ) : (
          <span className="text-lg font-bold">DP</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background"
        onClick={toggleSidebar}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
    </aside>
  )
}
```

---

## Phase 4: Integration Services (Days 13-18)

### 4.1 GitHub Service

```typescript
// lib/integrations/github.ts
import { Octokit } from "@octokit/rest"

export function createGitHubClient(token: string) {
  return new Octokit({
    auth: token,
    userAgent: "devops-portal/2.0.0",
  })
}

export async function getUserPullRequests(token: string) {
  const octokit = createGitHubClient(token)

  // Get user's repos
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: "pushed",
    per_page: 20,
  })

  // Get PRs from each repo
  const prPromises = repos.map(async (repo) => {
    try {
      const { data: prs } = await octokit.pulls.list({
        owner: repo.owner.login,
        repo: repo.name,
        state: "open",
        per_page: 10,
      })
      return prs.map((pr) => ({
        ...pr,
        repository: repo.name,
        owner: repo.owner.login,
      }))
    } catch {
      return []
    }
  })

  const allPRs = (await Promise.all(prPromises)).flat()
  return allPRs.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

export async function getOrgRepositories(token: string, org: string) {
  const octokit = createGitHubClient(token)
  const { data } = await octokit.repos.listForOrg({
    org,
    type: "all",
    sort: "pushed",
    per_page: 100,
  })
  return data
}
```

### 4.2 ArgoCD Service

```typescript
// lib/integrations/argocd.ts
export class ArgoCDClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    if (!res.ok) {
      throw new Error(`ArgoCD API error: ${res.status}`)
    }

    return res.json()
  }

  async getApplications() {
    return this.fetch<{ items: Application[] }>("/api/v1/applications")
  }

  async getApplication(name: string) {
    return this.fetch<Application>(`/api/v1/applications/${name}`)
  }

  async syncApplication(name: string) {
    return this.fetch<Application>(`/api/v1/applications/${name}/sync`, {
      method: "POST",
      body: JSON.stringify({ prune: false }),
    })
  }

  async refreshApplication(name: string) {
    return this.fetch<Application>(
      `/api/v1/applications/${name}?refresh=normal`,
      { method: "GET" }
    )
  }

  async rollbackApplication(name: string, revision: number) {
    return this.fetch<Application>(`/api/v1/applications/${name}/rollback`, {
      method: "POST",
      body: JSON.stringify({ id: revision }),
    })
  }
}

interface Application {
  metadata: { name: string; namespace: string }
  spec: { source: { repoURL: string; path: string; targetRevision: string } }
  status: {
    health: { status: string }
    sync: { status: string; revision: string }
    operationState?: { phase: string }
  }
}
```

### 4.3 Prometheus Service

```typescript
// lib/integrations/prometheus.ts
export class PrometheusClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async query(promql: string): Promise<QueryResult> {
    const url = new URL(`${this.baseUrl}/api/v1/query`)
    url.searchParams.set("query", promql)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Prometheus error: ${res.status}`)

    return res.json()
  }

  async queryRange(
    promql: string,
    start: Date,
    end: Date,
    step: string
  ): Promise<RangeQueryResult> {
    const url = new URL(`${this.baseUrl}/api/v1/query_range`)
    url.searchParams.set("query", promql)
    url.searchParams.set("start", (start.getTime() / 1000).toString())
    url.searchParams.set("end", (end.getTime() / 1000).toString())
    url.searchParams.set("step", step)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Prometheus error: ${res.status}`)

    return res.json()
  }

  async getTargets() {
    const res = await fetch(`${this.baseUrl}/api/v1/targets`)
    return res.json()
  }

  async getAlerts() {
    const res = await fetch(`${this.baseUrl}/api/v1/alerts`)
    return res.json()
  }
}

interface QueryResult {
  status: string
  data: {
    resultType: string
    result: Array<{
      metric: Record<string, string>
      value: [number, string]
    }>
  }
}

interface RangeQueryResult {
  status: string
  data: {
    resultType: string
    result: Array<{
      metric: Record<string, string>
      values: Array<[number, string]>
    }>
  }
}
```

---

## Phase 5: API Routes (Days 19-22)

### 5.1 GitHub API Route

```typescript
// app/api/github/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createGitHubClient, getUserPullRequests } from "@/lib/integrations/github"
import { getGitHubToken } from "@/lib/github"
import { redis } from "@/lib/redis"

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ✅ SECURE: Retrieve token from Redis, not from session
  const githubToken = await getGitHubToken()

  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub connection required", action: "connect_github" },
      { status: 401 }
    )
  }

  const path = params.path.join("/")

  try {
    switch (path) {
      case "pull-requests": {
        // Check cache first
        const cacheKey = `github:prs:${session.user?.email}`
        const cached = await redis.get(cacheKey)
        if (cached) {
          return NextResponse.json(JSON.parse(cached))
        }

        // Pass token to helper function
        const prs = await getUserPullRequests(githubToken)
        await redis.setex(cacheKey, 60, JSON.stringify(prs))
        return NextResponse.json(prs)
      }

      case "repos": {
        // Pass token to GitHub client
        const octokit = createGitHubClient(githubToken)
        const { data } = await octokit.repos.listForAuthenticatedUser({
          sort: "pushed",
          per_page: 50,
        })
        return NextResponse.json(data)
      }

      default:
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } catch (error) {
    console.error("GitHub API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch GitHub data" },
      { status: 500 }
    )
  }
}
```

### 5.2 ArgoCD API Route

```typescript
// app/api/argocd/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ArgoCDClient } from "@/lib/integrations/argocd"

const argocd = new ArgoCDClient(
  process.env.ARGOCD_URL!,
  process.env.ARGOCD_TOKEN!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const path = params.path.join("/")

  try {
    if (path === "applications") {
      const data = await argocd.getApplications()
      return NextResponse.json(data)
    }

    if (path.startsWith("applications/")) {
      const appName = path.replace("applications/", "")
      const data = await argocd.getApplication(appName)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    console.error("ArgoCD API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch ArgoCD data" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "DEVELOPER"].includes(session.user?.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const path = params.path.join("/")

  try {
    // applications/{name}/sync
    if (path.match(/^applications\/[^/]+\/sync$/)) {
      const appName = path.split("/")[1]
      const data = await argocd.syncApplication(appName)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (error) {
    console.error("ArgoCD API error:", error)
    return NextResponse.json(
      { error: "Failed to perform ArgoCD action" },
      { status: 500 }
    )
  }
}
```

---

## Phase 6: Background Jobs (Days 23-25)

### 6.1 Queue Setup

```typescript
// lib/queue.ts
import { Queue, Worker, Job } from "bullmq"
import { redis } from "./redis"

// Define queues
export const syncQueue = new Queue("sync", { connection: redis })
export const metricsQueue = new Queue("metrics", { connection: redis })
export const notifyQueue = new Queue("notify", { connection: redis })

// Job handlers
const jobHandlers: Record<string, (job: Job) => Promise<void>> = {
  "sync-argocd": async (job) => {
    const { appName } = job.data
    // Sync logic
  },
  "refresh-metrics": async (job) => {
    // Fetch and cache metrics
  },
  "send-notification": async (job) => {
    const { channel, message } = job.data
    // Send notification
  },
}

// Create workers
export function startWorkers() {
  const syncWorker = new Worker(
    "sync",
    async (job) => {
      const handler = jobHandlers[job.name]
      if (handler) await handler(job)
    },
    { connection: redis }
  )

  const metricsWorker = new Worker(
    "metrics",
    async (job) => {
      const handler = jobHandlers[job.name]
      if (handler) await handler(job)
    },
    { connection: redis }
  )

  return { syncWorker, metricsWorker }
}

// Schedule recurring jobs
export async function scheduleRecurringJobs() {
  // Refresh metrics every 5 minutes
  await metricsQueue.add(
    "refresh-metrics",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
    }
  )
}
```

---

## Phase 6.5: Security Middleware (Days 25-26)

### 6.5.1 Environment Variable Validation

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']),
  
  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  
  // Redis
  REDIS_URL: z.string().url().startsWith('redis://'),
  
  // Auth - all required in production
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_ISSUER: z.string().url(),
  
  // GitHub
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  
  // Integrations
  ARGOCD_URL: z.string().url(),
  ARGOCD_TOKEN: z.string().min(1),
  PROMETHEUS_URL: z.string().url().optional(),
  GRAFANA_URL: z.string().url().optional(),
})

// Validate at startup - crash early if misconfigured
export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

### 6.5.2 Rate Limiting Middleware

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL!)

export const rateLimiters = {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1m"),
    prefix: "ratelimit:api",
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1m"),
    prefix: "ratelimit:auth",
  }),
  sync: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1m"),
    prefix: "ratelimit:sync",
  }),
}

export async function rateLimit(request: Request, limiter: keyof typeof rateLimiters) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1"
  const { success, limit, remaining, reset } = await rateLimiters[limiter].limit(ip)

  if (!success) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }
  return null
}
```

### 6.5.3 Security Headers (CSP/HSTS)

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https:;
      font-src 'self';
      connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} ${process.env.KEYCLOAK_ISSUER};
      frame-src 'self' ${process.env.GRAFANA_URL};
      frame-ancestors 'self';
    `.replace(/\s{2,}/g, ' ').trim()
  }
]

const config: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default config
```

---

## Phase 7: Testing, Accessibility & Deployment (Days 26-30)

### 7.1 Hardened Docker Configuration

```dockerfile
# Dockerfile - Security hardened
FROM node:22-alpine@sha256:... AS base

# Security: Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && yarn build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Read-only filesystem where possible
RUN mkdir -p /app/.next/cache && chown nextjs:nodejs /app/.next/cache

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### 7.2 Hardened Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devops-portal
  labels:
    app: devops-portal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: devops-portal
  template:
    metadata:
      labels:
        app: devops-portal
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: devops-portal
          image: ghcr.io/radiantlogic/devops-portal:latest
          ports:
            - containerPort: 3000
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/.next/cache
          envFrom:
            - configMapRef:
                name: devops-portal-config
            - secretRef:
                name: devops-portal-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
---
# NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: devops-portal
spec:
  podSelector:
    matchLabels:
      app: devops-portal
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - port: 3000
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: data-services
      ports:
        - port: 5432
        - port: 6379
    - to:
        - namespaceSelector: {}
      ports:
        - port: 53
          protocol: UDP
---
# HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: devops-portal
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: devops-portal
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 7.3 Helm Chart (Priority Deployment Method)

```yaml
# helm/devops-portal/Chart.yaml
apiVersion: v2
name: devops-portal
description: DevOps Portal - Kubernetes Developer Portal
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: "oci://registry-1.docker.io/bitnamicharts"
    condition: postgresql.enabled
  - name: redis
    version: "19.x.x"
    repository: "oci://registry-1.docker.io/bitnamicharts"
    condition: redis.enabled
```

```yaml
# helm/devops-portal/values.yaml
replicaCount: 3

image:
  repository: ghcr.io/radiantlogic/devops-portal
  tag: "latest"
  pullPolicy: IfNotPresent

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  automount: true
  annotations: {}
  name: ""

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: portal.radiantlogic.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: devops-portal-tls
      hosts:
        - portal.radiantlogic.io

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Environment configuration
env:
  NODE_ENV: production
  NEXT_TELEMETRY_DISABLED: "1"

# External secrets (via External Secrets Operator)
externalSecrets:
  enabled: true
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: devops-portal/database
        property: url
    - secretKey: REDIS_URL
      remoteRef:
        key: devops-portal/redis
        property: url
    - secretKey: NEXTAUTH_SECRET
      remoteRef:
        key: devops-portal/auth
        property: nextauth_secret

# PostgreSQL subchart
postgresql:
  enabled: true
  auth:
    database: devops_portal
    existingSecret: devops-portal-db-creds
  primary:
    persistence:
      size: 10Gi

# Redis subchart
redis:
  enabled: true
  auth:
    enabled: true
    existingSecret: devops-portal-redis-creds
  master:
    persistence:
      size: 2Gi
```

```yaml
# helm/devops-portal/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "devops-portal.fullname" . }}
  labels:
    {{- include "devops-portal.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "devops-portal.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "devops-portal.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "devops-portal.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ include "devops-portal.fullname" . }}-config
            {{- if .Values.externalSecrets.enabled }}
            - secretRef:
                name: {{ include "devops-portal.fullname" . }}-secrets
            {{- end }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/.next/cache
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
```

### 7.4 Accessibility Testing

```typescript
// tests/a11y.spec.ts
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const pages = [
  { name: "Dashboard", path: "/" },
  { name: "GitHub", path: "/github" },
  { name: "ArgoCD", path: "/argocd" },
  { name: "Monitoring", path: "/monitoring" },
  { name: "Settings", path: "/settings" },
]

for (const page of pages) {
  test(`${page.name} should have no accessibility violations`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path)
    
    const results = await new AxeBuilder({ page: browserPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
```

### 7.4.1 Lighthouse CI (Performance Budgets)

```yaml
# lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/github', 'http://localhost:3000/argocd'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: yarn install --frozen-lockfile
      - run: yarn build
      - run: yarn start &
      - run: npx wait-on http://localhost:3000
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          configPath: './lighthouserc.js'
          uploadArtifacts: true
```

### 7.5 GitHub Actions (CI/CD with Security)

```yaml
# .github/workflows/build-deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "yarn"
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn test
      - run: yarn test:a11y

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-push:
    needs: [lint-test, security-scan]
    runs-on: ubuntu-latest
    if: github.event_name != 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/radiantlogic/devops-portal:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/radiantlogic/devops-portal:${{ github.sha }}
            ghcr.io/radiantlogic/devops-portal:${{ github.ref_name == 'main' && 'latest' || 'dev' }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-helm:
    needs: build-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via ArgoCD
        run: |
          # Update image tag in values
          yq -i '.image.tag = "${{ github.sha }}"' helm/devops-portal/values.yaml
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add helm/
          git commit -m "chore: update image to ${{ github.sha }}"
          git push
```

---

## Phase 8: Observability (Days 31-33)

### 8.1 OpenTelemetry Setup

```typescript
// lib/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  metricReader: new PrometheusExporter({ port: 9464 }),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
```

### 8.2 Pino Logger with Trace Correlation

```typescript
// lib/logger.ts
import pino from 'pino'
import { context, trace } from '@opentelemetry/api'

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password', 'token', 'accessToken', 'secret', 'apiKey',
]

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  mixin() {
    const span = trace.getSpan(context.active())
    if (span) {
      const { traceId, spanId } = span.spanContext()
      return { traceId, spanId }
    }
    return {}
  },
})
```

### 8.3 SLO Definitions

| SLO | Target | PromQL |
|-----|--------|--------|
| API Latency (p99) | < 500ms | `histogram_quantile(0.99, http_request_duration_seconds_bucket)` |
| Error Rate | < 1% | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
| Availability | 99.9% | `avg_over_time(up{job="devops-portal"}[30d])` |
| Queue Latency | < 30s | `histogram_quantile(0.95, bullmq_job_duration_seconds_bucket)` |

---

## MVP Acceptance Checklist

Based on requirements from `10-USER-REQUIREMENTS-ANALYSIS.md`:

### Authentication (P0)
- [ ] **AUTH-01**: Keycloak SSO login functional
- [ ] **AUTH-02**: GitHub OAuth for API token
- [ ] **AUTH-09**: Single auth flow (no dual issuance)
- [ ] **AUTH-10**: Guest access disabled in production

### GitOps Core (P0)
- [ ] **GIT-01**: View all org repositories
- [ ] **GIT-02**: List open PRs with status
- [ ] **GIT-05**: PR detail view with diff summary
- [ ] **ARGO-01**: List all ArgoCD applications
- [ ] **ARGO-02**: Show sync/health status
- [ ] **ARGO-03**: Sync single application
- [ ] **ARGO-04**: Bulk sync multiple apps

### Security (P0)
- [ ] **SEC-01**: Zod validation on all API routes
- [ ] **SEC-02**: Rate limiting (per-user/IP)
- [ ] **SEC-03**: CSP headers configured
- [ ] **SEC-04**: HSTS enabled
- [ ] **SEC-05**: Non-root container
- [ ] **SEC-06**: Read-only root filesystem
- [ ] **SEC-07**: NetworkPolicy applied

### Monitoring (P0)
- [ ] **MON-01**: Health endpoint (/api/health)
- [ ] **MON-02**: Basic Prometheus metrics
- [ ] **MON-03**: Structured JSON logging (Pino)
- [ ] **MON-07**: OpenTelemetry tracing

### Dashboard (P0)
- [ ] **DASH-01**: Home dashboard with widgets
- [ ] **DASH-02**: GitHub PR widget
- [ ] **DASH-03**: ArgoCD status widget
- [ ] **DASH-04**: Metrics overview widget
- [ ] **UX-04**: Command palette (⌘K)

### Deployment (P0)
- [ ] **DEPLOY-01**: Helm chart functional
- [ ] **DEPLOY-02**: ArgoCD Application manifest
- [ ] **DEPLOY-03**: External Secrets integration
- [ ] **DEPLOY-04**: HPA configured

### Accessibility (P1)
- [ ] **A11Y-01**: Skip-to-content link
- [ ] **A11Y-02**: Semantic headings (h1-h3)
- [ ] **A11Y-03**: Focus states visible
- [ ] **A11Y-06**: Axe CI passing (0 violations)

### Performance (P1)
- [ ] **PERF-01**: Dashboard loads < 3s (cold)
- [ ] **PERF-02**: API responses < 500ms (p95)
- [ ] **PERF-03**: Docker image < 300MB

---

## Summary

This implementation guide provides a complete roadmap for building the DevOps Portal using the custom stack:

| Phase | Days | Deliverables |
|-------|------|--------------|
| **Phase 1** | 1-3 | Project setup, dependencies |
| **Phase 2** | 4-7 | Database schema, Keycloak auth |
| **Phase 3** | 8-12 | Core UI components, dashboard |
| **Phase 4** | 13-18 | GitHub, ArgoCD, Prometheus integrations |
| **Phase 5** | 19-22 | API routes, caching |
| **Phase 6** | 23-25 | Background jobs (BullMQ) |
| **Phase 6.5** | 25-26 | Security middleware |
| **Phase 7** | 26-30 | Docker, Helm, K8s, CI/CD |
| **Phase 8** | 31-33 | Observability (OTel, Pino) |

**Total: ~6-7 weeks to MVP**

### Priority Deployment Methods

1. **Helm Chart** (Recommended) - Full production deployment with dependencies
2. **Raw K8s Manifests** - For customized deployments
3. **Docker Compose** - Local development only

---

*See also: [07-EOC-PATTERNS-REFERENCE.md](./07-EOC-PATTERNS-REFERENCE.md)*
