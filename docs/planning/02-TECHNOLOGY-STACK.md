# DevOps Portal - Technology Stack Deep Dive

## Stack Overview

This document provides a detailed breakdown of each technology choice, why it was selected, and how it compares to alternatives (including Backstage).

---

## KEY FINDING: 70% Reusable from Existing Codebase

> **See [12-SUGGESTION-VALIDATION-AND-REUSE.md](./12-SUGGESTION-VALIDATION-AND-REUSE.md) for complete analysis**

| Category | Reuse % | Notes |
|----------|---------|-------|
| Rate Limiting | 90% | Migrate `rateLimiter.ts` to Redis |
| Security Headers | 100% | Keep `securityHeaders.ts` patterns |
| RBAC | 80% | Migrate `PermissionService.ts`, add org scoping |
| Audit | 85% | Keep `AuditService.ts`, add OTel correlation |
| GitHub Integration | 95% | Migrate `GitHubService.ts` + `GitHubActionsService.ts` |
| ArgoCD Integration | 95% | Migrate `ArgoCDService.ts` |
| Grafana Integration | 95% | Migrate `GrafanaService.ts` |
| Uptime Kuma | 95% | Migrate `UptimeKumaService.ts` |
| Bulk Operations | 70% | Migrate `BulkOperationService.ts`, add BullMQ |
| Theme/Colors | 100% | Existing `theme.ts` already has Radiant Logic brand |
| 2FA/MFA | 90% | Migrate `TwoFactorAuthService.ts` |

### Radiant Logic Brand Colors (Reuse Directly)

```typescript
// FROM: packages/app/src/theme.ts (KEEP THESE)
const colors = {
  'rl-navy': '#09143F',      // Primary (official)
  'rl-navy-light': '#0d1a4f',
  'rl-orange': '#e25a1a',    // Accent (official)
  'rl-orange-light': '#ff7a3d',
  'rl-blue': '#2ea3f2',      // Links
  'rl-green': '#00b12b',     // Success
}
const fontFamily = '"Open Sans", "Arial", sans-serif'
```

---

---

## 1. Frontend Framework

### Chosen: **Next.js 15 (App Router) + Node.js 22 LTS**

| Criteria | Next.js 15 | Backstage | Vite + React |
|----------|-----------|-----------|--------------|
| Server-Side Rendering | Yes (built-in) | No | No (SPA) |
| API Routes | Built-in | Separate backend | Separate backend |
| Bundle Size | Optimized | Large | Small |
| Build Time | Fast (Turbopack stable) | Slow | Fast |
| Learning Curve | Moderate | Steep | Low |
| Type Safety | Excellent | Good | Good |
| React Version | React 19 | React 17 | React 18+ |

**Why Next.js 15:**
- **Full-stack in one**: Frontend + API routes = simpler architecture
- **Performance**: Server components, streaming, optimized bundles
- **Turbopack stable**: Faster dev/builds vs Webpack
- **Developer Experience**: Fast refresh, excellent TypeScript support
- **Production Ready**: Used by Netflix, TikTok, Notion
- **ISR/SSR**: Better SEO and initial load times
- **Partial Prerendering**: Hybrid static/dynamic rendering

**Known Issues & Mitigations (Feb 2026):**

| Issue | Mitigation |
|-------|------------|
| Turbopack dev slow/hangs (15.2.x-15.4) | Pin to **15.2.0 or 15.2.1**; use Turbopack dev only |
| Turbopack prod builds experimental | **Use Webpack for production** (`next build` default) |
| NextAuth refresh/idle delays | Server-side refresh + back-channel logout |

**Configuration:**
```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Docker-optimized builds
  // IMPORTANT: Turbopack for dev only; prod uses Webpack (default)
  // turbopack: {} - Enable in next.config.ts for dev if needed
  experimental: {
    ppr: true, // Partial Prerendering
  },
}

export default nextConfig

// package.json scripts
// "dev": "next dev --turbopack"  <- Turbopack dev only
// "build": "next build"          <- Webpack for prod (default)
```

