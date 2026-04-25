# DevOps Portal Security Best Practices Report

Date: 2026-03-02
Scope: Repository code and configuration in `/Users/nutakki/Documents/github/devops-portal`

## Executive Summary

The current implementation has multiple confirmed high-risk security issues. Two are critical and should be treated as immediate incident-level items: a hardcoded default admin password in source code and a likely client-side exposure of a Grafana API key via Next.js build-time environment injection.

The codebase is not currently in a "secure by default" state. In its present form, the portal can be hacked, especially by attackers who can reach the app and/or have low-privileged authenticated access.

Dependency CVE/outdated-package verification could not be completed online in this environment because npm registry access is blocked. CI coverage for security checks is also inconsistent with the active source layout.

## Method

- Static review of auth, API routes, middleware, proxy routes, secrets handling, and CI/workflow config.
- Secret pattern and hardcoded credential scan across tracked source and infra templates.
- Local package/dependency checks where possible (`npm ls`, `npm audit`, `npm outdated`).
- Framework best-practice comparison for Next.js/TypeScript frontend + backend patterns.

## Critical Findings

### CRIT-001: Hardcoded default admin credentials in source

- Location:
  - `plugins/gitops-backend/src/service/router.ts:2446`
  - `plugins/gitops-backend/src/service/router.ts:2449`
  - `plugins/gitops-backend/src/service/router.ts:2453`
- Evidence: Default admin user is auto-created with `password: 'Admin@123!'` and the password is logged.
- Impact: Anyone with endpoint access can attempt known default credentials and gain administrative control.
- Recommended fix:
  1. Remove auto-creation of default admin with static password.
  2. Require bootstrap through one-time setup token or migration-time secret.
  3. Immediately rotate any environment where this code has run.
  4. Remove credential values from logs permanently.

### CRIT-002: `GRAFANA_API_KEY` likely exposed to browser bundle

- Location:
  - `next.config.ts:113`
  - `next.config.ts:115`
- Evidence: `env` in Next config includes `GRAFANA_API_KEY`, which is compile-time inlined and can be exposed client-side.
- Impact: If exposed in client bundles/runtime, this grants attackers direct API access to Grafana data/actions.
- Recommended fix:
  1. Remove `GRAFANA_API_KEY` from `next.config.ts env`.
  2. Keep secrets server-only (route handlers/server components/process env at runtime).
  3. Rotate Grafana keys after remediation.

## High Findings

### HIGH-003: Rate limiting is effectively disabled by Redis initialization bug

- Location:
  - `src/lib/redis.ts:59`
  - `src/lib/redis.ts:62`
  - `src/lib/api.ts:219`
  - `src/lib/api.ts:221`
- Evidence: `_redis` is initialized to `null` but checked against `undefined`, so Redis client creation path is skipped; API rate limit helper returns permissive success when Redis is absent.
- Risk: Brute-force and abuse defenses are weakened or bypassed.
- Recommended fix:
  1. Initialize `_redis` as `undefined` and/or fix guard to initialize when `null`.
  2. Fail closed for sensitive routes if rate limiter backend is unavailable.
  3. Add tests for rate-limit behavior with/without Redis.

### HIGH-004: SSRF risk via user-controlled MCP server URL

- Location:
  - `src/app/api/mcp/chat/route.ts:13`
  - `src/app/api/mcp/chat/route.ts:112`
  - `src/app/api/mcp/chat/route.ts:124`
- Evidence: `mcpServerUrl` is accepted from request body and used in server-side outbound fetch flow without host allowlisting.
- Risk: Authenticated users could force server-side requests to internal services/metadata endpoints.
- Recommended fix:
  1. Remove user-provided arbitrary URL support for server-side fetch.
  2. Enforce strict allowlist of trusted MCP hosts.
  3. Block RFC1918/link-local/loopback targets.

### HIGH-005: Legacy GitOps backend defaults permit unauthenticated access

- Location:
  - `plugins/gitops-backend/src/plugin.ts:36`
  - `plugins/gitops-backend/src/plugin.ts:43`
  - `plugins/gitops-backend/src/service/router.ts:161`
- Evidence: Auth policy allows unauthenticated mode by default/fallback and `allowUnauthenticated` defaults to `true`.
- Risk: Endpoint exposure without authentication in misconfigured or non-production environments that still hold real data.
- Recommended fix:
  1. Default to authenticated-only in all environments.
  2. Require explicit local-dev override with loud startup warnings.
  3. Gate sensitive operations by role checks server-side.

## Medium Findings

### MED-006: Open redirect risk in callback URL handling

