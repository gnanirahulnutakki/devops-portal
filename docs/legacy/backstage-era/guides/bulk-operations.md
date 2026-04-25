# Bulk Operations Guide

This guide explains how to use bulk operations to update configuration files across multiple environment branches simultaneously - one of the most powerful features of the RadiantLogic DevOps Portal.

## What Are Bulk Operations?

Bulk operations allow you to commit changes to multiple branches in a single operation. Instead of manually updating each environment branch one by one, you can:

- Update a single YAML field across 50+ branches
- Replace entire configuration files in multiple environments
- Apply consistent changes across dev, QA, staging, and production
- Track progress and results in real-time

## When to Use Bulk Operations

### Good Use Cases

**Version Rollouts**
- Update FID version from v1.2.3 to v1.2.4 across all QA environments
- Deploy new collector version to all staging branches
- Rollback to previous version across affected environments

**Configuration Updates**
- Update memory limits across all environments
- Change log levels for debugging
- Update external service endpoints
- Modify resource quotas

**Emergency Fixes**
- Apply security patches across all environments
- Fix misconfiguration in multiple branches
- Update credentials or secrets references

### When NOT to Use Bulk Operations

- Production deployments (use PR workflow instead for review)
- Changes requiring environment-specific customization
- Testing unproven configurations (test in single environment first)
- Changes that need different values per environment

## Types of Bulk Operations

### Field-Level Updates

Update a single field in the YAML file while preserving everything else.

**Advantages:**
- Surgical precision - only changes what you specify
- Easy to review and understand
- Minimal merge conflict risk
- Clear audit trail

**Use when:**
- Updating version tags
- Changing single configuration values
- Modifying resource limits
- Updating feature flags

### Full-File Replacement

Replace the entire contents of a file across multiple branches.

**Advantages:**
- Complete control over final state
- Can restructure YAML files
- Useful for major refactoring

**Use when:**
- Standardizing configuration structure
- Applying template updates
- Major version upgrades requiring structural changes

**⚠️ Warning:** Full-file replacement is riskier. Ensure you've tested the new file in a single environment first.

## Step-by-Step: Field-Level Bulk Update

### Scenario: Update FID to v1.3.0 across all QA environments

**Step 1: Navigate to Repository Browser**
- Click "Repository Browser" in left sidebar
- Or click "Edit Config" on Home page

