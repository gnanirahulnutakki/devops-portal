# TBD_PROJECT_NAME — Multi-Cluster Day-2 Action Protocol

**Project status** (last updated 2026-04-11): MVP shipped end-to-end. Next step is v0.1 gRPC wire spec implementation with the corrections from the 4-reviewer critique.

**Working name placeholder**: the literal string `TBD_PROJECT_NAME` is used everywhere until a trademark-cleared name lands in an atomic rename commit. Candidates to research: `opspact`, `beacon`, `verdict`, `kap`, `convoke`, `parley`. **Dead**: `clusterops` (ReactiveOps trademark Reg. No. 6015193).

## What this project is

A typed, auditable, policy-envelope-bearing day-2 action protocol for Kubernetes clusters, suitable for both human and machine-to-machine callers. The donation target is a **wire protocol**, not a product. The reference implementation is a Go agent + gateway pair + a minimal adapter set that speaks the protocol.

The B→A path (DR-010, 2026-04-11): build internally first inside the devops-portal-v2 repo under `core/`, with CNCF-grade discipline from day one, then extract to a standalone CNCF Sandbox project in ~12 months.

## Filesystem layout

| Path | What's there |
|---|---|
| `~/Documents/github/devops-portal` | Main working tree for the existing devops-portal-v2 Next.js 15 app. **Has 38 uncommitted WIP files on branch `dev` — do NOT touch without explicit user approval.** |
| `~/.claude/worktrees/devops-portal-core-protocol` | **Active work tree** for this project. Git worktree on branch `feature/core-protocol`, cleanly based on `dev` HEAD. Parallel isolation from the main tree's WIP. |
| `core/` | The extraction-ready module. Single `go.mod` at `github.com/TBD_PROJECT_NAME/core`. |
| `core/protocol/action-protocol.proto` | v0.1 wire spec draft (codex-authored, has known issues — see v2 critique) |
| `core/protocol/mvp/types.go` | MVP shared types (Go structs, HTTP+JSON — **temporary**, replaced by protobuf in v0.1) |
| `core/gateway/`, `core/agent/`, `core/adapters/k8sgetpods/` | MVP reference implementation |
| `core/cmd/client/` | MVP CLI for invoking adapters |
| `core/protocol/docs/` | 5 prose spec documents (state machine, identity lifecycle, dual policy, audit storage, upstream-first rule) |
| `core/Makefile`, `core/README-MVP.md` | Build and run documentation |
| `core/LICENSE`, `core/GOVERNANCE.md`, `core/SECURITY.md`, `core/CONTRIBUTING.md`, `core/CODE_OF_CONDUCT.md` | CNCF-grade governance scaffolding |

## What's currently built

### MVP — HTTP+JSON proof-of-concept

**Status**: compiles and runs end-to-end. Four AI models produced the code in parallel on 2026-04-11:

| Component | Author | Status |
|---|---|---|
| Shared types | Claude | ✅ compiles |
| Gateway (HTTP server, agent registry, `/execute` routing) | codex (gpt-5.4/xhigh/fast) | ✅ compiles + runs |
| Agent (HTTP long-poll client, dispatcher) | cursor-agent (Opus 4.6 Max Thinking) | ✅ compiles + runs |
| `k8s-get-pods` adapter (client-go) | gemini (gemini-2.0-flash-thinking-exp) | ✅ compiles + invokes |
| Client CLI | Claude | ✅ compiles + runs |

**Binaries** (in `core/bin/` after `make build`): `gateway` 8.3 MB, `agent` 34 MB, `client` 8.3 MB.

**Known cosmetic bug**: the agent's `/submit-result` HTTP status check interprets the gateway's 204 No Content as an error (the submission actually succeeds). One-line fix pending.

### v0.1 wire spec draft

**Status**: drafted by codex, has 5 load-bearing issues flagged by cursor-agent's review:

