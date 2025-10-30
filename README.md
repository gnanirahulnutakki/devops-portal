# Backstage GitOps Management Portal

A Backstage plugin for managing multi-branch GitOps configurations with ArgoCD integration.

## 🎯 Problem Solved

Manage 350+ deployment branches across 35+ repositories from a single UI, reducing update time from **4-6 hours to <15 minutes**.

## ✨ Features

- **Multi-Branch File Management** - Edit and commit files across multiple branches simultaneously
- **Monaco Editor Integration** - VS Code-like editing experience with YAML validation
- **ArgoCD Integration** - View and sync applications directly from the UI
- **Audit Trail** - Complete history of all changes with diffs
- **GitHub OAuth** - Secure authentication with GitHub
- **Bulk Operations** - Update 50+ branches in parallel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Kubernetes cluster (for deployment)
- GitHub Personal Access Token
- ArgoCD instance (optional for sync features)

### Installation

```bash
# Navigate to the project
cd backstage-gitops

# Install dependencies
yarn install

# Setup environment variables
# Create .env file with your tokens:
#   GITHUB_TOKEN=your_github_pat_token
#   POSTGRES_HOST=localhost
#   POSTGRES_PORT=5432
#   POSTGRES_USER=backstage
#   POSTGRES_PASSWORD=backstage
#   POSTGRES_DB=backstage

# Start PostgreSQL (if not already running)
# macOS: brew services start postgresql@14
# Linux: sudo systemctl start postgresql

# Start development server with environment variables
./start-with-env.sh
```

**⚠️ Important**: Always use `./start-with-env.sh` to start the portal. This ensures GitHub tokens and environment variables are properly loaded. Using `yarn dev` directly will result in mock data mode.

**For detailed startup instructions, see [START_GUIDE.md](./START_GUIDE.md)**

### Access

- **Frontend:** http://localhost:3000/gitops
- **Backend API:** http://localhost:7007/api/gitops

## 📦 Project Structure

```
backstage-gitops/
├── packages/
│   ├── app/                      # Frontend application
│   └── backend/                  # Backend application
├── plugins/
│   ├── gitops/                   # Frontend plugin
│   └── gitops-backend/           # Backend plugin
├── deployment/
│   ├── helm/                     # Helm chart for Kubernetes
│   └── docker/                   # Docker and Docker Compose
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── app-config.yaml              # Backstage configuration
└── start-with-env.sh            # Development startup script
```

## 🔧 Configuration

```yaml
# app-config.yaml
gitops:
  github:
    organization: radiantlogic-saas
    token: ${GITHUB_TOKEN}
  argocd:
    url: https://argocd.radiantlogic.com
    token: ${ARGOCD_TOKEN}
```

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test --coverage

# Run backend tests only
yarn workspace @internal/plugin-gitops-backend test

# Run frontend tests only
yarn workspace @internal/plugin-gitops test
```

## 🚢 Deployment

The Backstage GitOps Portal can be deployed using Docker and Kubernetes/Helm.

### Quick Docker Deployment

```bash
# Build the Docker image
docker build -f deployment/docker/Dockerfile -t backstage-gitops:latest .

# Run with Docker Compose (includes PostgreSQL)
docker-compose -f deployment/docker/docker-compose.yml up -d

# Check logs
docker-compose -f deployment/docker/docker-compose.yml logs -f backstage
```

**📖 Full Docker Guide:** [deployment/docker/README.md](deployment/docker/README.md)

### Kubernetes Deployment with Helm

```bash
# Step 1: Create namespace
kubectl create namespace backstage

# Step 2: Create secrets
kubectl create secret generic backstage-secrets \
  --namespace backstage \
  --from-literal=GITHUB_TOKEN='your_github_pat_token' \
  --from-literal=POSTGRES_PASSWORD='your_postgres_password' \
  --from-literal=ARGOCD_TOKEN='your_argocd_token'

# Step 3: Install with Helm
helm install backstage-gitops ./deployment/helm \
  --namespace backstage \
  --values deployment/helm/values-qa.yaml

# Step 4: Verify deployment
kubectl get pods -n backstage
kubectl logs -f deployment/backstage-gitops -n backstage
```

**📖 Full Helm Guide:** [deployment/helm/README.md](deployment/helm/README.md)

### Production Deployment

For comprehensive deployment instructions including:
- Multi-registry Docker image publishing (Docker Hub, GHCR, AWS ECR)
- Production Helm configurations
- Ingress and TLS setup
- Resource limits and autoscaling
- Database backups and disaster recovery
- Monitoring and troubleshooting

**See the complete [Deployment Guide](./DEPLOY_GUIDE.md)**

## 📖 Documentation

### Getting Started
- **[Startup Guide](./START_GUIDE.md)** - How to start with GitHub integration (READ THIS FIRST!)
- [User Guide](./docs/guides/user-guide.md) - Daily usage and operations
- [Quick Start](./docs/getting-started.md) - Get up and running

### Deployment
- **[Deployment Guide](./DEPLOY_GUIDE.md)** - Docker build, Helm installation, Kubernetes deployment

### Administration
- [Admin & Operations Guide](./docs/guides/admin-guide.md) - Installation, deployment, security
- [Troubleshooting Guide](./docs/guides/troubleshooting.md) - Common issues and solutions
- [Bulk Operations Guide](./docs/guides/bulk-operations.md) - Mass update procedures

### Reference
- [API Reference](./docs/reference/api-reference.md) - REST API documentation
- [FAQ](./docs/reference/faq.md) - Frequently asked questions
- [Documentation Index](./docs/README.md) - Complete documentation overview

### In-App Documentation
Complete documentation is also available at http://localhost:3000/documentation when the portal is running.

### Implementation Details
- [Implementation Roadmap](../backstage-implementation/05-IMPLEMENTATION-ROADMAP.md)
- [Architecture](../backstage-implementation/03-ARCHITECTURE.md)
- [Requirements](../backstage-implementation/02-REQUIREMENTS.md)
- [Knowledge Base](../backstage-implementation/04-KNOWLEDGE-BASE.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 👥 Team

Platform Engineering Team @ RadiantLogic

## 🐛 Issues

Report issues at: https://github.com/radiantlogic-saas/backstage-gitops/issues
