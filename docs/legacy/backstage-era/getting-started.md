# Getting Started

This guide will help you get started with the RadiantLogic DevOps Management Portal.

## Prerequisites

- Access to the portal (URL provided by your administrator)
- GitHub account with access to RadiantLogic repositories
- Basic understanding of Git and YAML

## Portal Overview

The portal consists of several main sections accessible from the left sidebar:

### 🏠 Home
Your dashboard showing:
- Recent activity across all repositories
- Quick statistics (open PRs, branches, operations)
- Quick action buttons for common tasks
- System health status

### 📁 Repository Browser
Edit configuration files:
- Browse repositories, branches, and files
- Edit YAML files with Monaco editor
- Commit changes to single or multiple branches
- Create pull requests

### 🔀 Pull Requests
Manage PRs:
- View all open pull requests
- Review changes with diff viewer
- View PR timeline and activity
- Merge or close pull requests

### 🚀 ArgoCD Applications
Monitor deployments:
- View sync status of applications
- Trigger manual syncs
- View deployment history

## Your First Task: Updating a Configuration

### Scenario: Update FID version for a QA environment

**Step 1: Navigate to Repository Browser**
- Click "Repository Browser" in the left sidebar
- Or click "Edit Config" button from Home

**Step 2: Select Your Target**
- **Repository**: Select `rlqa-usw2` from dropdown
- **Branch**: Select `rlqa-usw2-qa01` (or your target environment)
- **File**: Select `values.yaml`

**Step 3: Edit the Configuration**
- Click "Edit with Monaco" button
- The Monaco editor will open with your file
- You have two editing modes:
  - **Field-Level Edit**: Update specific YAML fields
  - **Full File Edit**: Edit the entire file

**Step 4: Using Field-Level Edit (Recommended)**
- Select "Field-Level Edit" tab
- In the field selector:
  - **Field Path**: `fid.image.tag`
  - **New Value**: `v1.2.3`
- **Commit Message**: `Update FID to v1.2.3 for QA`

**Step 5: Choose Branches (Optional for Multi-Branch)**
- If updating multiple environments:
  - Check additional branches (e.g., `rlqa-usw2-qa02`, `rlqa-usw2-qa03`)
- Or keep just the current branch selected

**Step 6: Commit Changes**
- Click dropdown arrow next to commit button
- Choose one option:
  - **Commit to Current Branch**: Direct commit
  - **Commit to New Branch**: Create feature branch
  - **Create New Branch & Pull Request**: Create branch + PR

**Step 7: Verify Changes**
- If you created a PR, go to "Pull Requests" tab
- View the diff to confirm changes
- If you committed directly, check ArgoCD for deployment

## Common Workflows

### Workflow 1: Quick Single-Environment Update
```
1. Repository Browser → Select repo/branch/file
2. Edit with Monaco → Field-Level Edit
3. Update single field
4. Commit to current branch
5. Done! ArgoCD will auto-deploy
```

### Workflow 2: Bulk Update Across Environments
```
1. Repository Browser → Select base branch
2. Edit with Monaco → Field-Level Edit
3. Update field (e.g., fid.image.tag → v1.2.3)
4. Select multiple branches (15 QA branches)
5. Commit → "Update Field in 15 Branches"
6. Go to Operations tab to track progress
7. View Audit Log for results
```

### Workflow 3: PR-Based Deployment
```
1. Repository Browser → Select branch
2. Edit with Monaco
3. Make changes
4. "Create New Branch & Pull Request"
5. Fill PR title and description
6. Create PR
7. Go to Pull Requests tab
8. Review changes
9. Merge when ready
10. ArgoCD deploys automatically
```

## Understanding Branch Selection in Monaco Editor

When editing with Monaco:

### Single Branch Mode
- Edit and commit to current branch only
- Fastest for single environment updates

### Multi-Branch Mode
- Select multiple branches from checkboxes
- First 15 branches shown
- Click "View All X Branches" to see and select all
- Selected branches have:
  - Navy blue background
  - Checkmark icon
  - Bold text

### Branch Selection Dialog
- Search for branches by name
- Check/uncheck branches
- See total selected count
- Click "Done" to confirm

## Key Concepts

### Field Path Notation
YAML paths use dot notation:
```yaml
fid:
  image:
    tag: v1.2.3
```
Field path: `fid.image.tag`

### Branch Naming Convention
- `{product}-{region}-{customer}`
- Example: `rlqa-usw2-customer01`
- Production branches are protected

### Bulk Operations
- Asynchronous processing
- Returns Operation ID
- Track progress in Operations tab
- View results in Audit Log

### Commit Messages
Best practices:
- Be descriptive: "Update FID to v1.2.3 for QA environments"
- Include ticket number: "JIRA-123: Fix memory leak"
- Avoid generic: "update" or "fix"

## Tips & Best Practices

### 1. Use Field-Level Edits When Possible
- Safer than full file edits
- Clear intent
- Easy to review
- Less merge conflicts

### 2. Preview Changes Before Committing
- Review diff carefully
- Check all selected branches
- Verify commit message

### 3. Use Pull Requests for Production
- Always use PRs for production changes
- Get peer review
- Document changes in PR description

### 4. Monitor Operations
- Check Operations tab for bulk operations
- View Audit Log for history
- Watch ArgoCD for deployment status

### 5. Test in Lower Environments First
- Test in dev/qa before prod
- Verify configuration works
- Roll out incrementally

## Next Steps

Now that you understand the basics:

1. **Try a test update** in a dev environment
2. **Explore the Pull Requests tab** to see existing PRs
3. **Check the Operations tab** to see bulk operations
4. **Review the Audit Log** to see change history
5. **Read the detailed guides** for specific workflows

## Getting Help

- **Troubleshooting**: See [Troubleshooting Guide](guides/troubleshooting.md)
- **Workflows**: See [User Guides](guides/README.md)
- **API**: See [API Reference](reference/api-reference.md)
- **Support**: Contact DevOps team

## What's Next?

- [Bulk Operations Guide](guides/bulk-operations.md)
- [Pull Request Workflow](guides/pr-workflow.md)
- [YAML Configuration Reference](reference/yaml-structure.md)
- [Troubleshooting](guides/troubleshooting.md)
