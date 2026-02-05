# DevOps Portal Integration Guide

This guide covers deploying DevOps Portal in various scenarios, including alongside an existing Backstage installation.

## Table of Contents

1. [Standalone Deployment](#standalone-deployment)
2. [Integration with Existing Backstage](#integration-with-existing-backstage)
3. [DuploCloud (AWS EKS) Deployment](#duplocloud-aws-eks-deployment)
4. [Quick Reference](#quick-reference)

---

## Standalone Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- Helm 3.x
- `kubectl` configured to access your cluster
- GitHub OAuth App credentials
- GitHub Personal Access Token (for API access)

### Step 1: Create Namespace

```bash
kubectl create namespace devops-portal
```

### Step 2: Create Secrets

```bash
kubectl create secret generic backstage-secrets -n devops-portal \
  --from-literal=GITHUB_TOKEN=ghp_xxxxxxxxxxxx \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24) \
  --from-literal=GITHUB_OAUTH_CLIENT_ID=Ov23lixxxxxxxxxx \
  --from-literal=GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx \
  --from-literal=AUTH_SESSION_SECRET=$(openssl rand -hex 32)
```

### Step 3: Deploy with Helm

```bash
# Clone the repository
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal

# Deploy
helm upgrade --install devops-portal ./deployment/helm \
  -n devops-portal \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set "ingress.hosts[0].host=devops-portal.example.com" \
  --set "ingress.hosts[0].paths[0].path=/" \
  --set "ingress.hosts[0].paths[0].pathType=Prefix" \
  --set backstage.baseUrl=https://devops-portal.example.com \
  --set github.organization=your-org
```

### Step 4: Verify Deployment

```bash
kubectl get pods -n devops-portal
kubectl get ingress -n devops-portal
```

---

## Integration with Existing Backstage

If you already have a Backstage instance running, you have several integration options:

### Option A: Deploy as Separate Instance (Recommended)

Deploy DevOps Portal as a separate application in a different namespace. This provides:
- Complete isolation
- Independent scaling
- Separate authentication
- No risk to existing Backstage

```bash
# Deploy in separate namespace
kubectl create namespace devops-portal
helm upgrade --install devops-portal ./deployment/helm \
  -n devops-portal \
  -f deployment/helm/values.yaml
```

**Link from existing Backstage:**
Add a link in your existing Backstage app to DevOps Portal:

```yaml
# app-config.yaml (existing Backstage)
app:
  links:
    - url: https://devops-portal.example.com
      title: DevOps Portal
      icon: dashboard
```

### Option B: Add GitOps Plugin to Existing Backstage

If you want to add the GitOps functionality directly to your existing Backstage:

1. **Copy the plugin source:**
```bash
# Copy plugins from devops-portal to your backstage
cp -r devops-portal/plugins/gitops your-backstage/plugins/
cp -r devops-portal/plugins/gitops-backend your-backstage/plugins/
```

2. **Update package.json:**
```json
// packages/backend/package.json
{
  "dependencies": {
    "@internal/plugin-gitops-backend": "link:../../plugins/gitops-backend"
  }
}

// packages/app/package.json
{
  "dependencies": {
    "@internal/plugin-gitops": "link:../../plugins/gitops"
  }
}
```

3. **Register backend plugin:**
```typescript
// packages/backend/src/index.ts
backend.add(import('@internal/plugin-gitops-backend'));
```

4. **Add frontend routes:**
```tsx
// packages/app/src/App.tsx
import { GitOpsPage } from '@internal/plugin-gitops';

// In routes:
<Route path="/gitops" element={<GitOpsPage />} />
```

### Option C: Deploy in Same Namespace (Side-by-Side)

Deploy DevOps Portal in the same namespace as existing Backstage with a different name:

```bash
helm upgrade --install devops-portal ./deployment/helm \
  -n backstage \
  --set nameOverride=devops-portal \
  --set fullnameOverride=devops-portal \
  --set postgres.enabled=false \
  --set postgres.host=existing-postgres-service \
  --set postgres.database=devops_portal
```

**Note:** Ensure different ingress hosts to avoid conflicts.

---

## DuploCloud (AWS EKS) Deployment

DuploCloud has specific requirements for deployments:

### Prerequisites

- DuploCloud tenant configured
- AWS ALB Ingress Controller (pre-installed by Duplo)
- ACM certificate (optional, for HTTPS)

### Step 1: Create Namespace in Duplo

The namespace is typically auto-created when you create a Duplo tenant:
- Format: `duploservices-<tenant-name>`

### Step 2: Create Secrets

```bash
# Replace saasops1 with your tenant name
NAMESPACE=duploservices-saasops1

kubectl create secret generic backstage-secrets -n $NAMESPACE \
  --from-literal=GITHUB_TOKEN=ghp_xxxxxxxxxxxx \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24) \
  --from-literal=GITHUB_OAUTH_CLIENT_ID=Ov23lixxxxxxxxxx \
  --from-literal=GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx \
  --from-literal=AUTH_SESSION_SECRET=$(openssl rand -hex 32) \
  --from-literal=ARGOCD_TOKEN=your-argocd-token
```

### Step 3: Deploy Using Values File

```bash
# Use the provided Duplo-optimized values file
helm upgrade --install devops-portal ./deployment/helm \
  -n duploservices-saasops1 \
  -f deployment/helm/values-saasops1.yaml
```

### Step 4: Update nip.io Host

After ALB is provisioned (2-5 minutes):

```bash
./deployment/scripts/update-nip-io-host.sh duploservices-saasops1
```

### Step 5: Update GitHub OAuth Callback

Update your GitHub OAuth App callback URL to match the nip.io URL:
```
http://devops-portal.<ALB-IP>.nip.io/api/auth/github/handler/frame
```

### Key Duplo Considerations

1. **NodeSelector Required:**
   ```yaml
   nodeSelector:
     tenantname: duploservices-<tenant>
   ```

2. **Storage Class:**
   ```yaml
   postgres:
     storage:
       storageClass: duploservices-<tenant>-encrypted-gp3
   ```

3. **ALB Tags:**
   ```yaml
   ingress:
     alb:
       tags: "duplo-project=<tenant>,TENANT_NAME=<tenant>"
   ```

4. **No External IPs:** Nodes have internal IPs only; use ALB for external access.

---

## Quick Reference

### Common Commands

```bash
# Deploy
./deployment/scripts/deploy.sh <namespace> [values-file]

# Update nip.io host
./deployment/scripts/update-nip-io-host.sh <namespace>

# Check status
kubectl get pods -n <namespace> -l app.kubernetes.io/instance=devops-portal
kubectl get ingress -n <namespace>
kubectl logs -n <namespace> -l app.kubernetes.io/instance=devops-portal

# Port forward for local access
kubectl port-forward -n <namespace> svc/devops-portal 7007:80

# Restart deployment
kubectl rollout restart deployment/devops-portal -n <namespace>

# View helm values
helm get values devops-portal -n <namespace>

# Upgrade
helm upgrade devops-portal ./deployment/helm -n <namespace> -f values.yaml
```

### Values Files

| File | Use Case |
|------|----------|
| `values.yaml` | Default template |
| `values-saasops1.yaml` | DuploCloud saasops1 tenant |
| `values-qa.yaml` | QA environment |

### Required Secrets

| Key | Description |
|-----|-------------|
| `GITHUB_TOKEN` | GitHub PAT for API access |
| `GITHUB_OAUTH_CLIENT_ID` | OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth App client secret |
| `AUTH_SESSION_SECRET` | Session encryption key |
| `POSTGRES_PASSWORD` | Database password |
| `ARGOCD_TOKEN` | ArgoCD API token (optional) |

### Troubleshooting

**Pod CrashLoopBackOff:**
```bash
kubectl logs -n <namespace> <pod-name> --previous
kubectl describe pod -n <namespace> <pod-name>
```

**Ingress not getting address:**
```bash
kubectl describe ingress -n <namespace> <ingress-name>
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

**OAuth callback error:**
- Verify callback URL in GitHub OAuth App matches `<base-url>/api/auth/github/handler/frame`
- Check `backstage.baseUrl` matches the actual URL

**Database connection issues:**
```bash
kubectl exec -it -n <namespace> <postgres-pod> -- psql -U backstage -d backstage -c "SELECT 1"
```

---

## Architecture Diagrams

### Standalone Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Namespace: devops-portal               │ │
│  │  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ devops-portal│  │  PostgreSQL  │                │ │
│  │  │   (Backstage)│◄─┤   Database   │                │ │
│  │  └──────┬───────┘  └──────────────┘                │ │
│  └─────────┼──────────────────────────────────────────┘ │
│            │                                             │
│  ┌─────────▼─────────┐                                  │
│  │      Ingress      │                                  │
│  │   (nginx/ALB)     │                                  │
│  └─────────┬─────────┘                                  │
└────────────┼────────────────────────────────────────────┘
             │
    ┌────────▼────────┐     ┌─────────────┐
    │     Users       │     │   GitHub    │
    │  (Web Browser)  │     │   ArgoCD    │
    └─────────────────┘     └─────────────┘
```

### Side-by-Side with Existing Backstage

```
┌─────────────────────────────────────────────────────────────────┐
│                       Kubernetes Cluster                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Namespace: backstage                      │ │
│  │  ┌────────────────┐   ┌────────────────┐   ┌─────────────┐ │ │
│  │  │    Backstage   │   │  DevOps Portal │   │  PostgreSQL │ │ │
│  │  │   (existing)   │   │    (new)       │◄──┤  (shared)   │ │ │
│  │  └───────┬────────┘   └───────┬────────┘   └─────────────┘ │ │
│  └──────────┼────────────────────┼────────────────────────────┘ │
│             │                    │                               │
│  ┌──────────▼────────────────────▼──────────┐                   │
│  │              Ingress Controller           │                   │
│  │  backstage.example.com  devops.example.com│                   │
│  └──────────────────┬───────────────────────┘                   │
└─────────────────────┼───────────────────────────────────────────┘
                      │
             ┌────────▼────────┐
             │     Users       │
             └─────────────────┘
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/gnanirahulnutakki/devops-portal/issues
- Documentation: https://github.com/gnanirahulnutakki/devops-portal/docs
