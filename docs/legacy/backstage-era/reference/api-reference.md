# GitOps Management Portal - API Reference

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
   - [Health & Status](#health--status)
   - [Repositories](#repositories)
   - [Branches](#branches)
   - [Files](#files)
   - [Pull Requests](#pull-requests)
   - [ArgoCD Applications](#argocd-applications)
   - [Bulk Operations](#bulk-operations)
   - [Audit Logs](#audit-logs)
7. [Rate Limiting](#rate-limiting)
8. [Webhooks](#webhooks)
9. [SDK Examples](#sdk-examples)

---

## Introduction

The GitOps Management Portal provides a REST API for programmatic access to all portal features. This API can be used for:

- Automation scripts
- CI/CD integration
- Custom tools and dashboards
- Batch operations
- Monitoring and alerting

### API Version

Current version: **v1**

All endpoints are prefixed with `/api/gitops/`

---

## Authentication

### Development (Local)

For local development, authentication is optional. The portal runs in development mode without auth requirements.

### Production (Future)

Production deployments will use one of:

**Option 1: Session-based Authentication** (Recommended)
- Login via GitHub OAuth
- Session cookie maintained
- Same auth as web UI

**Option 2: API Token**
```bash
# Generate API token (future feature)
curl -X POST http://localhost:7007/api/auth/tokens \
  -H "Authorization: Bearer <session-token>" \
  -d '{"name": "automation-script", "expires_in": "30d"}'

# Use token in requests
curl -H "Authorization: Bearer <api-token>" \
  http://localhost:7007/api/gitops/repositories
```

---

## Base URL

### Development
```
http://localhost:7007/api/gitops
```

### Production
```
https://gitops-api.radiantlogic.com/api/gitops
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### List Response

```json
{
  "success": true,
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (success, no data returned) |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (authentication required) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., resource already exists) |
| 422 | Unprocessable Entity (validation error) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Common Error Codes

| Code | Description |
|------|-------------|
| `GITHUB_API_ERROR` | GitHub API request failed |
| `ARGOCD_API_ERROR` | ArgoCD API request failed |
| `DATABASE_ERROR` | Database operation failed |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |

---

## API Endpoints

### Health & Status

#### GET /health

Check if the backend is running and healthy.

**Request**:
```bash
curl http://localhost:7007/api/gitops/health
```

**Response**:
```json
{
  "status": "ok"
}
```

---

### Repositories

#### GET /repositories

List all repositories in the organization.

**Request**:
```bash
curl http://localhost:7007/api/gitops/repositories
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | string | Filter repositories by name (optional) |

**Response**:
```json
{
  "repositories": [
    {
      "id": 578713099,
      "name": "rli-use2",
      "full_name": "radiantlogic-saas/rli-use2",
      "owner": {
        "login": "radiantlogic-saas",
        "type": "Organization"
      },
      "private": true,
      "description": "SaaS Tenant Configuration Repository",
      "default_branch": "master",
      "created_at": "2023-01-15T10:00:00Z",
      "updated_at": "2025-10-29T10:31:16Z",
      "pushed_at": "2025-10-29T15:10:31Z"
    },
    // ... more repositories
  ]
}
```

**Example with Filter**:
```bash
curl "http://localhost:7007/api/gitops/repositories?filter=rli-use"
```

---

### Branches

#### GET /repositories/{repository}/branches

List all branches for a repository.

**Request**:
```bash
curl http://localhost:7007/api/gitops/repositories/rli-use2/branches
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | string | Filter branches by name (optional) |

**Response**:
```json
{
  "branches": [
    {
      "name": "master",
      "commit": {
        "sha": "abc123def456...",
        "url": "https://api.github.com/repos/..."
      },
      "protected": true
    },
    {
      "name": "rli-use2-mp02",
      "commit": {
        "sha": "def789ghi012...",
        "url": "https://api.github.com/repos/..."
      },
      "protected": false
    }
    // ... more branches
  ]
}
```

**Example with Filter**:
```bash
curl "http://localhost:7007/api/gitops/repositories/rli-use2/branches?filter=mp"
```

---

### Files

#### GET /repositories/{repository}/branches/{branch}/files

List files in a repository branch.

**Request**:
```bash
curl "http://localhost:7007/api/gitops/repositories/rli-use2/branches/master/files"
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Directory path (default: root) |

**Response**:
```json
{
  "files": [
    {
      "path": "app",
      "mode": "040000",
      "type": "tree",
      "sha": "sha123...",
      "url": "https://api.github.com/..."
    },
    {
      "path": "README.md",
      "mode": "100644",
      "type": "blob",
      "sha": "sha456...",
      "size": 1234,
      "url": "https://api.github.com/..."
    }
  ]
}
```

#### GET /repositories/{repository}/branches/{branch}/files/content

Get file content.

**Request**:
```bash
curl "http://localhost:7007/api/gitops/repositories/rli-use2/branches/master/files/content?path=app/charts/radiantone/values.yaml"
```

**Response**:
```json
{
  "name": "values.yaml",
  "path": "app/charts/radiantone/values.yaml",
  "sha": "abc123...",
  "size": 2500,
  "url": "https://api.github.com/...",
  "content": "ZmlkOgogIGltYWdlOgogICAgcmVwb3NpdG9ye...",
  "encoding": "base64",
  "download_url": "https://raw.githubusercontent.com/..."
}
```

**Decode Content**:
```bash
# Using jq and base64
curl "http://localhost:7007/api/gitops/repositories/rli-use2/branches/master/files/content?path=app/charts/radiantone/values.yaml" \
  | jq -r '.content' \
  | base64 -d
```

#### POST /repositories/{repository}/branches/{branch}/files

Update or create a file.

**Request**:
```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/branches/master/files \
  -H "Content-Type: application/json" \
  -d '{
    "path": "app/charts/radiantone/values.yaml",
    "content": "ZmlkOgogIGltYWdlOgogICAgcmVwb3NpdG9ye...",
    "message": "Update FID version to 8.1.2",
    "sha": "abc123...",
    "committer": {
      "name": "GitOps Portal",
      "email": "gitops@radiantlogic.com"
    }
  }'
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path |
| `content` | string | Yes | Base64-encoded file content |
| `message` | string | Yes | Commit message |
| `sha` | string | Yes (update) | Current file SHA (for updates) |
| `committer` | object | No | Committer info |

**Response**:
```json
{
  "content": {
    "name": "values.yaml",
    "path": "app/charts/radiantone/values.yaml",
    "sha": "new-sha-123...",
    "size": 2550,
    "url": "https://api.github.com/..."
  },
  "commit": {
    "sha": "commit-sha-456...",
    "message": "Update FID version to 8.1.2",
    "author": {
      "name": "GitOps Portal",
      "email": "gitops@radiantlogic.com",
      "date": "2025-10-29T12:00:00Z"
    },
    "url": "https://api.github.com/..."
  }
}
```

---

### Pull Requests

#### GET /repositories/{repository}/pulls

List pull requests.

**Request**:
```bash
curl "http://localhost:7007/api/gitops/repositories/rli-use2/pulls?state=open"
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | `open`, `closed`, or `all` (default: `open`) |
| `sort` | string | `created`, `updated`, `popularity` (default: `created`) |
| `direction` | string | `asc` or `desc` (default: `desc`) |

**Response**:
```json
{
  "pulls": [
    {
      "id": 1234,
      "number": 42,
      "state": "open",
      "title": "Update FID version to 8.1.2",
      "body": "Updating FID version across tenant branches",
      "user": {
        "login": "developer1",
        "avatar_url": "https://github.com/..."
      },
      "head": {
        "ref": "feature/update-fid-version",
        "sha": "head123..."
      },
      "base": {
        "ref": "master",
        "sha": "base456..."
      },
      "created_at": "2025-10-28T10:00:00Z",
      "updated_at": "2025-10-29T15:00:00Z",
      "html_url": "https://github.com/radiantlogic-saas/rli-use2/pull/42"
    }
  ]
}
```

#### POST /repositories/{repository}/pulls

Create a pull request.

**Request**:
```bash
curl -X POST http://localhost:7007/api/gitops/repositories/rli-use2/pulls \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Update FID version to 8.1.2",
    "body": "## Summary\nUpdates FID version\n\n## Testing\n- Tested in dev",
    "head": "feature/update-fid-version",
    "base": "master"
  }'
```

**Response**:
```json
{
  "pull": {
    "id": 1235,
    "number": 43,
    "state": "open",
    "title": "Update FID version to 8.1.2",
    "html_url": "https://github.com/radiantlogic-saas/rli-use2/pull/43",
    ...
  }
}
```

---

### ArgoCD Applications

#### GET /argocd/applications

List all ArgoCD applications.

**Request**:
```bash
curl http://localhost:7007/api/gitops/argocd/applications
```

**Response**:
```json
{
  "applications": [
    {
      "name": "radiantone-mp02",
      "namespace": "duploservices-rli-use2-mp02",
      "syncStatus": "Synced",
      "healthStatus": "Healthy",
      "repo": "https://github.com/radiantlogic-saas/rli-use2",
      "path": "app/charts/radiantone",
      "targetRevision": "rli-use2-mp02",
      "lastSyncTime": "2025-10-29T10:30:00Z"
    }
  ]
}
```

#### POST /argocd/applications/{app}/sync

Trigger application sync.

**Request**:
```bash
curl -X POST http://localhost:7007/api/gitops/argocd/applications/radiantone-mp02/sync \
  -H "Content-Type: application/json" \
  -d '{
    "prune": false,
    "dryRun": false
  }'
```

**Response**:
```json
{
  "status": "success",
  "operation": {
    "id": "op-123...",
    "phase": "Running",
    "startedAt": "2025-10-29T12:00:00Z"
  }
}
```

---

### Bulk Operations

#### POST /bulk-operations

Create a bulk operation to update multiple branches.

**Request**:
```bash
curl -X POST http://localhost:7007/api/gitops/bulk-operations \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "rli-use2",
    "branches": ["rli-use2-mp02", "rli-use2-mp04", "rli-use2-mp06"],
    "file_path": "app/charts/radiantone/values.yaml",
    "operation_type": "field_update",
    "field_path": "fid.image.tag",
    "new_value": "8.1.2",
    "commit_message": "Update FID version to 8.1.2"
  }'
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repository` | string | Yes | Repository name |
| `branches` | array | Yes | List of branch names |
| `file_path` | string | Yes | Path to file |
| `operation_type` | string | Yes | `field_update` or `file_replace` |
| `field_path` | string | Conditional | YAML field path (if field_update) |
| `new_value` | any | Conditional | New value (if field_update) |
| `new_content` | string | Conditional | Base64 content (if file_replace) |
| `commit_message` | string | Yes | Commit message |

**Response**:
```json
{
  "operation": {
    "id": "op-uuid-123",
    "status": "running",
    "repository": "rli-use2",
    "branches_total": 3,
    "branches_completed": 0,
    "branches_failed": 0,
    "started_at": "2025-10-29T12:00:00Z",
    "estimated_completion": "2025-10-29T12:05:00Z"
  }
}
```

#### GET /bulk-operations

List bulk operations.

**Request**:
```bash
curl "http://localhost:7007/api/gitops/bulk-operations?status=running&limit=10"
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `running`, `completed`, `failed` |
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Offset for pagination |

**Response**:
```json
{
  "operations": [
    {
      "id": "op-uuid-123",
      "status": "running",
      "repository": "rli-use2",
      "branches_total": 50,
      "branches_completed": 25,
      "branches_failed": 2,
      "started_at": "2025-10-29T12:00:00Z",
      "progress_percentage": 50
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

#### GET /bulk-operations/{id}

Get bulk operation details.

**Request**:
```bash
curl http://localhost:7007/api/gitops/bulk-operations/op-uuid-123
```

**Response**:
```json
{
  "operation": {
    "id": "op-uuid-123",
    "status": "completed",
    "repository": "rli-use2",
    "file_path": "app/charts/radiantone/values.yaml",
    "operation_type": "field_update",
    "field_path": "fid.image.tag",
    "new_value": "8.1.2",
    "commit_message": "Update FID version to 8.1.2",
    "branches_total": 50,
    "branches_completed": 48,
    "branches_failed": 2,
    "started_at": "2025-10-29T12:00:00Z",
    "completed_at": "2025-10-29T12:10:00Z",
    "duration_seconds": 600,
    "results": [
      {
        "branch": "rli-use2-mp02",
        "status": "success",
        "commit_sha": "abc123...",
        "message": "Successfully updated"
      },
      {
        "branch": "rli-use2-mp04",
        "status": "failed",
        "error": "Branch not found"
      }
    ]
  }
}
```

---

### Audit Logs

#### GET /audit-logs

List audit logs.

**Request**:
```bash
curl "http://localhost:7007/api/gitops/audit-logs?start_date=2025-10-01&end_date=2025-10-31&limit=50"
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | Start date (ISO 8601) |
| `end_date` | string | End date (ISO 8601) |
| `user_id` | string | Filter by user ID |
| `repository` | string | Filter by repository |
| `operation` | string | Filter by operation type |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Offset for pagination |

**Response**:
```json
{
  "logs": [
    {
      "id": "log-uuid-123",
      "timestamp": "2025-10-29T12:00:00Z",
      "user_id": "user123",
      "user_email": "developer@radiantlogic.com",
      "operation": "file_update",
      "repository": "rli-use2",
      "branch": "rli-use2-mp02",
      "file_path": "app/charts/radiantone/values.yaml",
      "commit_sha": "abc123...",
      "commit_message": "Update FID version to 8.1.2",
      "metadata": {
        "changes": {
          "fid.image.tag": {
            "old": "8.1.1",
            "new": "8.1.2"
          }
        }
      }
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

---

## Rate Limiting

### GitHub API Rate Limits

The portal inherits GitHub's rate limits:

- **Authenticated**: 5,000 requests per hour
- **Search API**: 30 requests per minute

**Check Rate Limit**:
```bash
curl http://localhost:7007/api/gitops/github/rate-limit
```

**Response**:
```json
{
  "core": {
    "limit": 5000,
    "remaining": 4950,
    "reset": 1635350400,
    "reset_time": "2025-10-29T13:00:00Z"
  },
  "search": {
    "limit": 30,
    "remaining": 28,
    "reset": 1635346800,
    "reset_time": "2025-10-29T12:00:00Z"
  }
}
```

### Rate Limit Headers

Responses include rate limit headers:

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4950
X-RateLimit-Reset: 1635350400
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Example: List repositories
async function listRepositories() {
  const response = await fetch(
    'http://localhost:7007/api/gitops/repositories'
  );
  const data = await response.json();
  return data.repositories;
}

// Example: Update file
async function updateFile(repo: string, branch: string, path: string, content: string, sha: string) {
  const response = await fetch(
    `http://localhost:7007/api/gitops/repositories/${repo}/branches/${branch}/files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        content: btoa(content), // Base64 encode
        message: 'Update via API',
        sha,
      }),
    }
  );
  return response.json();
}

// Example: Create bulk operation
async function createBulkOperation(repo: string, branches: string[], fieldPath: string, newValue: any) {
  const response = await fetch(
    'http://localhost:7007/api/gitops/bulk-operations',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repository: repo,
        branches,
        file_path: 'app/charts/radiantone/values.yaml',
        operation_type: 'field_update',
        field_path: fieldPath,
        new_value: newValue,
        commit_message: `Update ${fieldPath} to ${newValue}`,
      }),
    }
  );
  return response.json();
}
```

### Python

```python
import requests
import base64

