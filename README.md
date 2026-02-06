# DevOps Portal v2
# README.md

Enterprise-grade DevOps Management Portal built with Next.js 15, React 19, and a modern security-first stack.

## Features

- **Dashboard**: Real-time overview of deployments, services, and infrastructure health
- **ArgoCD Integration**: Manage GitOps deployments, view sync status, and application health
- **Grafana Integration**: Embedded dashboards and monitoring
- **S3 Browser**: Browse, upload, and download files from S3/MinIO
- **Team Management**: Role-based access control with user management
- **Multi-tenant**: Organization-based isolation with RLS
- **GitHub OAuth**: Sign in with GitHub
- **Keycloak SSO**: Enterprise SSO integration

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Object Storage**: MinIO / AWS S3
- **Authentication**: NextAuth.js v5
- **Logging**: Pino

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

### Development Setup

1. **Clone and install dependencies:**

```bash
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal
npm install
```

2. **Start infrastructure:**

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- MinIO on ports 9000 (API) and 9001 (Console)

3. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Setup database:**

```bash
npm run db:migrate
npm run db:seed
```

5. **Start development server:**

```bash
npm run dev
```

6. **Open http://localhost:3000**

Default credentials: `admin@example.com` / `admin123`

### MinIO Console

Access MinIO Console at http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

## Kubernetes Deployment

### Helm Chart

The Helm chart includes all dependencies as sub-charts:
- PostgreSQL (Bitnami)
- Redis (Bitnami)
- MinIO (Bitnami)

#### Quick Install

```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Update dependencies
cd helm/devops-portal
helm dependency update

# Install (development)
helm install devops-portal . -f values-dev.yaml -n devops-portal --create-namespace

# Install (production)
helm install devops-portal . -f values-prod.yaml -n devops-portal --create-namespace
```

#### Sealed Secrets

For GitOps deployments, use sealed secrets:

```bash
# Generate secrets
cd helm/devops-portal/scripts
./generate-secrets.sh devops-portal kube-system

# Apply sealed secrets
kubectl apply -f sealed-secrets/ -n devops-portal
```

#### Integration Configuration

Configure internal service URLs in values.yaml:

```yaml
integrations:
  argocd:
    url: "https://argocd-server.argocd.svc.cluster.local"
  grafana:
    url: "http://grafana.monitoring.svc.cluster.local:3000"
  prometheus:
    url: "http://prometheus-server.monitoring.svc.cluster.local:80"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Ingress                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  DevOps Portal                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Next.js App                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │   │
│  │  │   Pages    │  │    API     │  │   Auth     │      │   │
│  │  │ (React 19) │  │  Routes    │  │ (NextAuth) │      │   │
│  │  └────────────┘  └────────────┘  └────────────┘      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼───────┐ ┌───▼───┐ ┌──────▼──────┐
│  PostgreSQL   │ │ Redis │ │ MinIO / S3  │
│   (Prisma)    │ │       │ │             │
└───────────────┘ └───────┘ └─────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get session

### Users
- `GET /api/users` - List organization users
- `POST /api/users` - Create user (admin only)
- `PATCH /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Remove user (admin only)

### ArgoCD
- `GET /api/argocd/applications` - List applications
- `GET /api/argocd/applications/:name` - Get application details
- `POST /api/argocd/applications/:name/sync` - Trigger sync

### Grafana
- `GET /api/grafana/dashboards` - List dashboards
- `GET /api/grafana/datasources` - List datasources

### Storage (S3)
- `GET /api/storage/s3` - List objects
- `POST /api/storage/s3` - Generate signed URL
- `DELETE /api/storage/s3` - Delete object

## Role-Based Access Control

| Role | Description |
|------|-------------|
| `ADMIN` | Full access, can manage users and settings |
| `READWRITE` | Can create/edit resources, upload files |
| `USER` | Read-only access, can download files |

## Environment Variables

See [.env.example](.env.example) for all configuration options.

Key variables:
- `ENABLE_CREDENTIALS_AUTH` - Enable email/password login
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `S3_ENDPOINT` - MinIO/S3 endpoint
- `ARGOCD_URL` - ArgoCD server URL
- `GRAFANA_URL` - Grafana URL

## Development

### Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset database

# Docker
docker-compose up -d              # Start infrastructure
docker-compose --profile tools up # Start with pgAdmin & Redis Commander
docker-compose down               # Stop all services
```

### Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/         # Auth pages (login)
│   │   ├── (dashboard)/    # Dashboard pages
│   │   └── api/            # API routes
│   ├── components/         # React components
│   │   └── ui/            # shadcn/ui components
│   ├── hooks/              # React hooks
│   ├── lib/               # Utilities and services
│   └── middleware.ts      # NextAuth middleware
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeder
├── helm/
│   └── devops-portal/     # Helm chart
├── docker-compose.yml     # Local infrastructure
└── package.json
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests
5. Submit a pull request