- Location:
  - `src/app/(auth)/login/page.tsx:23`
  - `src/app/(auth)/login/page.tsx:118`
  - `src/app/(auth)/auth/popup-complete/page.tsx:10`
  - `src/app/(auth)/auth/popup-complete/popup-complete-client.tsx:29`
  - `src/app/(auth)/select-organization/page.tsx:43`
  - `src/app/(auth)/select-organization/page.tsx:110`
- Evidence: `callbackUrl` is propagated from query params and used in client redirects without strict same-origin validation.
- Risk: Users can be redirected to attacker-controlled sites after auth flow.
- Recommended fix:
  1. Allow only relative callback paths or same-origin absolute URLs.
  2. Normalize and validate callback target server-side before use.

### MED-007: Metrics endpoint can be exposed by weak trust assumptions

- Location:
  - `src/app/api/metrics/route.ts:20`
  - `src/app/api/metrics/route.ts:26`
  - `src/middleware.ts:22`
- Evidence: Endpoint is org-optional; if token is unset, access is open; "internal" trust is inferred from `x-forwarded-for`/missing IP.
- Risk: Metrics leakage and reconnaissance data exposure.
- Recommended fix:
  1. Require `METRICS_AUTH_TOKEN` in non-local environments.
  2. Remove implicit internal-IP bypass logic from app layer.
  3. Restrict at ingress/network policy and optionally mTLS.

### MED-008: Public verbose health endpoint reveals internal service details

- Location:
  - `src/middleware.ts:14`
  - `src/app/api/health/route.ts:42`
  - `src/app/api/health/route.ts:56`
  - `src/app/api/health/route.ts:138`
  - `src/app/api/health/route.ts:230`
- Evidence: `/api/health` is public; `verbose=true` includes integration/system details.
- Risk: Attackers gain operational intelligence useful for targeting.
- Recommended fix:
  1. Split liveness/readiness public checks from authenticated diagnostic endpoint.
  2. Disable verbose diagnostics for unauthenticated callers.

### MED-009: CSP includes `unsafe-inline` and `unsafe-eval`

- Location:
  - `next.config.ts:54`
  - `next.config.ts:55`
- Evidence: Primary app CSP permits inline and eval script execution.
- Risk: Reduces XSS mitigation strength.
- Recommended fix:
  1. Move toward nonce/hash-based scripts and remove `unsafe-eval` first.
  2. Scope exceptions only where unavoidable.

### MED-010: Security automation/policies are incomplete for active code

- Location:
  - `.github/workflows/v2-ci.yml:7`
  - `.github/workflows/v2-ci.yml:12`
  - `.github/codeql-config.yml:4`
  - `.github/workflows/docker-build-push.yml:9`
  - `.github/workflows/docker-build-push.yml:142`
- Evidence:
  - `v2` workflows/path filters target `v2/**`, but this checkout’s active app is root `src/`.
  - Container scans are `continue-on-error`, reducing enforcement value.
  - No repo-level `SECURITY.md`, `CODEOWNERS`, `dependabot.yml`, or `.snyk` found outside dependencies.
- Risk: Vulnerabilities can ship undetected; response ownership and disclosure process are unclear.
- Recommended fix:
  1. Align CI security scopes to active source paths.
  2. Make high/critical scans blocking.
  3. Add `SECURITY.md`, `CODEOWNERS`, and Dependabot config.

## Dependency and Outdated Package Status

- `npm audit` could not complete due blocked registry access in this environment:
  - Error: `getaddrinfo ENOTFOUND registry.npmjs.org`
- `npm outdated` also could not be completed (network/DNS restricted).
- Only one lockfile was found at repo root (`package-lock.json`), limiting reproducible auditability across legacy package areas.
- Local inventory indicates dependency-state drift/unmet deps in legacy Backstage subprojects (`packages/app`, `packages/backend`, `plugins/gitops`), which increases security uncertainty.

## Secrets and Plaintext Credential Status

- Confirmed plaintext credential in source: `Admin@123!` in `plugins/gitops-backend/src/service/router.ts:2449`.
- Local `.env` exists with secret-bearing keys (e.g., `NEXTAUTH_SECRET`, `AUTH_SECRET`, `DATABASE_URL`) stored as plaintext on disk, which is standard but requires host/file permission hardening.
- `.env` is ignored by git (`.gitignore:25`), reducing accidental commit risk.
- No obvious real leaked cloud/API key material was found in tracked source by common key-pattern scans; most token-like strings are placeholders/examples.

## Bottom Line

- Can devops-portal be hacked in its current state: **Yes, materially**.
- Most urgent fixes (same day):
  1. Remove hardcoded default admin password and rotate credentials.
  2. Remove `GRAFANA_API_KEY` from client-exposed Next.js env and rotate key.
  3. Fix Redis/rate-limit initialization bug and enforce fail-closed on sensitive auth endpoints.
  4. Lock down MCP URL SSRF vector with strict host allowlist.

