# GitHub Actions Workflows

This directory contains CI/CD workflows for the Backstage GitOps Portal.

## 🚀 Workflows

### Docker Build and Push (`docker-build-push.yml`)

Automatically builds and pushes Docker images to Docker Hub when changes are pushed.

#### Triggers

**Automatic Triggers:**
- Push to `main` branch (builds and pushes to Docker Hub)
- Push to `develop` branch (builds and pushes to Docker Hub)
- Pull requests to `main` (builds only, doesn't push)

**Manual Trigger:**
- Can be manually triggered via GitHub Actions UI
- Allows custom tag specification

**Watched Paths:**
- `packages/**` - Application code changes
- `plugins/**` - Plugin changes
- `deployment/docker/Dockerfile` - Dockerfile changes
- `app-config*.yaml` - Configuration changes
- `package.json` - Dependency changes
- `yarn.lock` - Lock file changes

#### Docker Image Tags

The workflow automatically creates multiple tags:

| Tag | Description | Example |
|-----|-------------|---------|
| `latest` | Latest build from main branch | `rahulnutakki/devprotal:latest` |
| `main` | Latest from main branch | `rahulnutakki/devprotal:main` |
| `develop` | Latest from develop branch | `rahulnutakki/devprotal:develop` |
| `main-abc1234` | Git SHA on branch | `rahulnutakki/devprotal:main-abc1234` |
| `2025-10-30-abc1234` | Date + SHA | `rahulnutakki/devprotal:2025-10-30-abc1234` |
| `v1.0.0` | Semantic version (if tagged) | `rahulnutakki/devprotal:v1.0.0` |
| `pr-123` | Pull request number | `rahulnutakki/devprotal:pr-123` |

#### Features

✅ **Automated Builds**
- Builds on every push to main/develop
- Validates builds on pull requests

✅ **Multi-Tag Support**
- Automatically creates semantic tags
- Branch-specific tags
- SHA-based tags for traceability

✅ **Docker Layer Caching**
- Uses GitHub Actions cache
- Faster subsequent builds

✅ **Security Scanning**
- Trivy vulnerability scanning
- Results uploaded to GitHub Security tab
- Scans for CRITICAL and HIGH vulnerabilities

✅ **Build Summaries**
- Automatic summary in GitHub Actions
- PR comments with build status
- Easy copy-paste pull commands

✅ **Pull Request Validation**
- Builds Docker image on PRs
- Comments on PR with build status
- Doesn't push to Docker Hub (validation only)

## 🔐 Required Secrets

Configure these secrets in your GitHub repository:

### Docker Hub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DOCKER_USERNAME` | Docker Hub username | Your Docker Hub username (e.g., `rahulnutakki`) |
| `DOCKER_PASSWORD` | Docker Hub access token | Generate at: https://hub.docker.com/settings/security |

#### Creating Docker Hub Access Token

1. Go to https://hub.docker.com/settings/security
2. Click **"New Access Token"**
3. Name: `github-actions-devops-portal`
4. Permissions: **Read, Write, Delete**
5. Click **"Generate"**
6. Copy the token (it won't be shown again)
7. Add as `DOCKER_PASSWORD` secret in GitHub

### Adding Secrets to GitHub

```bash
# Via GitHub CLI
gh secret set DOCKER_USERNAME -b "rahulnutakki"
gh secret set DOCKER_PASSWORD -b "your_docker_hub_token"

# Or via GitHub web UI:
# 1. Go to repository Settings
# 2. Secrets and variables → Actions
# 3. New repository secret
# 4. Add DOCKER_USERNAME and DOCKER_PASSWORD
```

## 📖 Usage Examples

### Automatic Build on Push

```bash
# Make changes to code
git add .
git commit -m "Update backend service"
git push origin main

# GitHub Actions automatically:
# 1. Builds Docker image
# 2. Tags with multiple tags
# 3. Pushes to Docker Hub
# 4. Scans for vulnerabilities
# 5. Updates GitHub Security tab
```

### Manual Trigger with Custom Tag

1. Go to **Actions** tab in GitHub
2. Select **"Build and Push Docker Image"** workflow
3. Click **"Run workflow"**
4. Select branch: `main`
5. Enter tag: `v1.2.3` (optional)
6. Click **"Run workflow"**

### Pull Request Validation

```bash
# Create feature branch
git checkout -b feature/new-plugin

# Make changes
git add .
git commit -m "Add new plugin"
git push origin feature/new-plugin

# Create PR to main
# GitHub Actions automatically:
# 1. Builds Docker image (validation)
# 2. Comments on PR with build status
# 3. Does NOT push to Docker Hub
```

## 🎯 Workflow Outputs

### Build Summary

After each successful build, you'll see:

```
## Docker Image Build Summary 🐳

**Repository:** `rahulnutakki/devprotal`

**Tags pushed:**
rahulnutakki/devprotal:latest
rahulnutakki/devprotal:main
rahulnutakki/devprotal:main-abc1234
rahulnutakki/devprotal:2025-10-30-abc1234

**Pull command:**
docker pull rahulnutakki/devprotal:latest

**Labels:**
org.opencontainers.image.created=2025-10-30T21:30:00Z
org.opencontainers.image.revision=abc1234...
```

### Security Scan Results

Vulnerability scan results are available at:
- **GitHub Security** → **Code scanning alerts**
- View CRITICAL and HIGH vulnerabilities
- Get recommendations for fixes

## 🔧 Customization

### Change Docker Image Name

Edit `.github/workflows/docker-build-push.yml`:

```yaml
env:
  DOCKER_IMAGE: your-username/your-image-name
```

### Add More Triggers

```yaml
on:
  push:
    branches:
      - main
      - develop
      - staging  # Add staging branch
    tags:
      - 'v*'     # Trigger on version tags
```

### Add Different Platforms

```yaml
platforms: linux/amd64,linux/arm64  # Add ARM64 support
```

### Modify Tag Strategy

```yaml
tags: |
  type=semver,pattern={{version}}
  type=raw,value=stable  # Add custom 'stable' tag
```

## 🐛 Troubleshooting

### Build Fails

**Check these:**

1. **Dockerfile Path**: Ensure `deployment/docker/Dockerfile` exists
2. **Dependencies**: Check `package.json` and `yarn.lock` are valid
3. **Build Logs**: View detailed logs in GitHub Actions tab

### Authentication Fails

**Error:** `unauthorized: authentication required`

**Solution:**
1. Verify `DOCKER_USERNAME` secret is correct
2. Regenerate Docker Hub access token
3. Update `DOCKER_PASSWORD` secret
4. Ensure token has "Read, Write" permissions

### Image Not Pushed

**Check:**
1. Workflow ran on `main` or `develop` branch (not PR)
2. No build errors in logs
3. Docker Hub credentials are valid
4. Repository `rahulnutakki/devprotal` exists

### Slow Builds

**Optimization:**
1. Build cache is working (check logs for cache hits)
2. Multi-stage Dockerfile is optimized
3. `.dockerignore` excludes unnecessary files

### Security Scan Failures

**If vulnerabilities found:**
1. Check GitHub Security tab
2. Update vulnerable dependencies: `yarn upgrade`
3. Update base image in Dockerfile
4. Re-run workflow

## 📊 Monitoring

### View Build History

```bash
# Via GitHub CLI
gh run list --workflow=docker-build-push.yml

# Via GitHub web
# Go to Actions tab → Build and Push Docker Image
```

### Check Latest Image

```bash
# Pull latest image
docker pull rahulnutakki/devprotal:latest

# View image details
docker inspect rahulnutakki/devprotal:latest

# View image layers
docker history rahulnutakki/devprotal:latest
```

### Monitor Security

```bash
# View security alerts
gh api repos/:owner/:repo/code-scanning/alerts

# Or visit:
# https://github.com/gnanirahulnutakki/devops-portal/security/code-scanning
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Docker Hub](https://hub.docker.com/r/rahulnutakki/devprotal)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)

## 🔄 Workflow Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  Developer pushes to main/develop or creates PR             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions triggered                                    │
│  - Checkout code                                             │
│  - Setup Docker Buildx                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Build Docker Image                                          │
│  - Use layer caching                                         │
│  - Multi-stage build                                         │
│  - Generate tags                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Push to Docker Hub (if not PR)                             │
│  - Login with secrets                                        │
│  - Push all tags                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Security Scan                                               │
│  - Trivy vulnerability scan                                  │
│  - Upload to GitHub Security                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Generate Summary                                            │
│  - Build summary in Actions                                  │
│  - Comment on PR (if applicable)                            │
└─────────────────────────────────────────────────────────────┘
```

## 🎉 Success Indicators

You'll know the workflow is working when:

✅ Green checkmark in GitHub commits
✅ New image appears in Docker Hub
✅ Multiple tags created automatically
✅ Security scan results in GitHub Security tab
✅ Build summary shows in Actions tab
✅ PR comments show build status

---

**Repository:** https://github.com/gnanirahulnutakki/devops-portal
**Docker Hub:** https://hub.docker.com/r/rahulnutakki/devprotal
