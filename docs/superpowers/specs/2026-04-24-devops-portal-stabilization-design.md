# devops-portal Stabilization + Architectural Boundary — Design

**Date**: 2026-04-24
**Author**: Gnani Rahul (pair-designed with Claude Opus 4.7)
**Status**: Approved — proceeding to implementation
**Scope**: Repo hygiene, in-flight credential-health feature, doc consolidation, `main` resync, CNCF protocol project boundary

## Context

This repository is carrying two projects (the DevOps Portal and an embedded CNCF-candidate multi-cluster action protocol in `core/`) plus three kinds of in-flight work (credential-health feature, doc consolidation, security-hardening follow-through). It also sits inside `~/Documents/github/`, which on this machine is iCloud-managed and known to destroy git state — the same failure mode that obliterated the `radiantic` repo on 2026-04-20.

Before this plan, the `main` branch still tracks the pre-pivot Backstage incarnation; the live runtime is on `dev` with 4 weeks of uncommitted feature work on top. `feature/core-protocol` (PR #21) runs in parallel as its own CNCF-track initiative.

See `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md` for the post-pivot runtime map.

## Decisions

1. **Architectural posture**: Option 1 — co-located projects with clearly marked boundaries. Portal and `core/` both live in this repo. Protocol subtree-split to its own public repo is deferred to M1 (per `core/PROJECT.md` DR-010), not pulled forward.
2. **Repo location**: Migrate out of `~/Documents/github/` to `~/repos/devops-portal/` before any other work, per the rule in `~/CLAUDE.local.md`.
3. **PR granularity**: Split the in-flight work into three independently-reviewable PRs: credential-health feature, doc consolidation, `main` resync. No bundling.
4. **`main` strategy**: Catch `main` up to `dev` once the other work lands. `main` is strictly behind `dev` (not diverged), so no force-push is needed. Use a merge commit (not true fast-forward) so the catch-up is a single landmark commit in `main`'s history rather than a silent linear replay.
5. **Test coverage**: Add unit tests for the parts of credential-health with the highest bug surface (`sanitizeError`, orchestrator expiry-override logic, API envelope shape). Defer integration tests that mock each of the 12 provider probes — that is a separate hardening pass.
6. **`expiresAt` UI**: Introduce a single shared `CredentialExpiryField` component and wire it into all 7 integration config pages. Do not duplicate per page.
7. **Protocol work**: Scope for this plan is limited to M1 milestone *planning*, not execution. Execution (public-repo extraction, external CA integration, v0.1 wire freeze) stays on `feature/core-protocol`.

## Sequence α — Safety-first execution order

```
1. Migrate repo out of iCloud
2. Commit doc consolidation (isolated PR)
3. Fix credential-health bugs + add shared expiry field + tests (isolated PR)
4. Fast-forward main → dev
5. Publish protocol M1 milestone plan as living design doc
```

Every step is reversible; every artifact is a small, reviewable unit.

## Section 1 — Repo migration

**Artifact**: functioning git clone at `~/repos/devops-portal/` with all current local state preserved; old tree untouched for rollback.

**WIP preservation**: capture staged+unstaged+untracked state to `/tmp/wip.patch` via `git diff --staged --binary` (after `git add -A`). Binary-safe; survives through `git apply`.

**External worktrees**:
- `~/.claude/worktrees/devops-portal-core-protocol` — detach from old repo, re-attach from new one.
- `/private/tmp/devops-portal-dev` — prunable; delete.

**Claude Code memory**: `~/.claude/projects/-Users-nutakki-Documents-github-devops-portal` renamed to `-Users-nutakki-repos-devops-portal` to preserve MEMORY.md continuity.

**iCloud defense**: add Finder-duplicate ignore rules to `.gitignore` in the new tree (`* [2-9].*`, `* 1[0-9].*`, `* [2-9]`, `* 1[0-9]`).

**Rollback window**: keep old tree at `~/Documents/github/devops-portal` for 3–5 days, delete only after new tree has been used daily without issue.

## Section 2 — Credential-health feature fixes

Four bugs identified in code review; fixes:

1. **API/UI envelope mismatch on `/credentials/health`** — flatten the API response to `{ ...summary, credentials }` (simpler than changing the page to read `data.summary.total`). Both endpoints return plain objects the UI's typed interfaces already match.
2. **API/UI envelope mismatch on `/credentials/expiring`** — change the page to read `expiringJson.data?.credentials || []` instead of assigning the whole envelope.
3. **Dead worker bootstrap** — invoke `startCredentialHealthWorker()` from `src/lib/instrumentation.ts:register()`, guarded on `process.env.NEXT_RUNTIME === 'nodejs'` and the worker's own Redis-availability check.
4. **Worker REDIS_URL ignored** — pass the shared `ioredis` client from `getRedis()` to BullMQ as the `connection` option, so it picks up `REDIS_URL` like the rest of the codebase.

**Additional work**:

- `CredentialExpiryField` React component (Date input + "no expiry" checkbox), wired into all 7 config pages that call `saveCredentials()` / `updateCredentialById()`.
- Drop the defensive dynamic-import in `credential-health-orchestrator.ts`; use a static import of `recordCredentialHealthCheck`.
- Remove the `as any` cast on the metrics function reference.
- Either delete the unused `updateCredentialHealthGauges` export, or call it at the end of `checkAllCredentials` with per-provider-per-status counts aggregated from `summary.results`.
- Unit tests (Vitest) for:
  - `sanitizeError` — bearer token stripping, password stripping, IP redaction, length truncation.
  - Orchestrator expiry override — credential with `expiresAt` within `EXPIRY_WARNING_DAYS` coerces `healthy` → `degraded` with correct message.
  - Health route response shape — matches the flattened envelope.

**Non-goals for this section** (deferred):
- Credential-rotation workflow UI.
- Alerting / Slack notifications on unhealthy credentials.
- Per-provider integration tests with probe mocks.
- Worker-to-metrics-gauge feedback loop for `credential_expiring_soon`.

## Section 3 — Documentation consolidation

Already present in local WIP; ship as its own PR.

**Scope**:
- `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md` + `_NOTION_READY.md` variant.
- `docs/development/CURRENT_RUNTIME_MAINTAINER_HANDOFF.md`.
- `docs/development/LEGACY_DOCS_AND_WORKFLOWS_CLEANUP_PLAN.md`.
- `docs/legacy/` with preserved Backstage-era tree.
- Concise replacements for 13 top-level docs (getting-started, admin-guide, api-reference, troubleshooting, faq, etc.).
- `packages/README.md` and `plugins/README.md` legacy-marker stubs.

**Verification** before merge:
- All cross-references in new docs point at files that exist.
- `docs/legacy/backstage-era/` tree matches originals byte-for-byte where applicable.
- No references to dropped features (e.g., "Backstage backend on :7007").

## Section 4 — `main` branch resync

**Current state**: `main` at `5ed69d6` (2026-02-05, pre-pivot), `dev` at `b0f1116` (2026-02-27, post-pivot + 5 feature waves) plus in-flight WIP.

**Strategy**: after credential-health + docs PRs land on `dev`, open a PR from `dev` → `main`. Since `main` is a strict ancestor, this is fast-forward. Merge with merge commit (not fast-forward) so `main`'s history retains a single landmark commit marking the catch-up, which is easier to read six months later than a linear replay.

**Why not reset**: because existing release tags and external docs may reference commits on `main`. Fast-forward merge keeps history intact.

**Verification**:
- `git log main --oneline -5` should include the post-pivot commits.
- `package.json` on `main` after merge must show `"devops-portal-v2"` / `2.0.0`, not `"root"` / Backstage.
- `packages/` should exist as the documented legacy artifact, not as the primary app.

## Section 5 — Protocol project M1 milestone plan

Documented only; execution stays on `feature/core-protocol`.

**M1 deliverables** (extracted from `core/PROJECT.md` critical path):

1. Ratify decisions D11 (no exec in protocol) and D12 (read-only v1) in a design doc PR.
2. Extract `core/` to public repo: subtree-split to `gnanirahulnutakki/action-protocol-mvp` (placeholder name). Preserve commit history.
3. Implement `CAProvider` external-CA backends: cert-manager and Vault (AWS PCA can defer to M2).
4. Finalize `DurableQueue` SQLite implementation with crash-safety test suite.
5. Write wire protocol v0.1 freeze proposal covering D1 (schema-addressed payload), D3 (version negotiation), D2 (heartbeat rename) in a single proto PR.
6. Establish weekly public office hours cadence (placeholder time, can stay empty initially).

**Not M1**:
- v0.1 gRPC implementation (blocked on freeze proposal).
- Agent evidence channel hash-chain signing (M2).
- Conformance suite (M2+).
- Multi-tenancy / blast-radius model D17 (M1–M2 boundary, can slip).

**Public-repo readiness criteria** (to leave this bullet list satisfied before extraction):
- Trademark search cleared for one name candidate (`opspact`, `beacon`, `verdict`, `kap`, `convoke`, `parley`, `signet`, `attest`, `conduit`).
- `core/MAINTAINERS.md` populated with at least one co-maintainer committed or a documented one-maintainer-with-cultivation-plan posture.
- CNCF TAG Contributor Strategy review request drafted.
- `MAINTAINERS.md` + `GOVERNANCE.md` + `SECURITY.md` + `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` reviewed one more time for CNCF conformance.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| iCloud strike during migration itself | Patch file written to `/tmp/`, outside iCloud. If old tree is destroyed mid-flight, the patch survives. |
| `git apply` fails on reapply in new tree | Pre-flight with `git apply --check` before applying; if conflicts surface they're on untouched files, easy to resolve. |
| Worktree reattachment breaks `feature/core-protocol` session state | Worktree contents are not moved; only the linked repo reference updates. `.claude/worktrees/.../.../core/` stays on disk. |
| Deployment regressions from credential-health changes | Staging-only feature flag check. The `credentialHealth` feature is already defaulted per-org, so misbehavior is bounded to orgs that haven't opted in. |
| `main` fast-forward surprises anyone with local `main` checked out | Low risk — this repo has only one active developer. Communicate via commit message. |
| Protocol project's public repo extraction leaks uncurated history | Subtree-split preserves only `core/` path, not portal history. Extraction script documented in M1 plan, not run until trademark cleared. |

## Success criteria

- Old `~/Documents/github/devops-portal` is unused; all new work happens at `~/repos/devops-portal/`.
- `/monitoring/credential-health` page loads with correct stat-card values on a fresh org, no TypeError from expiring-soon section.
- Credential-add/edit forms include an optional "Expires on" field (ArgoCD in this plan; remaining 5 integrations are follow-up below).
- A second credential-health sweep runs at T+30 min in staging, visible in Prom metrics.
- `main` `package.json` reads `"devops-portal-v2"`.
- `docs/superpowers/specs/2026-04-24-devops-portal-stabilization-design.md` exists and is committed.
- `core/PROJECT.md` has a new "M1 Execution Plan" section linking back to this doc.

## Out of scope

- Fixing the live `v2-latest` ↔ `v2-openapi-4` Helm image tag drift (documented in MEMORY.md; separate deployment cleanup task).
- Moving `AUTH_SECRET` out of deployment spec into a K8s `Secret` (separate hardening task).
- Re-enabling Redis in production (separate infra decision; credential-health works on-demand without it).
- Any changes inside `core/` (MVP), aside from the M1 milestone-plan section append.

## Follow-ups deferred out of this plan

1. **Wire `CredentialExpiryField` into the remaining 5 integration config pages** — ArgoCD has end-to-end expiry support as the reference pattern; GitHub, Grafana, LLM, Supabase, and Uptime Kuma need the same treatment (form state + API schema + `saveCredentials`/`updateCredentialById` pass-through). Each page is ~10 minutes of mechanical copy-paste from the ArgoCD implementation.
2. **Fix the same `REDIS_HOST`/`REDIS_PORT` bug in `src/lib/queue.ts`** — identical pattern to the credential-health worker's original bug; `getConnection()` there should also return the shared `getRedis()` client so the 3 existing BullMQ workers pick up `REDIS_URL` when Redis is re-enabled.
3. **Orchestrator expiry-override unit test** — the expiry-window logic in `checkSingleCredentialInternal` is pure arithmetic but is coupled to Prisma. A test would need Prisma mocks; defer until a broader test-infra pass.
4. **Per-provider integration tests with probe mocks** (explicitly out of this plan's scope per Section 2; confirmed deferred).
5. **Credential-rotation workflow UI** (non-goal for this plan; Prisma already tracks `rotatedAt`, needs a dedicated UI follow-up).
