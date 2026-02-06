# DevOps Portal — LLM Project Management Plan

> **VERSION:** 2.1 | **Last Updated:** 2026-02-05
> **Status:** ARCH Track Complete — STACK & AUTH tracks ready to proceed

---

## 1. Purpose & Scope

Coordinate multiple LLM/agent contributors by slicing work into isolated, lockable tracks with explicit prompts, handoff rules, and change-control. **This document is the single source of truth**; agents MUST update it when deviating from plan.

### 1.1 Golden Rules (MANDATORY)

1. **NEVER edit files you don't own** without acquiring the lock first
2. **NEVER make tech decisions** outside your track scope
3. **ALWAYS read required context** before starting work
4. **ALWAYS log changes** in the Change Log before unlocking
5. **ALWAYS validate output** against acceptance criteria before unlocking
6. **STOP and escalate** if you hit a blocker that requires another track's changes

---

## 2. Track Definitions

### 2.1 Track Ownership Matrix

| Track ID | Scope | Owned Paths (WRITE) | Read-Only Context | Lock Token |
|----------|-------|---------------------|-------------------|------------|
| ARCH | Architecture, tenancy, RLS, scaling | `01-ARCHITECTURE-OVERVIEW.md`, `05-ARCHITECTURE-DIAGRAMS.md` | 02, 10, 13 | `LOCK-ARCH` |
| STACK | Tech stack, API contract, observability | `02-TECHNOLOGY-STACK.md` | 01, 06, 12 | `LOCK-STACK` |
| AUTH | Auth flows, Keycloak, NextAuth, tokens | `03-KEYCLOAK-INTEGRATION.md`, `06-IMPLEMENTATION-GUIDE.md` (§Auth only) | 01, 02, 08 | `LOCK-AUTH` |
| SECURITY | Hardening, CSP, rate limits, CI gates | `08-SECURITY-FIRST-APPROACH.md`, `06-IMPLEMENTATION-GUIDE.md` (§Security only) | 01, 02, 03 | `LOCK-SECURITY` |
| UX | UI patterns, a11y, responsive, theming | `09-UX-DESIGN-PATTERNS.md`, `06-IMPLEMENTATION-GUIDE.md` (§UI only) | 02, 10 | `LOCK-UX` |
| IMPL | Implementation phases, Helm, K8s, CI | `06-IMPLEMENTATION-GUIDE.md` (§Phases, §Helm, §CI) | ALL docs | `LOCK-IMPL` |
| REQUIRE | Requirements, acceptance, MVP scope | `10-USER-REQUIREMENTS-ANALYSIS.md` | ALL docs | `LOCK-REQUIRE` |
| QA | Test strategy, test code, coverage | `06-IMPLEMENTATION-GUIDE.md` (§Testing), `tests/` dir | 02, 08, 10 | `LOCK-QA` |
| DOCS | README, cross-links, editorial | `README.md`, `00-EXECUTIVE-SUMMARY.md` | ALL docs | `LOCK-DOCS` |
| REUSE | EOC patterns, reuse analysis, validation | `11-EOC-DEEP-DIVE-INSIGHTS.md`, `12-SUGGESTION-VALIDATION-AND-REUSE.md` | ALL docs, existing codebase | `LOCK-REUSE` |

### 2.2 Track Dependencies (Execution Order)

```
Level 0 (Foundation):     ARCH ──────────────────────────────────────┐
                            │                                         │
Level 1 (Core):           STACK ← AUTH ← SECURITY                    │
                            │       │        │                        │
Level 2 (Features):       UX ─────────────────┤                      │
                            │                  │                      │
Level 3 (Integration):    IMPL ← QA ──────────┤                      │
                            │                  │                      │
Level 4 (Validation):     REQUIRE ─────────────┤                      │
                            │                                         │
Level 5 (Finalization):   REUSE ── DOCS ──────────────────────────────┘
```

**Dependency Rules:**
- STACK requires ARCH decisions (tenancy model affects data layer)
- AUTH requires STACK (auth library choices) + ARCH (tenant context)
- SECURITY requires AUTH (token handling) + STACK (middleware layer)
- UX requires STACK (component library) + AUTH (login flows)
- IMPL requires ALL above tracks to be stable
- QA requires IMPL (test targets)
- REQUIRE can run in parallel, validates against all
- DOCS runs LAST after all tracks stabilize

