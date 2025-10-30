# Backstage GitOps Portal - Helm Chart

This Helm chart deploys the Backstage GitOps Management Portal to Kubernetes.

## 📋 Overview

The Helm chart includes:
- Backstage application deployment
- PostgreSQL database (optional, can use external)
- Service accounts and RBAC
- ConfigMaps and Secrets
- Optional Ingress configuration
- Optional HPA (Horizontal Pod Autoscaler)

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster 1.19+
- Helm 3.x installed
- kubectl configured to access your cluster
- Docker image pushed to registry

### Step 1: Create Namespace

```bash
kubectl create namespace backstage
```

### Step 2: Create Secrets

```bash
# Create secret with required tokens
kubectl create secret generic backstage-secrets \
  --namespace backstage \
  --from-literal=GITHUB_TOKEN='your_github_pat_token_here' \
  --from-literal=POSTGRES_PASSWORD='your_secure_postgres_password' \
  --from-literal=ARGOCD_TOKEN='your_argocd_token_here' \
  --from-literal=GRAFANA_API_KEY='your_grafana_api_key_here'

# Verify secret creation
kubectl get secret backstage-secrets -n backstage
kubectl describe secret backstage-secrets -n backstage
```

**Token Requirements:**
- **GITHUB_TOKEN**: GitHub Personal Access Token with `repo`, `read:org`, `read:user` permissions
- **POSTGRES_PASSWORD**: Strong password for PostgreSQL database
- **ARGOCD_TOKEN**: ArgoCD API token (optional if ArgoCD integration disabled)
- **GRAFANA_API_KEY**: Grafana Cloud API key (optional if Grafana integration disabled)

### Step 3: Configure Values

Create a custom values file for your environment:

```bash
# For Development/QA
cp values-qa.yaml my-values.yaml

# For Production
cp values.yaml my-values.yaml
```

Edit `my-values.yaml` to configure:
- Image repository and tag
- Resource limits
- Ingress hostname
- Database settings
- Integration endpoints

### Step 4: Install Chart

```bash
# Validate the chart
helm lint .

# Dry-run to preview
helm install backstage-gitops . \
  --namespace backstage \
  --values my-values.yaml \
  --dry-run --debug

# Install
helm install backstage-gitops . \
  --namespace backstage \
  --values my-values.yaml
```

### Step 5: Verify Deployment

```bash
# Check deployment status
helm status backstage-gitops -n backstage

# Watch pods startup
kubectl get pods -n backstage -w

# Check logs
kubectl logs -f deployment/backstage-gitops -n backstage

# Verify service
kubectl get svc -n backstage
```

### Step 6: Access Application

```bash
# Port forward for local access
kubectl port-forward -n backstage svc/backstage-gitops 7007:80

# Open browser
open http://localhost:7007

# Or access via Ingress (if configured)
open https://backstage.yourdomain.com
```

## 📁 Chart Structure

```
helm/
├── Chart.yaml              # Chart metadata and version
├── values.yaml             # Default configuration values
├── values-qa.yaml          # QA environment configuration
├── README.md               # This file
└── templates/              # Kubernetes manifest templates
    ├── NOTES.txt           # Post-install instructions
    ├── _helpers.tpl        # Template helper functions
    ├── deployment.yaml     # Backstage deployment
    ├── service.yaml        # Service definition
    ├── serviceaccount.yaml # Service account
    ├── configmap.yaml      # Application configuration
    ├── secret.yaml         # Secret references
    ├── ingress.yaml        # Ingress (optional)
    ├── hpa.yaml            # Horizontal Pod Autoscaler (optional)
    ├── postgres-deployment.yaml  # PostgreSQL (optional)
    └── postgres-service.yaml     # PostgreSQL service (optional)
```

## ⚙️ Configuration

### Essential Configuration

#### Image Configuration

```yaml
image:
  repository: rahulnutakki/devprotal  # Your Docker image
  tag: latest                          # Image tag
  pullPolicy: IfNotPresent            # Pull policy
```

