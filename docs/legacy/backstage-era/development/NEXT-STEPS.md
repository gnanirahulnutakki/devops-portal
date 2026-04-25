# Next Steps - GitOps Management Portal

**Last Updated:** 2025-10-28
**Current Status:** Phase 0 Complete ✅
**Blocked By:** GitHub Personal Access Token

---

## 🎯 Immediate Action Required

### **Create GitHub Personal Access Token**

**Why:** Required to connect the portal to radiantlogic-saas/rli-use2 repository

**How:**

1. **Navigate to GitHub Token Settings:**
   - URL: https://github.com/settings/tokens?type=beta
   - Or: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

2. **Click "Generate new token"**

3. **Configure Token:**
   ```
   Token name: backstage-gitops-rli-use2
   Description: GitOps portal access for managing tenant branches
   Expiration: 90 days (recommended)
   Resource owner: radiantlogic-saas
   ```

4. **Repository Access:**
   ```
   ○ All repositories  (DON'T select)
   ● Only select repositories
     ✓ radiantlogic-saas/rli-use2  ← SELECT THIS
   ```

5. **Permissions:**
   ```
   Repository permissions:
   ├── Contents: Read and write access  ✅ REQUIRED
   └── Metadata: Read-only (automatic) ✅ AUTOMATIC

   Optional (for future features):
   ├── Pull requests: Read and write
   └── Workflows: Read and write
   ```

6. **Generate and Copy Token:**
   - Click "Generate token"
   - **COPY THE TOKEN IMMEDIATELY** (you won't see it again)
   - Format: `github_pat_11AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

7. **Add to .env File:**
   ```bash
   # Open .env file
   nano /Users/nutakki/Documents/cloud-2025/documents/backstage-gitops/.env

   # Update the GITHUB_TOKEN line
   GITHUB_TOKEN=github_pat_11AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

   # Save and close
   ```

8. **Test Token:**
   ```bash
   # Test with curl
   curl -H "Authorization: token github_pat_11AXXXX..." \
     https://api.github.com/repos/radiantlogic-saas/rli-use2/branches

   # Should return JSON with branch list
   ```

**Estimated Time:** 5 minutes

---

## 🚀 Once Token is Added

### **Restart Backend with Token**

```bash
# 1. Stop current backend
pkill -f "yarn start-backend"

# 2. Navigate to project
cd /Users/nutakki/Documents/cloud-2025/documents/backstage-gitops

# 3. Start backend with environment variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=backstage
export POSTGRES_PASSWORD=backstage
export POSTGRES_DB=backstage
export GITHUB_TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)

yarn start-backend

# Frontend should still be running on http://localhost:3000
```

### **Verify Token Works**

Test the backend can access GitHub:

```bash
# Test API endpoint (once implemented in Phase 1)
curl http://localhost:7007/api/gitops/repositories

# Should return radiantlogic-saas repositories
```

---

## 📋 Phase 1: Backend Foundation

### **What We'll Build:**

Once the GitHub token is added, we'll implement:

1. **GitHubService** (Day 1-2)
   - Connect to GitHub API with Octokit
   - List repositories
   - List branches (39 tenant branches)
   - Browse file tree
   - Read file contents
   - Update files and commit

2. **Database Schema** (Day 2)
   - Create audit_logs table migration
   - Create bulk_operations table migration
   - Run migrations
   - Verify schema

3. **AuditService** (Day 2-3)
   - Log all operations
   - Track user actions
   - Query audit history
   - Cleanup old logs

4. **REST API Endpoints** (Day 3)
   - Wire services to routes
   - Add input validation
   - Add error handling
   - Test with Postman/curl

### **Expected Duration:** 3-4 days

### **Deliverables:**
- ✅ Backend can list rli-use2 branches
- ✅ Backend can read values.yaml files
- ✅ Backend can commit changes
- ✅ All operations are logged
- ✅ API endpoints tested and working

---

## 🎨 Phase 2: Frontend Components

After Phase 1, we'll build the UI:

1. **Repository Selector**
   - Dropdown to select repository
   - Shows available repos from GitHub
   - Filters to radiantlogic-saas organization

2. **Branch Browser**
   - Lists all branches (master + 39 tenant branches)
   - Multi-select for bulk operations
   - Filter/search functionality

3. **File Browser**
   - Tree view of repository structure
   - Navigate to app/charts/radiantone/values.yaml
   - Click to open file

4. **Monaco Editor**
   - Syntax highlighting for YAML
   - Edit values.yaml
   - Validate YAML syntax
   - Show diff preview

5. **Commit Panel**
   - Commit message input
   - Preview changes
   - Select target branches
   - Bulk commit capability

### **Expected Duration:** 4-5 days

---

## 🔄 Phase 5: ArgoCD Integration

Later, we'll add ArgoCD features:

### **Prerequisites:**
- ArgoCD token from rli-use2 cluster
- Port-forward or direct cluster access

### **How to Get ArgoCD Token:**

```bash
# 1. Set kubeconfig
export KUBECONFIG=/Users/nutakki/Documents/cloud-2025/kubeconfigs/rli-use2-tst01-SA/duploinfra-rli-use2-kubeconfig.yaml

