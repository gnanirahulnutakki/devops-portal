# Pull Request Workflow Guide

This guide explains how to use the pull request workflow in the RadiantLogic DevOps Portal for safe, reviewed configuration changes - especially for production environments.

## When to Use Pull Requests

### Always Use PRs For:

- **Production deployments** - All production changes require peer review
- **Protected branches** - Branches with protection rules enforce PRs
- **Major configuration changes** - Significant updates that need review
- **Cross-team changes** - When other teams need visibility
- **Compliance requirements** - When audit trail with approval is needed
- **Risky operations** - Changes that could impact service availability

### Optional PR Usage:

- **QA environment updates** - For team visibility
- **Staging deployments** - For testing PR workflow
- **Documentation changes** - For review feedback

### Skip PRs For:

- **Dev environment experiments** - Direct commits are fine
- **Emergency hotfixes to dev** - Speed matters
- **Personal testing branches** - No review needed

## Pull Request Workflow Overview

```
┌─────────────────┐
│ 1. Create       │
│    Feature      │──┐
│    Branch       │  │
└─────────────────┘  │
                     ▼
┌─────────────────┐  ┌─────────────────┐
│ 2. Make         │  │ 3. Commit       │
│    Changes      │─▶│    Changes      │
└─────────────────┘  └─────────────────┘
                             │
                             ▼
                     ┌─────────────────┐
                     │ 4. Create       │
                     │    Pull         │──┐
                     │    Request      │  │
                     └─────────────────┘  │
                                          ▼
                                  ┌─────────────────┐
                                  │ 5. Review       │
                                  │    Changes      │
                                  └─────────────────┘
                                          │
                                          ▼
                                  ┌─────────────────┐
                                  │ 6. Merge or     │
                                  │    Request      │
                                  │    Changes      │
                                  └─────────────────┘
                                          │
                                          ▼
                                  ┌─────────────────┐
                                  │ 7. ArgoCD       │
                                  │    Auto-Deploy  │
                                  └─────────────────┘
```

## Creating Pull Requests

### Method 1: Via Repository Browser (Recommended)

**Step 1: Navigate to Repository Browser**
- Click "Repository Browser" in sidebar
- Select repository, branch, and file

**Step 2: Make Changes**
- Click "Edit with Monaco"
- Use Field-Level Edit or Full File Edit
- Make your configuration changes
- Write descriptive commit message

**Step 3: Create PR from Editor**
- Click dropdown next to commit button
- Select "Create New Branch & Pull Request"
- Fill in the dialog:
  - **New Branch Name**: `feature/update-fid-v1.3.0-prod`
  - **PR Title**: `Update FID to v1.3.0 for production`
  - **PR Description**:
    ```
    ## Summary
    Updates FID image tag from v1.2.9 to v1.3.0

    ## Changes
    - fid.image.tag: v1.2.9 → v1.3.0

    ## Testing
    - Tested in rlqa-usw2-qa01 ✓
    - Verified in staging environment ✓
    - Performance benchmarks look good ✓

    ## Deployment Plan
    - Deploy during maintenance window
    - Monitor for 2 hours post-deployment
    - Rollback plan: revert to v1.2.9

    Related: JIRA-789
    ```
- Click "Create Pull Request"

**Step 4: Confirmation**
- Portal creates feature branch
- Commits your changes to feature branch
- Creates PR against base branch
- Displays PR number: `#123`
- Redirects to PR details view

### Method 2: Manual Branch + PR

**Step 1: Create Feature Branch**
- Repository Browser → Select base branch
- Edit with Monaco
- Commit to new branch: `feature/my-change`

**Step 2: Go to Pull Requests Tab**
- Click "Pull Requests" in navigation
- Click "Create Pull Request" button

**Step 3: Fill PR Form**
- **Repository**: Select from dropdown
- **Base Branch**: Target branch (e.g., `prod-usw2-customer01`)
- **Compare Branch**: Your feature branch (`feature/my-change`)
- **Title**: Clear, descriptive title
- **Description**: Detailed explanation with sections

