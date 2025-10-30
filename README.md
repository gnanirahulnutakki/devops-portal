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

**For detailed startup instructions, see [Development Guide](docs/development/START_GUIDE.md)**

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

**See the complete [Deployment Guide](docs/deployment/DEPLOY_GUIDE.md)**

## 📖 Documentation

### 📚 Complete Documentation Index
**[Documentation Index](docs/index.md)** - Complete documentation organized by topic and audience

### Getting Started
- **[Development Guide](docs/development/START_GUIDE.md)** - How to start with GitHub integration (READ THIS FIRST!)
- **[Quickstart](docs/deployment/QUICKSTART.md)** - Get up and running in 5 minutes
- [User Guide](docs/guides/user-guide.md) - Daily usage and operations
- [Getting Started](docs/getting-started.md) - New user guide

### Deployment
- **[Complete Deployment Guide](docs/deployment/DEPLOY_GUIDE.md)** - Docker build, Helm installation, Kubernetes deployment
- **[Quick Deploy Guide](docs/deployment/QUICK_DEPLOY.md)** - Fast deployment for testing
- [Helm Chart Documentation](deployment/helm/README.md) - Kubernetes Helm deployment
- [Docker Documentation](deployment/docker/README.md) - Docker and Docker Compose

### Architecture & Design
- [Production Architecture](docs/architecture/PRODUCTION-ARCHITECTURE.md) - Production deployment architecture
- [Project Structure](docs/architecture/PROJECT-STRUCTURE.md) - Codebase organization
- [Infrastructure Analysis](docs/architecture/RLI-USE2-ANALYSIS.md) - RLI USE2 cluster analysis

### Operations & Administration
- [Admin & Operations Guide](docs/guides/admin-guide.md) - Installation, deployment, security
- [Security & Reliability](docs/operations/SECURITY_AND_RELIABILITY.md) - Security best practices
- [Troubleshooting Guide](docs/guides/troubleshooting.md) - Common issues and solutions
- [Bulk Operations Guide](docs/guides/bulk-operations.md) - Mass update procedures

### Development
- [Implementation Status](docs/development/IMPLEMENTATION-STATUS.md) - Current development progress
- [Next Steps](docs/development/NEXT-STEPS.md) - Planned features and roadmap
- [Mock Data Testing](docs/development/MOCK_DATA_TESTING_GUIDE.md) - Testing with mock data
- [PR Integration](docs/development/PR_INTEGRATION_SUMMARY.md) - Pull request workflow

### API Reference
- [API Reference](docs/reference/api-reference.md) - REST API documentation
- [FAQ](docs/reference/faq.md) - Frequently asked questions

### In-App Documentation
Complete documentation is also available at http://localhost:3000/documentation when the portal is running.

## 🔄 Continuous Integration

### Automated Docker Builds

Every push to `main` or `develop` automatically:
- ✅ Builds Docker image
- ✅ Pushes to Docker Hub: `rahulnutakki/devprotal`
- ✅ Creates multiple tags (latest, branch, SHA, date)
- ✅ Scans for security vulnerabilities
- ✅ Updates GitHub Security tab

**Docker Hub:** https://hub.docker.com/r/rahulnutakki/devprotal

**Pull latest image:**
```bash
docker pull rahulnutakki/devprotal:latest
```

**GitHub Actions:** [View Workflows](.github/workflows/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
6. GitHub Actions will automatically build and validate your changes

## 📝 License

MIT License - see LICENSE file for details

## 👥 Team

Platform Engineering Team @ RadiantLogic

## 🐛 Issues

Report issues at: https://github.com/radiantlogic-saas/backstage-gitops/issues