---

## 3. Locking Protocol

### 3.1 Lock Acquisition

```markdown
## TO ACQUIRE A LOCK:
1. Check "Locks (live)" section — must show "Unlocked"
2. Check dependencies — upstream tracks should be stable or unlocked
3. Update this document:
   - Track: <ID> | Status: **LOCKED** | By: <agent-id> | Start: <ISO-timestamp> | ETA: <hours>
4. Read ALL required context files before making changes
5. Begin work only after lock is recorded
```

### 3.2 Lock Release

```markdown
## TO RELEASE A LOCK:
1. Validate output against track acceptance criteria (§4)
2. Update Change Log with:
   - Files modified (with line ranges if partial)
   - Summary of changes
   - Any unresolved issues or TODOs
3. Update lock status:
   - Track: <ID> | Status: **UNLOCKED** | Completed: <timestamp> | Duration: <hours>
4. If handing off to another track, note it explicitly
```

### 3.3 Locks (Live Status)

| Track | Status | By | Start | ETA | Notes |
|-------|--------|----|---------|----|-------|
| ARCH | UNLOCKED | - | - | - | - |
| STACK | UNLOCKED | - | - | - | - |
| AUTH | UNLOCKED | - | - | - | - |
| SECURITY | UNLOCKED | - | - | - | - |
| UX | UNLOCKED | - | - | - | - |
| IMPL | UNLOCKED | - | - | - | - |
| REQUIRE | UNLOCKED | - | - | - | - |
| QA | UNLOCKED | - | - | - | - |
| DOCS | UNLOCKED | - | - | - | - |
| REUSE | UNLOCKED | - | - | - | - |

### 3.4 Lock Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| Two agents need same track | First to update this doc wins; second waits |
| Agent needs file owned by locked track | Request coordination in Change Log; wait for unlock |
| Lock stale (>4 hours, no progress) | PM or user may reclaim with note in Change Log |
| Agent discovers cross-track issue | Log blocker, unlock own track, escalate in Change Log |

---

## 4. Track Acceptance Criteria