**Step 4: Submit**
- Click "Create"
- PR is created in GitHub
- Portal syncs and displays PR

## Reviewing Pull Requests

### Step 1: Find Your PR

**Via Pull Requests Tab:**
- Click "Pull Requests" in navigation
- Select repository from dropdown
- PR list shows all open PRs

**Via Home Page:**
- Recent activity feed shows new PRs
- Click PR title to view details

**PR List Columns:**
```
┌────┬─────────────────────────┬────────────┬──────────────┬─────────┐
│ #  │ Title                   │ Author     │ Branch       │ Status  │
├────┼─────────────────────────┼────────────┼──────────────┼─────────┤
│ 123│ Update FID to v1.3.0    │ john.doe   │ feature/fid  │ Open    │
│ 122│ Fix memory limits       │ jane.smith │ fix/memory   │ Open    │
│ 121│ Add monitoring config   │ bob.jones  │ feature/mon  │ Merged  │
└────┴─────────────────────────┴────────────┴──────────────┴─────────┘
```

### Step 2: View PR Details

Click on a PR to see detailed view:

**Header Section:**
```
PR #123: Update FID to v1.3.0 for production
───────────────────────────────────────────────────────
Status: Open
Author: john.doe@radiantlogic.com
Created: 2 hours ago
Base: prod-usw2-customer01 ← Compare: feature/update-fid-v1.3.0-prod

[View in GitHub] [Merge PR] [Close PR]
```

**Tabs:**
1. **Description** - PR description and metadata
2. **Changes** - Diff viewer showing file changes
3. **Timeline** - Activity history and comments
4. **Files Changed** - List of modified files

### Step 3: Review Changes Tab

**Diff Viewer Features:**

```diff
File: values.yaml
───────────────────────────────────────

@@ -45,7 +45,7 @@ fid:
   image:
     repository: radiantlogic/fid
-    tag: v1.2.9
+    tag: v1.3.0
     pullPolicy: IfNotPresent

   resources:
```

**Diff View Controls:**
- **Unified Diff** - Side-by-side comparison
- **Split Diff** - Inline changes
- **Syntax Highlighting** - YAML aware
- **Line Numbers** - Easy reference
- **Expand Context** - Show more surrounding lines

**Verification Checklist:**
- ✓ Changes match PR description
- ✓ Only intended files modified
- ✓ No unexpected changes
- ✓ YAML syntax looks correct
- ✓ Values are appropriate
- ✓ No sensitive data exposed

### Step 4: Check Timeline

**Timeline Tab shows:**
- PR creation event
- Commits pushed to PR branch
- Comments from reviewers
- Status checks (if configured)
- Merge/close events

**Example Timeline:**
```
● john.doe created this pull request - 2 hours ago
  From: feature/update-fid-v1.3.0-prod
  Into: prod-usw2-customer01

● john.doe pushed commit a1b2c3d - 2 hours ago
  "Update FID to v1.3.0 for production"

● jane.smith commented - 1 hour ago
  "LGTM - verified in staging"

● bob.jones approved - 30 minutes ago
  "Approved for merge during maintenance window"
```

### Step 5: Add Comments (Optional)

While viewing PR:
- Navigate to GitHub (click "View in GitHub")
- Add comments on specific lines
- Request changes if needed
- Approve when ready

## Merging Pull Requests

### Pre-Merge Checklist

Before merging, verify:

- [ ] All reviewers have approved
- [ ] CI/CD checks pass (if configured)
- [ ] Testing completed in lower environment
- [ ] Deployment plan documented
- [ ] Rollback plan ready
- [ ] Maintenance window scheduled (if needed)
- [ ] Stakeholders notified

### Step 1: Click Merge Button

