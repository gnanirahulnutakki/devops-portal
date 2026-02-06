# DevOps Portal v2

Enterprise-grade DevOps management portal built with Next.js 15, featuring multi-tenant support, GitOps integration (ArgoCD), and comprehensive monitoring (Grafana).

## Features

- **Multi-Tenant Architecture**: Full organization isolation with Row-Level Security (RLS)
- **Authentication**: Keycloak SSO, GitHub OAuth, or credentials-based login
- **GitOps Integration**: ArgoCD application management and deployment tracking
- **Monitoring**: Grafana dashboard embedding and alerting
- **S3 Browser**: AWS S3 file browser with secure access
- **Observability**: OpenTelemetry, Prometheus metrics, structured logging

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS + shadcn/ui
- **Observability**: OpenTelemetry, Pino, Prometheus

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

### Quick Start (Development)

1. **Clone and install dependencies**:
   ```bash
   cd v2
   npm install
   ```

2. **Start infrastructure**:
   ```bash
   docker compose up -d
   ```

3. **Set up environment**:
   ```bash
   cp .env.local .env
   # Edit .env with your settings
   ```

4. **Initialize database**:
   ```bash
   npm run db:push
   npm run db:setup-rls
   npm run db:seed
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Access the portal**:
   - URL: http://localhost:3000
   - Login: `admin@example.com` / `admin123`

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `NEXTAUTH_SECRET` | Auth encryption key (32+ chars) | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `TOKEN_ENCRYPTION_KEY` | Token encryption key (32 chars) | Yes |
| `KEYCLOAK_ID` | Keycloak client ID | For SSO |
| `KEYCLOAK_SECRET` | Keycloak client secret | For SSO |
| `KEYCLOAK_ISSUER` | Keycloak issuer URL | For SSO |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | For GitHub |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | For GitHub |
| `ARGOCD_URL` | ArgoCD server URL | For ArgoCD |
| `ARGOCD_TOKEN` | ArgoCD API token | For ArgoCD |
| `GRAFANA_URL` | Grafana server URL | For Monitoring |
| `GRAFANA_API_KEY` | Grafana service account key | For Monitoring |
| `S3_BUCKET` | S3 bucket name | For S3 Browser |
| `AWS_ACCESS_KEY_ID` | AWS access key | For S3 Browser |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | For S3 Browser |
| `AWS_REGION` | AWS region | For S3 Browser |

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript check
npm run test         # Run tests
npm run test:coverage # Run tests with coverage
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with test data
npm run db:setup-rls # Set up Row-Level Security
```

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, select-org)
│   ├── (dashboard)/       # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard components
│   └── monitoring/        # Grafana/monitoring components
├── lib/                   # Core utilities
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── redis.ts          # Redis client
│   ├── api.ts            # API utilities
│   ├── tenant-context.ts # Tenant isolation
│   └── services/         # Business logic
└── test/                  # Test utilities
```

## Security

- **Multi-tenancy**: AsyncLocalStorage-based tenant context with RLS
- **Authentication**: JWT with membership claims
- **Authorization**: Role-based access (USER, ADMIN, OWNER)
- **Rate Limiting**: Redis-based per-org rate limiting
- **Token Security**: AES-256-GCM encrypted token storage
- **Headers**: CSP, HSTS, X-Frame-Options, etc.

## Monitoring

### Metrics Endpoint

Prometheus metrics available at `/api/metrics`:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `queue_depth` - Background job queue depth
- `tenant_operations_total` - Tenant operations
- `rate_limit_hits_total` - Rate limit events

### Health Check

Health endpoint at `/api/health`:

```bash
curl http://localhost:3000/api/health
```

## Docker Deployment

```bash
# Build image
docker build -t devops-portal:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="http://localhost:3000" \
  devops-portal:latest
```

## Kubernetes Deployment

See the `/helm` directory for Helm charts (coming soon).

## Contributing

1. Create a feature branch from `dev`
2. Make your changes
3. Run tests: `npm test`
4. Run lint: `npm run lint`
5. Submit a pull request

## License

Proprietary - RadiantLogic, Inc.
