# GitHub OAuth Integration

## Overview

The DevOps Portal uses GitHub OAuth to authenticate users AND to make GitHub API calls on their behalf. This means:

1. When a user signs in with GitHub, their OAuth token is stored by Backstage
2. When the user views repositories, PRs, issues - we use THEIR OAuth token
3. The user only sees repositories/PRs they have access to on GitHub
4. All GitHub API calls are scoped to the user's permissions

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                          GitOpsApi Client                                │ │
│  │  • Injects githubAuthApi via Backstage plugin API                       │ │
│  │  • Calls githubAuthApi.getAccessToken() to get user's OAuth token       │ │
│  │  • Includes token in x-github-token header on every request             │ │
│  │  • Caches token for 50 minutes to avoid repeated OAuth flow             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     │ x-github-token: gho_xxx...              │
│                                     ▼                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        router.ts                                         │ │
│  │  • getGitHubServiceForRequest(req): extracts x-github-token header      │ │
│  │  • Creates new GitHubService with user's token OR falls back to static  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        GitHubService                                     │ │
│  │  • Initialized with user's OAuth token                                  │ │
│  │  • Makes API calls to GitHub with user's permissions                    │ │
│  │  • User only sees repos/PRs they have access to                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## OAuth Scopes

The following scopes are requested when the user signs in with GitHub:

| Scope | Purpose |
|-------|---------|
| `repo` | Full control of private repositories (read/write code, issues, PRs) |
| `read:org` | Read organization and team membership |
| `workflow` | Update GitHub Actions workflows |
| `user` | Read user profile data |
| `read:user` | Read user email addresses |

## Key Files

### Frontend

**`plugins/gitops/src/api/GitOpsApi.ts`**
- Main API client that handles OAuth token retrieval and passing
- Uses `githubAuthApi.getAccessToken()` to get the user's token
- Includes `x-github-token` header in all requests
- Implements token caching to avoid repeated OAuth flows

**`packages/app/src/apis.ts`**
- Configures the GitOpsApi factory with `githubAuthApiRef` dependency
- Ensures every GitOpsApi instance has access to the user's OAuth context

### Backend

**`plugins/gitops-backend/src/service/router.ts`**
- Contains `getGitHubServiceForRequest()` function
- Extracts `x-github-token` header from incoming requests
- Creates user-specific GitHubService instances

**`plugins/gitops-backend/src/services/GitHubService.ts`**
- Octokit-based service for GitHub API operations
- User-centric endpoints: `/user/profile`, `/user/repos`, `/user/pull-requests`
- Falls back to mock data when no token is provided

## User-Centric Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /user/profile` | Get authenticated user's GitHub profile |
| `GET /user/repos` | Get repositories the user has access to |
| `GET /user/pull-requests` | Get PRs created by, assigned to, or requesting review from the user |
| `GET /user/issues` | Get issues involving the user |
| `GET /user/organizations` | Get organizations the user belongs to |
| `GET /user/dashboard` | Get combined dashboard data (profile, PRs, repos) |

## Widgets Using OAuth

| Widget | Location | Description |
|--------|----------|-------------|
| `MyPullRequestsWidget` | Home page | Shows user's open PRs across all repos |
| `HomePage` | Main dashboard | Shows user profile, PRs, repos, stats |

## Troubleshooting

### "Sign in with GitHub to see your pull requests"

The user hasn't completed GitHub OAuth sign-in. Click the "Sign in with GitHub" button.

### "GitHub authentication required"

The OAuth token is missing. Sign out and sign in again with GitHub.

### "GitHub token expired or invalid"

OAuth tokens expire. Sign out and sign in again.

### Data shows "mock" or placeholder content

The backend couldn't get a valid OAuth token and is using mock data. Check:
1. User signed in with GitHub (not guest)
2. OAuth app configured correctly in GitHub
3. Callback URL matches deployment URL

## Configuration

### app-config.yaml

```yaml
auth:
  environment: production  # or 'development' for guest access
  providers:
    github:
      production:
        clientId: ${GITHUB_CLIENT_ID}
        clientSecret: ${GITHUB_CLIENT_SECRET}
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName
```

### GitHub OAuth App Settings

1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create a new OAuth App or edit existing
3. Set Authorization callback URL to: `https://your-domain/api/auth/github/handler/frame`
4. Copy Client ID and Client Secret to your configuration

## Testing

1. Sign in with GitHub
2. Open browser DevTools > Network tab
3. Look for requests to `/api/gitops/user/*`
4. Check that `x-github-token` header is present
5. Verify response contains actual GitHub data (not mock)

## Security Considerations

- OAuth tokens are only stored in the browser session
- Tokens are never logged or persisted to the database
- Backend validates tokens on every request
- Token caching is limited to 50 minutes (tokens typically expire in 1 hour)
- If authentication fails, we fall back to showing an auth prompt (not mock data)