In PR details view:
- Click "Merge PR" button
- Confirmation dialog appears

### Step 2: Confirm Merge

**Merge Dialog:**
```
┌────────────────────────────────────────────┐
│ Merge Pull Request #123                    │
├────────────────────────────────────────────┤
│ This will merge:                           │
│                                            │
│ feature/update-fid-v1.3.0-prod             │
│          ↓                                 │
│ prod-usw2-customer01                       │
│                                            │
│ Merge Method: [Merge Commit ▼]            │
│                                            │
│ □ Delete branch after merge                │
│                                            │
│         [Cancel]  [Confirm Merge]          │
└────────────────────────────────────────────┘
```

**Merge Methods:**
- **Merge Commit** - Preserves all commits + merge commit (default)
- **Squash and Merge** - Combines all commits into one
- **Rebase and Merge** - Replays commits on base branch

**Recommendation**: Use "Merge Commit" for production deployments to preserve full history.

### Step 3: Verify Merge

After merge:
- PR status changes to "Merged"
- Feature branch can be deleted (optional)
- Base branch now contains your changes
- Redirect to merged PR view

**Success Message:**
```
✓ Pull Request #123 merged successfully

Merged feature/update-fid-v1.3.0-prod into prod-usw2-customer01

Commit: m1e2r3g4e
Merged by: john.doe@radiantlogic.com
Merged at: 2025-10-29 15:30:45 UTC
```

### Step 4: Verify Deployment

**Monitor ArgoCD:**
1. Navigate to "ArgoCD Applications" tab
2. Find application for `prod-usw2-customer01`
3. Watch sync status:
   - **OutOfSync** → **Syncing** → **Synced**
4. Verify application health: **Healthy**
5. Check deployed version matches your change

**Check Deployment:**
```
Application: prod-usw2-customer01-fid
Sync Status: Synced
Health: Healthy
Last Sync: 2 minutes ago
Revision: m1e2r3g4e
```

## Closing Pull Requests Without Merging

Sometimes you need to close a PR without merging:

**Valid Reasons:**
- Change no longer needed
- Superseded by another PR
- Approach was incorrect
- Testing revealed issues

**Steps:**
1. Open PR details
2. Click "Close PR" button
3. Confirm closure
4. Add comment explaining why (in GitHub)

**Closed PR:**
- Status: Closed
- Not merged into base branch
- Feature branch still exists
- Can be reopened if needed

## PR Best Practices

### Writing Good PR Titles

```
✅ Good Examples:
- "Update FID to v1.3.0 for production deployment"
- "Fix memory leak in collector configuration (JIRA-456)"
- "Add monitoring alerts for QA environments"

❌ Bad Examples:
- "update"
- "changes"
- "fix stuff"
```

**Format:** `[Action] [What] [Where/Why]`

### Writing Good PR Descriptions

Use this template:

```markdown
## Summary
Brief overview of what this PR does (1-2 sentences)

## Changes
- Bullet list of specific changes
- Include old → new values where relevant
- Link to related PRs if applicable

## Testing
- How was this tested?
- What environments were used?
- What are the results?

## Deployment Plan
- When to deploy (maintenance window?)
- Monitoring strategy
- Rollback plan

## Related Issues
- JIRA-123
- Links to related PRs or documentation
```

### Review Best Practices

**For Authors:**
1. **Self-review first** - Review your own PR before requesting review
2. **Keep PRs small** - Easier to review, faster to merge
3. **Provide context** - Explain why, not just what
4. **Respond promptly** - Address reviewer feedback quickly
5. **Test thoroughly** - Don't send untested changes for review

**For Reviewers:**
1. **Review promptly** - Don't block team productivity
2. **Be constructive** - Suggest improvements, not just criticism
3. **Ask questions** - Clarify intent if unclear
4. **Test if needed** - Pull branch locally for complex changes
5. **Approve clearly** - Explicitly approve when satisfied

## Common PR Scenarios

