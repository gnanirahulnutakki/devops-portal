# Backstage GitOps Portal - Startup Guide

## Overview
This guide explains how to properly start the Backstage GitOps Management Portal with GitHub integration and all environment variables configured.

## Prerequisites

- Node.js 24.1.0 or higher
- Yarn 1.22.22
- PostgreSQL 14 (running locally or accessible remotely)
- GitHub Personal Access Token (PAT)
- (Optional) ArgoCD API Token
- (Optional) Grafana API Key

## Environment Setup

### 1. Configure Environment Variables

Create or verify the `.env` file in the project root contains the following:

```bash
# GitHub Configuration (REQUIRED for real data)
GITHUB_TOKEN=your_github_pat_token_here

# PostgreSQL Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=backstage
POSTGRES_DB=backstage

# ArgoCD Configuration (Optional - uses mock data if not provided)
ARGOCD_TOKEN=your_argocd_token_here
ARGOCD_API_URL=https://argocd.your-domain.com

# Grafana Configuration (Optional)
GRAFANA_API_KEY=your_grafana_api_key_here
GRAFANA_URL=https://your-instance.grafana.net
```

**Important Notes:**
- `GITHUB_TOKEN` is **REQUIRED** to load real repository data
- Without the GitHub token, the portal will run in mock data mode with only 2 sample repositories
- Database credentials can be adjusted based on your PostgreSQL setup
- ArgoCD and Grafana are optional - they will use mock data if tokens are not provided

### 2. Generate GitHub Personal Access Token

If you don't have a GitHub PAT yet:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Backstage GitOps Portal")
4. Select the following scopes:
   - `repo` (all sub-scopes) - for repository access
   - `read:org` - for organization access
   - `read:user` - for user information
5. Generate token and copy it to your `.env` file

## Starting the Portal

### Method 1: Using the Startup Script (RECOMMENDED)

The project includes a startup script that automatically loads environment variables:

```bash
# Make sure you're in the project root
cd /path/to/backstage-gitops

# Make the script executable (first time only)
chmod +x start-with-env.sh

# Start the portal
./start-with-env.sh
```

This script:
- Loads all environment variables from `.env`
- Starts both backend and frontend servers
- Ensures GitHub token is available to the application

### Method 2: Manual Start with Environment Variables

If you prefer to start manually:

```bash
# Load environment variables
set -a
source .env
set +a

# Start the development servers
yarn dev
```

### Method 3: Direct Export (Alternative)

```bash
# Export environment variables manually
export GITHUB_TOKEN=your_github_pat_token_here
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=backstage
export POSTGRES_PASSWORD=backstage
export POSTGRES_DB=backstage

# Start the servers
yarn dev
```

## Verifying the Setup

### 1. Check Server Status

After starting, you should see:

```
[1] Loading config from MergedConfigSource...
[1] [backstage] info Found 6 new secrets in config that will be redacted
[1] [rootHttpRouter] info Listening on :7007
[0] webpack compiled successfully
```

**Key Indicators:**
- Backend running on: `http://localhost:7007`
- Frontend running on: `http://localhost:3000`
- No "[GitHubService] Using mock data mode" message means GitHub token is loaded ✓

### 2. Verify GitHub Integration

Test the API directly:

```bash
# Should return real repository data
curl http://localhost:7007/api/gitops/repositories | jq '.'
```

Expected output:
- Array of real repositories from your GitHub organization
- Repository names like "ensemble", "rli-use2", "rli-usw2", etc.
- Actual repository metadata (created_at, pushed_at, etc.)

**Mock Data Mode (if token is missing):**
- Only 2 sample repositories visible
- Log shows: `[GitHubService] Using mock data mode (no token provided)`

### 3. Access the Portal

Open your browser:
- **Main Portal**: http://localhost:3000
- **GitOps Management**: http://localhost:3000/gitops
- **Documentation**: http://localhost:3000/documentation
- **Grafana**: http://localhost:3000/grafana
- **S3 Browser**: http://localhost:3000/s3

## Navigation

The portal sidebar includes:

- **Home** - Catalog homepage
- **APIs** - API documentation
- **Docs** - Tech docs
- **Create** - Component scaffolding
- **GitOps** - Main GitOps management portal
  - Repository Browser
  - Pull Requests
  - ArgoCD Applications
  - Operations
  - Audit Logs
