# GitOps Management Portal - Troubleshooting Guide

## Table of Contents

1. [General Troubleshooting Approach](#general-troubleshooting-approach)
2. [Startup and Connection Issues](#startup-and-connection-issues)
3. [GitHub Integration Issues](#github-integration-issues)
4. [ArgoCD Integration Issues](#argocd-integration-issues)
5. [Database Issues](#database-issues)
6. [UI and Frontend Issues](#ui-and-frontend-issues)
7. [Bulk Operations Issues](#bulk-operations-issues)
8. [Performance Issues](#performance-issues)
9. [Error Messages Reference](#error-messages-reference)
10. [Getting Help](#getting-help)

---

## General Troubleshooting Approach

Before diving into specific issues, follow this systematic approach:

### 1. Identify the Problem

- **What is not working?** Be specific
- **When did it start?** After an update? Configuration change?
- **Who is affected?** All users or specific ones?
- **Can you reproduce it?** Consistent or intermittent?

### 2. Check the Basics

```bash
# Is the backend running?
curl http://localhost:7007/api/gitops/health

# Is the frontend accessible?
curl http://localhost:3000/

# Is PostgreSQL running?
docker ps | grep postgres
# OR
sudo systemctl status postgresql

# Are there any error logs?
# Check console output or logs
```

### 3. Review Logs

**Backend logs** (look for errors, warnings):
- Development: Console output
- Production: `journalctl -u backstage-gitops -f`
- Docker: `docker logs backstage-backend`

**Frontend logs**:
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

### 4. Check Configuration

```bash
# Verify environment variables are set
printenv | grep -E "(GITHUB|POSTGRES|ARGOCD)"

# Check app-config.yaml syntax
cat app-config.yaml | yq .

# Verify database connection
psql -h localhost -U backstage -d backstage -c "SELECT 1;"
```

### 5. Try Basic Fixes

```bash
# Restart the application
pkill -f "backstage-cli package start"
./start-with-env.sh

# Clear caches
rm -rf node_modules/.cache
rm -rf packages/*/dist

# Reinstall dependencies
yarn install

# Rebuild
yarn build
```

---

## Startup and Connection Issues

### Issue: Backend Fails to Start

**Symptoms**:
- Error: "Cannot start backend"
- Process exits immediately
- Port already in use error

**Common Causes & Solutions**:

#### 1. Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use ::1:7007`

**Solution**:
```bash
# Find process using port 7007
lsof -ti:7007

# Kill the process
lsof -ti:7007 | xargs kill -9

# Or use a different port (in app-config.yaml)
backend:
  listen:
    port: 7008
```

#### 2. Environment Variables Not Loaded

**Error**: `[GitHubService] Using mock data mode (no token provided)`

**Solution**:
```bash
# Verify .env file exists
ls -la .env

# Check variables are exported
source .env
printenv | grep GITHUB_TOKEN

# Use start-with-env.sh script
./start-with-env.sh
```

#### 3. Database Connection Failed

**Error**: `Connection terminated unexpectedly` or `ECONNREFUSED`

**Solution**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Start PostgreSQL
docker-compose up -d postgres

# Check connection string in .env
cat .env | grep POSTGRES

# Test connection manually
psql -h localhost -U backstage -d backstage
```

### Issue: Frontend Fails to Start

**Symptoms**:
- Error: "Failed to compile"
- Webpack errors
- Port 3000 already in use

**Solutions**:

#### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

#### Compilation Errors

```bash
# Clear build cache
rm -rf packages/app/dist
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules
yarn install

# Rebuild
yarn workspace app build
```

### Issue: "Cannot connect to backend"

**Symptoms**:
- Frontend loads but shows "Cannot connect to backend"
- Network errors in browser console
- CORS errors

**Solutions**:

#### 1. Backend Not Running

```bash
# Check backend status
curl http://localhost:7007/api/gitops/health

# Start backend if not running
cd packages/backend && yarn start
```

#### 2. CORS Configuration

Check `app-config.yaml`:
```yaml
backend:
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
```

#### 3. Proxy Configuration

If using a reverse proxy, ensure it's forwarding requests correctly:
```nginx
location /api/ {
    proxy_pass http://localhost:7007;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## GitHub Integration Issues

### Issue: Mock Data Instead of Real Repositories

**Symptoms**:
- Only seeing 2 repositories (ensemble, rli-use2)
- Log message: `[GitHubService] Using mock data mode (no token provided)`

**Root Cause**: GitHub token not properly loaded

**Solution**:

1. **Verify token is in .env**:
   ```bash
   cat .env | grep GITHUB_TOKEN
   # Should show: GITHUB_TOKEN=ghp_...
   ```

2. **Check token is valid**:
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
   ```

3. **Restart with environment loaded**:
   ```bash
   ./start-with-env.sh
   ```

4. **Verify token is being used**:
   ```bash
   # Check backend logs - should NOT see mock mode message
   # Should see real repository count
   curl http://localhost:7007/api/gitops/repositories | jq '.repositories | length'
   # Should return 35, not 2
   ```

### Issue: GitHub API Rate Limit Exceeded

**Symptoms**:
- Error: `API rate limit exceeded`
- HTTP 403 responses
- Operations fail intermittently

**Check Rate Limit**:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

**Solutions**:

1. **Wait for Rate Limit Reset**:
   - Check `reset` timestamp in rate limit response
   - Authenticated users get 5,000 requests/hour

2. **Use Multiple Tokens** (if available):
   - Rotate between different GitHub accounts
   - Implement token pool in configuration

3. **Implement Caching**:
   - Cache repository lists for 5-10 minutes
   - Cache branch lists for 2-5 minutes
   - Reduces redundant API calls

4. **Optimize API Usage**:
   - Use GraphQL API for bulk queries (not yet implemented)
   - Batch requests where possible

### Issue: "Repository not found" or "404 Not Found"

**Symptoms**:
- Can see repository in list but can't access branches
- Error when trying to edit files

**Causes & Solutions**:

#### 1. Token Lacks Permissions

```bash
# Verify token has repo access
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/radiantlogic-saas/rli-use2

# Expected: 200 OK with repository data
# If 404: Token doesn't have access
```

**Fix**: Generate new token with correct scopes:
- `repo` - Full control of private repositories
- `read:org` - Read org membership

#### 2. Repository is Private

Ensure your token belongs to a user who:
- Is a member of the `radiantlogic-saas` organization
- Has read access to the repository

#### 3. Repository Name Changed

- Check if repository was renamed in GitHub
- Update any hardcoded references

### Issue: Cannot Create Commits

**Symptoms**:
- Error: "Failed to create commit"
- Error: "Invalid commit signature"

**Solutions**:

#### 1. Check Token Permissions

Token needs `repo` scope to create commits.

#### 2. Verify Git Configuration

Commits require valid author information:
```javascript
committer: {
  name: 'GitOps Portal',
  email: 'gitops@radiantlogic.com'
}
```

#### 3. Check Branch Protection

Some branches have protection rules:
- Require pull requests
- Require status checks
- Require review approvals

**Workaround**: Create feature branch first, then PR to protected branch

---

## ArgoCD Integration Issues

### Issue: ArgoCD Showing Mock Data

**Symptoms**:
- Log message: `[ArgoCDService] Using mock data mode (no token provided)`
- Cannot see real applications

**Solution**:

1. **Generate ArgoCD Token**:
   ```bash
   argocd account generate-token --account argocd-server
   ```

2. **Add to .env**:
   ```bash
   ARGOCD_URL=https://argocd.radiantlogic.com
   ARGOCD_TOKEN=your_generated_token
   ```

3. **Restart application**:
   ```bash
   ./start-with-env.sh
   ```

### Issue: "Cannot connect to ArgoCD"

**Symptoms**:
- Timeout errors
- Connection refused

**Solutions**:

#### 1. Check ArgoCD URL

```bash
# Test connectivity
curl https://argocd.radiantlogic.com/api/version

# Expected: {"Version":"v2.x.x"}
```

#### 2. Verify Token

```bash
# Test authentication
curl -H "Authorization: Bearer $ARGOCD_TOKEN" \
  https://argocd.radiantlogic.com/api/v1/applications
```

#### 3. Check Network/Firewall

- Ensure outbound HTTPS access to ArgoCD server
- Check if VPN is required
- Verify firewall rules

### Issue: Cannot Sync Applications

**Symptoms**:
- Sync button doesn't work
- Error: "Permission denied"

**Cause**: Token doesn't have sync permissions

**Solution**:
```bash
# Create token with proper role
argocd account generate-token --account admin

# Or use service account with sync permissions
```

---

## Database Issues

### Issue: Database Connection Failed

**Symptoms**:
- Error: `Connection terminated unexpectedly`
- Error: `ECONNREFUSED`
- Backend fails to start

**Solutions**:

#### 1. PostgreSQL Not Running

```bash
# Check if running
docker ps | grep postgres

# Start with docker-compose
docker-compose up -d postgres

# Check logs
docker logs backstage-postgres
```

#### 2. Wrong Credentials

```bash
# Test connection
psql -h localhost -p 5432 -U backstage -d backstage

# If fails, check .env
cat .env | grep POSTGRES

# Reset password if needed
docker exec -it backstage-postgres psql -U postgres -c "ALTER USER backstage PASSWORD 'newpassword';"
```

#### 3. Port Conflict

```bash
# Check if port 5432 is in use by another process
lsof -i :5432

# Change port in docker-compose.yml if needed
ports:
  - "5433:5432"  # Use 5433 on host
```

### Issue: Migrations Failed

**Symptoms**:
- Error: "Migration failed"
- Tables don't exist
- Schema mismatch errors

**Solutions**:

```bash
# Check migration status
yarn workspace @internal/plugin-gitops-backend knex migrate:status

# Run pending migrations
yarn workspace @internal/plugin-gitops-backend knex migrate:latest

# If corrupted, rollback and retry
yarn workspace @internal/plugin-gitops-backend knex migrate:rollback
yarn workspace @internal/plugin-gitops-backend knex migrate:latest

# Nuclear option: Reset database (LOSES ALL DATA)
dropdb backstage
createdb backstage
yarn workspace @internal/plugin-gitops-backend knex migrate:latest
```

### Issue: Database Running Out of Space

**Symptoms**:
- Slow queries
- Error: "No space left on device"
- Disk usage warnings

**Solutions**:

```bash
# Check database size
docker exec backstage-postgres psql -U backstage -c "
  SELECT pg_size_pretty(pg_database_size('backstage'));
"

# Check table sizes
docker exec backstage-postgres psql -U backstage -d backstage -c "
  SELECT schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Clean up old audit logs (older than 90 days)
docker exec backstage-postgres psql -U backstage -d backstage -c "
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
"

# Vacuum database
docker exec backstage-postgres psql -U backstage -d backstage -c "VACUUM FULL;"
```

---

## UI and Frontend Issues

### Issue: Blank Page or Loading Forever

**Symptoms**:
- Page loads but stays blank
- Loading spinner indefinitely
- No errors in console

**Solutions**:

#### 1. Check Backend Connection

```bash
# Backend should be running
curl http://localhost:7007/api/gitops/health

# Check browser DevTools Network tab
# Look for failed API requests
```

#### 2. Clear Browser Cache

```
# Chrome/Edge: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Del
# Safari: Cmd+Option+E

# Or use incognito/private mode
```

#### 3. Rebuild Frontend

```bash
cd packages/app
rm -rf dist node_modules/.cache
yarn build
yarn start
```

### Issue: "Uncaught TypeError" in Browser Console

**Symptoms**:
- JavaScript errors in browser console
- Features not working
- Buttons not responding

**Solutions**:

```bash
# Clear cache and rebuild
rm -rf node_modules/.cache
yarn install
yarn build

# Check for TypeScript errors
yarn tsc

# Check for linting errors
yarn lint
```

### Issue: Monaco Editor Not Loading

**Symptoms**:
- File editor shows blank area
- Cannot edit files
- Monaco not defined error

**Solutions**:

```bash
# Reinstall monaco-editor
yarn workspace app add monaco-editor

# Check for webpack configuration issues
# In packages/app/webpack.config.js

# Clear cache
rm -rf packages/app/.cache
```

### Issue: Slow UI Performance

**Symptoms**:
- UI feels sluggish
- Delays when typing
- Lag when scrolling

**Solutions**:

1. **Browser**: Use Chrome or Edge for best performance
2. **RAM**: Close other tabs/applications
3. **Network**: Check network speed if loading remote resources
4. **Build Mode**:
   ```bash
   # Use production build instead of dev mode
   yarn build
   yarn start:app --config app-config.production.yaml
   ```

---

## Bulk Operations Issues

### Issue: Bulk Operation Stuck or Failing

**Symptoms**:
- Operation shows "In Progress" indefinitely
- Some branches succeed, others fail
- Operation times out

**Solutions**:

#### 1. Check Backend Logs

```bash
# Look for errors related to GitHub API
# Or database errors
```

#### 2. Check Individual Branch Failures

- Review failed branches in the operations view
- Common causes:
  - Branch doesn't exist
  - Branch protection rules
  - File doesn't exist on that branch
  - GitHub API rate limit

#### 3. Retry Failed Branches

- Use the "Retry Failed" button in the operations UI
- Or manually fix issues and retry

#### 4. Increase Timeout

In `app-config.yaml`:
```yaml
gitops:
  bulkOperations:
    timeout: 600000  # 10 minutes (increase if needed)
    maxConcurrency: 10  # Reduce if hitting rate limits
```

### Issue: "Maximum concurrency reached"

**Symptoms**:
- Bulk operation queued
- Waiting for other operations to complete

**Explanation**: System limits concurrent bulk operations to prevent overload

**Solutions**:

1. **Wait**: Let current operations complete
2. **Increase Limit** (if system resources allow):
   ```yaml
   gitops:
     bulkOperations:
       maxConcurrentOperations: 5  # Default is 3
   ```

---

## Performance Issues

### Issue: Slow API Responses

**Symptoms**:
- Requests take > 5 seconds
- Timeouts
- Lag in UI

**Debugging**:

```bash
# Check backend logs for slow queries
# Look for lines like: "Query took 5234ms"

# Monitor database performance
docker exec backstage-postgres psql -U backstage -d backstage -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

**Solutions**:

1. **Add Database Indexes**:
   ```sql
   CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
   CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
   CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);
   ```

2. **Optimize Queries**:
   - Add pagination to large result sets
   - Use SELECT only required columns
   - Cache frequently accessed data

3. **Scale Resources**:
   - Increase backend replicas
   - Increase database CPU/memory
   - Use connection pooling

### Issue: High Memory Usage

**Symptoms**:
- Backend consuming > 1GB RAM
- Out of memory errors
- Server crashes

**Solutions**:

```bash
# Monitor memory
ps aux | grep backstage

# Check for memory leaks
node --inspect packages/backend/src/index.ts

# Adjust Node memory limit
NODE_OPTIONS=--max-old-space-size=2048 yarn start
```

---

## Error Messages Reference

### "Error: listen EADDRINUSE: address already in use"

**Meaning**: Port is already in use by another process

**Solution**: Kill the process or use a different port

### "Error: getaddrinfo ENOTFOUND"

**Meaning**: Cannot resolve hostname (DNS issue)

**Solution**: Check network connectivity, DNS settings, or hostname spelling

### "Error: connect ETIMEDOUT"

**Meaning**: Connection timed out (firewall or network issue)

**Solution**: Check firewall, VPN, or network connectivity

### "Error: 401 Unauthorized"

**Meaning**: Authentication failed (invalid token)

**Solution**: Check token is valid and has proper permissions

### "Error: 403 Forbidden"

**Meaning**: Authenticated but not authorized (missing permissions)

**Solution**: Check token scopes or user permissions

### "Error: 404 Not Found"

**Meaning**: Resource doesn't exist

**Solution**: Check repository/branch name spelling

### "Error: 422 Unprocessable Entity"

**Meaning**: Request valid but cannot be processed (e.g., duplicate PR)

**Solution**: Check request parameters

### "Error: 503 Service Unavailable"

**Meaning**: Service temporarily unavailable

**Solution**: Wait and retry, or check if service is down

---

## Getting Help

If you've tried the solutions above and still have issues:

### 1. Gather Information

Collect the following before asking for help:

```bash
# System information
node --version
yarn --version
docker --version

# Application logs
docker logs backstage-backend > backend.log 2>&1

# Database status
docker exec backstage-postgres psql -U backstage -c "\l"

# Environment (sanitized - remove secrets!)
printenv | grep -v TOKEN | grep -v PASSWORD

# Recent error messages
# Copy from console or logs
```

### 2. Check Documentation

- [User Guide](user-guide.md)
- [Admin Guide](admin-guide.md)
- [FAQ](../reference/faq.md)
- [API Reference](../reference/api-reference.md)

### 3. Search for Similar Issues

- Check GitHub issues: https://github.com/radiantlogic-saas/backstage-gitops/issues
- Search Backstage community: https://discord.gg/backstage

### 4. Contact Support

- **Email**: platform-team@radiantlogic.com
- **Slack**: #platform-team channel
- **GitHub**: Open an issue with detailed information

### 5. Report a Bug

When reporting a bug, include:

1. **Description**: What you were trying to do
2. **Expected behavior**: What should happen
3. **Actual behavior**: What actually happened
4. **Steps to reproduce**:
   1. Step 1
   2. Step 2
   3. ...
5. **Environment**: OS, Node version, etc.
6. **Logs**: Relevant error messages
7. **Screenshots**: If UI-related

---

## Quick Reference

### Restart Everything

```bash
# Stop all
pkill -f "backstage-cli"
docker-compose down

# Start fresh
docker-compose up -d postgres
./start-with-env.sh
```

### Check All Services

```bash
# PostgreSQL
docker ps | grep postgres

# Backend
curl http://localhost:7007/api/gitops/health

# Frontend
curl http://localhost:3000

# GitHub connection
curl http://localhost:7007/api/gitops/repositories | jq '.repositories | length'
```

### View Logs

```bash
# Docker logs
docker-compose logs -f

# Specific service
docker logs backstage-postgres -f

# System logs (if using systemd)
journalctl -u backstage-gitops -f
```

### Database Commands

```bash
# Connect to database
docker exec -it backstage-postgres psql -U backstage -d backstage

# Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public';

# Count records
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'bulk_operations', COUNT(*) FROM bulk_operations;
```
