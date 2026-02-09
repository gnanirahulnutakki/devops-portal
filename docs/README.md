# GitOps Management Portal - Documentation

Welcome to the complete documentation for the RadiantLogic GitOps Management Portal!

## 📚 Documentation Map

### Getting Started
Start here if you're new to the portal:

- **[Main Overview](index.md)** - What is the portal and what can it do?
- **[Getting Started Guide](getting-started.md)** - Quick start and initial setup

### User Guides
Learn how to use the portal effectively:

- **[User Guide](guides/user-guide.md)** ⭐ - Comprehensive guide for daily usage
  - Portal overview and navigation
  - Common tasks (browsing, editing, bulk operations)
  - Pull request workflow
  - Best practices and tips

- **[Bulk Operations Guide](guides/bulk-operations.md)** - Deep dive into bulk updates
- **[Pull Request Workflow](guides/pr-workflow.md)** - PR creation and review process
- **[Troubleshooting Guide](guides/troubleshooting.md)** - Common issues and solutions

### Administrator Guides
For administrators and operators:

- **[Admin Guide](guides/admin-guide.md)** ⭐ - Complete admin/ops handbook
  - Installation and setup
  - Configuration management
  - Production deployment
  - Security and access control
  - Monitoring and maintenance
  - Backup and recovery

### Reference Documentation
Technical reference and API documentation:

- **[API Reference](reference/api-reference.md)** - REST API documentation
  - All endpoints documented
  - Request/response examples
  - Code samples in multiple languages
  - SDK examples

- **[FAQ](reference/faq.md)** - Frequently asked questions
  - General questions
  - Technical questions
  - Troubleshooting
  - Best practices

---

## 🎯 Quick Navigation by Role

### I'm a DevOps Engineer
**You want to**: Manage configurations across environments

**Start with**:
1. [User Guide](guides/user-guide.md) - Learn the basics
2. [Bulk Operations Guide](guides/bulk-operations.md) - Master bulk updates
3. [API Reference](reference/api-reference.md) - Automate with scripts

**Common tasks**:
- Update FID versions across tenants
- Manage values.yaml configurations
- Create and review pull requests
- Monitor ArgoCD deployments

### I'm a Platform Engineer
**You want to**: Deploy and maintain the portal

**Start with**:
1. [Admin Guide](guides/admin-guide.md) - Installation and configuration
2. [Troubleshooting Guide](guides/troubleshooting.md) - Fix common issues
3. [API Reference](reference/api-reference.md) - Integration options

**Common tasks**:
- Deploy portal to Kubernetes
- Configure GitHub/ArgoCD integration
- Monitor system health
- Manage database backups

### I'm a Developer
**You want to**: Integrate the portal with other tools

