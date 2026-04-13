# TBD_PROJECT_NAME — Multi-Cluster Day-2 Action Protocol

> **Status**: M0 scaffolding, pre-v0.1. Interface surface is unstable. Do not depend on this yet.
> **Working placeholder name**: the literal string `TBD_PROJECT_NAME` is used everywhere in this tree until a trademark-cleared name lands in one atomic rename commit at the end of M1.

## One-sentence thesis

**A typed, auditable, policy-envelope-bearing day-2 action protocol for Kubernetes clusters, suitable for both human and machine-to-machine callers, with identity, revocation, and dual policy placement as first-class primitives.**

The donation is a **wire protocol**, not a bundle. The reference implementation is a Go agent + gateway pair that speaks the protocol. Product-layer integrations live in downstream adopters, not in this repo.

## Why this exists

Multi-cluster operators today choose between two bad options: ship a full product (Grafana + Prometheus + Elastic + Loki + Argo + Velero + custom UI) into every cluster, or pipe everything back to a central hub and live with the data-residency, cost, and blast-radius problems that entails. Neither option gives a principled answer to "how do I invoke a typed, audited, policy-gated day-2 action against a specific cluster-local tool, safely, from a machine client or a human?"

This project is the missing primitive: the wire contract that sits between a caller (human or machine) and a cluster-local execution point, with identity, policy, and audit as first-class properties of the envelope.

## What this repo is NOT

- Not a workload-propagation framework (see KubeFleet, Karmada, OCM)
- Not a cluster lifecycle manager (see Cluster API)
- Not a GitOps engine (see Argo, Flux, Fleet)
- Not a telemetry aggregator (see Thanos, ACM observability)
- Not an Internal Developer Platform or portal (see Backstage)
- Not a cluster browse UI (see Headlamp, Lens)
- Not an interactive shell / PTY broker
- Not an MCP server — MCP clients are just one possible consumer of this protocol

## Layout

```
core/
├── README.md                      # this file
├── LICENSE                        # Apache 2.0
├── GOVERNANCE.md                  # maintainer council pattern
├── SECURITY.md                    # disclosure policy, reporting, embargo
├── CONTRIBUTING.md                # DCO + PR process + test requirements
├── CODE_OF_CONDUCT.md             # CNCF community CoC
├── go.mod                         # single module for the whole core tree
├── protocol/
│   ├── action-protocol.proto      # v0.1 wire spec DRAFT (deprecated, to be rewritten)
│   ├── buf.yaml                   # buf lint config
│   ├── buf.gen.yaml               # buf codegen config
│   └── docs/
│       ├── state-machine.md       # operation lifecycle spec
│       ├── identity-lifecycle.md  # CSR + join + rotation + revocation
│       ├── policy-placement.md    # dual OPA/CEL, central + local
│       ├── audit-storage.md       # OTLP + object store, NOT CRDs
│       ├── upstream-first-rule.md # project/product separation
│       ├── credential-references.md   # D8: credential envelope
│       ├── concurrency-semantics.md   # D14: conflicts + locking
│       ├── network-topology.md        # D15: mTLS + proxy matrix
│       ├── schema-distribution.md     # D16: schema URIs + versioning
│       ├── threat-model.md            # D20: STRIDE threat model
│       └── why-not-ocm.md            # architectural justification vs OCM
├── gateway/                       # reference Go gateway
├── agent/                         # reference Go agent
├── adapters/                      # minimal reference adapters
└── conformance/                   # planned — not yet implemented
```

## Design constraints (hard rules)

All ten are decision records in the parent Notion hub and must be honored by every PR.

| DR | Rule |
|---|---|
| DR-001 | No interactive shell / PTY transport in v1 |
| DR-002 | Policy uses OPA/CEL — no custom policy language |
| DR-003 | protobuf/gRPC is the public API; CRDs are reference-gateway persistence only |
| DR-004 | Audit goes to OTLP sinks or append-only object storage, never to CRDs |
| DR-005 | Operations follow an explicit state machine: `accepted / running / succeeded / failed / cancelled / unknown`; `unknown` is terminal |
| DR-006 | Bootstrap identity is OCM-style: join token → CSR → hub approval → short-lived cert → rotation |
| DR-007 | Upstream-first: all protocol and reference implementation changes land upstream before any downstream consumer can use them |
| DR-008 | Heartbeats use Kubernetes `Lease`, not a custom CRD |
| DR-009 | Pull-mode transport is an implementation detail, not the project thesis |
| DR-010 | B→A path: ship internally first, extract to CNCF Sandbox later with CNCF-grade discipline from day one |

## Governance

See [GOVERNANCE.md](./GOVERNANCE.md). This project uses a Maintainer Council model with lazy consensus for non-charter decisions and 2/3 supermajority for charter changes. External maintainer recruitment is explicitly a prerequisite for CNCF Incubation (not a post-acceptance concern).

## Security

See [SECURITY.md](./SECURITY.md). Reporting process: private email to the security contact list, 3-business-day acknowledgment, 14-day triage target, 90-day coordinated disclosure default unless severity warrants faster release.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All commits must be DCO sign-off (`Signed-off-by:` line). PRs require review from at least one maintainer. Tests required for all protocol-affecting changes.

## Related project and origin

This project was extracted (or will be extracted, per DR-010) from the internal Radiant devops-portal effort. The history and early research artifacts live in that project's Notion hub. The goal is vendor-neutral, CNCF-donatable substrate — not a Radiant product. Early pre-v0.1 work happens inside the devops-portal-v2 repo under this `core/` subdirectory; extraction to a standalone repo is scheduled for M6 (Q1–Q2 2027).