# 2. Get ArgoCD admin password
kubectl -n duploservices-rli-use2-svc get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# 3. Port-forward ArgoCD
kubectl port-forward -n duploservices-rli-use2-svc \
  svc/argocd-server 8080:443

# 4. Login and generate token
argocd login localhost:8080 --username admin --password <password>
argocd account generate-token

# 5. Add to .env
ARGOCD_TOKEN=<token>
ARGOCD_URL=http://localhost:8080
```

### **Features:**
- List ArgoCD applications (60 total)
- Show sync status per application
- Map applications to branches
- Bulk sync operations
- Monitor sync progress

---

## 📊 Development Workflow

### **Daily Workflow:**

**Starting Work:**
```bash
# 1. Start PostgreSQL (if not running)
docker compose up -d postgres

# 2. Start backend (terminal 1)
cd /Users/nutakki/Documents/cloud-2025/documents/backstage-gitops
export POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=backstage \
       POSTGRES_PASSWORD=backstage POSTGRES_DB=backstage \
       GITHUB_TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)
yarn start-backend

# 3. Start frontend (terminal 2)
yarn start

# 4. Access UI
open http://localhost:3000/gitops
```

**Stopping Work:**
```bash
# Stop frontend
pkill -f "yarn start"

# Stop backend
pkill -f "yarn start-backend"

# Stop PostgreSQL (optional)
docker compose down
```

### **Making Changes:**

**Backend Development:**
```bash
# Edit files in plugins/gitops-backend/src/
# Backend auto-reloads on file changes
# Test API: curl http://localhost:7007/api/gitops/...
```

**Frontend Development:**
```bash
# Edit files in plugins/gitops/src/
# Webpack auto-reloads browser
# Check console for errors
```

---

## 🧪 Testing Strategy

### **Phase 1 Testing:**

**Unit Tests:**
```bash
# Test GitHubService
yarn workspace @internal/plugin-gitops-backend test

# Expected tests:
- List repositories
- List branches
- Get file content
- Update file
- Error handling
```

**Integration Tests:**
```bash
# Test with real GitHub API
curl http://localhost:7007/api/gitops/repositories
curl http://localhost:7007/api/gitops/repositories/rli-use2/branches
```

**Manual Testing:**
```bash
# Test full workflow:
1. List branches ✓
2. Browse files ✓
3. Read values.yaml ✓
4. Make change ✓
5. Commit ✓
6. Verify on GitHub ✓
```

---

## 📈 Progress Tracking

### **Milestones:**

**Milestone 1: GitHub Integration** (Phase 1)
- [ ] GitHubService implemented
- [ ] Can list rli-use2 branches
- [ ] Can read values.yaml files
- [ ] Can commit changes
- Target: End of Week 1

**Milestone 2: UI Implementation** (Phase 2)
- [ ] Repository selector working
- [ ] Branch browser functional
- [ ] File browser navigable
- [ ] Monaco editor integrated
- Target: End of Week 2

**Milestone 3: Basic Workflow** (Phase 3-4)
- [ ] Can edit single file
- [ ] Can commit to one branch
- [ ] Can commit to multiple branches
- [ ] Audit logging working
- Target: End of Week 3

**Milestone 4: ArgoCD Integration** (Phase 5)
- [ ] Can list ArgoCD apps
- [ ] Can see sync status
- [ ] Can trigger sync
- [ ] Can sync multiple apps
- Target: End of Week 4

**Milestone 5: Production Ready** (Phase 6)
- [ ] Error handling complete
- [ ] Performance optimized
- [ ] Documentation complete
- [ ] Deployed to cluster
- Target: End of Week 5

---

## 🔍 Debugging Tips

### **Common Issues:**

**Backend won't start:**
```bash
# Check if port 7007 is in use
lsof -i :7007