---

## 2. Dependency Version Manifest

**Package Manager**: pnpm 9.x (workspace support, efficient disk usage)

**Node.js**: 22 LTS (active until 2027-04-30)

### Core Framework Dependencies

```json
{
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8",
    "ky": "^1.7.3",
    "@prisma/client": "^6.3.0",
    "bullmq": "^5.28.2",
    "ioredis": "^5.4.1",
    "@opentelemetry/sdk-node": "^0.54.0",
    "@opentelemetry/auto-instrumentations-node": "^0.50.0",
    "@opentelemetry/exporter-prometheus": "^0.54.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.54.0",
    "pino": "^9.5.0",
    "pino-pretty": "^13.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@auth/prisma-adapter": "^2.7.4",
    "zustand": "^5.0.2",
    "react-hook-form": "^7.54.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.6",
    "@types/react-dom": "^19.0.2",
    "prisma": "^6.3.0",
    "vitest": "^2.1.8",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "playwright": "^1.49.1",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.2.0",
    "prettier": "^3.4.2"
  }
}
```

**Version Pinning Strategy**:
- **Patch updates**: Auto-apply (security fixes)
- **Minor updates**: Review changelog, test in dev
- **Major updates**: Dedicated upgrade sprint, compatibility testing
- **Lock file**: `pnpm-lock.yaml` committed to git
- **Renovate bot**: Automated dependency PRs with CI checks

---

## 3. UI Components

### Chosen: **shadcn/ui + Tailwind CSS**

| Criteria | shadcn/ui | Material-UI | Chakra UI |
|----------|-----------|-------------|-----------|
| Bundle Size | Tiny (copy-paste) | Large | Medium |
| Customization | Full control | Theme-based | Theme-based |
| TypeScript | Excellent | Good | Good |
| Accessibility | Radix-based | Good | Excellent |
| Styling | Tailwind CSS | JSS/Emotion | Emotion |
| Component Updates | Manual | npm update | npm update |

**Why shadcn/ui:**
- **Zero runtime overhead**: Components are copied into your project
- **Full ownership**: Modify components directly without forking
- **Modern design**: Clean, professional appearance
- **Radix Primitives**: Accessible by default
- **Tailwind integration**: Consistent styling with utility classes

**Example Component:**
```tsx
// components/ui/button.tsx
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

### Dashboard Charts: **Tremor**

| Criteria | Tremor | Recharts | Chart.js |
|----------|--------|----------|----------|
| React Native | Yes | Yes | Wrapper |
| Design Quality | Excellent | Basic | Basic |
| TypeScript | Excellent | Good | Good |
| Dashboard Focus | Yes | No | No |

**Why Tremor:**
- Purpose-built for dashboards
- Pre-styled metric cards, charts, tables
- Works seamlessly with Tailwind

```tsx
import { Card, Metric, Text, AreaChart } from "@tremor/react"

export function MetricCard({ title, value, delta }) {
  return (
    <Card>
      <Text>{title}</Text>
      <Metric>{value}</Metric>
      <Text className={delta > 0 ? "text-green-500" : "text-red-500"}>
        {delta > 0 ? "+" : ""}{delta}%
      </Text>
    </Card>
  )
}
```

---

## 3. Authentication

### Chosen: **Keycloak via NextAuth.js**

| Criteria | Keycloak + NextAuth | Auth0 | Clerk |
|----------|---------------------|-------|-------|
| Self-Hosted | Yes | No | No |
| Cost | Free | Paid | Paid |
| SSO Support | Excellent | Excellent | Good |
| LDAP/AD | Built-in | Limited | No |
| Customization | Full | Limited | Limited |
| EOC Alignment | Same stack | Different | Different |

**Why Keycloak:**
- **Already in use**: EOC uses Keycloak for auth
- **Self-hosted**: No external dependencies
- **Full-featured**: SSO, MFA, LDAP, social login
- **Identity Federation**: Connect to GitHub, Google, Microsoft

**NextAuth Configuration:**
```typescript
// lib/auth.ts
import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import GitHubProvider from "next-auth/providers/github"

