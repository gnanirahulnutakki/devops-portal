# Backstage GitOps Portal - Docker Deployment

This directory contains Docker configuration files for building and running the Backstage GitOps Portal.

## 📋 Contents

- **Dockerfile** - Multi-stage production-ready Docker image
- **docker-compose.yml** - Local development setup with PostgreSQL
- **.dockerignore** - Files to exclude from Docker build

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for Docker
- GitHub Personal Access Token

### Option 1: Using Docker Compose (Recommended for Local Development)

```bash
# Navigate to project root
cd /path/to/backstage-gitops

# Create .env file with your credentials
cp .env.example .env
# Edit .env and add your tokens

# Start all services
docker-compose -f deployment/docker/docker-compose.yml up -d

# View logs
docker-compose -f deployment/docker/docker-compose.yml logs -f

# Access the portal
open http://localhost:7007
```

### Option 2: Build and Run Manually

```bash
# Build the image
docker build -f deployment/docker/Dockerfile -t backstage-gitops:latest .

# Run PostgreSQL
docker run -d \
  --name backstage-postgres \
  -e POSTGRES_USER=backstage \
  -e POSTGRES_PASSWORD=backstage \
  -e POSTGRES_DB=backstage \
  -p 5432:5432 \
  postgres:14-alpine

# Run Backstage
docker run -d \
  --name backstage-gitops \
  -p 7007:7007 \
  -e GITHUB_TOKEN=your_github_token \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=backstage \
  -e POSTGRES_PASSWORD=backstage \
  -e POSTGRES_DB=backstage \
  backstage-gitops:latest

# Check logs
docker logs -f backstage-gitops
```

## 🏗️ Building the Docker Image

### Production Build

```bash
# Build for production
docker build \
  -f deployment/docker/Dockerfile \
  -t backstage-gitops:latest \
  --target production \
  .

# Build with specific version
docker build \
  -f deployment/docker/Dockerfile \
  -t backstage-gitops:v1.0.0 \
  --build-arg NODE_VERSION=20 \
  .

# Build without cache (clean build)
docker build \
  -f deployment/docker/Dockerfile \
  -t backstage-gitops:latest \
  --no-cache \
  .
```

### Multi-Platform Build

```bash
# Build for both AMD64 and ARM64
docker buildx create --name multiarch --use
docker buildx build \
  -f deployment/docker/Dockerfile \
  --platform linux/amd64,linux/arm64 \
  -t backstage-gitops:latest \
  --push \
  .
```

### Build Arguments

The Dockerfile supports these build arguments:

```dockerfile
ARG NODE_VERSION=20        # Node.js version
ARG PYTHON_VERSION=3.11    # Python version (for node-gyp)
ARG UID=1000              # User ID for security
ARG GID=1000              # Group ID for security
```

Example with custom arguments:

```bash
docker build \
  -f deployment/docker/Dockerfile \
  --build-arg NODE_VERSION=24 \
  --build-arg UID=1001 \
  -t backstage-gitops:latest \
  .
```

## 📦 Push to Registry

### Docker Hub

```bash
# Tag image
docker tag backstage-gitops:latest yourusername/backstage-gitops:latest
docker tag backstage-gitops:latest yourusername/backstage-gitops:v1.0.0

# Login
docker login

# Push
docker push yourusername/backstage-gitops:latest
docker push yourusername/backstage-gitops:v1.0.0
```

### GitHub Container Registry (GHCR)

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag image
docker tag backstage-gitops:latest ghcr.io/gnanirahulnutakki/backstage-gitops:latest
docker tag backstage-gitops:latest ghcr.io/gnanirahulnutakki/backstage-gitops:v1.0.0

# Push
docker push ghcr.io/gnanirahulnutakki/backstage-gitops:latest
docker push ghcr.io/gnanirahulnutakki/backstage-gitops:v1.0.0
```

### AWS ECR

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create repository (first time only)
aws ecr create-repository \
  --repository-name backstage-gitops \
  --region us-east-1

# Tag image
docker tag backstage-gitops:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/backstage-gitops:latest

# Push
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/backstage-gitops:latest
```

## 🔧 Docker Compose Configuration

### Development Setup

The `docker-compose.yml` includes:

```yaml
services:
  backstage:
    # Backstage application
    - Port: 7007
    - Auto-restart on failure
    - Environment variables from .env
    - Depends on postgres

  postgres:
    # PostgreSQL database
    - Port: 5432
    - Persistent data volume
    - Health checks
```

### Environment Variables

Required in `.env` file:

```bash
# GitHub Integration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx          # GitHub PAT
GITHUB_ORG=your-organization            # GitHub organization

# Database
POSTGRES_HOST=postgres                  # Use 'postgres' for docker-compose
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage
POSTGRES_DB=backstage

# Optional: ArgoCD
ARGOCD_URL=https://argocd.example.com
ARGOCD_TOKEN=your_argocd_token

# Optional: Grafana
GRAFANA_URL=https://your-org.grafana.net
GRAFANA_API_KEY=your_grafana_key
```

### Docker Compose Commands

```bash
# Start services
docker-compose -f deployment/docker/docker-compose.yml up -d

# View logs
docker-compose -f deployment/docker/docker-compose.yml logs -f backstage
docker-compose -f deployment/docker/docker-compose.yml logs -f postgres

# Stop services
docker-compose -f deployment/docker/docker-compose.yml stop

# Stop and remove containers
docker-compose -f deployment/docker/docker-compose.yml down

# Stop and remove containers + volumes (data will be lost!)
docker-compose -f deployment/docker/docker-compose.yml down -v

# Restart specific service
docker-compose -f deployment/docker/docker-compose.yml restart backstage

# Rebuild and start
docker-compose -f deployment/docker/docker-compose.yml up -d --build
```

