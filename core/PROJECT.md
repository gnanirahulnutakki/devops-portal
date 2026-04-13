# TBD_PROJECT_NAME — Multi-Cluster Day-2 Action Protocol

**Project status** (last updated 2026-04-13): MVP shipped end-to-end, v0.1 architecture freeze in progress. Critical path steps 1–5 must close before any gRPC/proto code is written.

**Working name placeholder**: literal string `TBD_PROJECT_NAME` everywhere until a trademark-cleared name lands in an atomic rename commit. Candidates to research: `opspact`, `beacon`, `verdict`, `kap`, `convoke`, `parley`, `signet`, `attest`, `conduit`. **Dead**: `clusterops` (ReactiveOps trademark Reg. No. 6015193).

## What this project is

A typed, auditable, policy-envelope-bearing day-2 action protocol for Kubernetes clusters, suitable for both human and machine-to-machine callers. The donation target is a **wire protocol**, not a product. The reference implementation is a **standalone Go binary** that speaks the protocol — not a Kubernetes-native controller, not a hub service, not an OCM addon.

For the architectural justification of why this is not an OCM addon or subproject, see `core/protocol/docs/why-not-ocm.md`.

The B→A path (DR-010, 2026-04-11): build internally first under `core/`, with CNCF-grade discipline from day one, then extract to a standalone CNCF Sandbox project. **Timeline rebaseline deferred until architecture is frozen.**

## Design revisions — 2026-04-11

The original M0 plan had several load-bearing decisions that were revised after cross-team architectural review. These revisions apply to **v0.1 wire work**, not the MVP throwaway.