1. `google.protobuf.Struct params` is a type-safety hole (should be `google.protobuf.Any` with registered messages, or `bytes + schema_uri`)
2. In-band `Heartbeat` contradicts DR-008 (K8s Lease) — pick one liveness mechanism
3. No protocol version negotiation in `AgentHello` — needs `supported_features` bitmap
4. No backpressure/flow control on the bidirectional stream
5. Agent-authored `AuditEvent` is a trust inversion (compromised spoke can fabricate audit)

These must be fixed before any Go code is built against the proto.

## The 10 Decision Records

| DR | Status | Rule |
|---|---|---|
| DR-001 | Proposed | No interactive shell / PTY transport in v1 (disputed by gemini who argues it should stay) |
| DR-002 | Proposed | Policy uses OPA/CEL — no custom policy language |
| DR-003 | Proposed | protobuf/gRPC is the public API; CRDs are reference-gateway persistence only |
| DR-004 | Proposed | Audit goes to OTLP sinks or append-only object storage, never to CRDs |
| DR-005 | Proposed | Explicit state machine: `accepted / running / succeeded / failed / cancelled / unknown`; `unknown` is terminal |
| DR-006 | Proposed | Bootstrap identity is OCM-style: join token → CSR → hub approval → short-lived cert → rotation |
| DR-007 | Proposed | Upstream-first: all protocol changes land upstream before any downstream consumer can use them |
| DR-008 | Proposed | Heartbeats use Kubernetes `Lease`, not a custom CRD |
| DR-009 | Proposed | Pull-mode transport is an implementation detail, not the project thesis |
| DR-010 | **Committed** | B→A path: ship internally first, extract to CNCF Sandbox at M6 with CNCF-grade discipline from day one |

All DRs except DR-010 are **Proposed**, not committed. The 4-reviewer critique (codex + gemini + cursor-agent + grok) surfaced ~13 open decisions that need user resolution before any DR gets ratified. See the Notion hub's `🎯 Decisions` page.

## Related resources (external references)

### Notion project hub (parallel research workspace)
**Root**: https://www.notion.so/33f2637edb0781549ae8cf500379ba4a

Subpages:
- `📄 Docs` — design drafts + codex blindspots analysis + v2 design draft
- `💡 Ideas` — 8 use cases, naming candidates, open questions
- `❌ Failures` — 11 wrong architectural assumptions, 4 tool breakages, 3 script bugs
- `📜 Logs` — session transcripts, research artifacts
- `🔬 Research` — CNCF process, competitive landscape, trademark check
- `🎯 Decisions` — 9 proposed DRs (10 with B→A), reconciliation pointers
- `🧪 Pair Tools Status` — per-tool usability matrix
- `✅ TODO / Next Actions` — design gaps, governance work, reconciliation tasks

**Separate BRAIN-60 program** (not this hub): https://www.notion.so/33f2637edb0781e9b2e0fc66196bcfad — contains the existing multi-cluster control plane program with its own ADRs (Keep Control Plane Greenfield, One Agent Per Cluster, Standalone Generic Kubernetes Boundary Reset, Read-Heavy V1 Surface). **Do not conflate with EOC-MCP Project (`ARCHITECTURE v3`), which is unrelated.**

### Research artifacts on disk

- `~/.claude/pair-programming/current/conversation.md` — full pair session log (~40 KB+, all turns across codex, gemini, cursor-agent)
- `~/.claude/pair-programming/current/codex-blindspots-analysis.md` — 24 KB deep teardown of v1 design with 8 use cases + 12 blind spots + 8 design risks + 9 governance risks + 10 TOC questions
- `~/.claude/pair-programming/current/codex-m0-critique.md` — 12 KB review of the M0 implementation plan
- `~/.claude/pair-programming/current/cursor-agent-m0-critique.md` — 11 KB protocol-level critique of the M0 plan
- `~/.claude/pair-programming/current/v2-design-draft.md` — 19 KB Claude response to codex blindspots (pre-MVP)