BASE_URL = 'http://localhost:7007/api/gitops'

# Example: List repositories
def list_repositories():
    response = requests.get(f'{BASE_URL}/repositories')
    return response.json()['repositories']

# Example: Update file
def update_file(repo, branch, path, content, sha):
    url = f'{BASE_URL}/repositories/{repo}/branches/{branch}/files'
    payload = {
        'path': path,
        'content': base64.b64encode(content.encode()).decode(),
        'message': 'Update via API',
        'sha': sha
    }
    response = requests.post(url, json=payload)
    return response.json()

# Example: Create bulk operation
def create_bulk_operation(repo, branches, field_path, new_value):
    url = f'{BASE_URL}/bulk-operations'
    payload = {
        'repository': repo,
        'branches': branches,
        'file_path': 'app/charts/radiantone/values.yaml',
        'operation_type': 'field_update',
        'field_path': field_path,
        'new_value': new_value,
        'commit_message': f'Update {field_path} to {new_value}'
    }
    response = requests.post(url, json=payload)
    return response.json()

# Example: Monitor bulk operation
def monitor_bulk_operation(operation_id):
    url = f'{BASE_URL}/bulk-operations/{operation_id}'
    while True:
        response = requests.get(url)
        data = response.json()
        status = data['operation']['status']

        if status in ['completed', 'failed']:
            return data

        progress = data['operation']['progress_percentage']
        print(f'Progress: {progress}%')
        time.sleep(5)