# Check if PostgreSQL is running
docker compose ps

# Check environment variables
env | grep POSTGRES
env | grep GITHUB

# Check logs
yarn start-backend 2>&1 | grep error
```

**Frontend won't compile:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
yarn install

# Check for TypeScript errors
yarn tsc

# Check webpack output
yarn start 2>&1 | grep ERROR
```

**GitHub API errors:**
```bash
# Test token directly
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Check rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

---

## 📝 Checklist for Resuming Work

### **Before Starting Phase 1:**

- [ ] GitHub PAT created and added to .env
- [ ] Backend running with GitHub token
- [ ] Frontend running
- [ ] Can access http://localhost:3000/gitops
- [ ] Read SESSION-SUMMARY-2025-10-28.md
- [ ] Read IMPLEMENTATION-STATUS.md
- [ ] Read RLI-USE2-ANALYSIS.md

### **Phase 1 Kickoff:**

- [ ] Create feature branch: `git checkout -b feature/phase-1-backend`
- [ ] Review 05-IMPLEMENTATION-ROADMAP.md Phase 1 tasks
- [ ] Set up test environment
- [ ] Create GitHubService skeleton
- [ ] Write first test
- [ ] Implement first feature

---

## 🎯 Success Criteria

### **Phase 1 Complete When:**

1. ✅ Backend can list all radiantlogic-saas repositories
2. ✅ Backend can list all 39 tenant branches in rli-use2
3. ✅ Backend can read app/charts/radiantone/values.yaml from any branch
4. ✅ Backend can update a file and commit to GitHub
5. ✅ All operations are logged to audit_logs table
6. ✅ API endpoints return proper error messages
7. ✅ Unit tests pass (>80% coverage)
8. ✅ Integration tests pass with real GitHub API

### **How to Verify:**

```bash
# 1. List branches
curl http://localhost:7007/api/gitops/repositories/rli-use2/branches
# Should return 40 branches (master + 39 tenants)

# 2. Read file
curl http://localhost:7007/api/gitops/repositories/rli-use2/content\
?branch=rli-use2-mp02\&path=app/charts/radiantone/values.yaml
# Should return file content

# 3. Check audit logs
curl http://localhost:7007/api/gitops/audit/logs
# Should show logged operations

# 4. Run tests
yarn workspace @internal/plugin-gitops-backend test
# Should pass all tests
```

---

## 📞 Support Resources

### **If Stuck:**

1. **Documentation:**
   - Backstage: https://backstage.io/docs
   - GitHub API: https://docs.github.com/en/rest
   - Octokit: https://github.com/octokit/rest.js

2. **Project Docs:**
   - Knowledge Base: `04-KNOWLEDGE-BASE.md`
   - Architecture: `03-ARCHITECTURE.md`
   - Session Summary: `SESSION-SUMMARY-2025-10-28.md`

3. **Community:**
   - Backstage Discord: https://discord.gg/backstage
   - GitHub Discussions: https://github.com/backstage/backstage/discussions

---

## ✅ Current Status Summary

**Completed:**
- ✅ Phase 0: Project Setup
- ✅ Development environment running
- ✅ GitOps plugin loaded
- ✅ Production architecture analyzed
- ✅ Documentation complete

**Blocked:**
- 🔒 GitHub Personal Access Token required

**Next:**
- 🎯 Add GitHub token to .env
- 🎯 Start Phase 1: Backend Foundation
- 🎯 Implement GitHubService

**Timeline:**
- **With token:** Can start Phase 1 immediately
- **Without token:** Work blocked until token is created
- **Estimated to MVP:** ~23 days with token

---

**Last Updated:** 2025-10-28
**Status:** Ready for Phase 1 (pending GitHub token)
**Confidence:** High ✅
