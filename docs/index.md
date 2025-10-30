# RadiantLogic DevOps Management Portal

Welcome to the RadiantLogic DevOps Management Portal documentation. This portal provides a unified interface for managing multi-branch configurations, pull requests, and ArgoCD deployments across 50+ customer environments.

## What is This Portal?

The RadiantLogic DevOps Portal is a custom Backstage-based platform that enables:

- **Multi-Branch Configuration Management**: Edit values.yaml across multiple environment branches simultaneously
- **Pull Request Workflow**: Create, review, and merge PRs with visual diffs and timelines
- **ArgoCD Integration**: Monitor and manage Kubernetes deployments
- **Audit Trail**: Track all configuration changes and operations
- **Grafana Dashboards**: View metrics and monitoring data
- **S3 Browser**: Access deployment artifacts and logs

## Quick Links

- [Getting Started](getting-started.md) - New to the portal? Start here
- [User Guides](guides/README.md) - Step-by-step instructions for common tasks
- [API Reference](reference/api-reference.md) - Backend API documentation
- [Tutorials](tutorials/README.md) - Hands-on learning scenarios
- [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions

## Portal Sections

### 🏠 Home
Dashboard showing recent activity, statistics, and quick actions

### 📁 Repository Browser
Browse and edit configuration files across multiple branches:
- Select repository, branch, and file
- Edit with Monaco code editor
- Commit to single or multiple branches
- Create pull requests

### 🔀 Pull Requests
Manage pull request workflow:
- View open/closed PRs
- Review changes with diff viewer
- View PR timeline and comments
- Merge or close PRs

### 🚀 ArgoCD Applications
Monitor Kubernetes deployments:
- View application sync status
- Trigger manual syncs
- View deployment history
- Monitor application health

### ⚙️ Operations
Track bulk operations:
- View operation status
- Monitor progress across branches
- View success/failure results

### 📊 Audit Logs
Complete audit trail:
- All configuration changes
- User actions
- Operation results
- Timestamps and metadata

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)            │
│                      Backstage Framework                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ REST API
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend (Node.js + Express)                   │
│  ┌──────────────┬──────────────┬──────────────────────────┐│
│  │ GitHub       │ ArgoCD       │ Grafana                  ││
│  │ Service      │ Service      │ Service                  ││
│  └──────────────┴──────────────┴──────────────────────────┘│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│            PostgreSQL (Audit Logs & Operations)             │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### Bulk Operations
Update configuration values across 50+ branches in a single operation:
- Field-level editing (e.g., update only `fid.image.tag`)
- Full file replacement
- Asynchronous processing with progress tracking
- Detailed success/failure reporting

### GitOps Workflow
Industry-standard Git workflow:
1. Create feature branch
2. Make changes
3. Create pull request
4. Review and merge
5. ArgoCD auto-deploys

### Multi-Tenant Support
Each customer environment has its own branch:
- `prod-usw2-customer1`
- `qa-usw2-customer2`
- `staging-use2-customer3`

### Safety Features
- Preview changes before committing
- Audit log of all operations
- Protected branch warnings
- PR review workflow
- Rollback capabilities

## Technology Stack

- **Frontend**: React 18, TypeScript, Material-UI v4
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **APIs**: GitHub (Octokit), ArgoCD, Grafana
- **Framework**: Backstage
- **Editor**: Monaco Editor (VS Code editor)

## Support

For issues, questions, or feature requests:
- Check [Troubleshooting Guide](guides/troubleshooting.md)
- Review [FAQ](reference/faq.md)
- Contact DevOps team

## Contributing

See [Development Guide](reference/development.md) for information on:
- Setting up development environment
- Running tests
- Code standards
- Submitting changes