## 🔍 Verify Deployment

### Health Checks

```bash
# Check if container is running
docker ps | grep backstage-gitops

# Check application health
curl http://localhost:7007/healthcheck

# Expected response:
# {"status":"ok"}
```

### View Logs

```bash
# Docker Compose
docker-compose -f deployment/docker/docker-compose.yml logs -f

# Standalone Docker
docker logs -f backstage-gitops

# Last 100 lines
docker logs --tail 100 backstage-gitops

# Since last hour
docker logs --since 1h backstage-gitops
```

### Inspect Container

```bash
# Container details
docker inspect backstage-gitops

# Container stats (CPU, Memory)
docker stats backstage-gitops

# Execute command in container
docker exec -it backstage-gitops /bin/sh

# Check environment variables
docker exec backstage-gitops env | grep GITHUB
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker logs backstage-gitops

# Common issues:
# ❌ Database connection refused
#    → Ensure PostgreSQL is running
#    → Check POSTGRES_HOST value
# ❌ GitHub token invalid
#    → Verify GITHUB_TOKEN in .env
# ❌ Port already in use
#    → Change port mapping: -p 8080:7007
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test PostgreSQL connection
docker exec -it backstage-postgres psql -U backstage -d backstage

# Check PostgreSQL logs
docker logs backstage-postgres

# Verify connection from backstage container
docker exec -it backstage-gitops sh -c \
  'nc -zv $POSTGRES_HOST $POSTGRES_PORT'
```

### Image Build Failures

```bash
# Check Docker disk space
docker system df

# Clean up unused resources
docker system prune -a

# Build with verbose output
docker build -f deployment/docker/Dockerfile --progress=plain -t backstage-gitops:latest .

# Check build logs
docker build -f deployment/docker/Dockerfile -t backstage-gitops:latest . 2>&1 | tee build.log
```

### Permission Issues

```bash
# Run as different user
docker run -d \
  --name backstage-gitops \
  --user 1000:1000 \
  -p 7007:7007 \
  backstage-gitops:latest

# Fix file permissions (if mounted volumes)
docker exec -u root backstage-gitops chown -R 1000:1000 /app
```

## 🔐 Security Best Practices

### 1. Never Hardcode Secrets

❌ **Bad:**
```dockerfile
ENV GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

✅ **Good:**
```bash
docker run -e GITHUB_TOKEN=${GITHUB_TOKEN} backstage-gitops:latest
```

### 2. Run as Non-Root User

The Dockerfile already includes:
```dockerfile
USER 1000:1000
```

### 3. Use Secret Management

```bash
# Docker Swarm Secrets
echo "ghp_xxxxxxxxxxxxx" | docker secret create github_token -
docker service create \
  --secret github_token \
  backstage-gitops:latest

# Kubernetes Secrets (recommended for production)
# See ../helm/README.md
```

### 4. Scan Images for Vulnerabilities

```bash
# Using Trivy
trivy image backstage-gitops:latest

# Using Docker Scout
docker scout cves backstage-gitops:latest

# Using Snyk
snyk container test backstage-gitops:latest
```

## 📊 Monitoring

### Container Metrics

```bash
# Real-time stats
docker stats backstage-gitops

# Memory usage
docker stats backstage-gitops --no-stream --format "{{.MemUsage}}"

# CPU usage
docker stats backstage-gitops --no-stream --format "{{.CPUPerc}}"
```

### Application Metrics

```bash
# Prometheus metrics endpoint
curl http://localhost:7007/metrics

# Health check
curl http://localhost:7007/healthcheck

# API endpoints
curl http://localhost:7007/api/gitops/health
```

## 🗑️ Cleanup

### Remove Containers

```bash
# Stop and remove backstage
docker stop backstage-gitops
docker rm backstage-gitops

# Using Docker Compose
docker-compose -f deployment/docker/docker-compose.yml down

# Remove with volumes (data will be lost!)
docker-compose -f deployment/docker/docker-compose.yml down -v
```

### Remove Images

```bash
# Remove specific image
docker rmi backstage-gitops:latest

# Remove all backstage images
docker images | grep backstage-gitops | awk '{print $3}' | xargs docker rmi

# Remove dangling images
docker image prune
```

### Complete Cleanup

```bash
# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune -a

# Remove all unused volumes
docker volume prune

# Complete system cleanup
docker system prune -a --volumes
```

## 📚 Additional Resources

- **Main Documentation**: [../../README.md](../../README.md)
- **Helm Deployment**: [../helm/README.md](../helm/README.md)
- **Deployment Guide**: [../../DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md)
- **Troubleshooting**: [../../docs/guides/troubleshooting.md](../../docs/guides/troubleshooting.md)

## 🤝 Support

For issues or questions:
- **GitHub Issues**: https://github.com/gnanirahulnutakki/devops-portal/issues
- **Docker Hub**: https://hub.docker.com/r/yourusername/backstage-gitops
- **Email**: platform-team@radiantlogic.com

## 📝 Dockerfile Information

### Image Layers
1. **Base Image**: Node.js 20-alpine
2. **Dependencies**: System packages, Python, build tools
3. **Application**: Source code and npm packages
4. **Build**: TypeScript compilation
5. **Runtime**: Minimal production image

### Image Size
- **Development**: ~2.5 GB (includes build tools)
- **Production**: ~800 MB (optimized)

### Exposed Ports
- **7007**: Backstage application (HTTP)

### Health Check
- **Endpoint**: /healthcheck
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## 🔖 Version History

### Version 1.0.0
- Initial Docker setup
- Multi-stage production build
- Docker Compose for local development
- PostgreSQL integration
- Health checks and security hardening
