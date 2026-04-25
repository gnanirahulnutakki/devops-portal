# GitOps Management Portal - Frequently Asked Questions (FAQ)

## Table of Contents

1. [General Questions](#general-questions)
2. [Getting Started](#getting-started)
3. [Using the Portal](#using-the-portal)
4. [Technical Questions](#technical-questions)
5. [Troubleshooting](#troubleshooting)
6. [Security & Permissions](#security--permissions)
7. [Best Practices](#best-practices)
8. [Advanced Topics](#advanced-topics)

---

## General Questions

### What is the GitOps Management Portal?

The GitOps Management Portal is a custom Backstage-based platform that enables DevOps teams to manage configuration files across hundreds of deployment branches from a single, unified interface. It solves the challenge of updating 350+ branches across 35+ repositories, reducing what used to take 4-6 hours to less than 15 minutes.

### Who should use this portal?

- **DevOps Engineers**: Manage configurations across environments
- **Platform Engineers**: Monitor deployments and ArgoCD applications
- **Release Managers**: Coordinate updates across tenants
- **Support Teams**: Troubleshoot configuration issues

### What problem does it solve?

**Before**:
- Manually updating values.yaml across 350+ branches
- Using scripts with error-prone find-and-replace
- 4-6 hours per update
- 5-10% error rate
- No centralized audit trail

**After**:
- Visual UI with editor and diff view
- Field-level precision updates
- <15 minutes per update
- <1% error rate
- Complete audit trail

### How does it work?

1. **Browse** repositories and branches via GitHub API
2. **Edit** files using Monaco editor (VS Code-like experience)
3. **Commit** changes to single or multiple branches
4. **Monitor** deployments via ArgoCD integration
5. **Audit** all changes in centralized database

---

## Getting Started

### How do I access the portal?

**Development/Local**:
```
http://localhost:3000/gitops
```

**Production** (when deployed):
```
https://gitops.radiantlogic.com
```

### Do I need to install anything?

For **using** the portal: No, just access the URL in your browser.

For **running** the portal locally:
- Node.js 18+
- Yarn package manager
- Docker (for PostgreSQL)
- GitHub Personal Access Token

### How do I get a GitHub token?

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `read:org` - Read org membership
   - ✅ `workflow` - Update workflows (if needed)
4. Click "Generate token"
5. **Copy the token immediately** (you won't see it again!)
6. Save it in `.env` file as `GITHUB_TOKEN=ghp_...`

### Where do I start?

1. Read the [User Guide](../guides/user-guide.md)
2. Watch the demo video (if available)
3. Try browsing a repository in a dev/qa environment
4. Practice editing a single file
5. Try a small bulk operation (2-3 branches)
6. Explore other features (PRs, ArgoCD, audit logs)

---

## Using the Portal

### Can I undo a change?

**Git commits** cannot be directly undone, but you can:

1. **Revert the commit**:
   - Create a new commit that reverses the changes
   - Use bulk operation to revert across multiple branches

2. **Create a PR to revert**:
   - Create a revert PR for review
   - Merge after approval

3. **Manual fix**:
   - Edit the file again with the correct value
   - Commit the fix

**Best Practice**: Always preview changes before committing!

### What file types can I edit?

The portal works best with:
- **YAML files** (values.yaml, config.yaml, etc.)
- **JSON files** (package.json, config.json, etc.)
- **Text files** (scripts, configs, etc.)

The Monaco editor provides:
- Syntax highlighting
- YAML/JSON validation
- Auto-completion
- Error detection

### Can I edit binary files?

No, the portal is designed for text-based configuration files. Binary files (images, PDFs, etc.) should be managed outside the portal.

### How many branches can I update at once?

**Technical limit**: No hard limit, but practical considerations:

- **Recommended**: 50-100 branches per operation
- **Maximum tested**: 350+ branches (all tenants)

**Factors**:
- GitHub API rate limits (5,000/hour)
- Operation timeout (10 minutes default)
- System resources

**For very large operations**: Split into smaller batches.

### How long does a bulk operation take?

**Depends on**:
- Number of branches
- File size
- System load
- GitHub API response time

**Typical timings**:
- **10 branches**: 1-2 minutes
- **50 branches**: 5-10 minutes
- **100 branches**: 10-15 minutes

**Parallelization**: The system processes 10 branches concurrently.

### Can I cancel a bulk operation?

**Currently**: No direct cancel button (feature planned).

**Workarounds**:
- Wait for operation to complete
- Failed branches won't be retried automatically
- Manually revert completed branches if needed

### What happens if a bulk operation fails?

The operation continues for other branches and provides a detailed report:

- **Successful branches**: List of branches updated successfully
- **Failed branches**: List with specific error messages
- **Partial success**: You can retry just the failed branches

**Common failure reasons**:
- Branch doesn't exist
- File doesn't exist on that branch
- Branch protection rules
- GitHub API rate limit
- Network issues

---

## Technical Questions

### What is Backstage?

Backstage is an open-source developer portal platform created by Spotify. It provides:
- Plugin architecture
- Consistent UI framework (Material-UI)
- Integration capabilities
- Built-in features (catalog, docs, search)

The GitOps Portal is a custom plugin built on Backstage.

### How does the portal connect to GitHub?

Via the **Octokit** library, which is GitHub's official REST API client:

1. Authentication: Personal Access Token
2. API calls: REST API v3
3. Rate limiting: Built-in retry logic
4. Caching: Minimal caching to respect rate limits

### How does ArgoCD integration work?

The portal connects to ArgoCD via its REST API:

1. **Authentication**: Bearer token or username/password
2. **List apps**: Query all applications in namespace
3. **Sync**: Trigger manual synchronization
4. **Health**: Check application health status

### Where is data stored?

**PostgreSQL database** stores:
- Audit logs (all user actions)
- Bulk operation status and results
- User sessions (when auth is enabled)

**GitHub** stores:
- All code and configuration files
- Commit history
- Pull requests

**Not stored locally**:
- Repository data (fetched from GitHub in real-time)
- Branch information (fetched from GitHub)

### Is data cached?

**Minimal caching** to balance performance and freshness:

- **Repositories**: Not cached (always fresh from GitHub)
- **Branches**: Not cached (always fresh from GitHub)
- **Files**: Not cached (always fresh from GitHub)

**Reason**: We want real-time data, especially for critical operations.

### What happens if GitHub is down?

If GitHub API is unavailable:
- Portal cannot fetch repositories/branches/files
- Error messages will indicate GitHub connectivity issues
- Audit logs and bulk operations history remain accessible
- Portal UI remains functional for viewing historical data

---

## Troubleshooting

### I'm seeing mock data instead of real repositories

**Cause**: GitHub token not loaded or invalid.

**Fix**:
1. Check `.env` file has `GITHUB_TOKEN=ghp_...`
2. Restart with `./start-with-env.sh`
3. Verify token is valid:
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
   ```

See [Troubleshooting Guide](../guides/troubleshooting.md#github-integration-issues) for more.

### The portal won't start

**Common causes**:
1. Port already in use (3000 or 7007)
2. PostgreSQL not running
3. Node modules not installed
4. Environment variables not set

**Quick fix**:
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:7007 | xargs kill -9

# Start PostgreSQL
docker-compose up -d postgres

# Reinstall and start
yarn install
./start-with-env.sh
```

### I can't see a specific repository

**Possible reasons**:
1. Repository is private and your token doesn't have access
2. You're not a member of the organization
3. Repository was recently created (refresh the list)

**Verify access**:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/radiantlogic-saas/REPO_NAME
```

### My changes didn't work

**Check**:
1. **Commit was successful?** Check audit logs
2. **Correct branch?** Verify you committed to the intended branch
3. **ArgoCD synced?** Check if ArgoCD has synced the changes
4. **YAML syntax?** Ensure no syntax errors introduced

### How do I check if my update worked?

1. **Immediate verification**:
   - Check commit in GitHub (link in success message)
   - View file in GitHub to confirm changes

2. **ArgoCD verification**:
   - Go to ArgoCD Applications section
   - Find the application for that branch
   - Check if status is "OutOfSync" (change detected)
   - Trigger sync or wait for auto-sync

3. **Audit log**:
   - Check audit logs for your operation
   - Verify commit SHA and timestamp

---

## Security & Permissions

### Who can access the portal?

**Currently (Dev Mode)**: Anyone with access to the URL.

**Production (Planned)**:
- GitHub OAuth authentication required
- Only members of `radiantlogic-saas` organization
- Role-based access control (RBAC)

### What can users do?

**Read Access**:
- Browse repositories
- View branches and files
- View pull requests
- View audit logs
- View ArgoCD status

**Write Access** (requires token with `repo` scope):
- Edit and commit files
- Create pull requests
- Trigger ArgoCD syncs
- Create bulk operations

### Can I restrict access to specific repositories?

**Currently**: No, users see all repositories their GitHub token has access to.

**Future**: Role-based access control will allow:
- Repo-level permissions
- Branch-level permissions
- Operation-level permissions (e.g., bulk operations require admin)

### Are credentials secure?

**Yes**:
- Environment variables never exposed to frontend
- Secrets stored in `.env` file (never committed to Git)
- HTTPS for production deployments
- Session-based auth (when enabled)

**Best practices**:
- Never commit `.env` file
- Rotate tokens periodically
- Use principle of least privilege
- Enable audit logging

### What's logged in the audit trail?

**Everything**:
- Who (user ID/email)
- What (operation type)
- When (timestamp)
- Where (repository, branch, file)
- How (commit SHA, changes made)

**Audit logs include**:
- File updates
- Pull request creation
- Bulk operations
- ArgoCD syncs
- Configuration changes

**Retention**: Configurable (default 90 days)

---

## Best Practices

### How should I name my commit messages?

**Good commit messages**:
```
Update FID version to 8.1.2 for security patch CVE-2024-1234
Fix nodeSelector typo in mp02 tenant config
Add monitoring labels to Grafana dashboard
Update resource limits after load testing
```

**Bad commit messages**:
```
update
fix
changes
WIP
asdf
```

**Format**:
```
<verb> <what> <why (optional)>

Examples:
- Update FID version to 8.1.2
- Fix YAML indentation in values.yaml
- Add new environment variable for API key
- Remove deprecated configuration options
```

### Should I use feature branches?

**Yes, for**:
- Major changes
- Changes affecting multiple files
- Changes requiring peer review
- Experimental changes

**No, for**:
- Minor updates to tenant branches
- Hotfixes that need immediate deployment
- Single-value updates

### How often should I create pull requests?

**Use PRs when**:
- Changing master/main branch
- Making significant configuration changes
- Requiring peer review
- Learning/onboarding

**Direct commits okay for**:
- Tenant branch updates (if confident)
- Version bumps after testing
- Routine maintenance tasks

### What's the best way to test changes?

1. **Test in dev/qa environment first**:
   - Update one dev branch
   - Verify deployment
   - Monitor for issues

2. **Use a canary approach**:
   - Update 1-2 production tenants first
   - Monitor for 24-48 hours
   - Roll out to remaining tenants

3. **Validate YAML syntax**:
   - Use Monaco editor validation
   - Test files locally if possible
   - Check for typos and formatting

### How do I handle errors in bulk operations?

1. **Review failed branches**:
   - Check error messages
   - Identify common patterns

2. **Fix underlying issues**:
   - Branch doesn't exist? Create it
   - File doesn't exist? Add it manually
   - Protection rules? Use PR workflow

3. **Retry failed branches**:
   - Use "Retry Failed" button
   - Or run new operation with only failed branches

4. **Document lessons learned**:
   - Update runbooks
   - Share with team
   - Prevent future occurrences

---

## Advanced Topics

### Can I automate operations via API?

**Yes!** The portal provides a full REST API. See [API Reference](api-reference.md).

**Example use cases**:
- CI/CD integration
- Scheduled updates
- Custom automation scripts
- Integration with other tools

**Example**:
```bash
# Update FID version via API
curl -X POST http://localhost:7007/api/gitops/bulk-operations \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "rli-use2",
    "branches": ["rli-use2-mp02", "rli-use2-mp04"],
    "file_path": "app/charts/radiantone/values.yaml",
    "operation_type": "field_update",
    "field_path": "fid.image.tag",
    "new_value": "8.1.2",
    "commit_message": "Update FID version to 8.1.2 via API"
  }'
```

### How do I extend the portal?

The portal is built on Backstage's plugin architecture:

1. **Create new plugin**:
   ```bash
   yarn new --select plugin
   ```

2. **Add custom endpoints**:
   - Modify `plugins/gitops-backend/src/service/router.ts`
   - Add new routes and handlers

3. **Add UI components**:
   - Create components in `plugins/gitops/src/components/`
   - Add routes in `plugins/gitops/src/plugin.ts`

4. **Integrate with other services**:
   - Add new service class (e.g., `JenkinsService`)
   - Configure in `app-config.yaml`

### Can I integrate with Jenkins/other CI tools?

**Planned features**:
- Jenkins integration (trigger builds)
- CircleCI integration
- GitHub Actions integration
- Custom webhook support

**Current workaround**: Use the API to trigger operations from your CI tool.

### How do I contribute to the portal?

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes** and add tests
4. **Submit pull request**

See [Contributing Guide](../reference/contributing.md) (coming soon).

### Can I deploy the portal to Kubernetes?

**Yes!** Helm charts are included:

```bash
# Install with Helm
helm install backstage-gitops ./helm \
  --namespace gitops-portal \
  --values helm/values-prod.yaml
```

See [Admin Guide](../guides/admin-guide.md#production-deployment) for details.

### How do I monitor the portal's performance?

**Metrics exposed at `/metrics` (Prometheus format)**:
- Request count by endpoint
- Response time percentiles
- Error rates
- GitHub API usage
- Database query performance

**Recommended monitoring**:
- Prometheus + Grafana
- AlertManager for alerts
- ELK/Loki for logs

### What's on the roadmap?

**Coming soon**:
- ✅ Field-level YAML editing (Done)
- ✅ Bulk operations (Done)
- ✅ Audit logging (Done)
- ⏳ GitHub OAuth authentication
- ⏳ Role-based access control
- ⏳ Advanced PR workflow features
- ⏳ S3 browser integration
- ⏳ Automated testing framework
- ⏳ GraphQL API
- ⏳ Mobile-responsive UI
- ⏳ Dark mode

**Future considerations**:
- Multi-organization support
- GitLab integration
- Terraform file editing
- Configuration templating
- Drift detection

---

## Still Have Questions?

### Check the Documentation

- [User Guide](../guides/user-guide.md) - How to use the portal
- [Admin Guide](../guides/admin-guide.md) - Installation and configuration
- [Troubleshooting Guide](../guides/troubleshooting.md) - Common issues
- [API Reference](api-reference.md) - API documentation

### Contact Support

- **Email**: platform-team@radiantlogic.com
- **Slack**: #platform-team channel
- **GitHub**: https://github.com/radiantlogic-saas/backstage-gitops/issues

### Provide Feedback

We'd love to hear from you!
- Feature requests
- Bug reports
- UX improvements
- Documentation suggestions

**Submit via**:
- GitHub Issues
- Slack #platform-team
- Email to platform-team@radiantlogic.com