| # | Original position | Revised position |
|---|---|---|
| **D1** | `google.protobuf.Any` with registered adapter-specific message types | **Schema-addressed opaque payload**: `string schema_uri` + `bytes payload_digest` + `bytes payload`. Adapter-independent evolution, no centralized type registry. |
| **D4** | Windowed flow tokens + priority class + admission queue from v0.1 | **Simple max-concurrent-operations semaphore + bounded queues + payload caps** for v0.1. Windowed tokens deferred to v0.2+ after profiling evidence. |
| **D6** | Gateway is K8s-native from start, defer standalone binary to M5 | **Standalone Go binary from M0.** Kubernetes is a deployment target (a `Deployment` YAML), not the architectural foundation. Avoids strengthening the "OCM addon or subproject" objection. |
| **D7** | "NATS JetStream required for production" | **Pluggable `DurableQueue` interface.** One reference implementation (decision TBD: SQLite/Postgres/BadgerDB). Bring-your-own-queue posture. |
| **D8** | "Protocol doesn't define secret handling" | **Protocol defines credential reference semantics, rotation expectations, and failure modes.** Cite [OCM managed-serviceaccount](https://open-cluster-management.io/docs/getting-started/integration/managed-serviceaccount/) as prior art. See `credential-references.md`. |
| **D9** | External CA integration by M4 | **`CAProvider` interface with both gateway-as-CA (dev) and external CA (cert-manager/Vault/AWS PCA) from M1.** |
| **D10** | Split bidir stream into 3 channels for v0.1 | **Single bidir stream for v0.1.** Split only after profiling shows head-of-line blocking. |
| **D13** | Separate private repo, public at donation time | **Separate PUBLIC repo from M1.** Cannot cultivate external maintainers around an invisible repo. CNCF vendor-neutrality guidance is explicit. |
| **TL** | Fixed 12-month timeline | **Timeline deferred until architecture is frozen.** The hard part of the CNCF path is public governance, external review, and adoption evidence — social processes, not coding velocity. |

## The decision list — 23 items

### Group A: Protocol wire spec fixes (must land before any v0.1 code)

| # | Status | Decision |
|---|---|---|
| **D1** | Revised | Schema-addressed opaque payload (`schema_uri + digest + bytes`). See `schema-distribution.md`. |
| **D2** | Proposed | Rename in-band `Heartbeat` to `StreamKeepalive`, make Kubernetes `Lease` the authoritative liveness signal (DR-008). Bundle with D3 in the same proto PR. |
| **D3** | Proposed | Add `string protocol_version` + `repeated string supported_features` to `AgentHello`. Version negotiation before v0.1 freeze. |
| **D4** | Revised | Simple max-concurrent-ops semaphore + bounded queues + payload caps for v0.1. Windowed flow tokens deferred. |
| **D5** | Proposed + extended | Gateway is sole author of canonical `AuditEvent`, synthesized from `OperationAck`/`Progress`/`Result` + policy verdicts. Agent-side tamper-evident append-only signed attestations provide corroborating evidence. |

### Group B: Architecture / deployment / trust

| # | Status | Decision |
|---|---|---|
| **D6** | Revised | Standalone Go binary from M0. K8s is a deployment target. Supports Unix socket for local dev and break-glass SRE access. |
| **D7** | Revised | Pluggable `DurableQueue` interface + one reference implementation (SQLite-backed likely). BYO-queue posture. |
| **D8** | Revised | Protocol defines credential reference semantics (`credential_uri + version + provider + required-scope`), rotation expectations, failure modes. See `credential-references.md`. |
| **D9** | Revised | `CAProvider` interface with both gateway-as-CA (dev) and external CA (cert-manager/Vault/AWS PCA) from M1. |
| **D10** | Deferred | Single bidir stream for v0.1. Split into 3 channels only after profiling shows HOL blocking. |

### Group C: Scope and direction

| # | Status | Decision |
|---|---|---|
| **D11** | Proposed | Cut `kubectl exec` from the protocol. Interactive session support is out of protocol scope; downstream products may implement it independently. |
| **D12** | Proposed | Truly read-only v1. Reference adapters: `prometheus-read`, `argocd-status`, one K8s read/preflight adapter. Write ops land in v0.2 with validated state machine + audit path. |
| **D13** | Revised | Separate **public** repo from M1. Placeholder name initially, rename at trademark clearance. |

### Group D: Must land before v0.1 freeze

| # | Decision |
|---|---|
| **D14** | **Concurrency / conflict semantics.** Conflict classes, locking domain model, idempotency key semantics. See `concurrency-semantics.md`. |
| **D15** | **Network / LB / proxy topology.** mTLS termination matrix, L7 proxy headers, deployment modes. See `network-topology.md`. |
| **D16** | **Adapter schema distribution + compatibility policy.** Schema references, digests, versioning. See `schema-distribution.md`. |

### Group E: M1 work (not blocking v0.1 freeze)

| # | Decision |
|---|---|
| **D17** | Multi-tenancy / blast-radius model. Tenant namespaces, per-tenant quota, misbehaving-adapter isolation. |
| **D18** | Observability contract (OTLP attributes, correlation IDs, "healthy" definition, RED metrics). |
| **D19** | Compatibility policy — SLAs for minor vs patch proto changes, old-agent support windows. |
| **D20** | **Threat model artifact** (STRIDE-style). See `threat-model.md`. |
| **D21** | Testing strategy — conformance suite vs example adapters only. |
| **D22** | Release engineering — Go module semver, container images, Helm chart, signing, SBOM, CLOMonitor. |

### DR-010 (committed 2026-04-11)

The B→A path remains committed. The internal-first strategy is validated by the MVP. Execution updates: **public repo from M1, standalone binary architecture, deferred timeline**.

## Critical path

**No gRPC/proto v0.1 code proceeds until steps 1–5 are closed.**

1. **Stop scope drift**: ratify D12 (read-only v1), ratify D11 (no exec in protocol).
2. **Fix the extraction boundary**: D13 public repo from M1 + D6 standalone gateway.
3. **Lock the trust model**: D5 (audit authorship) + D7 (durability interface) + D9 (CAProvider + external CA) + D8 (credential reference semantics).
4. **Add the missing decisions**: D14 (concurrency), D15 (network topology), D16 (schema distribution). ✅ Drafts exist.
5. **Fix the wire**: D1 (schema-addressed payload), D3 (version negotiation), D2 (heartbeat rename). One proto PR.
6. **Defer protocol optimization**: D10 (stream split), D4 (windowed tokens).
7. **Rebaseline timeline** after steps 1–5 complete.

Additional M1 work: D17–D22 (not blocking v0.1 freeze but required before Sandbox application).

## External co-maintainer cultivation plan

### Principles

- No vendor exclusions — CNCF vendor-neutrality requires objective treatment across all contributors
- Public infrastructure first: public repo, public RFCs, public issue tracker, weekly office hours
- Design partners matter more than blog posts; adopters matter more than conference talks
- Maintainer pipeline: public engagement → contributed PRs → reviewer → maintainer promotion

### Phases

**Phase 1 (M1)** — *Public infrastructure*:
- Public repo with issue tracker and "good first issues" labels
- Public RFCs (issue-based design discussion)
- Weekly public office hours (even if empty initially)
- Defined reviewer→maintainer promotion rules in `GOVERNANCE.md`

**Phase 2 (M1–M2)** — *Design review as outreach*:
- Public "design review request" issues to OCM, Karmada, KubeStellar, Fleet communities — open to all vendors
- CNCF TAG Contributor Strategy governance review request
- Code reviews as the primary engagement mechanism

**Phase 3 (M2–M3)** — *Design partners*:
- Target frustrated end-users: SREs and platform engineers publicly in pain about multi-cluster day-2 operations
- Goal: two external design partners by M3
- Convert engagement → contributed PRs → reviewer role → maintainer promotion

**Phase 4 (M3–M5)** — *Maintainer conversion*:
- Governance-driven reviewer → maintainer promotion
- Target: one confirmed non-single-vendor maintainer by M5

## Filesystem layout

```
core/
├── PROJECT.md                         # this file
├── MAINTAINERS.md                     # active maintainers + security response team
├── README.md, README-MVP.md           # protocol overview + MVP quickstart
├── LICENSE, GOVERNANCE.md, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
├── go.mod                             # github.com/TBD_PROJECT_NAME/core
├── Makefile                           # MVP build/demo targets
├── protocol/
│   ├── action-protocol.proto          # v0.1 gRPC wire spec DRAFT (deprecated — to be rewritten)
│   ├── buf.yaml, buf.gen.yaml         # buf codegen config
│   ├── mvp/types.go                   # MVP shared types (temporary, replaced in v0.1)
│   └── docs/
│       ├── state-machine.md           # operation lifecycle spec
│       ├── identity-lifecycle.md      # CSR + join + rotation + revocation
│       ├── policy-placement.md        # dual OPA/CEL, central + local
│       ├── audit-storage.md           # OTLP + object store + agent evidence channel
│       ├── upstream-first-rule.md     # project/product separation
│       ├── credential-references.md   # D8: credential envelope + rotation + failure
│       ├── concurrency-semantics.md   # D14: conflicts + locking + idempotency
│       ├── network-topology.md        # D15: mTLS termination + proxy matrix
│       ├── schema-distribution.md     # D16: schema URIs + versioning + compat
│       ├── threat-model.md            # D20: STRIDE across 7 trust boundaries
│       └── why-not-ocm.md            # architectural justification vs OCM
├── gateway/                           # MVP HTTP reference (v0.1 becomes gRPC)
├── agent/                             # MVP HTTP reference
├── adapters/k8sgetpods/               # MVP reference adapter
└── cmd/client/                        # MVP client CLI
```

## MVP status

The MVP committed at `281fdea` on `feature/core-protocol` works end-to-end. It is a deliberate HTTP+JSON throwaway that proved the protocol shape: client → gateway → agent → kubeconfig-resolved API → real cluster → result propagation through all layers.

The MVP is NOT v0.1. The v0.1 implementation uses gRPC + protobuf + mTLS + OPA/CEL + durable queue + external CA and does not carry forward the HTTP+JSON layer.

## Development constraints

- The main `dev` working tree at `~/Documents/github/devops-portal` has uncommitted WIP files that must not be disturbed.
- No v0.1 gRPC or protobuf code is written until steps 1–5 of the critical path are closed.
- No git pushes to any remote without explicit maintainer approval.
- No real project name committed until a trademark search clears one.
- No timeline commitment (6/12/18 months) until the architecture is frozen.

## Contact and ownership

- **Lead maintainer**: Gnani Rahul ([`gnanirahulnutakki`](https://github.com/gnanirahulnutakki))
- **External co-maintainer**: seeking — cultivation plan starts M1
- **Affiliation**: RadiantLogic (the protocol is vendor-neutral; RadiantLogic is the initial contributor)
