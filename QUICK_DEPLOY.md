# Quick Deployment Guide - QA Environment

This guide provides quick steps to deploy Backstage GitOps Portal to the QA cluster.

## Prerequisites

✅ All prerequisites are already configured:
- Kubernetes namespace: `duploservices-qa4`
- Secrets created: `backstage-secrets`
- Helm chart ready: `./helm`
- QA values file: `helm/values-qa.yaml`

## Deployment Issue

⚠️ **Current Status**: Docker build is failing due to network connectivity issues (TLS handshake timeout with Docker Hub).

## Option 1: Automated Deployment (Recommended)

Once Docker Hub connectivity is restored, use the automated script:

```bash
./deploy-to-qa.sh
```

This script will:
1. Build the Docker image
2. Push to Docker Hub (rahulnutakki/devprotal:latest)
3. Deploy with Helm to QA cluster
4. Verify the deployment

## Option 2: Manual Step-by-Step

### Step 1: Build Docker Image

```bash
# Build the image
docker build -t rahulnutakki/devprotal:latest .

# Verify the build
docker images | grep devprotal
```

### Step 2: Push to Docker Hub

```bash
# Login to Docker Hub (if not already logged in)
docker login

# Push the image
docker push rahulnutakki/devprotal:latest
```

### Step 3: Deploy to Kubernetes

```bash
# Set kubeconfig
export KUBECONFIG=/Users/nutakki/Documents/cloud-2025/kubeconfigs/qa-self-managed/duploinfra-qa-self-managed-kubeconfig.yaml

# Verify access
kubectl get namespace duploservices-qa4

# Deploy with Helm
helm upgrade --install backstage-gitops ./helm \
  --namespace duploservices-qa4 \
  --values helm/values-qa.yaml \
  --wait
```

### Step 4: Verify Deployment

```bash
# Check pods
kubectl get pods -n duploservices-qa4 -l app.kubernetes.io/name=backstage-gitops

# Check logs
kubectl logs -f deployment/backstage-gitops -n duploservices-qa4

# Check all resources
kubectl get all -n duploservices-qa4 -l app.kubernetes.io/name=backstage-gitops
```

### Step 5: Access the Application

```bash
# Port forward to local machine
kubectl port-forward -n duploservices-qa4 service/backstage-gitops 7007:80

# Open in browser
open http://localhost:7007
```

## Option 3: Build on Different Machine

If Docker Hub connectivity issues persist on your current machine:

1. **Copy files to machine with better connectivity:**
   ```bash
   tar -czf backstage-deployment.tar.gz \
     Dockerfile .dockerignore \
     package.json yarn.lock \
     packages plugins \
     app-config.yaml app-config.production.yaml \
     docs helm
   ```

2. **On the other machine:**
   ```bash
   tar -xzf backstage-deployment.tar.gz
   docker build -t rahulnutakki/devprotal:latest .
   docker push rahulnutakki/devprotal:latest
   ```

3. **Then deploy from any machine with kubectl access:**
   ```bash
   ./deploy-to-qa.sh
   ```

## Troubleshooting Docker Build

### Network Timeout Issues

If you continue to see TLS handshake timeouts:

```bash
# Check Docker daemon connectivity
docker info

# Test Docker Hub connectivity
curl -v https://auth.docker.io/token

# Check proxy settings
env | grep -i proxy

# Try using Docker's built-in retry mechanism
docker build --network=host -t rahulnutakki/devprotal:latest .
```

### Alternative: Use Cached Layers

If partial build succeeded:

```bash
# Check for intermediate images
docker images -a | grep node

# Tag and use an intermediate image if available
docker tag <intermediate-image-id> rahulnutakki/devprotal:latest
```

## Deployment Configuration

### Image Details
- **Repository**: rahulnutakki/devprotal
- **Tag**: latest
- **Registry**: Docker Hub

### Kubernetes Configuration
- **Cluster**: qa-self-managed
- **Namespace**: duploservices-qa4
- **Node Selector**: tenantname=duploservices-qa4
- **Storage Class**: gp3

### Application Configuration
- **Replicas**: 1
- **Resources**: 500m CPU, 768Mi Memory (limits)
- **PostgreSQL**: Enabled (with 10Gi gp3 storage)
- **OAuth**: Disabled
- **ArgoCD Integration**: Enabled

## Post-Deployment Checks

### Health Check
```bash
# From within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n duploservices-qa4 -- \
  curl http://backstage-gitops/healthcheck

# Port-forwarded
curl http://localhost:7007/healthcheck
```

### View Logs
```bash
# All pods
kubectl logs -n duploservices-qa4 -l app.kubernetes.io/name=backstage-gitops --all-containers=true

# Specific pod
POD=$(kubectl get pods -n duploservices-qa4 -l app.kubernetes.io/name=backstage-gitops -o jsonpath='{.items[0].metadata.name}')
kubectl logs -f -n duploservices-qa4 $POD
```

### Check PostgreSQL
```bash
# PostgreSQL pods
kubectl get statefulset -n duploservices-qa4 | grep postgres

# PostgreSQL logs
kubectl logs -n duploservices-qa4 -l app.kubernetes.io/component=database
```

## Rollback

If deployment fails:

```bash
# Rollback to previous version
helm rollback backstage-gitops -n duploservices-qa4

# Or uninstall completely
helm uninstall backstage-gitops -n duploservices-qa4
```

## Support

For issues:
1. Check logs: `kubectl logs -n duploservices-qa4 -l app.kubernetes.io/name=backstage-gitops`
2. Check events: `kubectl get events -n duploservices-qa4 --sort-by='.lastTimestamp'`
3. Describe resources: `kubectl describe pod -n duploservices-qa4 <pod-name>`
4. Review the full [Deployment Guide](./DEPLOY_GUIDE.md)
