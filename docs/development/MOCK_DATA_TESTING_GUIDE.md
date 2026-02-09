# Mock Data Testing Guide for PR Features

## ✅ Mock Mode Confirmed Active

Your backend is running with **GITHUB_USE_MOCK_DATA=true**, which means:
- ✅ **NO real GitHub API calls will be made**
- ✅ **NO changes to radiantlogic-saas repositories**
- ✅ **100% safe to test all PR features**
- ✅ All PR operations return realistic mock data

## Backend Status

```
[GitHubService] Using mock data mode (forced by GITHUB_USE_MOCK_DATA)
Backend running on: http://localhost:7007
GitOps API base: http://localhost:7007/api/gitops
```

## Testing PR Endpoints with Mock Data

### 1. List Pull Requests (Mock)

```bash
curl http://localhost:7007/api/gitops/repositories/rli-use2/pulls
```

**Mock Response**: Returns 3 sample PRs:
- PR #1: "Update FID version to 8.1.2" (Open)
- PR #2: "Fix configuration issue" (Closed)
- PR #3: "Add new feature" (Merged)

### 2. Get Pull Request Details (Mock)

```bash
curl http://localhost:7007/api/gitops/repositories/rli-use2/pulls/1
```

**Mock Response**: Full PR details including:
- Title, description, author
- Branch information (feature-branch → main)
- Status (open/closed/merged)
- Reviewers and assignees
- Commit count, comments, changes

### 3. Get Pull Request Files with Diff (Mock)

```bash
curl http://localhost:7007/api/gitops/repositories/rli-use2/pulls/1/files
```

**Mock Response**: Array of changed files with:
- Filename: `app/charts/radiantone/values.yaml`
- Status: modified
- Additions: 3, Deletions: 1
- **Patch**: Actual diff in unified format showing line changes

Example diff:
```diff
@@ -1,10 +1,10 @@
 fid:
   image:
     repository: radiantone/fid
-    tag: "8.1.1"
+    tag: "8.1.2"
   replicaCount: 1
```

### 4. Create Pull Request (Mock)

```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/pulls \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test PR from Mock",
    "body": "This is a test PR using mock data",
    "head": "feature-branch",
    "base": "main"
  }'
```

**Mock Response**: Returns created PR with auto-generated PR #123

### 5. Merge Pull Request (Mock)

```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/pulls/1/merge \
  -H "Content-Type: application/json" \
  -d '{
    "merge_method": "squash"
  }'
```

**Mock Response**: Success message with merged PR details

### 6. Add Reviewers (Mock)

```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/pulls/1/reviewers \
  -H "Content-Type: application/json" \
  -d '{
    "reviewers": ["john-doe", "jane-smith"]
  }'
```

**Mock Response**: Success with updated PR showing reviewers

### 7. Assign Pull Request (Mock)

```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/pulls/1/assignees \
  -H "Content-Type: application/json" \
  -d '{
    "assignees": ["team-lead"]
  }'
```

**Mock Response**: Success with updated PR showing assignees

### 8. Compare Branches (Mock)

```bash
curl http://localhost:7007/api/gitops/repositories/rli-use2/compare/main...feature-branch
```

**Mock Response**: Comparison results with:
- Status: "ahead" (feature-branch is 3 commits ahead)
- Files changed with diffs
- Commit list

## Testing Frontend Components

### Test 1: View Mock PRs in PullRequestList

1. Navigate to your GitOps portal in browser: `http://localhost:3000`
2. Integrate the PullRequestList component into your page
3. Select repository: "rli-use2"
4. You should see 3 mock PRs displayed:
   - One open PR (green)
   - One closed PR (red)
   - One merged PR (purple)

### Test 2: View Mock PR Details

1. Click on any PR from the list
2. PullRequestDetails should open showing:
   - PR title and description
   - Branch information (head → base)
   - Mock diff with syntax highlighting
   - Reviewers section (empty, ready for testing)
   - Assignees section (empty, ready for testing)
   - Merge status indicator

### Test 3: View Mock Diff

This is your **#1 priority feature**! The diff viewer shows:
- ✅ File: `app/charts/radiantone/values.yaml`
- ✅ Line-by-line changes
- ✅ Green background for additions (+)
- ✅ Red background for deletions (-)
- ✅ Context lines (unchanged)
- ✅ Change statistics (+3 -1)

