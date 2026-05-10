# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/) starting from v0.1.0.

## [Unreleased]

### Added
- **CI staging-deploy workflow** (`.github/workflows/integration-staging.yml`, PR #26): opt-in long-lived Kubernetes deployment for PR review, gated on the `STAGING_ENABLED` repository variable so forks and the default OSS install stay no-cost. New helpers: `scripts/bootstrap-staging-rbac.sh`, `scripts/staging-deploy.sh`, `scripts/staging-test.sh`, and `docs/development/STAGING.md`.
- **Architecture: `docs/architecture/MULTI-CLUSTER.md`**: cluster registration flow, kubeconfig storage + decryption, the three auth types (`standard` / `duplo` / `eks`), and how per-org ArgoCD/Grafana credentials are sourced. Filled the largest OSS-doc gap.
- **Operations: RBAC matrix** added to `docs/operations/AUTHENTICATION_AND_USERS.md` showing which `USER` / `READWRITE` / `ADMIN` capabilities are enforced at which routes (cluster CRUD, pod exec, user management, etc.).
- **Operations: RLS reference** added to `docs/operations/SECURITY_AND_RELIABILITY.md`: the six tenant-scoped tables protected by Postgres Row-Level Security, when `npm run db:setup-rls` is required, and the failure modes if the GUC isn't set.

### Changed
- **Security overrides** (PR #30): bumped `uuid` override from `^11.0.0` to `^11.1.1` (GHSA-w5hq-g745-h8pq) and added a new `postcss` override at `^8.5.10` (GHSA-qx2v-qp2m-jg93) to displace the vulnerable copy bundled inside `next@15.5.15`. `npm audit` clean.
- **README**: added a one-line note up top clarifying that the active runtime is Next.js 15 + React 19; the Backstage-era trees were removed at v0.1.0 and live in `docs/legacy/` for historical reference.
- **`docs/architecture/PROJECT-STRUCTURE.md`** moved to `docs/legacy/backstage-era/PROJECT-STRUCTURE.md` (it described the original Backstage monorepo layout, not the current `src/` tree, and was actively misleading new contributors).

### Dependencies
- `vite`, `@vitest/coverage-v8`, `@vitest/ui`, `vitest` bumped (PR #22)
- `esbuild`, `@vitest/coverage-v8`, `@vitest/ui`, `vitest` bumped (PR #23)
- `ip-address` 10.1.0 → 10.2.0 (PR #25)

### Fixed
- **S3 path-style signed URLs** (`src/lib/services/s3.ts`): bucket name was duplicated in `${baseUrl}${canonicalUri}` because both halves included it for path-style endpoints (MinIO, LocalStack, `localhost`). Pre-signed PUT URLs landed at the wrong key (`bucket/bucket/key`) and signature validation depended on MinIO leniency. Fix moves the bucket out of `baseUrl` for path-style and updates `listObjects` to concat both halves. Found by Phase 8 of the v0.1.0 verification round.
- **YAML editor server-side apply** (`src/app/api/clusters/[id]/yaml/route.ts`): `PUT /api/clusters/[id]/yaml` returned `500 / 415 Unsupported Media Type` from the apiserver because the `KubernetesObjectApi.patch()` 6th positional arg was being passed an options object (`{ headers: { 'Content-Type': '...' } }`) instead of the v1 client's expected `PatchStrategy` string. The v1 client silently ignored the options object and sent the request without a Content-Type. Fix replaces the literal with `k8s.PatchStrategy.ServerSideApply`. Found by Phase 3.4 of the v0.1.0 verification round.
- **`phase-8-storage.sh`** also accepts `400 S3_NOT_CONFIGURED` as a graceful response. The `integration.yml` workflow runs the script without configuring S3/MinIO, so the route correctly returns 400 — the script previously only accepted `200|404` and would deterministically fail the integration job. Now `200|400|404` are all graceful; anything else (especially 5xx) is still a fail.
- **`phase-12-empty-state-pages.sh`** also accepts `404` so an intentionally-removed page is recognized as a "feature unavailable" signal, matching the script's own header comment. Previously `200|307|308` was the only pass set, which contradicted the comment and would force script churn whenever a route was retired.

## [0.1.0] — 2026-05-05

First public release. Portal works against any Kubernetes cluster reachable via kubeconfig — multi-cluster federation, multi-tenant via Postgres RLS, and per-cluster integrations with ArgoCD / Prometheus / Grafana / Loki and others.

### Added
- **Apache 2.0 license** (`LICENSE`)
- **OSS community files**: `README.md` (rewritten), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `QUICKSTART.md`
- **Package metadata**: `package.json` now declares `name: devops-portal`, `version: 0.1.0`, `license: Apache-2.0`, repository, homepage, bugs, and keywords for discoverability
- **Roadmap entry** for the planned in-cluster Portal Agent (v0.5+ target): three-posture identity (built-in CA / BYO-CA / SPIFFE-SPIRE), outbound mTLS tunnel, OSS-first. Public design RFC to follow.

### Changed
- **K8s Job labels** in security-scans: replaced custom-domain labels (`devops-portal.radiantlogic.io/security-scan`) with K8s standard recommended labels (`app.kubernetes.io/component=security-scan`, `managed-by=devops-portal`, `instance=<scanId>`)
- **GitHub org placeholder** in settings UI: generic `"my-github-org"` instead of internal RL org name
- **Organization segment label** "Infra (Duplo)" → "Infrastructure" (substring matching for "duplo" still works as a runtime classifier)

### Fixed (carried forward from 2026-05-03 → 2026-05-04 working sessions)
- 5 v0.x → v1 `@kubernetes/client-node` API drift bugs in cluster routes (pods, events, rollouts, helm, pod-logs) — all use options-object signature now
- Pod-logs SSE stream: static `import { Writable } from 'node:stream'` (dynamic await-import didn't work under the Next.js bundler)
- `/clusters` page Application Error from `<SelectItem value="">` (Radix UI v2 forbids empty values; sentinel `__all__` pattern instead)
- `setup-rls.ts` column-name bug (`clusters.organization_id` is snake_case via Prisma `@map`, others are camelCase)
- Encryption test: rewritten as real round-trip + tamper detection (was previously mocking `crypto`, exercising zero of the real encryption code)
- Removed legacy SHA-256 password fallback (downgrade-attack window)
- 16 tracked + 4 untracked Finder duplicates removed from working tree
- `@types/ws` added to fix TypeScript errors on pod-exec

### Removed
- **Backstage-era source** (~820 dead files): `packages/`, `plugins/`, `deployment/docker/`, `config/`, `app-config.yaml`. The repo originated as a Backstage app; the Next.js rewrite is in `src/`. The legacy trees were untouched by the active runtime, just adding clone weight.
- **Internal-only deploy scripts**: `scripts/deploy-{qa,qa2,saasops1,to-qa}.sh` (RL-specific environment automation)
- **Internal-only Helm values**: `deployment/helm/values-{qa,qa2,saasops1}.yaml` (the active chart is at `helm/devops-portal/`)
- **Stale internal docs** under `docs/development/`: PR summaries, session notes, status TODOs, mock-data testing guide. Kept: `CURRENT_RUNTIME_MAINTAINER_HANDOFF.md` for new contributor onboarding.

All removals are recoverable from git history (`git log -- <path>`).

### Known limitations
- **Helm chart** at `helm/devops-portal/` was originally written for an internal deployment; it works but PRs to make it more generic are welcome.
- **Output sanitization** (regex-based redaction of secrets in pod logs / events / YAML) is best-effort, not a security boundary. See `SECURITY.md`.
- **Mutations** (scale, restart, exec, apply) are read-only-only at v0.1. Coming in v0.5+ behind separate security review.
- **Mocks ban**: tests run against real Postgres / Redis / kind cluster. CI cost will be higher than mock-heavy projects; that's intentional. See `CONTRIBUTING.md` for rationale.

### Verified
- TypeScript: 0 errors
- ESLint (`--max-warnings 0`): 0 warnings
- Vitest: 146/146 passing (no mocks)
- Production build (`npm run build`): green
- Live portal smoke-tested end-to-end against kind cluster: pods, events, workloads, services, ingresses, helm, rollouts, pod-detail (logs/yaml/info), all rendering correctly

[Unreleased]: https://github.com/gnanirahulnutakki/devops-portal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gnanirahulnutakki/devops-portal/releases/tag/v0.1.0
