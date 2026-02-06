# DevOps Portal v2

Enterprise-grade DevOps management portal built with Next.js 15, featuring multi-tenancy, GitOps workflows, and comprehensive infrastructure management.

## Features

- **Multi-Tenant Architecture**: Organization-based isolation with Row Level Security
- **GitHub Integration**: Repository browsing, PR management, file editing
- **ArgoCD Integration**: Application sync, rollback, and health monitoring
- **Grafana Integration**: Dashboard embedding and metrics visualization
- **Bulk Operations**: Multi-branch updates with BullMQ job processing
- **Real-time Monitoring**: Health status, alerts, and activity tracking
- **Security First**: Keycloak SSO, encrypted token storage, comprehensive RBAC

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Auth**: NextAuth.js v5 with Keycloak
- **UI**: shadcn/ui + Tailwind CSS + Tremor charts
- **Validation**: Zod
- **Logging**: Pino + OpenTelemetry

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis 7+

### Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
# Build image
docker build -t devops-portal:v2 .

# Run
docker run -p 3000:3000 --env-file .env devops-portal:v2
```

### Kubernetes (Helm)

```bash
# Add dependencies
helm dependency update ./helm/devops-portal

# Install
helm install devops-portal ./helm/devops-portal \
  --namespace devops-portal \
  --create-namespace \
  -f values-production.yaml
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login)
│   ├── (dashboard)/       # Dashboard pages
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard-specific components
│   ├── github/            # GitHub integration components
│   ├── argocd/            # ArgoCD integration components
│   └── monitoring/        # Monitoring components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── prisma.ts          # Prisma client
│   ├── redis.ts           # Redis client + token storage
│   ├── queue.ts           # BullMQ configuration
│   ├── api.ts             # API utilities
│   ├── logger.ts          # Pino logger
│   ├── integrations/      # External service clients
│   └── validations/       # Zod schemas
├── hooks/                 # React hooks
├── store/                 # Zustand stores
└── types/                 # TypeScript types
```

## Environment Variables

See [.env.example](.env.example) for all configuration options.

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - NextAuth encryption secret
- `NEXTAUTH_URL` - Application URL

### Authentication

- `KEYCLOAK_ID`, `KEYCLOAK_SECRET`, `KEYCLOAK_ISSUER` - Keycloak OIDC
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth

### Integrations

- `ARGOCD_URL`, `ARGOCD_TOKEN` - ArgoCD API
- `GRAFANA_URL`, `GRAFANA_API_KEY` - Grafana API
- `PROMETHEUS_URL` - Prometheus API

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/github/repositories` | List repositories |
| GET | `/api/github/pull-requests` | List pull requests |
| POST | `/api/github/pull-requests` | Create pull request |
| GET | `/api/argocd/applications` | List ArgoCD apps |
| POST | `/api/argocd/applications/:name/sync` | Sync application |

## Security

- **Authentication**: Keycloak SSO + GitHub OAuth via NextAuth.js
- **Authorization**: Role-based (USER, READWRITE, ADMIN) with organization scoping
- **Token Storage**: AES-256-GCM encrypted in Redis (never exposed to client)
- **Rate Limiting**: Redis-based with configurable limits per endpoint type
- **Headers**: HSTS, CSP, X-Frame-Options, and more via Next.js config

## Contributing

1. Create a feature branch from `dev`
2. Make changes following the existing patterns
3. Run `npm run lint && npm run typecheck`
4. Create a PR targeting `dev`

## License

MIT