### Scenario 1: Production Config Update

**Goal**: Update production configuration safely

1. Test change in dev environment
2. Apply to QA via bulk operation
3. Verify in staging via bulk operation
4. Create PR for production
5. Get approval from 2+ reviewers
6. Merge during maintenance window
7. Monitor deployment closely
8. Verify service health

### Scenario 2: Emergency Hotfix

**Goal**: Deploy critical fix to production ASAP

1. Create hotfix branch from production
2. Apply minimal fix
3. Test in isolated environment if possible
4. Create PR with "HOTFIX" prefix
5. Get expedited review (1 reviewer)
6. Merge immediately
7. Deploy and monitor
8. Follow up with root cause analysis

### Scenario 3: Multi-File Configuration Change

**Goal**: Update multiple related configuration files

1. Create feature branch
2. Update all related files
3. Commit all changes together
4. Create PR showing all diffs
5. Reviewers see complete picture
6. Merge as single atomic change
7. ArgoCD deploys all changes together

### Scenario 4: Abandoned PR

**Goal**: Clean up old, stale PR

1. Review PR - is it still relevant?
2. If code conflicts, ask author to rebase
3. If no response after 1 week, comment with deadline
4. If still no response, close with explanation
5. Delete feature branch if author agrees

## Troubleshooting PRs

### Issue: "No commits between branches"

**Symptom**: Can't create PR, GitHub says branches are identical

**Cause**: Feature branch has same commits as base branch

**Solutions:**
1. Ensure you committed to feature branch, not base branch
2. Check you're comparing correct branches
3. Verify changes were actually committed
4. Try creating new feature branch from current base

### Issue: "Merge conflicts detected"

**Symptom**: PR shows conflicts that must be resolved

**Cause**: Base branch changed since you created feature branch

**Solutions:**
1. Pull latest base branch locally
2. Merge base into your feature branch
3. Resolve conflicts in editor
4. Commit merge resolution
5. Push updated feature branch
6. PR automatically updates

### Issue: Can't merge - "Protected branch"

**Symptom**: Merge button disabled, protection rules shown

**Cause**: Branch has protection requiring reviews or checks

**Solutions:**
1. Get required number of approvals
2. Wait for CI/CD checks to pass
3. Ask admin to merge if urgent
4. Check protection rules in GitHub

### Issue: PR not showing in portal

**Symptom**: Created PR in GitHub, but not visible in portal

**Solutions:**
1. Refresh page (portal may be cached)
2. Change repository filter and change back
3. Verify PR is open (not closed/merged)
4. Check you're looking at correct repository
5. PR may take 30 seconds to sync

## Advanced: GitHub Integration

### Viewing PRs in GitHub

Click "View in GitHub" button to:
- Add detailed comments on code lines
- Use GitHub's review features
- View CI/CD check results
- See full PR discussion thread
- Access GitHub-specific features

### GitHub PR Comments Sync

Comments added in GitHub:
- Are visible when you click "View in GitHub"
- Don't appear in portal timeline (portal shows portal-only events)
- Use GitHub for detailed code review discussions

### Protected Branches

Some branches may have protection rules requiring:
- Minimum number of reviews (e.g., 2 approvals)
- Passing CI/CD checks
- Up-to-date branch (rebased on latest base)
- Specific reviewer approval (e.g., from DevOps team)

These are configured in GitHub and enforced by GitHub API.

## Related Documentation

- [Bulk Operations Guide](bulk-operations.md) - For multi-branch updates
- [Getting Started](../getting-started.md) - Portal basics
- [Troubleshooting Guide](troubleshooting.md) - Common issues
- [YAML Configuration Reference](../reference/yaml-structure.md) - Config structure

## Need Help?

- Check [Troubleshooting Guide](troubleshooting.md)
- Review [FAQ](../reference/faq.md)
- Contact DevOps team
- See GitHub documentation for advanced features
