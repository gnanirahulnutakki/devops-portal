# Quick Start Guide

Get the Backstage GitOps Management Portal running locally in 10 minutes.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **Yarn** installed (`yarn --version`)
- [ ] **Docker** running (`docker ps`)
- [ ] **PostgreSQL client** (optional, for debugging)
- [ ] **GitHub Personal Access Token** with scopes: `repo`, `read:org`, `workflow`
- [ ] **ArgoCD Auth Token** (optional, for sync features)

## Step 1: Get GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `Backstage GitOps Local`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `read:org` (Read org and team membership)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

## Step 2: Clone and Setup

```bash
# Navigate to project directory
cd /Users/nutakki/Documents/cloud-2025/documents/backstage-gitops

# Copy environment template
cp .env.example .env

# Edit .env and add your tokens
nano .env  # or use your favorite editor
```

**Update these values in .env:**
```bash
GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_CLIENT_ID=your_oauth_client_id  # Get from GitHub OAuth App
GITHUB_CLIENT_SECRET=your_oauth_secret  # Get from GitHub OAuth App

# ArgoCD (optional for Phase 1)
ARGOCD_URL=https://argocd.radiantlogic.com
ARGOCD_TOKEN=your_argocd_token
```

## Step 3: Start PostgreSQL

```bash
# Start PostgreSQL in Docker
docker-compose up -d postgres

# Verify it's running
docker ps | grep backstage-postgres

# Check logs (optional)
docker logs backstage-postgres
```

## Step 4: Install Dependencies

```bash
# Install all dependencies (this will take a few minutes)
yarn install

# If you encounter errors, try:
yarn install --network-timeout 100000
```

## Step 5: Initialize Project

**Note:** For the initial implementation, we'll follow the roadmap in `05-IMPLEMENTATION-ROADMAP.md` starting with Phase 0.

The actual Backstage app creation will be done using:

```bash
# This command creates the full Backstage app structure
npx @backstage/create-app@latest

# When prompted:
# - Name: backstage-gitops
# - Database: PostgreSQL
```

Then we'll integrate our custom plugins into that structure.

## Expected Timeline

Following the implementation roadmap:

| Phase | Duration | Description |
|-------|----------|-------------|
| **Phase 0** | 1-2 days | Project setup, scaffolding, dev environment |
| **Phase 1** | 3-4 days | Backend foundation (GitHub service, database) |
| **Phase 2** | 3-4 days | Frontend foundation (UI components) |
| **Phase 3** | 4-5 days | GitHub integration (file browsing) |
| **Phase 4** | 5-6 days | File management (editing, commits) |
| **Phase 5** | 3-4 days | ArgoCD integration (sync) |
| **Phase 6** | 4-5 days | Production readiness (testing, docs, deploy) |

**Total:** 4-6 weeks to MVP

## Verify Installation

Once Phase 0 is complete, you should be able to:

```bash
# Start development server
yarn dev

# In separate terminals:
# Frontend: http://localhost:3000
# Backend: http://localhost:7007

# Health check
curl http://localhost:7007/api/gitops/health

# Expected response:
# {"status":"ok"}
```

## Next Steps

1. ✅ You are here: Project scaffolded, ready to implement
2. ⏭️ **Follow the roadmap:** Open `05-IMPLEMENTATION-ROADMAP.md`
3. ⏭️ **Start Phase 0:** Bootstrap Backstage app and create plugins
4. ⏭️ **Implement Phase 1:** Build backend services

## Troubleshooting

### PostgreSQL won't start
```bash
# Check if port 5432 is already in use
lsof -i :5432

# Stop any existing PostgreSQL
brew services stop postgresql  # if installed via Homebrew

# Restart Docker container
docker-compose down
docker-compose up -d postgres
```

### Yarn install fails
```bash
# Clear cache
yarn cache clean

# Remove node_modules and lockfile
rm -rf node_modules yarn.lock

# Reinstall
yarn install
```

### Port already in use
```bash
# Frontend (3000)
lsof -ti:3000 | xargs kill -9

# Backend (7007)
lsof -ti:7007 | xargs kill -9
```

## Documentation

- **Implementation Roadmap:** `05-IMPLEMENTATION-ROADMAP.md` (Start here!)
- **Architecture:** `../backstage-implementation/03-ARCHITECTURE.md`
- **Requirements:** `../backstage-implementation/02-REQUIREMENTS.md`
- **Knowledge Base:** `../backstage-implementation/04-KNOWLEDGE-BASE.md`
- **Project Structure:** `PROJECT-STRUCTURE.md`

## Getting Help

- Check `docs/TROUBLESHOOTING.md` (once implemented)
- Review phase-specific tasks in the roadmap
- Consult the knowledge base for technical details

## Current Status

📂 **Project scaffolded**
📋 **Roadmap ready**
📘 **Documentation complete**
⏳ **Ready to implement Phase 0**

**Let's build this! 🚀**