#### Application Configuration

```yaml
backstage:
  baseUrl: https://backstage.yourdomain.com  # Public URL
  github:
    organization: your-github-org             # GitHub org name
  argocd:
    enabled: true                             # Enable ArgoCD
    url: https://argocd.yourdomain.com       # ArgoCD URL
  grafana:
    enabled: true                             # Enable Grafana
    url: https://your-org.grafana.net        # Grafana URL
```

#### Database Configuration

```yaml
postgres:
  enabled: true              # Use built-in PostgreSQL
  host: ""                   # Leave empty for built-in
  port: 5432
  database: backstage
  user: backstage
  # Password from secret: backstage-secrets

  # For external PostgreSQL
  # enabled: false
  # host: postgres.external.com
  # port: 5432
```

#### Resource Configuration

```yaml
resources:
  limits:
    cpu: 500m
    memory: 768Mi
  requests:
    cpu: 250m
    memory: 512Mi
```

### Advanced Configuration

#### Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: backstage.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: backstage-tls
      hosts:
        - backstage.yourdomain.com
```

#### Horizontal Pod Autoscaler

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

#### PostgreSQL Storage

```yaml
postgres:
  enabled: true
  storage:
    size: 20Gi
    storageClass: gp3  # AWS EBS gp3
    # storageClass: standard  # GKE
    # storageClass: managed-premium  # Azure
```

## 🌍 Environment-Specific Deployments

### Development/QA Environment

```bash
helm install backstage-gitops . \
  --namespace backstage \
  --values values-qa.yaml \
  --set image.tag=dev-latest \
  --set replicaCount=1 \
  --set resources.limits.cpu=500m \
  --set resources.limits.memory=768Mi
```

### Staging Environment

```bash
helm install backstage-gitops . \
  --namespace backstage \
  --values values.yaml \
  --set image.tag=staging-v1.2.3 \
  --set replicaCount=2 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=backstage-staging.yourdomain.com
```

### Production Environment

```bash
helm install backstage-gitops . \
  --namespace backstage-prod \
  --values values.yaml \
  --set image.tag=v1.2.3 \
  --set replicaCount=3 \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=backstage.yourdomain.com \
  --set postgres.storage.size=50Gi \
  --set postgres.storage.storageClass=gp3
```

## 🔄 Upgrade and Rollback

### Upgrade Release

```bash
# Update image version
helm upgrade backstage-gitops . \
  --namespace backstage \
  --values my-values.yaml \
  --set image.tag=v1.2.3

# Upgrade with new values file
helm upgrade backstage-gitops . \
  --namespace backstage \
  --values my-updated-values.yaml \
  --reuse-values

# Force recreation of pods
helm upgrade backstage-gitops . \
  --namespace backstage \
  --values my-values.yaml \
  --force
```

### Check Rollout Status

```bash
# Check helm release
helm status backstage-gitops -n backstage

# Watch pod rollout
kubectl rollout status deployment/backstage-gitops -n backstage

# View rollout history
kubectl rollout history deployment/backstage-gitops -n backstage
```

### Rollback Release

```bash
# View release history
helm history backstage-gitops -n backstage

# Rollback to previous version
helm rollback backstage-gitops -n backstage

# Rollback to specific revision
helm rollback backstage-gitops 3 -n backstage
```

## 🐛 Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n backstage -l app.kubernetes.io/name=backstage-gitops

# Check pod logs
kubectl logs -n backstage -l app.kubernetes.io/name=backstage-gitops --tail=100

# Check events
kubectl get events -n backstage --sort-by='.lastTimestamp' | head -20
```

**Common Issues:**
- ❌ **ImagePullBackOff**: Check image repository and credentials
- ❌ **CrashLoopBackOff**: Check application logs for errors
- ❌ **Pending**: Check resource availability and PVC binding

### Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl get pods -n backstage -l app=postgres

# Check PostgreSQL logs
kubectl logs -n backstage -l app=postgres --tail=50

