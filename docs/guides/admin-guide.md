# GitOps Management Portal - Administrator Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
3. [Configuration](#configuration)
4. [Operations](#operations)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Security](#security)
7. [Troubleshooting](#troubleshooting)
8. [Backup and Recovery](#backup-and-recovery)

---

## Overview

This guide is for administrators responsible for deploying, configuring, and maintaining the GitOps Management Portal. It covers installation, configuration, monitoring, and operational procedures.

### Administrator Responsibilities

- Deploy and configure the portal
- Manage user access and permissions
- Monitor system health and performance
- Maintain database and backups
- Configure integrations (GitHub, ArgoCD, Grafana)
- Troubleshoot issues
- Plan and execute upgrades

---

## Installation and Setup

### Prerequisites

Before installing the portal, ensure you have:

#### System Requirements

- **Node.js**: v18, v20, or v24
- **Yarn**: v1.22+
- **PostgreSQL**: v14+
- **Docker**: For containerized deployments
- **Kubernetes**: For production deployments (optional)

#### Access Requirements

- GitHub Personal Access Token with:
  - `repo` - Full control of private repositories
  - `read:org` - Read org and team membership
  - `workflow` - Update GitHub Action workflows

- ArgoCD Authentication Token:
  ```bash
  argocd account generate-token --account argocd-server
  ```

- Grafana API Token (optional):
  - Access to relevant dashboards and metrics

#### Network Requirements

- Outbound access to:
  - `github.com` (port 443)
  - `api.github.com` (port 443)
  - ArgoCD server URL
  - Grafana server URL
- Inbound access for users (port 3000 frontend, port 7007 backend)

### Local Development Setup

#### Step 1: Clone Repository

```bash
git clone https://github.com/radiantlogic-saas/backstage-gitops.git
cd backstage-gitops
```

#### Step 2: Install Dependencies

```bash
yarn install
```

#### Step 3: Setup PostgreSQL

**Option A: Using Docker Compose**

```bash
docker-compose up -d postgres
```

**Option B: Local PostgreSQL Installation**

```bash
# Create database
createdb backstage

# Create user
psql -c "CREATE USER backstage WITH PASSWORD 'backstage';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE backstage TO backstage;"
```

#### Step 4: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` file with your credentials:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=backstage

# GitHub
GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_OAUTH_CLIENT_ID=your_oauth_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_oauth_secret

# ArgoCD
ARGOCD_URL=https://argocd.your-domain.com
ARGOCD_TOKEN=your_argocd_token

# Grafana
GRAFANA_URL=https://your-org.grafana.net
GRAFANA_TOKEN=your_grafana_token

# Auth
AUTH_SESSION_SECRET=$(openssl rand -base64 32)
```

#### Step 5: Run Database Migrations

```bash
# Run migrations
yarn workspace @internal/plugin-gitops-backend knex migrate:latest

# Verify migrations
yarn workspace @internal/plugin-gitops-backend knex migrate:status
```

#### Step 6: Start the Application

```bash
# Start with environment variables loaded
./start-with-env.sh
```

#### Step 7: Verify Installation

```bash
# Check frontend
curl http://localhost:3000/

# Check backend
curl http://localhost:7007/api/gitops/health

# Expected response: {"status":"ok"}
```

---

## Configuration

### Application Configuration

The main configuration file is `app-config.yaml`:

```yaml
app:
  title: GitOps Management Portal
  baseUrl: http://localhost:3000

organization:
  name: RadiantLogic

backend:
  baseUrl: http://localhost:7007
  listen:
    port: 7007
  database:
    client: pg
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
      database: ${POSTGRES_DB}

# GitHub Integration
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}

# GitOps Plugin Configuration
gitops:
  github:
    organization: radiantlogic-saas
    token: ${GITHUB_TOKEN}
  argocd:
    enabled: true
    url: ${ARGOCD_URL}
    token: ${ARGOCD_TOKEN}
  grafana:
    enabled: true
    url: ${GRAFANA_URL}
    token: ${GRAFANA_TOKEN}
```

### Environment-Specific Configuration

Create environment-specific configs:

**app-config.production.yaml**:

```yaml
app:
  baseUrl: https://gitops.radiantlogic.com

backend:
  baseUrl: https://gitops-api.radiantlogic.com
  database:
    connection:
      ssl:
        require: true
        rejectUnauthorized: false

# Production-specific settings
gitops:
  github:
    rateLimitWarning: 100
  bulkOperations:
    maxConcurrency: 20
    timeout: 600000
```

### Database Configuration

#### Connection Pooling

Configure in `packages/backend/src/plugins/database.ts`:

```typescript
const pool = {
  min: 2,
  max: 10,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 600000,
};
```

#### Migrations

Migrations are in `plugins/gitops-backend/migrations/`:

```bash
# Create new migration
yarn workspace @internal/plugin-gitops-backend knex migrate:make migration_name

# Run pending migrations
yarn workspace @internal/plugin-gitops-backend knex migrate:latest

# Rollback last migration
yarn workspace @internal/plugin-gitops-backend knex migrate:rollback

# Check migration status
yarn workspace @internal/plugin-gitops-backend knex migrate:status
```

### GitHub Integration Configuration

#### Rate Limiting

GitHub API has rate limits:
- **Authenticated**: 5,000 requests per hour
- **Search API**: 30 requests per minute

Configure rate limit handling in `plugins/gitops-backend/src/services/GitHubService.ts`:

```typescript
const octokit = new Octokit({
  auth: config.token,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      logger.warn(`Rate limit hit, retrying after ${retryAfter}s`);
      return true; // Retry
    },
  },
});
```

#### Webhook Configuration (Optional)

To receive real-time updates from GitHub:

1. Go to GitHub Organization Settings
2. Navigate to Webhooks
3. Add webhook:
   - **Payload URL**: `https://gitops-api.your-domain.com/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Generate secure secret
   - **Events**: Select relevant events (push, pull_request, etc.)

### ArgoCD Integration Configuration

#### Authentication

ArgoCD supports multiple auth methods:

**Token-based (Recommended)**:
```bash
# Generate long-lived token
argocd account generate-token --account argocd-server --expires-in 8760h
```

**Username/Password**:
```yaml
gitops:
  argocd:
    url: https://argocd.example.com
    username: admin
    password: ${ARGOCD_PASSWORD}
```

#### Namespace Configuration

If using namespace-scoped ArgoCD:

```yaml
gitops:
  argocd:
    namespace: argocd
    # Or tenant-specific namespace
    namespace: duploservices-rli-use2-svc
```

---

## Operations

### Starting and Stopping

#### Development

```bash
# Start
./start-with-env.sh

# Stop
pkill -f "backstage-cli package start"
```

#### Production (Systemd)

Create systemd service file `/etc/systemd/system/backstage-gitops.service`:

```ini
[Unit]
Description=Backstage GitOps Portal
After=network.target postgresql.service

[Service]
Type=simple
User=backstage
WorkingDirectory=/opt/backstage-gitops
EnvironmentFile=/opt/backstage-gitops/.env
ExecStart=/usr/bin/yarn start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Manage the service:

```bash
# Enable and start
sudo systemctl enable backstage-gitops
sudo systemctl start backstage-gitops

# Check status
sudo systemctl status backstage-gitops

# View logs
sudo journalctl -u backstage-gitops -f
```

### Production Deployment

#### Option 1: Kubernetes with Helm

```bash
# Create namespace
kubectl create namespace gitops-portal

# Create secrets
kubectl create secret generic backstage-secrets \
  --namespace gitops-portal \
  --from-literal=GITHUB_TOKEN=$GITHUB_TOKEN \
  --from-literal=ARGOCD_TOKEN=$ARGOCD_TOKEN \
  --from-literal=POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Deploy with Helm
helm install backstage-gitops ./helm \
  --namespace gitops-portal \
  --values helm/values-prod.yaml
```

#### Option 2: Docker Compose

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Scaling

#### Horizontal Scaling

The backend can be scaled horizontally:

**Kubernetes**:
```yaml
replicaCount: 3

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

**Docker Compose**:
```yaml
services:
  backend:
    deploy:
      replicas: 3
```

#### Database Connection Pooling

Adjust pool size based on replicas:

```typescript
// Rule of thumb: (replicas * max_connections) < postgres_max_connections
const pool = {
  max: 10, // per instance
};
```

### Backup and Recovery

#### Database Backups

**Automated Daily Backups**:

```bash
#!/bin/bash
# /opt/backups/backup-gitops-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/gitops"
BACKUP_FILE="$BACKUP_DIR/backstage_$DATE.sql.gz"

# Create backup
pg_dump -h localhost -U backstage backstage | gzip > $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE s3://your-backup-bucket/gitops/
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/backups/backup-gitops-db.sh
```

**Manual Backup**:

```bash
# Backup
pg_dump -h localhost -U backstage backstage > backup.sql

# Restore
psql -h localhost -U backstage backstage < backup.sql
```

#### Application State Backup

Backup configuration files:

```bash
#!/bin/bash
tar -czf gitops-config-$(date +%Y%m%d).tar.gz \
  app-config.yaml \
  app-config.production.yaml \
  .env \
  helm/values-prod.yaml
```

---

## Monitoring and Maintenance

### Health Checks

#### Application Health

```bash
# Backend health
curl http://localhost:7007/api/gitops/health

# Database connectivity
curl http://localhost:7007/api/gitops/health/db

# GitHub API connectivity
curl http://localhost:7007/api/gitops/health/github

# ArgoCD connectivity
curl http://localhost:7007/api/gitops/health/argocd
```

#### Metrics

The portal exposes metrics at `/metrics` (Prometheus format):

- Request count by endpoint
- Request duration
- Error rates
- Database connection pool stats
- GitHub API rate limit remaining

### Log Management

#### Log Locations

**Development**:
- Backend: Console output
- Frontend: Browser console

**Production**:
- Systemd: `/var/log/journal/` or `journalctl`
- Docker: `docker logs <container>`
- Kubernetes: `kubectl logs <pod>`

#### Log Levels

Configure in `app-config.yaml`:

```yaml
backend:
  logLevel: info  # debug, info, warn, error
```

#### Log Rotation

Configure logrotate for production:

```bash
# /etc/logrotate.d/backstage-gitops
/var/log/backstage-gitops/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 backstage backstage
    sharedscripts
    postrotate
        systemctl reload backstage-gitops
    endscript
}
```

### Performance Monitoring

#### Database Performance

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

#### Application Performance

Monitor key metrics:
- API response times
- Bulk operation duration
- Database query times
- GitHub API call latency
- Memory and CPU usage

### Maintenance Tasks

#### Weekly Tasks

- Review error logs
- Check disk space
- Verify backups are running
- Review audit logs for anomalies

#### Monthly Tasks

- Update dependencies: `yarn upgrade-interactive`
- Review and optimize slow queries
- Clean up old audit logs (older than 90 days)
- Test backup restoration
- Review security advisories

#### Quarterly Tasks

- Plan and execute version upgrades
- Review and update documentation
- Conduct security audit
- Review access permissions
- Load testing

---

## Security

### Authentication and Authorization

#### GitHub OAuth Setup

1. Create GitHub OAuth App:
   - Go to: Settings → Developer settings → OAuth Apps
   - **Application name**: GitOps Management Portal
   - **Homepage URL**: `https://gitops.your-domain.com`
   - **Authorization callback URL**: `https://gitops.your-domain.com/api/auth/github/handler/frame`

2. Configure in `.env`:
   ```bash
   GITHUB_OAUTH_CLIENT_ID=your_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
   ```

#### Session Management

Configure session settings:

```yaml
auth:
  session:
    secret: ${AUTH_SESSION_SECRET}
    secure: true  # HTTPS only
    sameSite: strict
    maxAge: 86400000  # 24 hours
```

### Network Security

#### TLS/SSL Configuration

**Nginx Reverse Proxy**:

```nginx
server {
    listen 443 ssl http2;
    server_name gitops.your-domain.com;

    ssl_certificate /etc/nginx/ssl/gitops.crt;
    ssl_certificate_key /etc/nginx/ssl/gitops.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:7007;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Firewall Rules

Allow only necessary ports:

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTPS
ufw allow 443/tcp

# Block direct access to backend
ufw deny 7007/tcp

# Enable firewall
ufw enable
```

### Secret Management

#### Using Kubernetes Secrets

```bash
# Create secret
kubectl create secret generic backstage-secrets \
  --from-literal=GITHUB_TOKEN=$GITHUB_TOKEN \
  --from-literal=POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Reference in deployment
env:
  - name: GITHUB_TOKEN
    valueFrom:
      secretKeyRef:
        name: backstage-secrets
        key: GITHUB_TOKEN
```

#### Using HashiCorp Vault (Advanced)

```yaml
backend:
  secrets:
    vault:
      addr: https://vault.example.com
      token: ${VAULT_TOKEN}
      paths:
        - secret/gitops/*
```

### Audit and Compliance

#### Enable Audit Logging

All operations are logged to the `audit_logs` table:

```sql
SELECT
  timestamp,
  user_id,
  operation,
  repository,
  branch,
  details
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;
```

#### Export Audit Reports

```bash
# Monthly audit report
psql -h localhost -U backstage -c "
  COPY (
    SELECT * FROM audit_logs
    WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      AND timestamp < DATE_TRUNC('month', CURRENT_DATE)
  ) TO '/tmp/audit_report_$(date +%Y%m).csv' CSV HEADER;
"
```

---

## Troubleshooting

See [Troubleshooting Guide](troubleshooting.md) for detailed troubleshooting steps.

### Common Issues

#### 1. Cannot Connect to Database

**Symptoms**: Backend fails to start, error: "Connection refused"

**Solution**:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connectivity
psql -h localhost -U backstage -d backstage

# Check logs
sudo journalctl -u postgresql -n 50
```

#### 2. GitHub API Rate Limit Exceeded

**Symptoms**: Operations fail with 403 error

**Solution**:
```bash
# Check rate limit status
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# Wait for reset or use different token
# Implement caching to reduce API calls
```

#### 3. Frontend Not Loading

**Symptoms**: Blank page or loading indefinitely

**Solution**:
```bash
# Check backend is running
curl http://localhost:7007/api/gitops/health

# Check browser console for errors
# Rebuild frontend
cd packages/app && yarn build

# Clear browser cache
```

---

## Appendix

### Useful Commands

```bash
# View all running processes
ps aux | grep backstage

# Check port usage
lsof -i :3000
lsof -i :7007

# View database connections
psql -c "SELECT * FROM pg_stat_activity;"

# Restart services
systemctl restart backstage-gitops

# View real-time logs
tail -f /var/log/backstage-gitops/app.log
```

### Configuration Reference

See `app-config.yaml` for full configuration options.

### API Endpoints

See [API Reference](../reference/api-reference.md) for complete API documentation.
