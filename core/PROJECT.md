# TBD_PROJECT_NAME — Multi-Cluster Day-2 Action Protocol

**Project status** (last updated 2026-04-11, post-3-reviewer synthesis): MVP shipped end-to-end, v0.1 architecture is being frozen before any wire code is written. The critical path from codex's review is being executed.

**Working name placeholder**: literal string `TBD_PROJECT_NAME` everywhere until a trademark-cleared name lands in an atomic rename commit. Candidates to research: `opspact`, `beacon`, `verdict`, `kap`, `convoke`, `parley`, `signet`, `attest`, `conduit`, `parley`. **Dead**: `clusterops` (ReactiveOps trademark Reg. No. 6015193).

## What this project is

A typed, auditable, policy-envelope-bearing day-2 action protocol for Kubernetes clusters, suitable for both human and machine-to-machine callers. The donation target is a **wire protocol**, not a product. The reference implementation is a **standalone Go binary** that speaks the protocol — not a Kubernetes-native controller, not a hub service, not an OCM addon.

The B→A path (DR-010, 2026-04-11): build internally first inside the devops-portal-v2 repo under `core/`, with CNCF-grade discipline from day one, then extract to a standalone CNCF Sandbox project. **Timeline rebaseline deferred until architecture is frozen** (per 3-reviewer synthesis).

## Retraction notice — 2026-04-11 post-synthesis

This section exists because Claude's earlier M0 plan and the 14-decision recommendation list contained several wrong calls that were caught by the 3-reviewer pass (codex + cursor-agent composer-2 + gemini). They are retracted here and replaced with the synthesis-approved versions. The MVP itself is unaffected — it was a deliberate HTTP+JSON throwaway that proved the protocol shape works. All retractions below apply to **v0.1 wire work**, not the MVP.