# Test connection from backstage pod
kubectl exec -it -n backstage deployment/backstage-gitops -- \
  sh -c 'nc -zv backstage-gitops-postgres 5432'
```

### Secret Issues

```bash
# Verify secrets exist
kubectl get secret backstage-secrets -n backstage

# Check secret keys
kubectl describe secret backstage-secrets -n backstage

# View secret values (base64 encoded)
kubectl get secret backstage-secrets -n backstage -o yaml
```

### Ingress Not Working

```bash
# Check ingress
kubectl describe ingress -n backstage

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# Test service directly
kubectl port-forward -n backstage svc/backstage-gitops 7007:80
curl http://localhost:7007/healthcheck
```

## 🔐 Security Best Practices

### 1. Use External Secrets Management

Instead of kubectl create secret, use:
- **AWS Secrets Manager** + External Secrets Operator
- **Azure Key Vault** + Secrets Store CSI Driver
- **HashiCorp Vault** + Vault Agent Injector

### 2. Enable Network Policies

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: backstage
```

### 3. Use Pod Security Standards

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
```

### 4. Rotate Credentials Regularly

```bash
# Update GitHub token
kubectl create secret generic backstage-secrets \
  --namespace backstage \
  --from-literal=GITHUB_TOKEN='new_token' \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment to pick up new secret
kubectl rollout restart deployment/backstage-gitops -n backstage
```

## 📊 Monitoring and Observability

### Health Checks

```bash
# Check application health
kubectl exec -n backstage deployment/backstage-gitops -- \
  curl http://localhost:7007/healthcheck

# Check from outside cluster
curl https://backstage.yourdomain.com/healthcheck
```

### Metrics

```bash
# Enable Prometheus metrics in values.yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true

# View metrics endpoint
kubectl port-forward -n backstage svc/backstage-gitops 7007:80
curl http://localhost:7007/metrics
```

### Logs

```bash
# Tail logs
kubectl logs -f -n backstage deployment/backstage-gitops

# Get logs from all replicas
kubectl logs -n backstage -l app.kubernetes.io/name=backstage-gitops \
  --all-containers=true --tail=100

# Export logs to file
kubectl logs -n backstage deployment/backstage-gitops \
  --since=24h > backstage-logs.txt
```

## 🗑️ Cleanup

### Uninstall Release

```bash
# Uninstall Helm release (keeps PVCs)
helm uninstall backstage-gitops -n backstage

# Delete namespace (removes all resources including PVCs)
kubectl delete namespace backstage

# Delete only specific resources
kubectl delete deployment,service,configmap -n backstage \
  -l app.kubernetes.io/instance=backstage-gitops
```

### Delete PVCs

```bash
# List PVCs
kubectl get pvc -n backstage

# Delete specific PVC
kubectl delete pvc postgres-data-backstage-gitops-postgres-0 -n backstage

# Delete all PVCs in namespace
kubectl delete pvc --all -n backstage
```

## 📚 Additional Resources

- **Main Documentation**: [../../README.md](../../README.md)
- **Deployment Guide**: [../../DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md)
- **Docker Deployment**: [../docker/README.md](../docker/README.md)
- **Troubleshooting**: [../../docs/guides/troubleshooting.md](../../docs/guides/troubleshooting.md)
- **Architecture**: [../../PRODUCTION-ARCHITECTURE.md](../../PRODUCTION-ARCHITECTURE.md)

## 🤝 Support

For issues or questions:
- **GitHub Issues**: https://github.com/gnanirahulnutakki/devops-portal/issues
- **Documentation**: https://github.com/gnanirahulnutakki/devops-portal/tree/main/docs
- **Email**: platform-team@radiantlogic.com

## 📝 Chart Information

- **Chart Version**: 1.0.0
- **App Version**: 1.0.0
- **Kubernetes Version**: >= 1.19.0
- **Helm Version**: >= 3.0.0

## 🔖 Version History

### Version 1.0.0
- Initial Helm chart release
- Support for PostgreSQL deployment
- Ingress and HPA support
- Comprehensive configuration options
- Multi-environment support