**Step 2: Select Base Configuration**
- **Repository**: `rlqa-usw2`
- **Branch**: `rlqa-usw2-qa01` (we'll use this as the reference)
- **File**: `values.yaml`

**Step 3: Open Monaco Editor**
- Click "Edit with Monaco" button
- Wait for editor to load

**Step 4: Configure Field-Level Edit**
- Select "Field-Level Edit" tab
- **Field Path**: `fid.image.tag`
- **New Value**: `v1.3.0`
- **Commit Message**: `Update FID to v1.3.0 for QA environments`

**Step 5: Select Target Branches**
- First 15 QA branches are shown with checkboxes
- Click "View All X Branches" to see complete list
- Check all QA branches:
  - `rlqa-usw2-qa01`
  - `rlqa-usw2-qa02`
  - `rlqa-usw2-qa03`
  - ... (continue selecting)
- Total selected: 15 branches

**Step 6: Preview Changes**
- Review the summary:
  - "Update field `fid.image.tag` to `v1.3.0`"
  - "Branches: 15 selected"
  - Commit message displays correctly
- Verify everything looks correct

**Step 7: Execute Bulk Operation**
- Click dropdown arrow next to commit button
- Select "Update Field in X Branches"
- Confirm the operation
- Modal shows:
  ```
  Operation ID: op-abc123def
  Status: In Progress
  Branches: 0/15 completed
  ```

**Step 8: Track Progress**
- Navigate to "Operations" tab
- Find your operation ID: `op-abc123def`
- Watch real-time progress:
  ```
  Status: In Progress
  Progress: 8/15 branches (53%)
  Successful: 8
  Failed: 0
  Pending: 7
  ```

**Step 9: Review Results**
- Wait for operation to complete
- Check final status:
  ```
  Status: Completed
  Progress: 15/15 branches (100%)
  Successful: 15
  Failed: 0
  ```
- If any failures, expand to see error details

**Step 10: Verify in GitHub**
- Go to GitHub repository
- Check recent commits on one of the branches
- Verify commit message and changes
- Check ArgoCD for deployment status

## Step-by-Step: Full-File Bulk Update

### Scenario: Standardize values.yaml structure across dev environments

**Step 1: Prepare Your Configuration File**
- Test the new `values.yaml` in one dev environment first
- Verify it works correctly
- Document what changed

**Step 2: Navigate to Repository Browser**
- Repository: `rlqa-usw2`
- Branch: `rlqa-usw2-dev01` (reference branch with tested config)
- File: `values.yaml`

**Step 3: Open Monaco Editor**
- Click "Edit with Monaco"
- Select "Full File Edit" tab

**Step 4: Edit File**
- Monaco editor shows current file contents
- Make your changes or paste new configuration
- Ensure YAML syntax is valid

**Step 5: Select Target Branches**
- Click "View All X Branches"
- Filter for dev branches: search "dev"
- Select all dev branches (e.g., dev01-dev10)
- Total: 10 branches selected

**Step 6: Commit Message**
- Write descriptive message:
  ```
  Standardize values.yaml structure for dev environments

  Changes:
  - Reorganized service configuration
  - Added resource limits section
  - Updated monitoring configuration
  - Aligned with new template v2.0
  ```

**Step 7: Execute Operation**
- Click "Replace File in X Branches"
- Review confirmation dialog carefully
- Confirm to proceed

**Step 8: Monitor Progress**
- Operation ID: `op-xyz789abc`
- Go to Operations tab
- Track progress across 10 branches

**Step 9: Handle Partial Failures**
If some branches fail:
- Expand failed branch details
- Common failure reasons:
  - Branch protection rules
  - Merge conflicts
  - File doesn't exist on branch
  - Permission issues
- Address failures manually or retry

## Understanding Branch Selection

### Branch Selection UI

When you click "View All X Branches", you see:

```
┌─────────────────────────────────────┐
│  Select Branches (15 selected)      │
├─────────────────────────────────────┤
│  Search: [dev____________]          │
├─────────────────────────────────────┤
│  ☑ rlqa-usw2-dev01                  │
│  ☑ rlqa-usw2-dev02                  │
│  ☑ rlqa-usw2-dev03                  │
│  ☐ rlqa-usw2-qa01                   │
│  ☐ rlqa-usw2-qa02                   │
│  ☐ rlqa-usw2-prod01                 │
├─────────────────────────────────────┤
│          [Done] [Cancel]             │
└─────────────────────────────────────┘
```

### Selection Tips

**Use Search**
- Type "qa" to show only QA branches
- Type "prod" for production branches
- Type customer name to filter by customer

**Visual Indicators**
- **Navy blue background** = Selected
- **Checkmark icon** = Included in operation
- **Bold text** = Active selection

**Keyboard Shortcuts**
- Click header checkbox to select/deselect all visible
- Shift+Click to select range (if available)

## Operations Tab Reference

### Operation Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| **Pending** | Queued but not started | Wait for system to process |
| **In Progress** | Currently executing | Monitor progress |
| **Completed** | All branches processed successfully | Review audit log |
| **Partial Success** | Some branches succeeded, some failed | Check failed branches |
| **Failed** | Operation failed to start | Check error message, retry |

### Progress Indicators

```
Operation: op-abc123def
Status: In Progress
━━━━━━━━━━━━━━░░░░░░ 60% (9/15)

Successful: 9 branches
Failed: 1 branch
Pending: 5 branches
```

### Viewing Operation Details

Click operation row to expand:

```
Operation ID: op-abc123def
User: john.doe@radiantlogic.com
Timestamp: 2025-10-29 14:23:45 UTC
Type: Field-Level Update
Field: fid.image.tag
Value: v1.3.0
Total Branches: 15

Results:
✓ rlqa-usw2-qa01 - Success (commit: a1b2c3d)
✓ rlqa-usw2-qa02 - Success (commit: b2c3d4e)
✗ rlqa-usw2-qa03 - Failed: Branch is protected
✓ rlqa-usw2-qa04 - Success (commit: c3d4e5f)
...
```

## Audit Log Integration

Every bulk operation creates detailed audit log entries:

### What's Logged

- **Operation metadata**: ID, user, timestamp, type
- **Target details**: Repository, branches, file path
- **Changes**: Field path and new value (or full file diff)
- **Results**: Success/failure per branch with commit SHAs
- **Duration**: Time taken to complete

### Viewing in Audit Log

Navigate to "Audit" tab and filter:
- **Action Type**: "Bulk Operation"
- **User**: Your username
- **Date Range**: Today
- **Repository**: rlqa-usw2

## Best Practices

### Before Executing Bulk Operations

1. **Test in One Environment First**
   - Apply change to single dev/qa branch
   - Verify it works as expected
   - Check ArgoCD deployment succeeds
   - Only then proceed to bulk update

2. **Use Clear Commit Messages**
   ```
   ✅ Good: "Update FID to v1.3.0 to fix memory leak (JIRA-456)"
   ❌ Bad: "update"
   ```

3. **Start with Non-Production**
   - Update dev environments first
   - Then QA environments
   - Then staging
   - Production always via PR (for review)

4. **Verify Branch Selection**
   - Double-check you selected the right branches
   - Watch for production branches if you didn't intend to include them
   - Use search filter to ensure you got all intended environments

### During Operation

5. **Monitor Progress**
   - Don't navigate away immediately
   - Watch for failures in real-time
   - Note any patterns in failures

6. **Be Patient**
   - Large operations (50+ branches) may take 5-10 minutes
   - Each branch requires GitHub API calls
   - System processes sequentially to avoid rate limits

### After Operation

7. **Review Results in Audit Log**
   - Confirm all expected branches succeeded
   - Investigate any failures
   - Save operation ID for reference

8. **Verify Deployments**
   - Check ArgoCD Applications tab
   - Ensure applications are syncing
   - Watch for any deployment failures

9. **Document What You Did**
   - Update change log or runbook
   - Note any issues encountered
   - Share results with team

## Handling Failures

### Common Failure Reasons

**Branch Protection**
```
Error: Branch 'main' is protected and requires pull request
```
**Solution**: Use PR workflow for protected branches

**Merge Conflict**
```
Error: File has diverged, cannot apply automatic update
```
**Solution**: Update branch manually or use full-file replacement carefully

**File Not Found**
```
Error: File 'values.yaml' does not exist on branch
```
**Solution**: Create file on branch first, or exclude branch from operation

**Permission Denied**
```
Error: GitHub API returned 403 Forbidden
```
**Solution**: Check GitHub token permissions, contact admin

**Rate Limit**
```
Error: GitHub API rate limit exceeded
```
**Solution**: Wait for rate limit reset (shown in error), retry operation

### Retry Strategies

**Partial Success - Retry Failed Branches**
1. Go to Operations tab
2. Find your operation
3. Click "Retry Failed Branches"
4. System creates new operation with only failed branches

**Complete Failure - Manual Fix**
1. Review error message
2. Fix underlying issue (permissions, conflicts, etc.)
3. Create new operation with corrected parameters

## Advanced Scenarios

### Scenario 1: Staggered Rollout

Update configuration in waves to minimize risk:

**Wave 1: Dev (10 branches)**
- Execute bulk operation
- Monitor for 1 hour
- Verify no issues

**Wave 2: QA (15 branches)**
- Execute bulk operation
- Monitor for 2 hours
- Get QA team feedback

**Wave 3: Staging (5 branches)**
- Execute bulk operation
- Monitor for 4 hours
- Perform smoke tests

**Wave 4: Production (Individual PRs)**
- Create PRs for each prod environment
- Get approval from change review board
- Merge during maintenance window

### Scenario 2: Conditional Updates

Update only branches matching certain criteria:

1. Use branch search/filter in selection dialog
2. Search for pattern (e.g., "customer-vip")
3. Select only filtered results
4. Execute targeted bulk operation

### Scenario 3: Coordinated Multi-Field Update

Update multiple related fields together:

**Option A: Multiple Sequential Operations**
1. Operation 1: Update `fid.image.tag`
2. Operation 2: Update `fid.resources.memory`
3. Operation 3: Update `fid.config.logLevel`

**Option B: Single Full-File Operation**
1. Edit file with all changes
2. Execute full-file replacement
3. Single operation, single commit per branch

**Recommendation**: Use Option B when changes are related and should be atomic.

## Troubleshooting

### Issue: "No branches selected"
**Symptom**: Commit button is disabled
**Solution**:
- Click "View All X Branches"
- Select at least one branch
- Click "Done"

### Issue: Operation stuck in "Pending"
**Symptom**: Progress shows 0/X for > 5 minutes
**Solution**:
- Refresh page
- Check backend logs
- Contact DevOps if persists

### Issue: All branches failed with same error
**Symptom**: 0% success rate, identical error on all branches
**Solution**:
- Error is likely with your change, not the branches
- Verify YAML syntax
- Test change on single branch manually
- Check field path is correct

### Issue: Can't find my operation in Operations tab
**Symptom**: Operation ID not visible in list
**Solution**:
- Adjust date range filter
- Clear user filter
- Search by operation ID directly
- Check Audit Log as alternative

## Related Documentation

- [Getting Started](../getting-started.md) - Basic portal usage
- [Pull Request Workflow](pr-workflow.md) - For production changes
- [Troubleshooting Guide](troubleshooting.md) - Common issues
- [YAML Configuration Reference](../reference/yaml-structure.md) - Field paths and structure

## Need Help?

- Check [Troubleshooting Guide](troubleshooting.md)
- Review [FAQ](../reference/faq.md)
- Contact DevOps team
- Check operation logs in Audit tab