- **Grafana** - Grafana Cloud dashboards
- **S3 Browser** - S3 file browser
- **Documentation** - Complete portal documentation (NEW!)

## Troubleshooting

### Issue: Only seeing mock data / 2 repositories

**Cause**: GitHub token not loaded or invalid

**Solution**:
1. Verify `.env` file has `GITHUB_TOKEN=your_token`
2. Stop the server (Ctrl+C)
3. Restart using `./start-with-env.sh` (not just `yarn dev`)
4. Check logs for "[GitHubService] Using mock data mode" message
5. If message appears, token is not being loaded

### Issue: "ModuleNotFoundError: No module named 'distutils'"

**Cause**: Optional native dependencies failing to build (cpu-features, better-sqlite3, isolated-vm)

**Solution**:
- These errors are safe to ignore - they're for optional features
- The portal will run successfully despite these warnings
- Main dependencies install correctly

### Issue: Database connection errors

**Cause**: PostgreSQL not running or wrong credentials

**Solution**:
1. Start PostgreSQL: `brew services start postgresql@14` (macOS) or `sudo systemctl start postgresql` (Linux)
2. Verify credentials in `.env` match your PostgreSQL setup
3. Test connection: `psql -h localhost -U backstage -d backstage`

### Issue: Port already in use (3000 or 7007)

**Cause**: Previous instance still running

**Solution**:
```bash
# Find and kill processes on ports
lsof -ti:3000 | xargs kill
lsof -ti:7007 | xargs kill

# Or kill by process name
pkill -f "backstage-cli"

# Then restart
./start-with-env.sh
```

## Development Workflow

### Standard Workflow

```bash
# 1. Pull latest changes (if using git)
git pull

# 2. Install dependencies (if package.json changed)
yarn install

# 3. Start the portal
./start-with-env.sh

# 4. Make your changes
# Frontend auto-reloads on changes
# Backend requires restart for most changes

# 5. Stop the server
# Press Ctrl+C in terminal
```

### Hot Reload

- **Frontend**: Auto-reloads on file changes
- **Backend**: Manual restart required for most changes
- **Configuration**: Restart required for app-config.yaml changes

## Production Deployment

For production deployment, see `docs/guides/admin-guide.md` for:
- Production build process
- Container deployment
- Environment variable management
- Security considerations
- Monitoring and logging

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./start-with-env.sh` | Start with env vars (recommended) |
| `yarn dev` | Start without loading .env |
| `yarn install` | Install dependencies |
| `yarn build` | Production build |
| `yarn test` | Run tests |
| `Ctrl+C` | Stop servers |

## Important Files

```
backstage-gitops/
├── .env                          # Environment variables (REQUIRED)
├── start-with-env.sh             # Startup script (RECOMMENDED)
├── app-config.yaml               # Backstage configuration
├── packages/
│   ├── app/                      # Frontend application
│   │   └── public/
│   │       └── docs/            # Symlink to documentation
│   └── backend/                  # Backend application
├── plugins/
│   └── gitops/                   # GitOps plugin
└── docs/                         # Documentation markdown files
    ├── README.md                 # Documentation index
    ├── getting-started.md
    ├── guides/
    │   ├── user-guide.md
    │   ├── admin-guide.md
    │   ├── troubleshooting.md
    │   ├── bulk-operations.md
    │   └── pr-workflow.md
    └── reference/
        ├── api-reference.md
        └── faq.md
```

## Support

For issues or questions:
1. Check the documentation at `/documentation` in the portal
2. Review `docs/guides/troubleshooting.md`
3. Check GitHub issues (if applicable)
4. Contact the platform team

## Summary

**To start Backstage with GitHub data:**

```bash
# One-time setup
chmod +x start-with-env.sh

# Every time you start
./start-with-env.sh
```

**Remember:**
- Always use `./start-with-env.sh` to ensure environment variables are loaded
- Never use `yarn dev` directly unless you've manually exported environment variables
- Check for "[GitHubService] Using mock data mode" in logs to confirm token is loaded
- The GitHub token in `.env` must be valid and have appropriate permissions