### Pair programming scripts

- `~/.claude/bin/pair-with-codex.sh` — file-based pair channel with codex (gpt-5.4/xhigh/fast default). Commands: `init`, `send`, `append-codex`, `show`, `last`, `path`, `list`.
- `~/.claude/bin/pair-with-gemini.sh` — same surface, gemini backend. Currently functional.

Session log: `~/.claude/pair-programming/<session-slug>/conversation.md`

## How to run the MVP

```sh
cd ~/.claude/worktrees/devops-portal-core-protocol/core
make deps      # go mod tidy (fetches client-go and transitive deps, ~1 min first time)
make build     # compile gateway, agent, client into ./bin/
make demo      # one-shot: start gateway+agent in background, run client, tear down
```

Or three-terminal:

```sh
# Terminal 1
cd core && make run-gateway

# Terminal 2
cd core && make run-agent

# Terminal 3
cd core && ./bin/client get-pods -namespace default
```

Requires: Go 1.24+ and a reachable Kubernetes cluster (via kubeconfig). Works with `kind` for a fully local demo.

## What's next (in priority order)

1. **Resolve the 13 open decisions from the 4-reviewer critique** before writing any more v0.1 code. Key conflicts to resolve:
   - `kubectl exec` in v1: cut (codex/DR-001) vs keep (gemini as primary differentiator)?
   - Timeline: stretch to 18mo (codex), hold 12mo (current), or compress to 6mo (gemini)?
   - Gateway architecture: standalone Go gRPC + SQLite WAL (codex) vs Envoy Go Extension (gemini) vs K8s-native with 3-stream split (cursor-agent)?
   - Agent-authored vs gateway-authored `AuditEvent`?
   - Single bidir stream vs split into 3 channels (Control/Report/Lifecycle)?

2. **Fix the proto file** for the 5 load-bearing issues (type-unsafe `Struct`, DR-008 Lease contradiction, no version negotiation, no backpressure, trust inversion in audit).

3. **Ratify DR-001 through DR-009** — currently only DR-010 is committed. Update the Notion hub's `🎯 Decisions` page when ratified.

4. **Resolve the git history trap** (gemini's finding): decide between git subtree split at M6 vs maintain `core/` in a separate repo from day one with a vendor-copy mirror inside devops-portal-v2.

5. **Start trademark search** for 10 name candidates.

6. **Start external co-maintainer cultivation** — hard Sandbox blocker. Target: one confirmed non-Radiant maintainer by M3.

7. **Resolve reconciliation with BRAIN-60 program** — the existing DevOps Portal Multi-Cluster Control Plane Program (BRAIN-60) has its own ADRs from 2026-04-11. Some are compatible (Read-Heavy V1, Standalone Reset), some partially conflict (DR-007 vs "Integrate Agent with Existing Charts"). Cross-link, don't overwrite.

## Git state

- **Main working tree** (`~/Documents/github/devops-portal`, branch `dev`): in sync with `origin/dev`, 38 uncommitted WIP files (Prisma schema changes for `CredentialHealthCheck`, docs cleanup, sidebar tweaks). **Do not touch.**
- **Worktree** (`~/.claude/worktrees/devops-portal-core-protocol`, branch `feature/core-protocol`): clean base of `dev` HEAD `b0f1116`, plus the `core/` tree as described above. All commits to this branch should be DCO sign-off (`-s` flag). Do not push without explicit user approval.

## Contact and ownership

- **Head developer**: Gnani Rahul (`gnanirahulnutakki` on GitHub)
- **AI implementation partners** (as of 2026-04-11): codex (gpt-5.4/xhigh/fast), cursor-agent (composer-2 for coding, Opus 4.6 Max Thinking for review), gemini (gemini-2.0-flash-thinking-exp), grok (grok-4-20-thinking, for reviews)
- **External co-maintainer**: NONE — hard blocker before CNCF Incubation
