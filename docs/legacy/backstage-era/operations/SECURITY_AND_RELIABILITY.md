# Security and Fault Tolerance Guide

## Table of Contents
1. [OAuth Configuration](#oauth-configuration)
2. [Security Best Practices](#security-best-practices)
3. [Fault Tolerance & Reliability](#fault-tolerance--reliability)
4. [Production Checklist](#production-checklist)

---

## OAuth Configuration

### Setting Up OAuth Providers

#### 1. GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App
2. Fill in the details:
   - **Application name**: GitOps Management Portal
   - **Homepage URL**: `http://localhost:3000` (dev) or `https://your-domain.com` (prod)
   - **Authorization callback URL**: `http://localhost:7007/api/auth/github/handler/frame`
3. Copy the Client ID and generate a Client Secret
4. Add to `.env`:
   ```bash
   GITHUB_OAUTH_CLIENT_ID=your_client_id_here
   GITHUB_OAUTH_CLIENT_SECRET=your_client_secret_here
   ```

**Production URLs**:
- Homepage: `https://gitops.your-domain.com`
- Callback: `https://gitops.your-domain.com/api/auth/github/handler/frame`

#### 2. Google OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth client ID
5. Configure OAuth consent screen (required first time)
6. Choose "Web application" and configure:
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:7007/api/auth/google/handler/frame`
7. Add to `.env`:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
   ```

**Production URLs**:
- JavaScript origins: `https://gitops.your-domain.com`
- Redirect URI: `https://gitops.your-domain.com/api/auth/google/handler/frame`

#### 3. Microsoft Azure AD OAuth

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory → App registrations → New registration
3. Fill in:
   - **Name**: GitOps Management Portal
   - **Supported account types**: Choose based on your needs
   - **Redirect URI**: Web - `http://localhost:7007/api/auth/oauth2/handler/frame`
4. After registration:
   - Copy **Application (client) ID**
   - Copy **Directory (tenant) ID**
   - Go to Certificates & secrets → New client secret
   - Copy the secret value (shown only once!)
5. Add to `.env`:
   ```bash
   MICROSOFT_OAUTH_CLIENT_ID=your_application_client_id
   MICROSOFT_OAUTH_CLIENT_SECRET=your_client_secret
   MICROSOFT_TENANT_ID=your_tenant_id
   ```

**Production URLs**:
- Redirect URI: `https://gitops.your-domain.com/api/auth/oauth2/handler/frame`

#### 4. Generate Session Secret

```bash
# Generate a secure random string for session cookies
openssl rand -base64 32
```

Add to `.env`:
```bash
AUTH_SESSION_SECRET=your_generated_secret_here
```

---

## Security Best Practices

### 1. Environment Variables & Secrets Management

**Development**:
- ✅ Use `.env` file (already in `.gitignore`)
- ✅ Never commit `.env` to version control
- ✅ Keep `.env.example` updated with placeholders

**Production**:
- Use Kubernetes Secrets or cloud secret managers:
  - AWS Secrets Manager / Systems Manager Parameter Store
  - Azure Key Vault
  - Google Cloud Secret Manager
  - HashiCorp Vault
- Mount secrets as environment variables in pods
- Rotate secrets regularly (quarterly minimum)

### 2. API Token Security

**GitHub Personal Access Token**:
- Minimum required scopes: `repo`, `read:org`
- Use fine-grained PAT with repository-specific access
- Set expiration (max 1 year, recommend 90 days)
- Rotate before expiration

**ArgoCD Token**:
- Create service account with minimum required permissions
- Use project-scoped tokens, not admin
- Rotate regularly

### 3. Database Security

**Connection Security**:
```yaml
# app-config.yaml - Production example
backend:
  database:
    client: pg
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
      ssl:
        require: true
        rejectUnauthorized: true
        ca: ${POSTGRES_CA_CERT}
```

**Best Practices**:
- Use SSL/TLS for database connections
- Separate database credentials per environment
- Use connection pooling (built into Backstage)
- Regular backups with encryption at rest
- Database user should have minimum required privileges

### 4. HTTPS & TLS

**Production Requirements**:
- Always use HTTPS in production
- Use valid SSL/TLS certificates (Let's Encrypt, commercial CA)
- Enable HSTS (HTTP Strict Transport Security)
- Set secure cookie flags

**Configuration**:
```yaml
# app-config.yaml - Production
app:
  baseUrl: https://gitops.your-domain.com
backend:
  baseUrl: https://gitops.your-domain.com
  cors:
    origin: https://gitops.your-domain.com
  csp:
    connect-src: ["'self'", 'https:']
```

### 5. CORS Configuration

**Development** (current):
```yaml
cors:
  origin: http://localhost:3000
```

**Production**:
```yaml
cors:
  origin: https://gitops.your-domain.com
  methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
  credentials: true
```

### 6. Content Security Policy (CSP)

Already configured in `app-config.yaml`:
```yaml
csp:
  connect-src: ["'self'", 'http:', 'https:']
```

**Production hardening**:
```yaml
csp:
  connect-src: ["'self'", 'https://api.github.com', 'https://your-argocd.com']
  default-src: ["'self'"]
  script-src: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
  style-src: ["'self'", "'unsafe-inline'"]
  img-src: ["'self'", 'data:', 'https:']
```

### 7. Input Validation

Already implemented in:
- `plugins/gitops-backend/src/validation/schemas.ts`

**Key validations**:
- File paths (max 1000 chars)
- Branch names (max 255 chars)
- Commit messages (max 500 chars)
- Bulk operation limits (max 50 branches)
- YAML field paths (max 500 chars)

### 8. Rate Limiting

**GitHub API**:
- Already configured in GitHubService with retry logic
- Uses GitHub token (5000 req/hour) vs unauthenticated (60 req/hour)

**Backstage API** (TODO for production):
```typescript
// Add rate limiting middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

router.use('/api/gitops', limiter);
```

### 9. Audit Logging

Implemented in `plugins/gitops-backend/src/services/AuditService.ts`

**Current logging**:
- User ID, operation type, resource
- Status (success/failure)
- Timestamp, metadata
- Stored in PostgreSQL `audit_logs` table

**Recommendations**:
- Ship logs to centralized logging (ELK, Splunk, CloudWatch)
- Set up alerts for suspicious patterns
- Retain logs for compliance (90 days minimum)

### 10. Authentication & Authorization

**Authentication** (just implemented):
- ✅ Multi-provider OAuth (GitHub, Google, Microsoft)
- ✅ Session-based authentication
- ✅ Secure cookie handling

**Authorization** (TODO for production):
```yaml
# app-config.yaml - Add permission rules
permission:
  enabled: true

  # Define policies
  policy:
    - resource:
        kind: gitops-repository
      allow: ['read']
      roles: ['user', 'admin']

    - resource:
        kind: gitops-file
        action: write
      allow: ['write']
      roles: ['admin', 'gitops-writer']
```

---

## Fault Tolerance & Reliability

### 1. Database High Availability

**PostgreSQL Setup**:
```yaml
# Kubernetes example
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  type: ClusterIP
  ports:
    - port: 5432
  selector:
    app: postgres

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: database
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
```

**Backup Strategy**:
```bash
# Daily automated backups
0 2 * * * pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/gitops-$(date +\%Y\%m\%d).sql.gz

# Keep 30 days of backups
find /backups -name "gitops-*.sql.gz" -mtime +30 -delete
```

**Recovery Testing**:
```bash
# Test restore monthly
gunzip -c /backups/gitops-20250128.sql.gz | psql -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB
```

### 2. Application High Availability

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
spec:
  replicas: 3  # Run multiple instances
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: backstage
        image: your-registry/backstage-gitops:latest
        ports:
        - containerPort: 7007
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /healthcheck
            port: 7007
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthcheck
            port: 7007
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 3. Health Checks

**Add to backend** (`packages/backend/src/index.ts`):
```typescript
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... existing plugins ...

// Add health check endpoint
backend.add(import('@backstage/plugin-app-backend/alpha'));

// The default backend includes /healthcheck endpoint
```

**Monitor endpoints**:
- `GET /healthcheck` - Overall health
- `GET /api/gitops/repositories` - API functional test

### 4. Error Handling & Retry Logic

**Already implemented**:
- GitHub Service: Retry on rate limit, secondary rate limit
- Database: Connection pooling with automatic retry
- Bulk Operations: Track per-branch success/failure

**Error boundaries** (frontend):
```typescript
// Add to App.tsx
import { ErrorBoundary } from '@backstage/core-app-api';

// Wrap routes
<ErrorBoundary>
  <AppRouter>
    <Root>{routes}</Root>
  </AppRouter>
</ErrorBoundary>
```

### 5. Monitoring & Observability

**Prometheus Metrics** (TODO):
```typescript
// Add Prometheus exporter
import { register } from 'prom-client';

// Expose metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Key Metrics to Track**:
- Request rate, error rate, latency
- Database connection pool usage
- GitHub API rate limit remaining
- Bulk operation queue depth
- Authentication success/failure rate

**Grafana Dashboard**:
- Create dashboards for all key metrics
- Set up alerts for anomalies
- Monitor error rates > 1%

### 6. Logging

**Structured Logging**:
```typescript
// Use Winston logger (already configured)
import { Logger } from 'winston';

logger.info('Bulk operation started', {
  operationId: 'abc123',
  targetBranches: 10,
  user: 'user@example.com',
});
```

**Log Levels**:
- ERROR: Application errors, external service failures
- WARN: Degraded performance, retries
- INFO: Normal operations, bulk operations started/completed
- DEBUG: Detailed debugging information

### 7. Graceful Degradation

**Service degradation strategy**:
1. GitHub API unavailable → Use cached data, display warning
2. ArgoCD unavailable → Disable sync features, show status as unknown
3. Database connection issues → Retry with exponential backoff

**Circuit Breaker Pattern** (TODO):
```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(githubService.listRepositories, {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
});
```

### 8. Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 4 hours
**RPO (Recovery Point Objective)**: 24 hours

**Disaster Scenarios**:

1. **Database Failure**:
   - Restore from latest backup
   - Update connection string to new instance
   - Verify data integrity

2. **Complete Infrastructure Loss**:
   - Deploy to new cluster from IaC (Infrastructure as Code)
   - Restore database from backup
   - Update DNS entries
   - Test OAuth callbacks

3. **Data Corruption**:
   - Identify corruption timeframe
   - Restore from point-in-time backup
   - Replay audit logs for manual recovery

**Recovery Steps Document**:
```markdown
# Emergency Recovery Procedure

## Database Restore
1. Identify latest valid backup
2. Create new PostgreSQL instance
3. Restore backup: `gunzip -c backup.sql.gz | psql ...`
4. Update POSTGRES_HOST in secrets
5. Restart Backstage pods
6. Verify health check passes
7. Test authentication
8. Test critical GitOps operations

## Full Deployment
1. Clone infrastructure repository
2. Run Terraform/Helm: `terraform apply`
3. Deploy secrets: `kubectl apply -f secrets/`
4. Deploy application: `helm install backstage ./chart`
5. Verify all pods running
6. Update DNS if needed
7. Test all OAuth providers
8. Notify users of recovery
```

### 9. Load Balancing

**Kubernetes Service**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backstage
spec:
  type: LoadBalancer  # or NodePort/ClusterIP with Ingress
  ports:
    - port: 80
      targetPort: 7007
  selector:
    app: backstage
```

**Ingress with SSL**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backstage
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - gitops.your-domain.com
    secretName: backstage-tls
  rules:
  - host: gitops.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backstage
            port:
              number: 7007
```

### 10. Scaling Strategy

**Horizontal Pod Autoscaling**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backstage
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backstage
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Production Checklist

### Pre-Deployment

- [ ] Configure all OAuth providers with production URLs
- [ ] Generate and set secure AUTH_SESSION_SECRET
- [ ] Set up PostgreSQL with SSL/TLS
- [ ] Configure database backups (automated daily)
- [ ] Set up secrets management (Vault/AWS Secrets Manager)
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Update CORS origins to production domain
- [ ] Harden CSP directives
- [ ] Set up centralized logging
- [ ] Configure Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Set up health check monitoring
- [ ] Configure rate limiting
- [ ] Enable audit logging to external system
- [ ] Document disaster recovery procedures
- [ ] Test backup restore procedure
- [ ] Configure HPA (Horizontal Pod Autoscaler)
- [ ] Set up Ingress with SSL termination

### Security Hardening

- [ ] Enable network policies (Kubernetes)
- [ ] Run vulnerability scans on Docker image
- [ ] Set up dependency scanning (Dependabot/Snyk)
- [ ] Configure pod security policies
- [ ] Enable container image signing
- [ ] Set up WAF (Web Application Firewall)
- [ ] Configure DDoS protection
- [ ] Enable security headers (HSTS, X-Frame-Options)
- [ ] Set up intrusion detection
- [ ] Configure SIEM integration
- [ ] Perform penetration testing
- [ ] Complete security audit

### Operational Readiness

- [ ] Document runbooks for common operations
- [ ] Set up on-call rotation
- [ ] Configure alerting (PagerDuty/Opsgenie)
- [ ] Create SLOs/SLAs
- [ ] Set up status page
- [ ] Document escalation procedures
- [ ] Train operations team
- [ ] Conduct disaster recovery drill
- [ ] Set up change management process
- [ ] Configure deployment pipeline with rollback
- [ ] Test rollback procedure
- [ ] Document known issues and workarounds

### Compliance & Governance

- [ ] Review data retention policies
- [ ] Configure audit log retention (90+ days)
- [ ] Document data privacy compliance (GDPR/SOC2)
- [ ] Set up access control policies (RBAC)
- [ ] Configure permission boundaries
- [ ] Document security incident response plan
- [ ] Set up compliance monitoring
- [ ] Complete risk assessment
- [ ] Document data classification
- [ ] Review third-party dependencies

---

## Additional Resources

- [Backstage Security Guide](https://backstage.io/docs/auth/)
- [OAuth 2.0 Security Best Practices](https://oauth.net/2/oauth-best-practice/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## Support & Contact

For security issues, please report to: security@your-domain.com

For operational issues: oncall@your-domain.com