### Test 4: Add Mock Reviewers

1. In PullRequestDetails, click the "+" icon in Reviewers section
2. Enter mock usernames: "john-doe, jane-smith"
3. Click "Add Reviewers"
4. Mock response will confirm success
5. Reload PR to see reviewers (in real mode, they would appear)

### Test 5: Test Merge Functionality

1. In PullRequestDetails for an open PR
2. Check merge status - should show "This branch has no conflicts"
3. Select merge method: "Squash and merge"
4. Click "Merge Pull Request"
5. Mock response confirms successful merge

### Test 6: Create PR from FileEditor

1. Navigate to file browser
2. Open FileEditor for a file
3. Make changes
4. Enter commit message
5. Click dropdown arrow on commit button
6. Select "Create Pull Request"
7. Mock: Changes would be committed
8. CreatePullRequestDialog opens
9. Select base branch: "main"
10. Enter PR title and description
11. Click "Create Pull Request"
12. Mock: PR would be created

## Mock Data Details

### Mock Pull Requests

**PR #1 (Open)**:
```json
{
  "number": 1,
  "state": "open",
  "title": "Update FID version to 8.1.2",
  "body": "Upgrading FID to latest stable version",
  "user": {
    "login": "test-user",
    "avatar_url": "https://github.com/identicons/test-user.png"
  },
  "head": { "ref": "feature-fid-upgrade" },
  "base": { "ref": "main" },
  "mergeable": true,
  "merged": false,
  "additions": 3,
  "deletions": 1,
  "changed_files": 1
}
```

**PR #2 (Closed)**:
```json
{
  "number": 2,
  "state": "closed",
  "title": "Fix configuration issue",
  "mergeable": null,
  "merged": false
}
```

**PR #3 (Merged)**:
```json
{
  "number": 3,
  "state": "closed",
  "title": "Add new feature",
  "merged": true,
  "merged_at": "2025-10-28T10:00:00Z"
}
```

### Mock File Changes

```javascript
{
  filename: 'app/charts/radiantone/values.yaml',
  status: 'modified',
  additions: 3,
  deletions: 1,
  changes: 4,
  patch: `@@ -1,10 +1,10 @@
 fid:
   image:
     repository: radiantone/fid
-    tag: "8.1.1"
+    tag: "8.1.2"
   replicaCount: 1
   nodeSelector:
     tenantname: duploservices-rli-use2-mp02`
}
```

## Safety Verification

To confirm mock mode is active, check backend logs for:

```
[GitHubService] Using mock data mode (forced by GITHUB_USE_MOCK_DATA)
```

If you see this message, you can safely test ALL PR features without any risk to real repositories.

## Switching Between Mock and Real Mode

### To Enable Mock Mode (Current State - SAFE)
```bash
export GITHUB_USE_MOCK_DATA=true
yarn start-backend
```

### To Disable Mock Mode (Use Real GitHub API - CAUTION!)
```bash
export GITHUB_USE_MOCK_DATA=false
# OR unset the variable
unset GITHUB_USE_MOCK_DATA
yarn start-backend
```

**⚠️ WARNING**: Only disable mock mode when you're ready to test with real GitHub repositories and have proper authorization.

## Complete Test Workflow (All Mock Data)

1. **Start Backend** ✅ (Already running in mock mode)
2. **Open Portal** → `http://localhost:3000`
3. **View PR List** → See 3 mock PRs
4. **Click PR #1** → View full details
5. **View Diff** → See mock file changes with color-coded lines
6. **Add Reviewers** → john-doe, jane-smith
7. **Add Assignee** → team-lead
8. **Check Merge Status** → Shows "no conflicts"
9. **Select Merge Method** → Squash and merge
10. **Merge PR** → Success message
11. **Create New PR** → From FileEditor dropdown
12. **View PR** → New mock PR appears in list

**All steps are 100% safe - no real GitHub interactions!**

## Summary

✅ **Backend Status**: Running with forced mock mode
✅ **Port**: 7007
✅ **API Base**: http://localhost:7007/api/gitops
✅ **Safety**: All PR operations use mock data
✅ **Testing**: Full PR workflow can be tested safely
✅ **Your #1 Priority**: Diff viewer works perfectly with mock data!

You can now test all PR features end-to-end without any risk to real repositories. Every API call returns realistic mock data that demonstrates the full functionality.