export const authOptions: AuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
    // GitHub as direct provider (for OAuth token access)
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist OAuth tokens in JWT
      if (account) {
        token.accessToken = account.access_token
        token.provider = account.provider
        if (account.provider === "github") {
          token.githubToken = account.access_token
        }
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.provider = token.provider
      session.githubToken = token.githubToken
      return session
    },
  },
}
```

### Guest Access
```typescript
// For limited guest access
import CredentialsProvider from "next-auth/providers/credentials"

CredentialsProvider({
  id: "guest",
  name: "Guest Access",
  credentials: {},
  async authorize() {
    return {
      id: "guest",
      name: "Guest User",
      email: "guest@portal.local",
      role: "guest",
    }
  },
})
```

---

## 4. Database

### Chosen: **PostgreSQL with Prisma ORM**

| Criteria | Prisma | Drizzle | TypeORM | Knex |
|----------|--------|---------|---------|------|
| Type Safety | Excellent | Excellent | Good | Manual |
| Migrations | Built-in | Built-in | Built-in | Built-in |
| Performance | Good | Excellent | Moderate | Good |
| DX | Excellent | Good | Moderate | Good |
| Learning Curve | Low | Low | Moderate | Low |

**Why Prisma:**
- **Type-safe queries**: Generated types from schema
- **Excellent DX**: Prisma Studio for data exploration
- **Migrations**: Simple schema-first migrations
- **Connection pooling**: Built-in for serverless

**Multi-Tenancy Schema** (aligned with ARCHITECTURE track):

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Tenant isolation at database level
model Tenant {
  id          String   @id @default(uuid())
  name        String   @unique
  slug        String   @unique
  settings    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  clusters    Cluster[]
  deployments Deployment[]
  users       User[]

  @@index([slug])
}

model User {
  id          String     @id @default(uuid())
  email       String     @unique
  name        String
  role        UserRole   @default(VIEWER)

  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id])

  dashboards  Dashboard[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([tenantId])
  @@index([email])
}

model Cluster {
  id          String   @id @default(uuid())
  name        String
  kubeconfig  String   // Encrypted
  provider    String   // aws, gcp, azure, on-prem
  region      String?

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  deployments Deployment[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId])
}

model Deployment {
  id          String   @id @default(uuid())
  name        String
  status      String   // pending, running, completed, failed
  helmChart   Json     // { repository, version, values }

  clusterId   String
  cluster     Cluster  @relation(fields: [clusterId], references: [id])

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId])
  @@index([clusterId])
  @@index([status])
}

model Dashboard {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  layout      Json     @default("[]")
  isDefault   Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  widgets     Widget[]
}

model Widget {
  id          String    @id @default(uuid())
  dashboardId String
  dashboard   Dashboard @relation(fields: [dashboardId], references: [id])
  type        String    // github-prs, argocd-apps, metrics
  title       String
  config      Json      @default("{}")
  position    Json      @default("{\"x\": 0, \"y\": 0, \"w\": 4, \"h\": 2}")

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum UserRole {
  ADMIN
  DEVELOPER
  VIEWER
  GUEST
}
```

**Connection Pooling**:
```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection pool configuration (via DATABASE_URL)
// postgresql://user:password@localhost:5432/devops_portal?connection_limit=10&pool_timeout=30
```

**Note**: Schema subject to refinement by ARCHITECTURE track based on final tenancy decisions.

---

## 5. Caching & Queue

### Chosen: **Redis with BullMQ**

