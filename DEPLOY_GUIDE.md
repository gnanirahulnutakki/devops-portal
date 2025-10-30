# Backstage GitOps Portal - Deployment Guide

This guide provides comprehensive instructions for building Docker images and deploying the Backstage GitOps Portal to Kubernetes using Helm.

## Table of Contents

1. [Docker Build and Push](#docker-build-and-push)
2. [Kubernetes Deployment with Helm](#kubernetes-deployment-with-helm)
3. [Configuration](#configuration)
4. [Troubleshooting](#troubleshooting)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Docker Build and Push

### Prerequisites

- Docker installed and running
- Access to a container registry (Docker Hub, GitHub Container Registry, AWS ECR, etc.)
- Completed local development setup (see START_GUIDE.md)

### Build the Docker Image

```bash
# Navigate to project root
cd /path/to/backstage-gitops

# Build the Docker image
docker build -t backstage-gitops:latest .

# Or build with a specific version tag
docker build -t backstage-gitops:1.0.0 .
```

**Build Options:**

```bash
# Build with build args
docker build \
  --build-arg NODE_VERSION=24.1.0 \
  -t backstage-gitops:latest \
  .

# Build without cache (for clean builds)
docker build --no-cache -t backstage-gitops:latest .

# Multi-platform build (for ARM and x86)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t backstage-gitops:latest \
  .
```

### Tag and Push to Registry

#### Docker Hub

```bash
# Tag the image
docker tag backstage-gitops:latest your-dockerhub-username/backstage-gitops:latest
docker tag backstage-gitops:latest your-dockerhub-username/backstage-gitops:1.0.0

# Login to Docker Hub
docker login

# Push the image
docker push your-dockerhub-username/backstage-gitops:latest
docker push your-dockerhub-username/backstage-gitops:1.0.0
```

#### GitHub Container Registry (GHCR)

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag the image
docker tag backstage-gitops:latest ghcr.io/radiantlogic-saas/backstage-gitops:latest
docker tag backstage-gitops:latest ghcr.io/radiantlogic-saas/backstage-gitops:1.0.0

# Push the image
docker push ghcr.io/radiantlogic-saas/backstage-gitops:latest
docker push ghcr.io/radiantlogic-saas/backstage-gitops:1.0.0
```

#### AWS ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create repository (if not exists)
aws ecr create-repository --repository-name backstage-gitops

# Tag the image
docker tag backstage-gitops:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/backstage-gitops:latest

# Push the image
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/backstage-gitops:latest
```

### Test the Docker Image Locally

```bash
# Run with docker-compose (recommended)
docker-compose up -d

# Or run standalone
docker run -d \
  --name backstage-test \
  -p 7007:7007 \
  -e GITHUB_TOKEN=your_token \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=backstage \
  -e POSTGRES_PASSWORD=backstage \
  -e POSTGRES_DB=backstage \
  backstage-gitops:latest

# Check logs
docker logs -f backstage-test

# Test health check
curl http://localhost:7007/healthcheck

# Stop and remove
docker stop backstage-test
docker rm backstage-test
```

---

## Kubernetes Deployment with Helm

### Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured to access your cluster
- Helm 3.x installed
- Container image pushed to a registry
- Secrets and ConfigMaps prepared

### Step 1: Create Kubernetes Namespace

```bash
# Create namespace
kubectl create namespace backstage

# Or use a different namespace
kubectl create namespace devops-tools
```

### Step 2: Create Secrets

Create secrets for sensitive data:

```bash
# Create secret for GitHub token
kubectl create secret generic backstage-secrets \
  --namespace backstage \
  --from-literal=GITHUB_TOKEN='your_github_pat_token' \
  --from-literal=POSTGRES_PASSWORD='your_postgres_password' \
  --from-literal=ARGOCD_TOKEN='your_argocd_token' \
  --from-literal=GRAFANA_API_KEY='your_grafana_api_key'

# Verify secret
kubectl get secret backstage-secrets -n backstage
kubectl describe secret backstage-secrets -n backstage
```

**Using a secrets file:**

```bash
# Create secrets.yaml
cat <<EOF > secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: backstage-secrets
  namespace: backstage
type: Opaque
stringData:
  GITHUB_TOKEN: "ghp_your_github_token_here"
  POSTGRES_PASSWORD: "your_postgres_password"
  ARGOCD_TOKEN: "your_argocd_token"
  GRAFANA_API_KEY: "your_grafana_api_key"
EOF

# Apply secrets
kubectl apply -f secrets.yaml

# Delete the secrets file (security best practice)
shred -vfz -n 10 secrets.yaml  # Linux
rm -P secrets.yaml  # macOS
```

### Step 3: Configure Helm Values

Create a custom values file:

```bash
# Create custom-values.yaml
cat <<EOF > custom-values.yaml
# Custom values for production deployment

replicaCount: 2

image:
  repository: ghcr.io/radiantlogic-saas/backstage-gitops
  tag: "1.0.0"
  pullPolicy: IfNotPresent

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: backstage.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: backstage-tls
      hosts:
        - backstage.yourdomain.com

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

postgres:
  enabled: true
  storage:
    size: 20Gi
    storageClass: gp3

backstage:
  baseUrl: https://backstage.yourdomain.com

github:
  organization: your-org-name

argocd:
  enabled: true
  url: https://argocd.yourdomain.com

grafana:
  enabled: true
  url: https://your-org.grafana.net
EOF
```

### Step 4: Install with Helm

```bash
# Install the chart
helm install backstage-gitops ./helm \
  --namespace backstage \
  --values custom-values.yaml

# Or upgrade if already installed
helm upgrade --install backstage-gitops ./helm \
  --namespace backstage \
  --values custom-values.yaml

# With debug output
helm upgrade --install backstage-gitops ./helm \
  --namespace backstage \
  --values custom-values.yaml \
  --debug \
  --dry-run

# Remove --dry-run when ready to deploy
helm upgrade --install backstage-gitops ./helm \
  --namespace backstage \
  --values custom-values.yaml
```

### Step 5: Verify Deployment

```bash
# Check deployment status
kubectl get deployments -n backstage
kubectl get pods -n backstage
kubectl get services -n backstage
kubectl get ingress -n backstage

# Watch pod startup
kubectl get pods -n backstage -w

# Check pod logs
kubectl logs -f deployment/backstage-gitops -n backstage

# Check specific pod logs
POD_NAME=$(kubectl get pods -n backstage -l app.kubernetes.io/name=backstage-gitops -o jsonpath='{.items[0].metadata.name}')
kubectl logs -f $POD_NAME -n backstage

# Check events
kubectl get events -n backstage --sort-by='.lastTimestamp'
```

### Step 6: Access the Application

```bash
# Port forward for local access (testing)
kubectl port-forward -n backstage service/backstage-gitops 7007:80

# Access via browser
open http://localhost:7007

# Or use the ingress URL
open https://backstage.yourdomain.com
```

---

## Configuration

### Environment Variables

The application uses the following environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BACKSTAGE_BASE_URL` | Public URL of Backstage | Yes | - |
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes | - |
| `GITHUB_ORG` | GitHub organization name | Yes | - |
| `POSTGRES_HOST` | PostgreSQL host | Yes | - |
| `POSTGRES_PORT` | PostgreSQL port | Yes | 5432 |
| `POSTGRES_USER` | PostgreSQL username | Yes | backstage |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes | - |
| `POSTGRES_DB` | PostgreSQL database name | Yes | backstage |
| `ARGOCD_ENABLED` | Enable ArgoCD integration | No | false |
| `ARGOCD_URL` | ArgoCD API URL | No | - |
| `ARGOCD_TOKEN` | ArgoCD API token | No | - |
| `GRAFANA_ENABLED` | Enable Grafana integration | No | false |
| `GRAFANA_URL` | Grafana URL | No | - |
| `GRAFANA_API_KEY` | Grafana API key | No | - |
| `LOG_LEVEL` | Logging level | No | info |

### Helm Chart Configuration

Key configuration options in `values.yaml`:

```yaml
# Number of replicas
replicaCount: 2

# Image configuration
image:
  repository: your-registry/backstage-gitops
  tag: "1.0.0"

# Resource limits
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

# Auto-scaling
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 80

# PostgreSQL
postgres:
  enabled: true
  storage:
    size: 20Gi
    storageClass: gp3
```

### Update Configuration

```bash
# Update Helm values
helm upgrade backstage-gitops ./helm \
  --namespace backstage \
  --values custom-values.yaml \
  --reuse-values

# Update specific value
helm upgrade backstage-gitops ./helm \
  --namespace backstage \
  --set image.tag=1.0.1

# Update secrets
kubectl create secret generic backstage-secrets \
  --namespace backstage \
  --from-literal=GITHUB_TOKEN='new_token' \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment/backstage-gitops -n backstage
```

---

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n backstage <pod-name>

# Check logs
kubectl logs -n backstage <pod-name>

# Check events
kubectl get events -n backstage --sort-by='.lastTimestamp'
```

**Common causes:**
- Image pull errors (check image name and pull secrets)
- Missing secrets (check secret exists and has correct keys)
- Resource limits too low (increase CPU/memory limits)
- Health check failures (check /healthcheck endpoint)

#### 2. Database Connection Errors

```bash
# Check PostgreSQL pod
kubectl get pods -n backstage -l app=postgres

# Test database connectivity from backstage pod
kubectl exec -it -n backstage <backstage-pod> -- \
  sh -c 'apk add postgresql-client && \
  psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB'
```

**Solutions:**
- Verify POSTGRES_HOST points to correct service
- Check PostgreSQL pod is running
- Verify credentials in secrets
- Check network policies

#### 3. GitHub Integration Not Working

```bash
# Check GitHub token
kubectl get secret backstage-secrets -n backstage -o jsonpath='{.data.GITHUB_TOKEN}' | base64 -d

# Test GitHub API from pod
kubectl exec -it -n backstage <backstage-pod> -- \
  sh -c 'curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user'
```

**Solutions:**
- Verify token has correct permissions (repo, read:org, read:user)
- Check token hasn't expired
- Verify GITHUB_ORG is correct
- Check network egress rules

#### 4. Ingress Not Working

```bash
# Check ingress
kubectl describe ingress -n backstage

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Test service directly
kubectl port-forward -n backstage service/backstage-gitops 7007:80
```

**Solutions:**
- Verify ingress controller is installed
- Check DNS resolves to cluster
- Verify TLS certificate is valid
- Check ingress class name

### Debugging Commands

```bash
# Get all resources
kubectl get all -n backstage

# Describe deployment
kubectl describe deployment backstage-gitops -n backstage

# Check resource usage
kubectl top pods -n backstage

# Get pod shell
kubectl exec -it -n backstage <pod-name> -- /bin/sh

# Check environment variables
kubectl exec -it -n backstage <pod-name> -- env

# View configuration
kubectl get configmap backstage-config -n backstage -o yaml

# Export resources for debugging
kubectl get deployment backstage-gitops -n backstage -o yaml > deployment-debug.yaml
```

---

## Monitoring and Maintenance

### Health Checks

```bash
# Check health endpoint
curl https://backstage.yourdomain.com/healthcheck

# From within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://backstage-gitops.backstage.svc.cluster.local/healthcheck
```

### Logs

```bash
# Tail logs
kubectl logs -f -n backstage deployment/backstage-gitops

# Get logs from all replicas
kubectl logs -n backstage -l app.kubernetes.io/name=backstage-gitops --all-containers=true

# Export logs
kubectl logs -n backstage deployment/backstage-gitops --since=1h > backstage-logs.txt
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment backstage-gitops -n backstage --replicas=3

# Enable autoscaling
kubectl autoscale deployment backstage-gitops -n backstage \
  --cpu-percent=80 \
  --min=2 \
  --max=5

# Check HPA status
kubectl get hpa -n backstage
```

### Updates and Rollbacks

```bash
# Update image
kubectl set image deployment/backstage-gitops -n backstage \
  backstage-gitops=ghcr.io/radiantlogic-saas/backstage-gitops:1.0.1

# Check rollout status
kubectl rollout status deployment/backstage-gitops -n backstage

# View rollout history
kubectl rollout history deployment/backstage-gitops -n backstage

# Rollback to previous version
kubectl rollout undo deployment/backstage-gitops -n backstage

# Rollback to specific revision
kubectl rollout undo deployment/backstage-gitops -n backstage --to-revision=2
```

### Backup and Restore

#### Backup PostgreSQL

```bash
# Backup database
kubectl exec -n backstage <postgres-pod> -- \
  pg_dump -U backstage backstage > backstage-backup-$(date +%Y%m%d).sql

# Or use pg_dumpall for all databases
kubectl exec -n backstage <postgres-pod> -- \
  pg_dumpall -U backstage > backstage-full-backup-$(date +%Y%m%d).sql
```

#### Restore PostgreSQL

```bash
# Restore database
kubectl exec -i -n backstage <postgres-pod> -- \
  psql -U backstage backstage < backstage-backup-20250129.sql
```

### Cleanup

```bash
# Uninstall Helm chart
helm uninstall backstage-gitops -n backstage

# Delete namespace (removes all resources)
kubectl delete namespace backstage

# Delete PVCs (if needed)
kubectl delete pvc -n backstage --all
```

---

## Production Checklist

Before deploying to production:

- [ ] Docker image built and pushed to registry
- [ ] Secrets created with production credentials
- [ ] Custom values.yaml configured for production
- [ ] Ingress configured with valid domain and TLS
- [ ] Resource limits set appropriately
- [ ] Auto-scaling enabled
- [ ] Database backups configured
- [ ] Monitoring and alerting setup
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Security scan completed on Docker image
- [ ] Network policies configured
- [ ] RBAC policies reviewed

---

## Next Steps

- Review [Admin Guide](./docs/guides/admin-guide.md) for operational procedures
- Check [Troubleshooting Guide](./docs/guides/troubleshooting.md) for common issues
- See [API Reference](./docs/reference/api-reference.md) for automation

## Support

For issues or questions:
- Documentation: http://your-backstage-url/documentation
- Email: platform-team@radiantlogic.com