| # | Retracted | Replaced with | Source |
|---|---|---|---|
| **D1** | `google.protobuf.Any` with registered adapter-specific message types | **Schema-addressed opaque payload**: `string schema_uri` + `bytes payload_digest` + `bytes payload`. Adapter-independent evolution, no centralized type registry. | codex |
| **D4** | Windowed flow tokens + priority class + admission queue from v0.1 | **Simple max-concurrent-operations semaphore + bounded queues + payload caps** for v0.1. Windowed tokens deferred to v0.2+ after real profiling evidence shows HOL blocking. | 3-reviewer consensus |
| **D6** | Gateway is K8s-native from start, defer standalone binary to M5 | **Standalone Go binary from M0.** Kubernetes is a deployment target (a `Deployment` YAML), not the architectural foundation. Enables local dev, SRE break-glass via Unix socket, and avoids strengthening the "OCM addon or subproject" objection codex warned about. | 3-reviewer consensus |
| **D7** | "NATS JetStream required for production" | **Pluggable `DurableQueue` interface. One reference implementation** (decision TBD: SQLite/Postgres/BadgerDB), BYO-queue posture. JetStream is an optional implementation, not the mandate. | codex + cursor-agent |
| **D8** | "Protocol doesn't define secret handling; adapter-pluggable trivia" | **Protocol defines credential reference semantics, rotation expectations, and failure modes.** Actual secret storage remains adapter-pluggable, but the boundary is in the protocol. Cite [OCM managed-serviceaccount](https://open-cluster-management.io/docs/getting-started/integration/managed-serviceaccount/) as prior art. See `core/protocol/docs/credential-references.md`. | codex |
| **D9** | `CAProvider` interface with gateway-as-CA dev default, external CA integration by M4 | **`CAProvider` interface with both gateway-as-CA (dev) and external CA (cert-manager/Vault/AWS PCA) implementations from M1.** External CA cannot wait until M4 for production rollout beyond QA. | codex |
| **D10** | Split the single bidir stream into Control / Report / Lifecycle channels for v0.1 | **Single bidir stream for v0.1.** Fix audit authorship (D5), bounded message sizes, and durable result ingestion (D7) first. Split only after profiling evidence of head-of-line blocking. | codex + cursor-agent (2-1 over gemini) |
| **D13** | Separate **private** repo from day one, make public at donation time | **Separate PUBLIC repo from M1**, not private. Cannot cultivate external maintainers around an invisible repo. CNCF vendor-neutrality guidance is explicit about public governance. | codex |
| **TL** | 12 months with AI parallelism | **Timeline commitment deferred until architecture is frozen.** Codex: "AI parallelism is irrelevant to the hard part of the CNCF path — public decision-making, external review, adoption evidence, and maintainer promotion. Those are social processes." Rebaseline after D1–D16 are locked. | codex |

## The decision list — 23 items (14 original + 9 new)

### Group A: Protocol wire spec fixes (must land before any v0.1 code)

| # | Status | Decision |
|---|---|---|
| **D1** | Revised | Schema-addressed opaque payload (`schema_uri + digest + bytes`), not `Any`. See `core/protocol/docs/schema-distribution.md`. |
| **D2** | Proposed | Rename in-band `Heartbeat` to `StreamKeepalive`, make Kubernetes `Lease` the authoritative liveness signal (DR-008 precedence). Bundle with D3 in the same proto PR. |
| **D3** | Proposed | Add `string protocol_version` + `repeated string supported_features` to `AgentHello`. Protocol version negotiation before v0.1 freeze. |
| **D4** | Revised | Simple max-concurrent-ops semaphore + bounded queues + payload caps for v0.1. Windowed flow tokens deferred. |
| **D5** | Proposed + extended | Gateway is sole author of canonical `AuditEvent`, synthesized from `OperationAck`/`Progress`/`Result` + policy verdicts. **PLUS** agent-side tamper-evident append-only signed attestations as corroborating evidence (per cursor-agent's "incomplete" critique). |

### Group B: Architecture / deployment / trust

| # | Status | Decision |
|---|---|---|
| **D6** | Revised | Standalone Go binary from M0. K8s is a deployment target. Supports Unix socket for local dev and break-glass SRE access. |
| **D7** | Revised | Pluggable `DurableQueue` interface + one reference implementation (SQLite-backed likely). BYO-queue posture. |
| **D8** | Revised | Protocol defines credential reference semantics (`credential_uri + version + provider + required-scope`), rotation expectations, failure modes. See `core/protocol/docs/credential-references.md`. |
| **D9** | Revised | `CAProvider` interface with both gateway-as-CA (dev) and external CA (cert-manager/Vault/AWS PCA) from M1. |
| **D10** | Revised / Deferred | Single bidir stream for v0.1. Split into 3 channels only after profiling shows HOL blocking. |

### Group C: Scope and direction

| # | Status | Decision |
|---|---|---|
| **D11** | Proposed | Cut `kubectl exec` from the protocol (3-1 consensus, gemini alone dissenting). Downstream Radiant product may wrap shellinabox independently. |
| **D12** | Proposed | Truly read-only v1. No `argocd-sync`, no `kubectl-apply`. Replace with `prometheus-read` + `argocd-status` + one K8s read/preflight adapter. Write ops land in v0.2. |
| **D13** | Revised | Separate **public** repo from M1. Create today with a placeholder name (e.g., `action-protocol-mvp`), migrate at name clearance. |

### Group D: Newly surfaced by 3-reviewer synthesis (must land before v0.1 freeze)

| # | Source | Decision |
|---|---|---|
| **D14** | codex + cursor-agent | **Concurrency / conflict semantics.** Conflict classes, locking domain model, conflict detection location (gateway vs agent), optimistic vs pessimistic, idempotency key semantics, fairness. See `core/protocol/docs/concurrency-semantics.md`. |
| **D15** | codex + gemini | **Network / LB / proxy topology.** mTLS termination matrix, L7 proxy headers, gateway endpoint topology, HA topology, proxy fallback matrix, supported deployment modes. See `core/protocol/docs/network-topology.md`. |
| **D16** | codex | **Adapter schema distribution + compatibility policy.** Schema references, digests, versioning, schema lifecycle, capability advertisement, compatibility windows, signing and trust. See `core/protocol/docs/schema-distribution.md`. |

### Group E: Newly surfaced but deferrable to M1 (not required for v0.1 freeze)

| # | Source | Decision |
|---|---|---|
| **D17** | cursor-agent | Multi-tenancy / blast-radius model. Tenant namespaces, per-tenant quota, misbehaving-adapter isolation. |
| **D18** | cursor-agent | Observability contract (OTLP attributes, correlation IDs, "healthy" definition, RED metrics, no-PII rules in logs). |
| **D19** | cursor-agent | Compatibility policy — SLAs for minor vs patch proto changes, old-agent support windows. Pairs with D3. |
| **D20** | cursor-agent + codex | **Threat model artifact** (STRIDE-style). See `core/protocol/docs/threat-model.md`. Drafted now because CNCF reviewers will ask. |
| **D21** | cursor-agent | Testing strategy — conformance suite vs example adapters only. Without it "read-only v1" is a slogan. |
| **D22** | cursor-agent | Release engineering — Go module semver, container images, Helm chart, cosign signing, SBOM generation, CLOMonitor onboarding. |

### DR-010 (committed 2026-04-11)

The B→A path itself remains committed. The internal-first strategy is validated by the MVP. What's changed is how we execute it: **public repo from M1, standalone binary architecture, deferred timeline**.

## The critical path (per codex)

**No gRPC/proto v0.1 code proceeds until steps 1–5 are closed.**

1. **Stop scope drift**: confirm D12 (read-only v1), reaffirm D11 (cut exec from protocol). No more debate.
2. **Fix the extraction boundary**: D13 public repo from M1 + D6 standalone gateway.
3. **Lock the trust model**: D5 (audit authorship) + D7 (durability interface + reference impl) + D9 (CAProvider + external CA from M1) + D8 (credential reference semantics).
4. **Add the missing decisions**: D14 (concurrency), D15 (network topology), D16 (schema distribution).
5. **Then fix the wire**: D1 (schema-addressed payload), D3 (version negotiation), D2 (heartbeat rename). All in one proto PR.
6. **Defer protocol optimization until measured**: D10 (stream split), D4 (windowed flow tokens).
7. **Rebaseline timeline** after steps 1–5 are complete.

Additional M1 work (not blocking v0.1 freeze but required before Sandbox application): D17 (multi-tenancy), D18 (observability contract), D19 (compat policy), D21 (testing strategy), D22 (release engineering).

## External co-maintainer cultivation plan — v2 (post-synthesis)

**The earlier plan was retracted.** All three reviewers tore it up. The revised plan is a combination of codex's process guidance and gemini's targeting critique.

### What was wrong with the earlier plan

- ❌ Excluded AWS/GCP/Microsoft/Red Hat contributors — codex: "self-sabotage, violates CNCF vendor neutrality."
- ❌ HN/Reddit/Twitter as top-of-funnel — codex: "not a maintainer pipeline."
- ❌ KubeCon CFPs as critical path — codex: "marketing, not critical path."
- ❌ "Target ex-OCM/ex-Karmada/ex-KubeFleet maintainers jumping ship" — gemini: "profound misunderstanding of open-source incentives."
- ❌ "Blog post first, code second" — codex: "Public repo must move to Phase 1, not donation time."

### The revised plan

**Phase 1 (M1 immediately)** — *Public infrastructure*:
- **Public repo in M1**, not at M6 donation time (D13 revised)
- Public RFCs in the repo (issue-based design discussion)
- Public issue tracker with "good first issues" labels
- **Weekly public office hours**, even if empty for the first month
- **Defined reviewer→maintainer promotion rules** in `GOVERNANCE.md` (needs criteria added beyond the current template)

**Phase 2 (M1–M2)** — *Design review as outreach*:
- Public "design review request" issues to OCM, Karmada, KubeStellar, Fleet maintainers — **do NOT exclude by vendor**. Include them. CNCF vendor-neutrality requires objective treatment.
- Public post to the CNCF TAG Contributor Strategy for governance review
- Code reviews as the primary engagement mechanism, not blog posts

**Phase 3 (M2–M3)** — *Design partners, not maintainer prospects*:
- Target **frustrated end-users** (gemini's correction): SREs at mid-sized SaaS companies publicly in pain about multi-cluster ops, authors of messy bash wrappers for multi-cluster kubectl, anyone who has written a blog post about "managing N ArgoCDs"
- **Goal: two external adopters by M3** (codex's correction: adopters matter more than blog posts)
- Convert design-partner engagement → contributed PRs → reviewer role → maintainer promotion

**Phase 4 (M3–M5)** — *Maintainer conversion*:
- The `GOVERNANCE.md` promotion rules drive the conversion
- Target: one confirmed non-Radiant maintainer by M5

### What's been cut from the plan

- The 1500-word announcement blog post is demoted from Phase 1 priority to "nice to have once the repo is public"
- KubeCon / Open Source Summit / CNCF Project Office Hours CFP work is demoted from Phase 2 priority to M3+ (talks are marketing, not maintainer pipeline)
- Cold-email outreach to named ex-maintainers is cut entirely — replaced with public design review asks in public issues

## Filesystem layout

Unchanged from earlier PROJECT.md, except the addition of new design docs in `core/protocol/docs/`:

```
core/
├── PROJECT.md                         # this file
├── CLAUDE.md                          # session bootstrap
├── README.md, README-MVP.md           # product and MVP quickstart
├── LICENSE, GOVERNANCE.md, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
├── go.mod                             # github.com/TBD_PROJECT_NAME/core
├── Makefile                           # MVP build/demo targets
├── protocol/
│   ├── action-protocol.proto          # v0.1 gRPC wire spec draft (has 5 known issues per synthesis — to be rewritten)
│   ├── buf.yaml, buf.gen.yaml         # buf codegen config
│   ├── mvp/types.go                   # MVP shared types (temporary, replaced in v0.1)
│   └── docs/
│       ├── state-machine.md
│       ├── identity-lifecycle.md
│       ├── policy-placement.md
│       ├── audit-storage.md
│       ├── upstream-first-rule.md
│       ├── credential-references.md    # NEW (D8)
│       ├── concurrency-semantics.md    # NEW (D14)
│       ├── network-topology.md         # NEW (D15)
│       ├── schema-distribution.md      # NEW (D16)
│       └── threat-model.md             # NEW (D20)
├── gateway/                           # MVP HTTP reference (will be rewritten in v0.1 as gRPC)
├── agent/                             # MVP HTTP reference
├── adapters/k8sgetpods/               # MVP reference adapter
├── cmd/client/                        # MVP client CLI
└── bin/                               # gitignored build artifacts
```

## MVP status (unchanged)

The MVP committed at `281fdea` on `feature/core-protocol` still works end-to-end. It was a deliberate HTTP+JSON throwaway to prove the shape. It has been verified against the real cluster `rlqa-usw2-dev01` — the adapter returned a valid `corev1.PodList` (`items: null` for the empty `default` namespace, `resourceVersion: 841733956` from the real etcd).

The MVP is NOT v0.1. The v0.1 rebuild uses gRPC + protobuf + mTLS + OPA/CEL + durable queue + external CA + all the synthesis-approved architecture above, and does not carry forward the HTTP+JSON layer.

## What Claude is NOT doing (important to preserve across sessions)

- **Not touching the main `dev` working tree at `~/Documents/github/devops-portal`.** It has 38 uncommitted WIP files that must not be disturbed.
- **Not writing any v0.1 gRPC or protobuf code** until steps 1–5 of the critical path above are closed.
- **Not pushing any git remote** without explicit user approval.
- **Not committing a real project name** until a trademark search clears one.
- **Not cultivating ex-OCM/ex-Karmada maintainers via cold outreach.** The revised plan is public-first, design-partners-first.
- **Not committing to a timeline of 6 or 12 or 18 months** until the architecture is frozen.

## Contact and ownership

- **Head developer**: Gnani Rahul (`gnanirahulnutakki` on GitHub)
- **AI implementation partners** (as of 2026-04-11 post-synthesis):
  - **codex** (gpt-5.4/xhigh/fast) — protocol and security reasoning
  - **cursor-agent composer-2** — fast backend code generation (preferred for coding tasks per user directive)
  - **cursor-agent claude-4.6-opus-max-thinking** — heavy review (expensive, used sparingly)
  - **cursor-agent grok-4-20-thinking** — independent architectural perspective
  - **gemini** (gemini-2.0-flash-thinking-exp / gemini-2.0-pro-exp) — contrarian voice and single-file code generation
- **External co-maintainer**: NONE yet — hard blocker before CNCF Incubation, cultivation plan starts M1
- **ai-dev-team skill**: `~/.claude/skills/ai-dev-team/SKILL.md` — orchestration pattern for parallel AI implementers