```

### Bash/cURL

```bash
#!/bin/bash

BASE_URL="http://localhost:7007/api/gitops"

# List repositories
list_repositories() {
  curl -s "$BASE_URL/repositories" | jq '.repositories'
}

# List branches for a repository
list_branches() {
  local repo=$1
  curl -s "$BASE_URL/repositories/$repo/branches" | jq '.branches'
}

# Get file content
get_file_content() {
  local repo=$1
  local branch=$2
  local path=$3

  curl -s "$BASE_URL/repositories/$repo/branches/$branch/files/content?path=$path" \
    | jq -r '.content' \
    | base64 -d
}

# Update file
update_file() {
  local repo=$1
  local branch=$2
  local path=$3
  local content=$4
  local sha=$5

  local encoded_content=$(echo "$content" | base64)

  curl -X POST "$BASE_URL/repositories/$repo/branches/$branch/files" \
    -H "Content-Type: application/json" \
    -d "{
      \"path\": \"$path\",
      \"content\": \"$encoded_content\",
      \"message\": \"Update via script\",
      \"sha\": \"$sha\"
    }"
}

# Create bulk operation
create_bulk_operation() {
  local repo=$1
  local branches=$2  # JSON array as string
  local field_path=$3
  local new_value=$4

  curl -X POST "$BASE_URL/bulk-operations" \
    -H "Content-Type: application/json" \
    -d "{
      \"repository\": \"$repo\",
      \"branches\": $branches,
      \"file_path\": \"app/charts/radiantone/values.yaml\",
      \"operation_type\": \"field_update\",
      \"field_path\": \"$field_path\",
      \"new_value\": \"$new_value\",
      \"commit_message\": \"Update $field_path to $new_value\"
    }"
}

# Example usage
list_repositories
list_branches "rli-use2"
get_file_content "rli-use2" "master" "app/charts/radiantone/values.yaml"
```

---

## API Client Libraries

### Official Libraries (Coming Soon)

- **JavaScript/TypeScript**: `@radiantlogic/gitops-client`
- **Python**: `radiantlogic-gitops`
- **Go**: `github.com/radiantlogic-saas/gitops-go-client`

### Community Libraries

Check the GitHub repository for community-contributed client libraries.

---

## Support

For API questions or issues:

- **Documentation**: [API Reference](api-reference.md)
- **Examples**: See `/examples` directory in repository
- **Issues**: https://github.com/radiantlogic-saas/backstage-gitops/issues
- **Email**: platform-team@radiantlogic.com