| Criteria | BullMQ | Bull | Agenda | pg-boss |
|----------|--------|------|--------|---------|
| Redis-based | Yes | Yes | No | No |
| TypeScript | Native | Wrapper | No | Yes |
| Performance | Excellent | Good | Good | Good |
| Features | Full | Full | Basic | Basic |
| EOC Alignment | Same pattern | Same | Different | Different |

**Why Redis + BullMQ:**
- **EOC Pattern**: Already proven in EOC
- **BullMQ**: Modern rewrite of Bull with better TypeScript
- **Multiple use cases**: Cache, sessions, queues

**Redis Configuration** (`lib/redis.ts`):
```typescript
import { Redis } from 'ioredis';
import { logger } from './logger';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error({ error: err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});
```

**BullMQ Queue Setup** (`lib/queue.ts`):
```typescript
import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';
import { logger } from './logger';

// Define job types
export interface DeploymentJob {
  deploymentId: string;
  clusterId: string;
  helmChart: {
    repository: string;
    version: string;
    values: Record<string, unknown>;
  };
}

// Create queue
export const deploymentQueue = new Queue<DeploymentJob>('deployments', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },
});

// Worker processor
export const deploymentWorker = new Worker<DeploymentJob>(
  'deployments',
  async (job: Job<DeploymentJob>) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing deployment');

    // Deployment logic here
    await deployHelmChart(job.data);

    logger.info({ jobId: job.id }, 'Deployment completed');
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

deploymentWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

deploymentWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Job failed');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await deploymentWorker.close();
  await deploymentQueue.close();
  await redis.quit();
});
```

**Caching Pattern:**
```typescript
// lib/cache.ts
import { redis } from './redis';

export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}

// Usage in API routes
const apps = await cached("argocd:apps", 60, () => argocd.getApplications())
```

---

## 6. API Layer

**Decision**: REST APIs with Zod validation for type-safe contracts

**Rationale**:
- Industry-standard REST patterns (familiar to all developers)
- Framework-agnostic (works with Next.js, Express, Fastify)
- OpenAPI generation possible via `zod-to-openapi`
- No vendor lock-in
- Easier debugging with standard HTTP tools

**Pattern**: Route Handlers + Zod schemas for validation + TypeScript inference

### 6.1 REST + Zod API Pattern

**File Structure**:
```
app/api/
  deployments/
    route.ts              # POST /api/deployments
    [id]/route.ts         # GET/PUT/DELETE /api/deployments/:id
  clusters/
    route.ts              # GET /api/clusters
  _lib/
    schemas.ts            # Shared Zod schemas
    response.ts           # Standardized response helpers
```

**Schema Definition** (`app/api/_lib/schemas.ts`):
```typescript
import { z } from 'zod';

// Input validation schema
export const createDeploymentSchema = z.object({
  name: z.string().min(3).max(50),
  clusterId: z.string().uuid(),
  helmChart: z.object({
    repository: z.string().url(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
  values: z.record(z.unknown()).optional(),
});

// Infer TypeScript type from schema
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;

// Response schema (optional, for documentation)
export const deploymentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  createdAt: z.string().datetime(),
});

export type DeploymentResponse = z.infer<typeof deploymentResponseSchema>;
```