**Start with**:
1. [API Reference](reference/api-reference.md) - REST API docs
2. [FAQ](reference/faq.md) - Advanced topics
3. [Admin Guide](guides/admin-guide.md#extending-the-portal) - Extend functionality

**Common tasks**:
- Automate operations via API
- Create custom integrations
- Build monitoring dashboards
- Develop new features

### I'm New Here
**You want to**: Understand what this is and how to use it

**Start with**:
1. [Main Overview](index.md) - Understand the big picture
2. [Getting Started](getting-started.md) - Get up and running
3. [User Guide](guides/user-guide.md) - Learn common tasks
4. [FAQ](reference/faq.md) - Get answers to common questions

---

## 📖 Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── index.md                           # Portal overview and introduction
├── getting-started.md                 # Quick start guide
│
├── guides/                            # User and admin guides
│   ├── user-guide.md                 # Comprehensive user guide
│   ├── admin-guide.md                # Admin and operations guide
│   ├── troubleshooting.md            # Troubleshooting reference
│   ├── bulk-operations.md            # Bulk operations deep dive
│   └── pr-workflow.md                # Pull request workflow
│
├── reference/                         # Technical reference
│   ├── api-reference.md              # REST API documentation
│   └── faq.md                        # Frequently asked questions
│
├── tutorials/                         # Step-by-step tutorials
│   └── (coming soon)
│
└── runbooks/                          # Operational runbooks
    └── (coming soon)
```

---

## 🔍 Find What You Need

### By Topic

**Configuration Management**
- [Editing files](guides/user-guide.md#task-2-editing-a-configuration-file-on-a-single-branch)
- [Bulk updates](guides/user-guide.md#task-3-bulk-update-across-multiple-branches)
- [Field-level updates](guides/bulk-operations.md)

**Pull Requests**
- [Creating PRs](guides/user-guide.md#task-4-creating-a-pull-request)
- [Reviewing PRs](guides/user-guide.md#task-5-reviewing-and-merging-a-pull-request)
- [PR workflow best practices](guides/pr-workflow.md)

**ArgoCD Integration**
- [Monitoring deployments](guides/user-guide.md#task-6-monitoring-argocd-deployments)
- [Triggering syncs](reference/api-reference.md#argocd-applications)
- [Troubleshooting ArgoCD](guides/troubleshooting.md#argocd-integration-issues)

**Automation**
- [API usage](reference/api-reference.md)
- [Bulk operations API](reference/api-reference.md#bulk-operations)
- [SDK examples](reference/api-reference.md#sdk-examples)

**Administration**
- [Installation](guides/admin-guide.md#installation-and-setup)
- [Configuration](guides/admin-guide.md#configuration)
- [Security](guides/admin-guide.md#security)
- [Monitoring](guides/admin-guide.md#monitoring-and-maintenance)

### By Problem

**"I can't see my repositories"**
→ [Troubleshooting: Mock data issue](guides/troubleshooting.md#issue-mock-data-instead-of-real-repositories)

**"My bulk operation failed"**
→ [Troubleshooting: Bulk operations](guides/troubleshooting.md#bulk-operations-issues)

**"The portal won't start"**
→ [Troubleshooting: Startup issues](guides/troubleshooting.md#startup-and-connection-issues)

**"How do I update 50 branches?"**
→ [User Guide: Bulk operations](guides/user-guide.md#task-3-bulk-update-across-multiple-branches)

**"Can I automate this?"**
→ [API Reference](reference/api-reference.md)

---

## 💡 Tips for Using This Documentation

### For First-Time Users

1. **Start broad, then narrow**: Read the [overview](index.md) first to understand the big picture
2. **Follow the getting started**: Complete the [getting started guide](getting-started.md) step-by-step
3. **Learn by doing**: Try the examples in the [user guide](guides/user-guide.md)
4. **Reference as needed**: Use the [API reference](reference/api-reference.md) and [FAQ](reference/faq.md) when you need specific information

### For Experienced Users

1. **Jump to what you need**: Use the table of contents in each guide
2. **Use search**: Browser search (Ctrl/Cmd+F) is your friend
3. **Check the FAQ**: Common questions are answered in the [FAQ](reference/faq.md)
4. **Refer to API docs**: [API Reference](reference/api-reference.md) for automation

### For Troubleshooting

1. **Check symptoms**: Identify what's not working
2. **Consult troubleshooting guide**: [Troubleshooting Guide](guides/troubleshooting.md) covers common issues
3. **Review logs**: Backend and frontend logs provide clues
4. **Search FAQ**: [FAQ](reference/faq.md) has solutions to frequent problems
5. **Get help**: Contact support if stuck (see below)

---

## 🔗 Additional Resources

### External Links

- **GitHub Repository**: https://github.com/radiantlogic-saas/backstage-gitops
- **Backstage Documentation**: https://backstage.io/docs
- **GitHub API Docs**: https://docs.github.com/en/rest
- **ArgoCD Docs**: https://argo-cd.readthedocs.io/

### Internal Resources

- **Slack**: #platform-team channel
- **Email**: platform-team@radiantlogic.com
- **Wiki**: (link to internal wiki if available)

---

## 📝 Documentation Feedback

### Help Us Improve

Found a typo? Something unclear? Want more examples?

**Submit feedback**:
- Create an issue: https://github.com/radiantlogic-saas/backstage-gitops/issues
- Email: platform-team@radiantlogic.com
- Slack: #platform-team channel

**What to include**:
- Which page/section
- What's confusing or missing
- Suggested improvements
- Examples that would help

---

## 📄 Document Versions

- **Current version**: 1.0
- **Last updated**: October 2025
- **Compatibility**: Portal v1.0+

---

## 🎓 Learning Path

### Beginner Path (1-2 hours)

1. ✅ [Portal Overview](index.md) (10 min)
2. ✅ [Getting Started](getting-started.md) (20 min)
3. ✅ [User Guide - Sections 1-4](guides/user-guide.md) (30 min)
4. ✅ Try browsing repositories (hands-on)
5. ✅ Try editing one file (hands-on)

### Intermediate Path (3-4 hours)

1. ✅ Complete Beginner Path
2. ✅ [User Guide - Complete](guides/user-guide.md) (1 hour)
3. ✅ [Bulk Operations Guide](guides/bulk-operations.md) (30 min)
4. ✅ Try a small bulk operation (hands-on)
5. ✅ Create and review a PR (hands-on)

### Advanced Path (1-2 days)

1. ✅ Complete Intermediate Path
2. ✅ [Admin Guide](guides/admin-guide.md) (2 hours)
3. ✅ [API Reference](reference/api-reference.md) (1 hour)
4. ✅ Build an automation script (hands-on)
5. ✅ Deploy to Kubernetes (hands-on)

---

## 🚀 Quick Links

**Most Popular**:
- [User Guide](guides/user-guide.md) - Daily usage
- [Bulk Operations](guides/bulk-operations.md) - Mass updates
- [Troubleshooting](guides/troubleshooting.md) - Fix issues
- [API Reference](reference/api-reference.md) - Automation

**For Admins**:
- [Installation](guides/admin-guide.md#installation-and-setup)
- [Configuration](guides/admin-guide.md#configuration)
- [Security](guides/admin-guide.md#security)
- [Monitoring](guides/admin-guide.md#monitoring-and-maintenance)

**Get Help**:
- [FAQ](reference/faq.md)
- [Troubleshooting](guides/troubleshooting.md)
- [Support](#additional-resources)

---

Happy reading! 📖
