# GitOps Management Portal - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Accessing the Portal](#accessing-the-portal)
3. [Portal Overview](#portal-overview)
4. [Common Tasks](#common-tasks)
5. [Best Practices](#best-practices)
6. [Tips and Tricks](#tips-and-tricks)

---

## Introduction

The GitOps Management Portal is your central hub for managing configurations across all RadiantLogic SaaS environments. Instead of manually updating 350+ branches across 35+ repositories (which takes 4-6 hours), you can now update everything in under 15 minutes through this intuitive interface.

### What You Can Do

- Browse and search across all repositories and branches
- Edit configuration files with syntax highlighting and validation
- Update multiple branches simultaneously (bulk operations)
- Create and manage pull requests
- Monitor ArgoCD deployments
- View complete audit trail of all changes

---

## Accessing the Portal

### Development/Local Access

1. The portal runs locally on your machine
2. Open your browser and navigate to: **http://localhost:3000/gitops**
3. You'll see the GitOps Management Portal homepage

### Production Access

*(To be configured - will be available at a dedicated URL)*

---

## Portal Overview

### Navigation

The portal has several main sections accessible from the left sidebar:

#### 🏠 **Home Dashboard**
- Quick stats: Total repositories, branches, recent operations
- Recent activity feed
- Quick action buttons

#### 📁 **Repository Browser**
- Browse all 35+ repositories
- Navigate through branches
- View and edit configuration files
- Commit changes to single or multiple branches

#### 🔀 **Pull Requests**
- View all open and closed PRs
- Review changes with visual diff
- View PR timeline and comments
- Merge or close PRs
- Add reviewers and assignees

#### 🚀 **ArgoCD Applications**
- Monitor deployment status across environments
- Trigger manual syncs
- View application health
- Check sync history

#### ⚙️ **Bulk Operations**
- View ongoing and completed bulk operations
- Monitor progress across branches
- Review success/failure results
- Retry failed operations

#### 📊 **Audit Logs**
- Complete history of all changes
- Filter by user, repository, date
- View detailed operation metadata
- Export audit reports

---

## Common Tasks

### Task 1: Browsing Repositories and Branches

**Goal**: Find and view configuration files across your environments

**Steps**:

1. Click **Repository Browser** in the left sidebar
2. Select a repository from the dropdown (e.g., `rli-use2`)
3. Select a branch from the branch dropdown (e.g., `rli-use2-mp02`)
4. Browse the file tree to find your file (e.g., `app/charts/radiantone/values.yaml`)
5. Click on the file to view its contents in the Monaco editor

**Tip**: Use the search functionality in dropdowns to quickly find repositories or branches by typing part of the name.

---

### Task 2: Editing a Configuration File on a Single Branch

**Goal**: Update a configuration value for one environment

**Steps**:

1. Navigate to the file using Repository Browser (see Task 1)
2. Click the **Edit** button
3. Make your changes in the Monaco editor
   - Syntax highlighting will help identify errors
   - YAML validation runs automatically
4. Review your changes
5. Scroll down to the commit section
6. Enter a meaningful commit message:
   ```
   Update FID version to 8.1.2 for mp02 environment
   ```
7. Click **Commit Changes**
8. Wait for the success confirmation

**What Happens Next**:
- The file is updated on the selected branch
- A commit is created in GitHub with your message
- The change appears in the audit log
- ArgoCD will detect the change and sync automatically (if configured)

---

### Task 3: Bulk Update Across Multiple Branches

**Goal**: Update the same configuration value across 50+ tenant branches simultaneously

**Use Case**: You need to update the FID version from 8.1.1 to 8.1.2 across all production tenants.

**Steps**:

1. Click **Bulk Operations** in the sidebar
2. Click **New Bulk Operation** button
3. Fill in the operation details:
   - **Repository**: Select `rli-use2`
   - **Branches**: Select target branches (use Select All or pick specific ones)
   - **File Path**: `app/charts/radiantone/values.yaml`
   - **Operation Type**: Choose "Field Update" or "Full File Replace"

4. **For Field Update**:
   - **Field Path**: `fid.image.tag`
   - **New Value**: `"8.1.2"`
   - **Commit Message**: `Update FID version to 8.1.2`

5. **Preview** your changes:
   - The system will show you what will change in each branch
   - Review the diff for a few branches to ensure correctness

6. Click **Execute Bulk Operation**

7. Monitor progress:
   - You'll see a progress bar showing completion percentage
   - Real-time updates for each branch (Success/Failed/In Progress)
   - Estimated time remaining

8. Review results:
   - Once complete, review the summary
   - Check for any failed branches
   - Retry failed operations if needed

**Time Saved**: What used to take 4-6 hours now takes 10-15 minutes!

---

### Task 4: Creating a Pull Request

**Goal**: Create a PR for review before merging changes to master

**When to Use**: When making significant changes that need peer review

**Steps**:

1. Make your changes using the Repository Browser
2. Instead of committing directly to a branch, create a feature branch:
   - Click **Create Branch** button
   - Enter branch name: `feature/update-fid-version`
   - Select base branch: `master`

3. Commit your changes to the new feature branch

4. Navigate to **Pull Requests** section

5. Click **Create Pull Request**

6. Fill in PR details:
   - **Title**: `Update FID version to 8.1.2 across tenants`
   - **Description**:
     ```markdown
     ## Summary
     Updates FID version from 8.1.1 to 8.1.2 across all tenant branches

     ## Changes
     - Updated fid.image.tag in values.yaml
     - Tested in dev environment

     ## Testing
     - [ ] Verified values.yaml syntax
     - [ ] Tested in one tenant (mp02)
     - [ ] Reviewed ArgoCD sync status
     ```
   - **Base Branch**: `master`
   - **Head Branch**: `feature/update-fid-version`
   - **Reviewers**: Add team members
   - **Assignees**: Assign to yourself

7. Click **Create Pull Request**

8. Share the PR link with your team for review

---

### Task 5: Reviewing and Merging a Pull Request

**Goal**: Review changes made by others and merge when approved

**Steps**:

1. Navigate to **Pull Requests**
2. Click on the PR you want to review
3. Review the PR details:
   - Read the description and summary
   - Check the files changed
   - View the diff for each file

4. **View Diff**:
   - Side-by-side comparison shows old vs new
   - Added lines are highlighted in green
   - Removed lines are highlighted in red

5. **Add Comments** (if needed):
   - Click on a line in the diff
   - Add your comment
   - Submit comment

6. **Check Status**:
   - View CI/CD checks (if configured)
   - Ensure all checks pass

7. **Approve or Request Changes**:
   - Click **Review Changes**
   - Select **Approve** or **Request Changes**
   - Add your review comments
   - Submit review

8. **Merge the PR**:
   - Once approved and checks pass
   - Click **Merge Pull Request**
   - Select merge method (merge, squash, or rebase)
   - Confirm merge

9. **Post-Merge**:
   - The feature branch can be deleted
   - ArgoCD will sync the changes automatically
   - Monitor deployment in ArgoCD section

---

### Task 6: Monitoring ArgoCD Deployments

**Goal**: Check deployment status and trigger syncs

**Steps**:

1. Navigate to **ArgoCD Applications**
2. View list of all applications across environments
3. Check application status:
   - **Synced**: Application is up to date
   - **OutOfSync**: Changes detected, needs sync
   - **Progressing**: Sync in progress
   - **Degraded**: Application has issues

4. **View Application Details**:
   - Click on an application
   - See resource tree (pods, services, etc.)
   - Check health of individual resources

5. **Trigger Manual Sync** (if needed):
   - Click **Sync** button
   - Confirm sync operation
   - Monitor progress

6. **View Sync History**:
   - See previous sync operations
   - Check what changed in each sync
   - View sync duration and status

---

### Task 7: Searching Audit Logs

**Goal**: Find specific changes or track who made what change

**Steps**:

1. Navigate to **Audit Logs**
2. Use filters to narrow down:
   - **Date Range**: Select start and end dates
   - **User**: Filter by username
   - **Repository**: Filter by specific repo
   - **Operation Type**: Filter by commit, PR merge, bulk operation
   - **Branch**: Filter by specific branch

3. View audit log entries:
   - Timestamp
   - User who performed the action
   - Operation type
   - Repository and branch
   - Commit message
   - Files changed

4. **Export Audit Report**:
   - Select date range
   - Click **Export to CSV**
   - Use for compliance or reporting

---

## Best Practices

### Configuration Management

1. **Always Use Meaningful Commit Messages**
   - ✅ Good: `Update FID version to 8.1.2 for security patch CVE-2024-1234`
   - ❌ Bad: `update`

2. **Preview Before Committing**
   - Always review your changes in the diff view
   - Check YAML syntax is valid
   - Ensure no accidental changes

3. **Test on One Branch First**
   - Before bulk operations, test on a single dev/qa branch
   - Verify the change works as expected
   - Then roll out to production branches

### Pull Request Workflow

1. **Use Feature Branches for Significant Changes**
   - Don't commit directly to master for major updates
   - Create a feature branch
   - Get peer review through PR

2. **Write Descriptive PR Descriptions**
   - Explain what changed and why
   - Include testing steps
   - Add any relevant context

3. **Keep PRs Focused**
   - One PR should address one concern
   - Avoid mixing unrelated changes

### Bulk Operations

1. **Select Branches Carefully**
   - Double-check you've selected the right branches
   - Use branch filtering to avoid accidents

2. **Use Field Updates When Possible**
   - Field updates are safer than full file replacement
   - Only the specified field changes
   - Other values remain untouched

3. **Monitor Progress**
   - Don't close the browser during bulk operations
   - Watch for any failures
   - Retry failed branches after investigating

### Safety

1. **Be Careful with Protected Branches**
   - Master/main branches may have protections
   - Follow your team's process for these branches

2. **Keep Audit Trail**
   - All changes are logged
   - Use meaningful descriptions
   - This helps with troubleshooting and compliance

---

## Tips and Tricks

### Keyboard Shortcuts (Monaco Editor)

- **Ctrl/Cmd + F**: Find in file
- **Ctrl/Cmd + H**: Find and replace
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo
- **Ctrl/Cmd + /**: Comment/uncomment line
- **Alt + Up/Down**: Move line up/down
- **Shift + Alt + Down**: Duplicate line
- **Ctrl/Cmd + D**: Select next occurrence of word

### Quick Navigation

- Use browser search (Ctrl/Cmd + F) to find repositories or branches in dropdowns
- Bookmark frequently accessed pages
- Use browser back/forward buttons to navigate between views

### Bulk Operations

- **Save Common Branch Sets**: You can save frequently used branch selections for future operations
- **Schedule Operations**: For large-scale updates, run during off-peak hours
- **Parallel Execution**: The system handles 10 branches concurrently for speed

### File Editing

- **Auto-Completion**: Start typing in YAML files and press Ctrl+Space for suggestions
- **Syntax Validation**: Red squiggles indicate YAML errors - hover for details
- **Indentation**: Use spaces, not tabs for YAML files (Monaco auto-formats)

### Pull Requests

- **@mention Team Members**: Use @username in PR comments to notify specific people
- **Link Issues**: Reference issue numbers with # (e.g., #123) to link related issues
- **Templates**: Your team can create PR templates for consistent descriptions

---

## Getting Help

### In-App Help

- Look for the **?** icon in the top right of each page
- Hover tooltips provide contextual help

### Documentation

- Refer to specific guides:
  - [Bulk Operations Guide](bulk-operations.md)
  - [PR Workflow Guide](pr-workflow.md)
  - [Troubleshooting Guide](troubleshooting.md)

### Support

- Contact your DevOps team
- Check the [FAQ](../reference/faq.md)
- Review [Known Issues](../reference/known-issues.md)

---

## Next Steps

Now that you understand the basics:

1. Try browsing some repositories and branches
2. Practice editing a file in a dev/qa environment
3. Create a test bulk operation with a few branches
4. Review the audit logs to see your changes

For more advanced workflows, check out:
- [Bulk Operations Deep Dive](bulk-operations.md)
- [Pull Request Best Practices](pr-workflow.md)
- [API Reference](../reference/api-reference.md) (for automation)