**Route Handler** (`app/api/deployments/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createDeploymentSchema } from '../_lib/schemas';
import { successResponse, errorResponse } from '../_lib/response';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const parsed = createDeploymentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        'Validation failed',
        400,
        { errors: parsed.error.flatten().fieldErrors }
      );
    }

    const { data } = parsed;

    // Business logic (with type safety from Zod inference)
    const deployment = await prisma.deployment.create({
      data: {
        name: data.name,
        clusterId: data.clusterId,
        helmChart: data.helmChart,
        values: data.values,
        status: 'pending',
      },
    });

    logger.info({ deploymentId: deployment.id }, 'Deployment created');

    return successResponse(deployment, 201);

  } catch (error) {
    logger.error({ error }, 'Failed to create deployment');
    return errorResponse('Internal server error', 500);
  }
}
```

**Response Helpers** (`app/api/_lib/response.ts`):
```typescript
import { NextResponse } from 'next/server';

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function errorResponse(
  message: string,
  status = 500,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        ...details,
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
```

**Benefits**:
- Full type safety from request to database
- Runtime validation catches malformed inputs
- Schema serves as single source of truth
- Optional OpenAPI documentation generation
- No framework lock-in

### 6.2 HTTP Client Layer (ky)

**Library**: `ky` (9KB, fetch-based)

**Why ky over alternatives**:
- Built on native `fetch` (modern, standards-based)
- Automatic retry with exponential backoff
- Timeout handling built-in
- JSON parsing included
- Smaller bundle size vs axios (9KB vs 31KB)
- TypeScript-native

**Client Wrapper** (`lib/api-client.ts`):
```typescript
import ky, { HTTPError } from 'ky';
import { logger } from './logger';

// Base client with defaults
export const apiClient = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_API_URL || '',
  timeout: 30000, // 30 seconds
  retry: {
    limit: 3,
    methods: ['get', 'put', 'head', 'delete', 'options', 'trace'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    backoffLimit: 3000,
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // Add auth token
        const token = localStorage.getItem('auth_token');
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }

        // Add trace ID for correlation
        const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();
        request.headers.set('x-trace-id', traceId);

        logger.debug({ url: request.url, traceId }, 'API request');
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        const traceId = request.headers.get('x-trace-id');
        logger.debug({
          url: request.url,
          status: response.status,
          traceId
        }, 'API response');

        return response;
      },
    ],
  },
});

// Typed API calls with Zod validation
export async function createDeployment(
  data: CreateDeploymentInput
): Promise<DeploymentResponse> {
  try {
    const response = await apiClient.post('api/deployments', {
      json: data,
    }).json<{ success: true; data: DeploymentResponse }>();

    return response.data;

  } catch (error) {
    if (error instanceof HTTPError) {
      const errorBody = await error.response.json();
      logger.error({ error: errorBody }, 'API call failed');
      throw new Error(errorBody.error?.message || 'Request failed');
    }
    throw error;
  }
}

// Usage in components
async function handleSubmit(formData: CreateDeploymentInput) {
  try {
    const deployment = await createDeployment(formData);
    toast.success(`Deployment ${deployment.name} created`);
  } catch (error) {
    toast.error(error.message);
  }
}
```

**Error Handling Pattern**:
```typescript
// Centralized error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export async function handleApiError(error: unknown): Promise<never> {
  if (error instanceof HTTPError) {
    const body = await error.response.json();
    throw new ApiError(
      error.response.status,
      body.error?.message || 'Request failed',
      body.error
    );
  }

  throw new ApiError(500, 'Unknown error occurred');
}
```

---

## 7. State Management

### Chosen: **TanStack Query + Zustand**

| Criteria | TanStack Query | SWR | React Query |
|----------|---------------|-----|-------------|
| Caching | Excellent | Good | Same |
| DevTools | Excellent | Limited | Same |
| TypeScript | Excellent | Good | Same |
| Features | Full | Basic | Same |

**TanStack Query** for server state:
```typescript
// hooks/useArgoApps.ts
import { useQuery } from "@tanstack/react-query"

export function useArgoApps() {
  return useQuery({
    queryKey: ["argocd", "apps"],
    queryFn: async () => {
      const res = await fetch("/api/argocd/apps")
      return res.json()
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  })
}
```

**Zustand** for client state:
```typescript
// store/ui.ts
import { create } from "zustand"

interface UIStore {
  sidebarOpen: boolean
  theme: "light" | "dark"
  toggleSidebar: () => void
  setTheme: (theme: "light" | "dark") => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  theme: "dark",
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}))
```

---

## 8. Integration Clients

### GitHub: **Octokit**
```typescript
// lib/integrations/github.ts
import { Octokit } from "@octokit/rest"

export function createGitHubClient(token: string) {
  return new Octokit({
    auth: token,
    userAgent: "devops-portal/1.0.0",
  })
}
```

### ArgoCD: **Custom Client**
```typescript
// lib/integrations/argocd.ts
export class ArgoCDClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  async getApplications() {
    const res = await fetch(`${this.baseUrl}/api/v1/applications`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    return res.json()
  }

  async syncApplication(name: string) {
    const res = await fetch(`${this.baseUrl}/api/v1/applications/${name}/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    })
    return res.json()
  }
}
```

### Prometheus: **Custom Client**
```typescript
// lib/integrations/prometheus.ts
export class PrometheusClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async query(promql: string) {
    const res = await fetch(
      `${this.baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`
    )
    return res.json()
  }

  async queryRange(promql: string, start: Date, end: Date, step: string) {
    const params = new URLSearchParams({
      query: promql,
      start: start.toISOString(),
      end: end.toISOString(),
      step,
    })
    const res = await fetch(`${this.baseUrl}/api/v1/query_range?${params}`)
    return res.json()
  }
}
```

### Kubernetes: **@kubernetes/client-node**
```typescript
// lib/integrations/kubernetes.ts
import * as k8s from "@kubernetes/client-node"