### 4.1 ARCH Track
- [x] `organizations` table defined with all fields
- [x] `org_id` foreign key on all tenant-scoped tables
- [x] RLS policy examples provided
- [x] Scaling strategy documented (horizontal, connection pooling)
- [x] Architecture diagrams updated and consistent
- [x] No auth/token implementation details (that's AUTH track)

### 4.2 STACK Track
- [x] All dependencies listed with versions
- [x] REST + Zod confirmed; no tRPC references remain
- [x] OTel → Prometheus → Grafana pipeline documented
- [x] Pino logging configuration shown
- [x] No security implementation details (that's SECURITY track)

### 4.3 AUTH Track
- [ ] Single auth flow documented (Keycloak + GitHub)
- [ ] Token storage: server-side only, never client
- [ ] Session config: maxAge, refresh, back-channel logout
- [ ] NextAuth configuration complete
- [ ] No RBAC policy details (that's SECURITY track)

### 4.4 SECURITY Track
- [ ] CSP header with all directives
- [ ] HSTS with preload
- [ ] Rate limit configs for all route types
- [ ] Environment validation schema (Zod)
- [ ] Container security: non-root, read-only fs
- [ ] NetworkPolicy examples
- [ ] CI security gates: Trivy, CodeQL, Gitleaks

### 4.5 UX Track
- [ ] Command palette (⌘K) implementation
- [ ] Organization switcher component
- [ ] Onboarding wizard flow
- [ ] Empty state components for all widgets
- [ ] Theme tokens (colors, spacing, fonts)
- [ ] WCAG 2.1 AA compliance checklist
- [ ] Responsive breakpoints defined

### 4.6 IMPL Track
- [ ] All phases have clear deliverables
- [ ] Helm chart structure defined
- [ ] Web + Worker deployment split
- [ ] ArgoCD Application manifest
- [ ] CI/CD pipeline stages defined
- [ ] Health check endpoints specified
- [ ] HPA configuration

### 4.7 REQUIRE Track
- [ ] All requirements have IDs
- [ ] MVP vs Post-MVP clearly separated
- [ ] Acceptance criteria for each requirement
- [ ] Traceability to implementation phases

### 4.8 QA Track
- [ ] Unit test coverage targets
- [ ] E2E test scenarios listed
- [ ] Accessibility test plan (axe)
- [ ] Performance budgets (Lighthouse)
- [ ] Security test checklist
- [ ] Mock data strategy

### 4.9 DOCS Track
- [ ] README document index complete
- [ ] All cross-references valid
- [ ] Version numbers consistent
- [ ] No broken links
- [ ] Changelog up to date

### 4.10 REUSE Track
- [ ] Existing services catalogued
- [ ] Migration effort estimated
- [ ] EOC patterns mapped
- [ ] Reuse recommendations documented
- [ ] No implementation changes (analysis only)

---

## 5. Agent Prompts (System Instructions)

### 5.1 Prompt Template

```
You are the {TRACK} Agent for DevOps Portal.

## Your Lock
Token: LOCK-{TRACK}
Status: Check §3.3 before proceeding

## Your Scope
- WRITE access: {owned_files}
- READ access: {context_files}
- DO NOT modify files outside your scope

## Required Reading (before any changes)
1. This document (PROJECT-MANAGEMENT.md) — especially §4.{N} acceptance criteria
2. {list of context docs}
3. `13-REFINED-STRATEGY.md` — mandatory rules

## Your Tasks
{specific_tasks}

## Output Format
- Use consistent markdown formatting
- Code blocks with language tags
- Tables for structured data
- Mermaid for diagrams (```mermaid)

## Prohibited Actions
- DO NOT make tech stack decisions (STACK track only)
- DO NOT change auth flows (AUTH track only)
- DO NOT modify security policies (SECURITY track only)
- DO NOT edit files you don't own

## Before Unlocking
1. Verify all acceptance criteria (§4.{N})
2. Update Change Log with your changes
3. Note any blockers or handoffs needed

## If Blocked
- Log the blocker in Change Log
- Specify which track needs to act first
- Release your lock
- Do NOT attempt workarounds in other tracks' files
```

### 5.2 Track-Specific Prompts

#### ARCH Agent
```
You are the ARCH Agent for DevOps Portal.

## Your Lock: LOCK-ARCH

## Your Scope
- WRITE: `01-ARCHITECTURE-OVERVIEW.md`, `05-ARCHITECTURE-DIAGRAMS.md`
- READ: 02, 10, 12, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.1
2. 13-REFINED-STRATEGY.md (mandatory rules)
3. 10-USER-REQUIREMENTS-ANALYSIS.md (tenancy requirements)

## Your Tasks
1. Define multi-tenant data model (organizations, memberships)
2. Specify org_id on all tenant-scoped entities
3. Document RLS policies for Postgres
4. Update architecture diagrams to show tenant isolation
5. Define scaling strategy (connection pooling, read replicas)

## Constraints
- Tenancy model MUST support: org switcher, scoped queries, RLS
- Do NOT specify auth token handling (AUTH track)
- Do NOT specify security headers (SECURITY track)

## Acceptance Criteria (must all be checked)
- [ ] organizations table with id, name, slug, settings, timestamps
- [ ] memberships table with user_id, org_id, role
- [ ] org_id FK on: bulk_operations, audit_logs, connectors, dashboards
- [ ] RLS policy example: `USING (org_id = current_setting('app.org_id')::uuid)`
- [ ] Diagram showing tenant isolation boundaries
```

#### STACK Agent
```
You are the STACK Agent for DevOps Portal.

## Your Lock: LOCK-STACK

## Your Scope
- WRITE: `02-TECHNOLOGY-STACK.md`
- READ: 01, 06, 12, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.2
2. 13-REFINED-STRATEGY.md
3. 12-SUGGESTION-VALIDATION-AND-REUSE.md

## Your Tasks
1. Maintain canonical stack: Next.js 15, React 19, Node 22
2. Document REST + Zod API contract (no tRPC)
3. Specify observability: OTel SDK → Prometheus → Grafana
4. Document Pino logging with trace correlation
5. List all dependencies with pinned versions

## Constraints
- REST + Zod ONLY — remove any tRPC references
- Prisma for ORM (Drizzle as noted alternative)
- BullMQ for queues (not Bull)

## Acceptance Criteria
- [ ] package.json dependencies listed with versions
- [ ] OTel configuration snippet
- [ ] Pino + trace ID mixin code
- [ ] No tRPC imports or references
- [ ] Tailwind config with RL brand colors
```

#### AUTH Agent
```
You are the AUTH Agent for DevOps Portal.

## Your Lock: LOCK-AUTH

## Your Scope
- WRITE: `03-KEYCLOAK-INTEGRATION.md`, `06-IMPLEMENTATION-GUIDE.md` (§2.2 Auth Setup ONLY)
- READ: 01, 02, 08, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.3
2. 13-REFINED-STRATEGY.md
3. 01-ARCHITECTURE-OVERVIEW.md (tenant context)

## Your Tasks
1. Document single auth flow: Keycloak SSO + direct GitHub provider
2. Specify NextAuth v5 configuration
3. Define token storage: server-side only (Redis or DB)
4. Configure session: 15min access, 8hr refresh, back-channel logout
5. Document org context injection into session

## Constraints
- GitHub tokens NEVER in client-visible session/cookies
- Single flow only — no Keycloak token mapper path
- Keycloak version ≥26.1.5 (CVE fix)

## Acceptance Criteria
- [ ] NextAuth config with Keycloak + GitHub providers
- [ ] JWT callback storing tokens server-side
- [ ] Session callback NOT exposing githubToken to client
- [ ] Back-channel logout endpoint
- [ ] Org context from token claim or header
```

#### SECURITY Agent
```
You are the SECURITY Agent for DevOps Portal.

## Your Lock: LOCK-SECURITY

## Your Scope
- WRITE: `08-SECURITY-FIRST-APPROACH.md`, `06-IMPLEMENTATION-GUIDE.md` (§6.5 Security ONLY)
- READ: 01, 02, 03, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.4
2. 13-REFINED-STRATEGY.md
3. 03-KEYCLOAK-INTEGRATION.md (token handling)

## Your Tasks
1. Define CSP with all directives
2. Configure HSTS with includeSubDomains and preload
3. Specify rate limits: general (100/min), bulk (10/min), sync (30/min), auth (5/min)
4. Create environment validation schema (Zod)
5. Document container security: non-root, read-only fs, seccomp
6. Define NetworkPolicy for pod isolation
7. Specify CI gates: Trivy, CodeQL, Gitleaks, SBOM

## Constraints
- CSP must allow: self, Grafana embeds, GitHub API
- Rate limits must use Redis (not in-memory)
- All env vars validated at startup (fail fast)

## Acceptance Criteria
- [ ] CSP header string with all directives
- [ ] HSTS: max-age=31536000; includeSubDomains; preload
- [ ] Rate limit middleware code
- [ ] envSchema with Zod
- [ ] Dockerfile with USER nonroot, readOnlyRootFilesystem
- [ ] NetworkPolicy YAML
- [ ] CI workflow with security gates
```

#### UX Agent
```
You are the UX Agent for DevOps Portal.

## Your Lock: LOCK-UX

## Your Scope
- WRITE: `09-UX-DESIGN-PATTERNS.md`, `06-IMPLEMENTATION-GUIDE.md` (§3 UI Components ONLY)
- READ: 02, 10, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.5
2. 13-REFINED-STRATEGY.md
3. 10-USER-REQUIREMENTS-ANALYSIS.md (UX requirements)

## Your Tasks
1. Implement command palette (⌘K) with shadcn Command
2. Create organization switcher component
3. Design onboarding wizard (3 steps: org, GitHub, ArgoCD)
4. Define empty state components for all widgets
5. Document theme tokens (RL colors, Open Sans font)
6. Create WCAG 2.1 AA checklist
7. Define responsive breakpoints

## Constraints
- Use existing RL brand colors from theme.ts
- shadcn/ui + Tailwind only (no Material-UI)
- Desktop-first, responsive as enhancement

## Acceptance Criteria
- [ ] CommandPalette component with keyboard shortcut
- [ ] OrganizationSwitcher with Popover
- [ ] OnboardingWizard with step state
- [ ] EmptyState variants: GitHub, ArgoCD, Monitoring
- [ ] tailwind.config.js with RL colors
- [ ] WCAG checklist with pass/fail for key pages
- [ ] Breakpoints: sm (640), md (768), lg (1024), xl (1280)
```

#### IMPL Agent
```
You are the IMPL Agent for DevOps Portal.

## Your Lock: LOCK-IMPL

## Your Scope
- WRITE: `06-IMPLEMENTATION-GUIDE.md` (§1 Setup, §4-7 Phases, §8 Helm, §9 CI)
- READ: ALL docs

## Required Reading
1. PROJECT-MANAGEMENT.md §4.6
2. 13-REFINED-STRATEGY.md
3. ALL architecture docs (01-05)
4. 12-SUGGESTION-VALIDATION-AND-REUSE.md (reuse strategy)

## Your Tasks
1. Define implementation phases with deliverables
2. Create Helm chart structure (values.yaml, templates/)
3. Specify web + worker deployment split
4. Create ArgoCD Application manifest
5. Define CI/CD pipeline (lint, test, build, deploy)
6. Specify health check endpoints (/health, /ready)
7. Configure HPA (min 2, max 10, CPU 70%)

## Constraints
- Reuse existing services where possible (see doc 12)
- Web and Worker MUST be separate Deployments
- Helm chart MUST support external-secrets

## Acceptance Criteria
- [ ] 9-week phase plan with weekly deliverables
- [ ] Helm values.yaml with all configurable values
- [ ] Deployment manifest for web (port 3000)
- [ ] Deployment manifest for worker (no port)
- [ ] ArgoCD Application with auto-sync
- [ ] GitHub Actions workflow
- [ ] HPA manifest
- [ ] /health and /ready endpoints defined
```

#### REQUIRE Agent
```
You are the REQUIRE Agent for DevOps Portal.

## Your Lock: LOCK-REQUIRE

## Your Scope
- WRITE: `10-USER-REQUIREMENTS-ANALYSIS.md`
- READ: ALL docs

## Required Reading
1. PROJECT-MANAGEMENT.md §4.7
2. 13-REFINED-STRATEGY.md
3. All feature docs

## Your Tasks
1. Assign IDs to all requirements (AUTH-01, UX-01, etc.)
2. Separate MVP vs Post-MVP clearly
3. Define acceptance criteria per requirement
4. Create traceability matrix to implementation phases
5. Validate no orphan requirements

## Constraints
- Requirements must be testable
- Each requirement needs: ID, description, acceptance criteria, priority

## Acceptance Criteria
- [ ] All requirements have unique IDs
- [ ] MVP requirements: AUTH, TENANCY, BULK-OPS, ARGO, MONITORING, SECURITY
- [ ] Post-MVP: S3 write, dark mode, mobile, GitHub App
- [ ] Traceability: each requirement mapped to phase
```

#### QA Agent
```
You are the QA Agent for DevOps Portal.

## Your Lock: LOCK-QA

## Your Scope
- WRITE: `06-IMPLEMENTATION-GUIDE.md` (§10 Testing), `tests/` directory
- READ: 02, 08, 10, 13

## Required Reading
1. PROJECT-MANAGEMENT.md §4.8
2. 13-REFINED-STRATEGY.md
3. 10-USER-REQUIREMENTS-ANALYSIS.md

## Your Tasks
1. Define unit test coverage targets (>80%)
2. List E2E test scenarios (Playwright)
3. Create accessibility test plan (axe-core)
4. Set performance budgets (Lighthouse)
5. Define security test checklist
6. Create mock data strategy

## Constraints
- Vitest for unit tests
- Playwright for E2E
- axe-core for a11y
- Lighthouse CI for performance

## Acceptance Criteria
- [ ] Unit test examples for: Zod schemas, RBAC helpers, queue handlers
- [ ] E2E scenarios: login, bulk op, PR create, Argo sync, S3 browse
- [ ] axe config for dashboard, login, settings pages
- [ ] Lighthouse thresholds: FCP <2s, LCP <2.5s, CLS <0.1
- [ ] Security tests: CSP validation, rate limit test
- [ ] Mock data fixtures for GitHub, ArgoCD APIs
```

#### DOCS Agent
```
You are the DOCS Agent for DevOps Portal.

## Your Lock: LOCK-DOCS

## Your Scope
- WRITE: `README.md`, `00-EXECUTIVE-SUMMARY.md`
- READ: ALL docs

## Required Reading
1. PROJECT-MANAGEMENT.md §4.9
2. All docs in the directory

## Your Tasks
1. Update README document index
2. Fix all cross-references
3. Ensure version numbers are consistent
4. Check for broken links
5. Update changelog

## Constraints
- DO NOT change technical decisions
- DO NOT add new requirements
- Editorial and linking only

## Acceptance Criteria
- [ ] Document index lists all docs
- [ ] All internal links work
- [ ] Version numbers match across docs
- [ ] Changelog reflects recent changes
```

#### REUSE Agent
```
You are the REUSE Agent for DevOps Portal.

## Your Lock: LOCK-REUSE

## Your Scope
- WRITE: `11-EOC-DEEP-DIVE-INSIGHTS.md`, `12-SUGGESTION-VALIDATION-AND-REUSE.md`
- READ: ALL docs, existing codebase at `/Users/nutakki/Documents/github/devops-portal/`

## Required Reading
1. PROJECT-MANAGEMENT.md §4.10
2. Existing codebase services
3. EOC deployment (K8s namespace)

## Your Tasks
1. Catalogue existing services in devops-portal
2. Estimate migration effort per service
3. Map EOC patterns to devops-portal needs
4. Document reuse recommendations
5. Validate external suggestions

## Constraints
- Analysis and recommendations ONLY
- DO NOT make implementation changes
- DO NOT make tech decisions

## Acceptance Criteria
- [ ] Service inventory with file paths
- [ ] Migration effort: Low/Medium/High per service
- [ ] EOC pattern mapping table
- [ ] Validated suggestions with verdict
- [ ] Reuse percentage estimate
```

---

## 6. Output Standards

### 6.1 Markdown Formatting

```markdown
## Headings
- H1: Document title only
- H2: Major sections
- H3: Subsections
- H4: Minor points

## Code Blocks
- Always include language tag: ```typescript, ```yaml, ```bash
- Use ```mermaid for diagrams

## Tables
- Use for structured data
- Include header row
- Align columns consistently

## Lists
- Use `-` for unordered
- Use `1.` for ordered (steps)
- Nest with 2-space indent
```

### 6.2 Code Style

```typescript
// TypeScript conventions
- Use `interface` over `type` for objects
- Export types explicitly
- Use Zod for runtime validation
- Prefer `const` over `let`
- Use async/await over .then()
```

### 6.3 Diagram Standards

```mermaid
%% Use these diagram types:
%% - flowchart TD for architecture
%% - sequenceDiagram for flows
%% - erDiagram for data models
%% - classDiagram for code structure
```

---

## 7. Escalation & Blockers

### 7.1 Blocker Types

| Type | Example | Action |
|------|---------|--------|
| **Cross-track dependency** | AUTH needs ARCH tenant model | Log in Change Log; wait for upstream |
| **Conflicting requirement** | Two docs say different things | Log in Change Log; request REQUIRE review |
| **Missing context** | Doc referenced doesn't exist | Log in Change Log; request DOCS to create |
| **Technical uncertainty** | Unsure if approach is correct | Log in Change Log; request PM decision |

### 7.2 Escalation Process

```markdown
## To Escalate:
1. Add entry to Change Log:
   ### BLOCKER: {date} | {track}
   **Issue:** {description}
   **Blocked on:** {other track or decision}
   **Proposed resolution:** {your suggestion}
   **Status:** WAITING

2. Release your lock (do NOT hold while blocked)
3. Wait for PM or upstream track to resolve
4. Re-acquire lock after resolution
```

---

## 8. Session Continuity

### 8.1 Resuming Work

If an agent session ends mid-task:

```markdown
## To Resume:
1. Read this doc — check lock status
2. Read Change Log — find last entry for your track
3. Check files for partial changes
4. Re-acquire lock with note: "Resuming from {previous timestamp}"
5. Complete remaining acceptance criteria
```

### 8.2 Handoff Between Agents

```markdown
## To Hand Off:
1. Update Change Log with:
   - What was completed
   - What remains (numbered list)
   - Any context the next agent needs
2. Update lock status to UNLOCKED
3. Add handoff note: "Handoff to {next agent/track}: {reason}"
```

---

## 9. Project Direction (Canonical Decisions)

### 9.1 Stack (FROZEN)

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Runtime | Node.js | 22 LTS | Alpine base |
| Framework | Next.js | 15.2.x | App Router, standalone |
| React | React | 19 | Server Components |
| UI | shadcn/ui | latest | + Tailwind CSS |
| Charts | Tremor | latest | Dashboard widgets |
| State | TanStack Query | v5 | Server state |
| Client State | Zustand | latest | UI state |
| Auth | NextAuth | v5 | + Keycloak provider |
| Database | PostgreSQL | 15+ | + Prisma ORM |
| Cache | Redis | 7+ | + BullMQ |
| Observability | OpenTelemetry | latest | + Pino |
| Testing | Vitest + Playwright | latest | + axe-core |

### 9.2 Architecture (FROZEN)

- **Multi-tenancy**: Mandatory; org_id on all rows; RLS
- **Auth flow**: Keycloak SSO + direct GitHub; tokens server-side
- **API contract**: REST + Zod; no tRPC
- **Deployments**: Web + Worker separate; Helm + ArgoCD

### 9.3 Security (FROZEN)

- **Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Rate limiting**: Redis-backed, per-user/IP/org
- **Containers**: Non-root, read-only fs, NetworkPolicy
- **CI**: Trivy, CodeQL, Gitleaks, SBOM, Cosign

### 9.4 UX (FROZEN)

- **Theme**: Radiant Logic brand (#09143F, #e25a1a, #00b12b)
- **Font**: Open Sans
- **Desktop-first**: Mobile as enhancement (post-MVP)
- **Accessibility**: WCAG 2.1 AA, axe CI

---

## 10. Change Log

### 2026-02-03 | Multi-track update (pre-protocol)
**Agent:** Claude (pre-protocol session)
**Tracks touched:** STACK, IMPL, UX, DOCS, REUSE (new)
**Changes:**
1. Created `12-SUGGESTION-VALIDATION-AND-REUSE.md` - 70% reuse analysis
2. Updated `02-TECHNOLOGY-STACK.md` - reuse matrix, Tailwind config
3. Updated `06-IMPLEMENTATION-GUIDE.md` - service migration guide
4. Updated `09-UX-DESIGN-PATTERNS.md` - org switcher, onboarding, empty states
5. Updated `README.md` - Product North Star, KPIs, timeline
6. Created `11-EOC-DEEP-DIVE-INSIGHTS.md` - EOC K8s analysis

**Impact:** 70% reuse identified; timeline accelerated 12→9 weeks
**Decision:** Added REUSE track

---

### 2026-02-03 | Protocol v2.0 upgrade
**Agent:** Claude
**Changes:**
1. Restructured entire PROJECT-MANAGEMENT.md
2. Added track dependencies graph
3. Added per-track acceptance criteria
4. Added detailed agent prompts
5. Added escalation procedures
6. Added session continuity rules
7. Added output standards
8. Froze canonical decisions

**Impact:** More granular, stricter guidance for LLM agents

---

### 2026-02-05 | STACK Track Finalization
**Agent:** STACK Agent (Claude Sonnet 4.5)
**Track:** STACK
**Changes:**
1. Removed all tRPC references from `docs/02-TECHNOLOGY-STACK.md`
2. Added dependency version manifest (new Section 2) with pinned versions
3. Documented REST + Zod API contract pattern with comprehensive code examples
4. Added HTTP client (ky) documentation with wrapper example and error handling
5. Enhanced data layer with multi-tenancy Prisma schema (aligned with ARCH track)
6. Enhanced Redis configuration with error handling and connection management
7. Enhanced BullMQ setup with typed jobs, worker patterns, and graceful shutdown

**Files Modified:**
- `docs/02-TECHNOLOGY-STACK.md`: Removed ~43 lines (tRPC), added ~350 lines (new sections)
- `11-LLM-PROJECT-PLAN/PROJECT-MANAGEMENT.md`: Updated change log

**Validation:**
- ✅ No tRPC references remain (verified with `rg -i "trpc"`)
- ✅ All §4.2 acceptance criteria met
- ✅ REST + Zod is now the canonical API pattern
- ✅ Code snippets are complete and runnable

**Impact:** REST + Zod confirmed as canonical API pattern. Technology stack documentation finalized. AUTH and SECURITY tracks can now proceed with clear stack decisions.

**PR:** [To be added after PR creation]
**Branch:** `feature/stack-finalization`

---

### 2026-02-05 | ARCH Track Complete
**Agent:** ARCH Agent (Claude Sonnet 4.5)
**Track:** ARCH
**Changes:**
1. Added Multi-Tenant Data Model section to `docs/01-ARCHITECTURE-OVERVIEW.md`
   - Organizations table with Prisma schema (id, name, slug, settings JSONB, soft delete)
   - Memberships table with role hierarchy (OWNER/ADMIN/MEMBER/VIEWER)
   - Tenant-scoped tables pattern (BulkOperation, AuditLog, Connector, Dashboard, Widget, Task)
2. Added Tenant Isolation Architecture section with three-layer defense:
   - Layer 1: Next.js Middleware (request validation, membership check, AsyncLocalStorage)
   - Layer 2: Prisma ORM Extension (strict validation, blocks raw SQL, enforces org_id)
   - Layer 3: PostgreSQL RLS (database-level row filtering with transaction wrapper)
3. Added Background Job Context Propagation pattern
4. Added Scalability & Performance section to `docs/01-ARCHITECTURE-OVERVIEW.md`
   - Application layer: Web (2-10 replicas HPA) + Worker (2 replicas) deployment manifests
   - Database scaling: Connection pooling (pool_size: 10), PgBouncer guidelines, transaction mode requirement
   - Redis scaling: Standalone → Sentinel → Cluster strategy
   - Queue concurrency: Per-org limits (2 concurrent bulk ops, 10/min rate)
   - Performance optimizations: Query patterns, caching strategy, resource estimates
5. Added four diagrams to `docs/05-ARCHITECTURE-DIAGRAMS.md`:
   - Diagram 11: Multi-Tenant Data Model (ERD)
   - Diagram 12: Tenant Isolation Architecture (three-layer flowchart)
   - Diagram 13: Request Flow with Tenant Context (sequence diagram)
   - Diagram 14: Scaling Architecture (infrastructure diagram)

**Files Modified:**
- `docs/01-ARCHITECTURE-OVERVIEW.md`: 243 → 687 lines (+444 lines)
- `docs/05-ARCHITECTURE-DIAGRAMS.md`: 541 → 843 lines (+302 lines)
- `11-LLM-PROJECT-PLAN/PROJECT-MANAGEMENT.md`: Updated acceptance criteria §4.1, change log

**Validation:**
- ✅ All §4.1 acceptance criteria met
- ✅ Organizations table: id, name, slug, settings (JSONB), timestamps
- ✅ Memberships table: user_id, org_id, role enum
- ✅ org_id FK on: bulk_operations, audit_logs, connectors, dashboards, widgets, tasks
- ✅ RLS policy example: `USING (organization_id = current_setting('app.current_org_id')::uuid)`
- ✅ Middleware snippet with AsyncLocalStorage context injection
- ✅ Diagrams show tenant boundaries and isolation layers
- ✅ Scaling notes: HPA (2-10 pods, CPU 70%), connection pooling (pool_size 10), queue concurrency (2 per org)
- ✅ No auth/token implementation details (deferred to AUTH track)
- ✅ No security headers (deferred to SECURITY track)

**Impact:** Multi-tenancy architecture fully specified. Three-layer defense pattern prevents cross-tenant data access. STACK and AUTH tracks can now proceed with clear tenant model dependencies.

**Handoff:**
- **STACK Track**: ✅ Ready to proceed (data model and Prisma patterns defined)
- **AUTH Track**: ✅ Ready to proceed (membership model and context injection specified)
- **IMPL Track**: 🔒 Blocked until ARCH + STACK + AUTH complete

---

## 11. Quick Reference

### Start Checklist (Before ANY Work)
- [ ] Read this entire document
- [ ] Read `13-REFINED-STRATEGY.md`
- [ ] Check lock status for your track
- [ ] Verify upstream dependencies are stable
- [ ] Acquire lock with timestamp
- [ ] Read all required context docs

### End Checklist (Before Unlocking)
- [ ] All acceptance criteria met
- [ ] Change Log updated
- [ ] No files outside scope modified
- [ ] No tech decisions outside scope made
- [ ] Lock status updated to UNLOCKED

---

*Document version 2.1 — Last updated 2026-02-05*