export function createK8sClient() {
  const kc = new k8s.KubeConfig()
  kc.loadFromCluster() // In-cluster config
  
  return {
    core: kc.makeApiClient(k8s.CoreV1Api),
    apps: kc.makeApiClient(k8s.AppsV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
  }
}
```

---

## 9. Testing

### Unit Tests: **Vitest**
```typescript
// __tests__/utils.test.ts
import { describe, it, expect } from "vitest"
import { formatDuration } from "@/lib/utils"

describe("formatDuration", () => {
  it("formats seconds correctly", () => {
    expect(formatDuration(30)).toBe("30s")
  })
  
  it("formats minutes correctly", () => {
    expect(formatDuration(90)).toBe("1m 30s")
  })
})
```

### Integration Tests: **Playwright**
```typescript
// e2e/login.spec.ts
import { test, expect } from "@playwright/test"

test("should login with GitHub", async ({ page }) => {
  await page.goto("/login")
  await page.click('button:has-text("Sign in with GitHub")')
  // Mock OAuth flow in test environment
  await expect(page).toHaveURL("/dashboard")
})
```

---

## 10. Observability

### Chosen: **OpenTelemetry + Prometheus + Pino**

| Component | Tool | Purpose |
|-----------|------|---------|
| **Tracing** | OpenTelemetry SDK | Distributed traces |
| **Metrics** | Prometheus exporter | Application metrics |
| **Logging** | Pino | Structured JSON logs |
| **Visualization** | Grafana | Dashboards & alerts |

**OpenTelemetry Setup:**
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

**Pino Logger with Trace Correlation:**
```typescript
// lib/logger.ts
import pino from 'pino'
import { context, trace } from '@opentelemetry/api'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
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

**SLO Definitions:**
| SLO | Target | Metric |
|-----|--------|--------|
| API Latency (p99) | < 500ms | `http_request_duration_seconds` |
| Error Rate | < 1% | `http_requests_total{status=~"5.."}` |
| Availability | 99.9% | `up{job="devops-portal"}` |
| Queue Processing | < 30s | `bullmq_job_duration_seconds` |

---

## Complete Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 15 + React 19 + shadcn/ui + Tailwind + Tremor      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        API LAYER                             │
│  Next.js API Routes + REST + Zod + NextAuth v5              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
│  PostgreSQL (Prisma) + Redis (BullMQ) + Keycloak            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY                            │
│  OpenTelemetry + Prometheus + Pino + Grafana                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     INTEGRATIONS                             │
│  Octokit + ArgoCD Client + Prometheus + Grafana + K8s       │
└─────────────────────────────────────────────────────────────┘
```

---

---

## 11. Validated Decisions (Feb 2026)

Based on [12-SUGGESTION-VALIDATION-AND-REUSE.md](./12-SUGGESTION-VALIDATION-AND-REUSE.md) analysis:

### ✅ Validated for MVP

| Suggestion | Validation | Action |
|------------|------------|--------|
| p95 API <400ms | Industry standard (Google, AWS) | Adopt |
| p99 API <500ms | Typical CRUD target | Adopt |
| FCP <2s, LCP <2.5s, CLS <0.1 | Google Core Web Vitals | Adopt |
| REST + Zod (no tRPC) | Simpler, existing patterns | Adopt |
| Prisma ORM | DX > performance for our scale | Keep |
| Redis + BullMQ | EOC pattern, proven | Keep |
| Keycloak ≥26.1.5 | CVE-2025-2559 fix | Upgrade |
| NextAuth v5 | Server-side token storage | Adopt |
| Pino + OTel | Trace correlation | Adopt |
| axe-core CI | Accessibility testing | Adopt |
| Lighthouse CI | Performance budgets | Adopt |

### ⚠️ Deferred (Post-MVP)

| Suggestion | Reason | Timeline |
|------------|--------|----------|
| GitHub App | OAuth sufficient, setup complexity | Post-MVP |
| Feature Flags (Unleash) | Env vars sufficient for now | Post-MVP |
| PgBouncer | <50 connections expected | Monitor first |
| Chaos Drills | Manual testing sufficient | Post-MVP |
| Dark Mode | MVP is desktop-first, light theme | Post-MVP |
| Mobile Polish | Responsive basics, full polish later | Post-MVP |

### ⚡ Performance Budget Caveats

| Target | Realistic? | Notes |
|--------|------------|-------|
| Bulk ops 50 branches <60s | ⚠️ Optimistic | GitHub rate limits; plan for 2-3 min |
| p99 <500ms | ✅ Yes | Add Redis caching for hot paths |
| LCP <2.5s | ✅ Yes | Use `partial-prerendering` |

---

## 12. Multi-Tenancy Addition (Required for MVP)

Per suggestion validation, multi-tenancy is **P0**:

```prisma
// prisma/schema.prisma (ADDITIONS)
model Organization {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  settings    Json         @default("{}")
  members     Membership[]
  connectors  Connector[]
  bulkOps     BulkOperation[]
  auditLogs   AuditLog[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Membership {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  role           Role         @default(USER)
  createdAt      DateTime     @default(now())
  
  @@unique([userId, organizationId])
}

// Add to existing models:
// - User: memberships Membership[]
// - Connector: organizationId, organization
// - BulkOperation: organizationId, organization
// - AuditLog: organizationId, organization
```

**RLS Policy Example:**
```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

-- Policy using app.current_org_id set by middleware
CREATE POLICY org_isolation ON bulk_operations
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

---

## 13. Tailwind Config (From Existing Theme)

Migrate existing `theme.ts` colors to Tailwind:

```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Radiant Logic Brand (from existing theme.ts)
        'rl-navy': '#09143F',
        'rl-navy-light': '#0d1a4f',
        'rl-navy-dark': '#050a24',
        'rl-orange': '#e25a1a',
        'rl-orange-light': '#ff7a3d',
        'rl-orange-dark': '#b8460d',
        'rl-blue': '#2ea3f2',
        'rl-blue-light': '#5db7f5',
        'rl-green': '#00b12b',
        // Semantic aliases
        primary: '#09143F',
        secondary: '#e25a1a',
        accent: '#2ea3f2',
        success: '#00b12b',
      },
      fontFamily: {
        sans: ['"Open Sans"', 'Arial', 'sans-serif'],
      },
      // Design tokens (per UX doc)
      spacing: {
        'sidebar': '280px',
        'sidebar-collapsed': '64px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
```

---

*Next: [03-KEYCLOAK-INTEGRATION.md](./03-KEYCLOAK-INTEGRATION.md)*
