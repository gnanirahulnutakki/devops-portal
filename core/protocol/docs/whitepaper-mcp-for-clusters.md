# Foundations for Multi-Cluster MCP Federation

A typed protocol for cross-cluster Model Context Protocol traffic with central audit, identity, and policy.

| | |
|---|---|
| **Status** | **RFC v0.1 (draft for discussion) — 2026-04-25.** *Not* a Sandbox application; not ready to be one. Targeted at TAG-AI / Cloud Native AI Working Group community review to test problem framing and protocol shape before any CNCF-process step. |
| **Audience** | TAG-AI / CNAIWG technical reviewers, MCP / agentgateway / kagent maintainers, OCM maintainers, Solo.io agentregistry maintainers. *Not yet* CNCF TOC. |
| **Working name** | Not assigned. Trademark + npm-name clearance is M1.2; deliberately deferred until problem framing settles in public discussion. |
| **Maintainers** | One: Gnani Rahul ([gnanirahulnutakki](https://github.com/gnanirahulnutakki)). Single-maintainer, single-organization today. This is a known and disqualifying state for CNCF Sandbox; the project does not plan a Sandbox application until at least one external maintainer with commit/review rights is in place and named in `MAINTAINERS.md`. |
| **Affiliation** | Initial contributor: RadiantLogic. The project will be developed in public from M1.3 onward under a vendor-neutral GitHub organization, Apache 2.0 license, with no RadiantLogic-only privileges in governance. |
| **License** | Apache 2.0 (manuscript and reference implementation). |
| **Replaces** | Original framing in `core/PROJECT.md` (pre-pivot, "multi-cluster day-2 actions"). Pivot rationale in `core/protocol/docs/why-mcp-for-clusters.md`. |
| **Reviewer guidance** | This document is intentionally pre-Sandbox. The right outcome of community review is: (a) problem-framing refinement, (b) primitives that are wrong or missing, (c) overlap concerns with adjacent projects that we should integrate into rather than around. The wrong outcome is treating it as a TOC pitch. |

---

## Abstract

Model Context Protocol (MCP) has emerged as a candidate de facto wire for agent-to-tool and agent-to-agent communication, with single-cluster traffic handling already addressed by [Higress](https://higress.cn/), [agentgateway](https://agentgateway.dev/), and similar gateways. **Federation across clusters and across heterogeneous backends is unaddressed**: there is no widely-adopted standard for an agent in cluster *A* to invoke an MCP server hosted in cluster *B* with single-source identity, single-record audit, and central-plus-local policy. CNCF TOC initiative #1746 ("Cloud-Native Foundations for Distributed Agentic Systems") names this gap explicitly as *MCP-for-Clusters* and lists no incumbent.

This whitepaper sketches a typed wire protocol that could fill that slot, for community discussion. The protocol is intentionally narrow: it does not run agents, host MCP servers, serve models, edit Kubernetes manifests, or replace existing service meshes. It carries one class of traffic — typed agent operations, primarily MCP and A2A — across cluster and trust boundaries. The wire-level primitives proposed are a schema-addressed opaque payload, a gateway-authored canonical audit record, and dual policy placement; the deployment-level primitives (pluggable durable queues, pluggable certificate authorities) are reference-architecture concerns called out explicitly as such. A Go-language proof-of-concept has executed an end-to-end MCP-shaped call across one real Kubernetes cluster, demonstrating protocol shape only — not production maturity, not multi-cluster scale, not a wire freeze. A candidate v0.1 wire-freeze subset is identified in §3 with explicit exclusions.

The contribution this RFC seeks community feedback on is whether **one wire** could let every cloud-native AI project — kagent, llm-d, Higress, agentgateway, agentregistry, agent-sandbox — compose into a federated whole instead of forcing each integration to invent its own cross-cluster story. The authors recognize that the answer may be "no, this belongs inside an existing project (e.g., OCM cluster-proxy or agentgateway)," and the document is structured to make that critique easy to deliver.

---

## 1. Problem statement

Three trends collide in 2026:

**Trend 1 — Kubernetes is increasingly the AI platform.** 82% of surveyed organizations run AI workloads on Kubernetes per the [2025 CNCF Annual Survey](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/). The Kubernetes AI Conformance Program ([launched November 2025](https://www.cncf.io/announcements/2025/11/11/cncf-launches-certified-kubernetes-ai-conformance-program-to-standardize-ai-workloads-on-kubernetes/)) codified Kubernetes AI Requirements (KARs); WG-Serving [concluded successfully](https://www.cncf.io/blog/2026/02/26/kubernetes-wg-serving-concludes-following-successful-advancement-of-ai-inference-support/), indicating the inference layer of the AI stack has reached working consensus inside CNCF.

**Trend 2 — MCP has gained substantial mindshare as the agent-tool wire.** Anthropic's Model Context Protocol, per the [KubeCon EU 2026 recap](https://www.kubermatic.com/blog/kubecon-eu-2026-recap/), *"appeared in sessions across every track."* Multiple CNCF Sandbox / contributing projects (kagent, agentgateway, Higress) treat it as a first-class wire. Adjacent specifications (A2A for agent-to-agent, agent skills for capability advertising) are converging on similar envelope shapes. This is mindshare and momentum; whether MCP will hold this position at the 24-month horizon depends on factors outside this document. The question this whitepaper asks is conditional: *if* MCP-shaped traffic continues to grow as a substantial class of cloud-native traffic, is there a federation gap?

**Trend 3 — Multi-cluster is the typical Kubernetes deployment for non-trivial fleets.** Fleet management (OCM, Karmada, KubeStellar), workload distribution (ApplicationSet, Fleet), and inference scaling (llm-d) all assume the operator is running multiple Kubernetes clusters.

Where these three meet, an architectural gap appears: **agents in cluster A want to call MCP servers in cluster B with comparable identity, audit, and policy guarantees they would have inside one cluster**. Today, every integration that needs this — Argo CD addons calling agent tools, ML pipelines invoking inference servers in foreign regions, security agents pulling logs from sister clusters — has to invent its own cross-cluster auth, its own audit-stitching, its own policy placement. The result is a fragmented set of federation layers, each with a separate breach surface.

The community-discussion question this whitepaper poses: *is one shared federation wire the right way to address this gap, or should it be addressed inside an existing project (OCM cluster-proxy, agentgateway, kagent)?* The authors lean toward the former and explain why in §2.3, but flag this as the central decision the TAG-AI community should weigh in on.

### 1.1 Concrete user stories (non-exhaustive)

- A platform engineer at a SaaS vendor manages 30+ tenant clusters. A single AI assistant should be able to query "which pods are crashlooping in tenant X" via MCP without that assistant holding 30 individual kubeconfigs. **Federation primitive needed.**
- An ML team runs a RAG pipeline where the agent in the inference cluster needs to invoke a `postgres-mcp` server in the data cluster. The data team's compliance team requires every such call to be auditable centrally. **Canonical audit needed.**
- An SRE running break-glass diagnostics through an agent must satisfy a policy: "no production write actions without two-person approval." Today this is enforced per-tool by per-team logic. **Central + local policy needed.**
- A vendor consolidating around Higress for ingress and kagent for in-cluster agents wants to federate to a sister cluster running a different gateway. **Vendor-neutral wire needed.**

These stories share one shape: typed agent traffic crossing a trust boundary.

---

## 2. Context — why this is a CNCF gap, not a vendor opportunity

### 2.1 What CNCF TOC has named

[TOC initiative #1746](https://github.com/cncf/toc/issues/1746) (status: accepted) lists the following gaps as "where new projects are needed":

| Gap | Status | Incumbent |
|---|---|---|
| **MCP-for-Clusters — auth, discovery, streaming** | spec proposal pending | **none** |
| Agent CRD — fleet-level schema + lifecycle | spec proposal pending | none at fleet scale |
| AgentMemory API | project pending | **none** |
| AgentBench-CN — benchmarking | project pending | none |
| Observability spec — minimum OTel for autonomy | spec pending | **none** |
| Policy CRDs — Kyverno/Gatekeeper for autonomy | spec pending | **none** |

This whitepaper addresses only the first row. The rest are out of scope and explicitly invite other contributors.

### 2.2 What current CNCF projects already cover

Federation is the negative space that emerges once each adjacent project is mapped:

| Project | Status | Scope | Federation contribution |
|---|---|---|---|
| [llm-d](https://www.cncf.io/blog/2026/03/24/welcome-llm-d-to-the-cncf-evolving-kubernetes-into-sota-ai-infrastructure/) | Sandbox 2026-03-24 | Distributed LLM **inference** | Out of scope. Different traffic class. |
| [Higress](https://www.cncf.io/blog/2026/03/25/higress-joins-cncf-delivering-an-enterprise-grade-ai-gateway-and-a-seamless-path-from-nginx-ingress/) | Sandbox 2026-03-25 | **Single-cluster** AI-native gateway | Stops at cluster boundary. |
| [kagent](https://www.cncf.io/projects/kagent/) | Sandbox 2025-05-22 | **In-cluster** agent runtime | Stops at cluster boundary. |
| agentgateway (Solo.io, [contributing](https://www.solo.io/blog/bringing-agentic-ai-to-kubernetes-contributing-kagent-to-cncf)) | donation in progress | **Single-cluster** MCP/A2A proxy | Stops at cluster boundary. |
| agentregistry (Solo.io, donated) | donation in progress | Catalog of agents/tools/skills | Answers "what exists," not "how to call across boundaries." |
| agentevals (Solo.io) | open-source | Agent evaluation standardization | Orthogonal. |
| [agent-sandbox](https://kubernetes.io/blog/2026/03/20/running-agents-on-kubernetes-with-agent-sandbox/) (kubernetes-sigs) | k8s SIG | **Single-pod** stateful agent CRD | Below this layer. |

The pattern across the AI-Sandbox cohort: each project terminates at, or stays below, the cluster boundary. **No CNCF project today targets cross-cluster MCP federation as its primary scope.** This claim is based on each project's public scope statements (links above) as of 2026-04-25; it has not been validated through direct conversation with each project's maintainers, and the authors flag this as a gap. §8 lists per-project engagement status. If any project below considers cross-cluster MCP federation in-scope and the table understates it, we want to hear that.

### 2.3 Relationship to OCM (the most-likely-overlap incumbent)

[Open Cluster Management](https://open-cluster-management.io/) (CNCF Incubating) is the strongest "this should be inside an existing project" critique we anticipate. The honest answer is partial overlap, not zero. Comparison:

| Concern | OCM today | This protocol | Could OCM grow into this? |
|---|---|---|---|
| Cross-cluster declarative state | `ManifestWork` (the canonical primitive) | Not addressed | N/A — no overlap |
| Cross-cluster imperative K8s API push | `Pushing-Kube-API-Requests` (works) | Not addressed | N/A — no overlap |
| Cross-cluster L7 tunneling (generic) | `cluster-proxy` (works for arbitrary HTTP/gRPC) | Long-poll mTLS to dialed-out agent | **Yes — `cluster-proxy` could be the long-haul transport.** This protocol does not preclude using it. |
| Typed agent traffic envelope (schema_uri + payload_digest) | None | D1 of this protocol | OCM has shown no plan or interest |
| Gateway-authored canonical audit per agent call | None | D5 of this protocol | OCM's audit model is per-cluster K8s audit |
| Dual-placement policy (central + local) for typed agent calls | None (OCM policies act on K8s objects) | D3 of this protocol | Adjacent but different; OCM `Placement` and `ManagedClusterSetBinding` operate on workload placement, not call-level allow/deny |
| End-user identity carried in-payload (signed JWT claim) across hops | None natively | Required by D1 + D5 | Could be added; not on roadmap |
| MCP/A2A schema versioning | None | D3 + D16 | No |

Where the honest critique lands: **the long-haul transport could be `cluster-proxy`**. This protocol's contribution then narrows to (a) the typed envelope, (b) the canonical audit semantics, (c) the dual-policy placement, (d) MCP/A2A schema-version negotiation, plus (e) the credential-reference and CA-provider abstractions that exist for any agent-traffic system.

We invite OCM maintainers to push back. The two structurally compatible outcomes are: this protocol lands as an OCM-adjacent CNCF project that uses `cluster-proxy` when available, OR this protocol's primitives are absorbed into OCM as an "agent traffic" extension. The wrong outcome is two parallel cross-cluster control planes.

Full historical context (and the case against absorption) is in [`why-not-ocm.md`](./why-not-ocm.md); the gap mapping vs current AI-Sandbox projects is in [`why-mcp-for-clusters.md`](./why-mcp-for-clusters.md). Both are inputs to community discussion, not conclusions.

---

## 3. Protocol — wire-level primitives vs reference-architecture choices

A point of confusion in v0.0 of this document, called out in early review, was conflating **protocol-level decisions** (what's on the wire, what every conformant implementation must do) with **reference-architecture decisions** (what our current implementation does, but which an alternate implementation could do differently). This section now separates them. **§3.1–§3.3 are wire-level**; **§3.4–§3.6 are reference-architecture**, included because they shape the protocol's deployability claims but are not themselves part of any future wire freeze.

### 3.1 Schema-addressed opaque payload (D1) — wire

**Decision** (ratified 2026-04-11, see `core/PROJECT.md`): the wire envelope is `{ schema_uri: string, payload_digest: bytes, payload: bytes, ... }` (see appendix B for the full field list).

**Why**: a centralized type registry creates governance friction (who owns the registry?) and slows adapter evolution. Schema-addressed payload defers schema knowledge to the endpoints that actually need it. Intermediate hops validate `schema_uri` against an allow-list and `payload_digest` against the bytes; the type itself is end-to-end.

**Application to MCP**: `schema_uri = mcp://tools/call/v1.0` (or `v1.1`, etc.) carries an MCP `CallToolRequest`. Distinct from `mcp://prompts/get/v1.0`, `mcp://resources/read/v1.0`, A2A schemas, or future agent-skill schemas. Versioning is explicit per-call.

**Adapter independence**: the same wire carries `mcp://`, `a2a://`, and custom typed action schemas without protocol changes.

**Schema trust — load-bearing, currently underspecified.** Reviewers of v0.0 correctly observed that the protocol's safety claim depends on `schema_uri` allow-listing without specifying *how a federation participant knows which `schema_uri` values to trust*. This is a wire-level question, not an open question, and v0.2 of this document will move it from §9 into a normative subsection here. Candidate trust models the authors are weighing:

  1. **OCI-registry-anchored** — `schema_uri` is a digest of a Subject-bound OCI artifact; trust = trust in the issuer's signing identity (cosign-style).
  2. **Maintainer-signed catalog** — a small set of well-known schemas (mcp.io, a2a.io) signed by their respective protocol working groups; federation operators allow-list signers, not individual schemas.
  3. **Trust-on-first-use + revocation** — first-use registration with operator confirmation; revocation list distributed via the gateway.

The authors lean toward (1) but want TAG-AI input before fixing the choice. *Until this is fixed, the protocol does not have a complete safety argument and is not Sandbox-ready regardless of other progress.*

### 3.2 Gateway-authored canonical audit (D5) — wire

**Decision**: the gateway is the sole author of a single `AuditEvent` per call. The agent contributes cryptographic evidence of execution (hash-chained attestations); the gateway combines its own dispatch record with the agent evidence into one canonical record.

**Why**: distributed audit (per-cluster K8s audit logs, per-tool event streams, per-CI run logs) requires out-of-band stitching to answer "who invoked what, and was it allowed." A canonical audit author lets compliance answer that question with one query.

**Audit of invocation vs attestation of outcome** (added v0.1 in response to early review). The audit record proves *that a call was dispatched* and *what the agent reported back*. It does **not** by itself prove *that the agent executed the call truthfully* — a compromised agent can fabricate `OperationResult` fields and the gateway will record them as reported. v0.2 will define an explicit attestation channel where outcome evidence (e.g., a signed digest of the MCP server's actual response, when the MCP server itself can sign) is separable from invocation audit. For agents whose underlying MCP servers cannot sign responses, the protocol commits to honest framing in the audit record: `outcome.attestation_quality = ["agent-asserted" | "agent-signed" | "server-signed"]`.

**Audit integrity under gateway compromise.** A compromised gateway can backdate or omit records; this was correctly identified in early review as undermining the "central audit" value claim. Mitigations the protocol commits to in v0.2:
  1. Append-only audit-log signing with periodic external anchoring (e.g., write a Merkle root every N minutes to an out-of-band store like a public transparency log or a separately-administered S3 bucket).
  2. Independent log replication: agents retain a parallel audit shadow (just their own calls); reconciliation jobs catch gateway omissions.
  3. Detect-not-prevent posture: the protocol does not claim a compromised gateway leaves no trace; it claims the trace is detectable within a bounded window if the operator runs reconciliation.

**Application to MCP**: every MCP call becomes one `AuditEvent` with `actor` (signed user identity), `action` (`mcp://tools/call/v1.0/<tool-name>`), `target` (cluster + MCP server), `decision` (allow/deny + policy ref), `outcome` (success/failure + agent evidence + attestation_quality). The audit record is keyed on `(orgId, callId, agentEvidenceDigest)`.

### 3.3 Dual policy placement — wire

**Decision**: policy evaluates at two points:
1. **Central, gateway pre-dispatch**: "is this caller allowed to invoke this `schema_uri` against this target at all?" — coarse-grained, identity- and target-aware.
2. **Local, agent pre-execution**: "given the local cluster's runtime state, is this specific call safe to execute now?" — fine-grained, runtime-aware (e.g., reject calls during a maintenance window even if gateway policy allows).

**Why**: central-only policy can't know about agent-side conditions (paused rollouts, locked tenants). Local-only policy can't enforce cross-cluster policy ("no break-glass calls without two-person approval"). Both are needed; neither is sufficient.

**Application to MCP**: gateway policy bears on `(actor, schema_uri, target_cluster, target_mcp_server)`. Agent policy bears on `(local_namespace_state, target_object_state, time_window, mcp_tool_args)`.

**Engines and interoperability** (sharpened in v0.1 in response to early review). OPA (Rego) and CEL are both candidate engines per the [Kyverno/Gatekeeper convergence](https://kyverno.io/) on CEL. The protocol carries the policy verdict as an envelope field, but a verdict alone is not sufficient for interoperability — v0.2 will define normatively:
  - **Canonical policy input schema** — the JSON document a policy engine evaluates (envelope fields normalized into a stable shape)
  - **Verdict schema** — `{decision, policy_id, policy_version, rule_id, evaluated_at, context_digest}` so audit can replay
  - **Conflict resolution** — central deny is final; central allow does not bind local; local can deny anything central allowed (deny-precedence)
  - **Version identity** — policy_id + policy_version + rule_id together uniquely identify what evaluated
  - **Replay requirement** — the input schema must be deterministic enough that compliance reviewers can re-run the policy against a stored audit input and get the same verdict

This is not novel work; it borrows from OPA's audit conventions and Gatekeeper's `ConstraintTemplate` versioning. We call it out explicitly because v0.0 understated it.

### 3.4 Pluggable durable queue (D7) — reference-architecture, not wire

**Reference-architecture choice**: the gateway depends on a `DurableQueue` interface; reference implementations include in-memory (dev), SQLite (single-node prod target, [crash-safety target for M1.5](../PROJECT.md#m1)), and planned future BadgerDB or external broker (Kafka/NATS/Redpanda).

**This is not on the wire** and is not part of any wire freeze. Two implementations of the protocol could pick entirely different durability models and remain wire-compatible.

**Required queue semantics** (these *are* normative if a federation deployment is to give the audit and policy guarantees described above):
  - At-least-once delivery from gateway-accept to agent-dispatch (duplicates handled by call_id idempotency)
  - FIFO per `(orgId, target_cluster)` partition (out-of-order delivery within a partition can break dependent calls)
  - Visibility timeout with redelivery on agent crash
  - Dead-letter handling for poison messages with audit trail
  - Crash-safety: a write acknowledged to the caller must survive process death and disk-cache flush

**Why pluggability matters**: forcing every operator to run NATS/Kafka raises the deployment bar in a way that the SQLite-default avoids. We do not claim this works at 10,000-cluster scale; we claim the SQLite default is sufficient for the small-fleet operator and the broker-backed choice for the large-fleet operator. Quantitative scale claims will follow real benchmarks (M2 deliverable), not be written into protocol material before they exist.

**Application to MCP**: durable queue holds `OperationDispatch` records between gateway-accept and agent-poll.

### 3.5 Credential reference semantics (D8) — wire (envelope field) + reference-architecture (resolution)

**Wire-level decision**: the envelope carries `{ credential_uri, version, provider, required_scope }` *references*, not credential material. The wire commitment is "the gateway and intermediate hops never see secret bytes."

**Reference-architecture decision**: agent-side resolution against local Vault or local K8s Secret. Other agent implementations could resolve from a different secret store; the wire does not require Vault.

**Authorization clarification** (sharpened in v0.1 in response to early review). The wire decision shifts the secret-handling problem to the agent — *who authorizes the agent to dereference this credential, and how is scope enforced*? The protocol commits to:
  - **Credential reference authorization**: dereference is policy-evaluated locally with the same OPA/CEL engine as call execution; the policy input includes `(actor, schema_uri, credential_uri, required_scope, current_cluster_state)`
  - **Namespace binding**: a `credential_uri` resolves only against the agent's namespace; cross-namespace dereferences are explicit and audited
  - **Scope verification**: the agent rejects scopes broader than `required_scope`; rotation that narrows scope cannot be silently ignored
  - **Rotation failure behavior**: on rotation, the agent retries with the new version once; persistent failure produces a typed error that surfaces to the caller, not a silent fallback to the old version
  - **Audit**: every dereference produces a `CredentialAccess` audit field on the parent `AuditEvent`

**Application to MCP**: an MCP server that needs downstream auth (e.g., `postgres-mcp` reading a database) describes its requirement via `credential_uri = vault://data/postgres-prod?scope=read`. Agent fetches from local Vault or local K8s Secret with the policy and audit hooks above.

### 3.6 Pluggable Certificate Authority (D9) — reference-architecture; mTLS *requirement* is wire

**Wire-level decision**: every gateway↔agent and agent↔gateway hop **must** authenticate with mTLS. End-user identity rides as a signed claim *inside* the envelope, not as a transport header.

**Reference-architecture decision**: a `CAProvider` interface lets operators bring their own CA — dev-only self-signed, cert-manager, Vault PKI, AWS Private CA, etc.

**Lifecycle requirements** (added v0.1 in response to early review — "use mTLS" is table stakes; federation-grade trust needs more):
  - **Identity format**: SPIFFE-style URI is the recommended cluster identity (`spiffe://<trust_domain>/cluster/<cluster_name>/agent`); operators can use X.509 SAN/CN equivalents but SPIFFE is the canonical form for cross-domain trust mapping.
  - **Trust-domain boundaries**: a federation MAY span multiple SPIFFE trust domains; each gateway records the trust domain on the audit record, and policies can deny across-domain calls.
  - **Issuance**: bootstrap via the `CAProvider`; agent identity refresh is automated (cert-manager-style) on a configurable schedule (default: 24h).
  - **Rotation windows**: certs are short-lived (recommended: ≤24h); long-lived certs are rejected by the gateway.
  - **Revocation**: the protocol does not require CRL/OCSP because cert TTL is short, but operators with stricter requirements can plug in either; the audit record carries a `cert_serial` field for incident response.
  - **Compromised-cluster isolation**: a cluster's cert and SPIFFE identity must be revocable independently of other clusters; the gateway maintains a deny-list keyed on `spiffe_id` that takes effect within one heartbeat window.

These lifecycle commitments are normative for any deployment that claims to implement the protocol with federation-grade trust. v0.0 understated this; v0.1 makes it explicit.

---

## 4. Reference architecture

```
   Cluster B (caller)                          Cluster A (callee)
   ─────────────────                           ─────────────────

   ┌─────────────┐                             ┌─────────────┐
   │  AI agent   │                             │ MCP server  │
   │ (kagent /   │                             │ (postgres-  │
   │  external)  │                             │  mcp /      │
   └──────┬──────┘                             │  github-mcp)│
          │ MCP tools/call                     └──────┬──────┘
          ▼                                           ▲
   ┌─────────────┐                             ┌──────┴──────┐
   │ local       │                             │ local       │
   │ agentgateway│                             │ MCP runtime │
   │ (Solo.io /  │                             │ (kagent /   │
   │  Higress /  │                             │  in-pod)    │
   │  kgateway)  │                             └─────────────┘
   └──────┬──────┘                                    ▲
          │ envelope                                  │
          │ (schema_uri + payload)                    │ dispatch
          ▼                                           │
                       ╔══════════════════╗           │
   long-haul mTLS  ──→ ║  Federation      ║ ──→ long-haul mTLS to
                       ║  Gateway         ║      cluster A's federation agent
                       ║  (this protocol) ║
                       ╠══════════════════╣
                       ║  Durable Queue   ║
                       ║  Audit DB        ║
                       ║  Policy Engine   ║
                       ║  CA Provider     ║
                       ╚════════╤═════════╝
                                │ all gateway hops audited
                                ▼
                       ┌──────────────────┐
                       │ Audit Store      │ ← compliance queries land here
                       │ (Postgres / S3 / │
                       │  whatever)       │
                       └──────────────────┘
```

### 4.1 Call flow — concrete

A platform engineer asks an agent in cluster B: *"How many pods are crashlooping in tenant-x?"*

1. **Agent → local agentgateway** (in cluster B). MCP `tools/call` with tool=`kubernetes-mcp/list-pods`, arguments=`{namespace: "tenant-x", status: "CrashLoopBackOff"}`. The agentgateway recognizes the tool reference points to a federated MCP server (it's not local to cluster B).
2. **Local agentgateway → federation gateway**. Sends the call as an envelope: `schema_uri=mcp://tools/call/v1.0`, payload-bytes carry the MCP `CallToolRequest`. mTLS to gateway. End-user identity ride as a signed JWT claim inside the envelope.
3. **Federation gateway**: validates mTLS, reads the envelope, dispatches central policy (OPA/CEL): *is this user, calling this tool, against this target, allowed?* If not → 403 with policy-decision-id; audit event written.
4. **Federation gateway → durable queue**: write `OperationDispatch{call_id, target=cluster-a/kubernetes-mcp, ...}`. The agent in cluster A is dialed-out (long-poll); it picks up the dispatch.
5. **Federation agent (cluster A) → local MCP server**. Validates local policy (OPA/CEL): *is this call safe right now?* (e.g., reject during maintenance windows even if central policy allows.) If allowed → forward to the local MCP runtime; receive result.
6. **Federation agent → federation gateway**: returns `OperationResult` with hash-chained `AgentEvidence` proving execution. Long-haul mTLS.
7. **Federation gateway**: combines its own dispatch record with the agent evidence into a single `AuditEvent`. Writes to audit store. Forwards result.
8. **Federation gateway → local agentgateway → agent → user**.

Total round-trips on the wire: agent↔local gateway (1), local gateway↔federation gateway (1), federation gateway↔federation agent (1, via durable queue). Agent only sees the abstraction "MCP call returned." The federation is invisible to the agent code.

### 4.2 Identity propagation

End-user identity rides as a **signed claim inside the envelope**, not as an HTTP header. Reasons:

- HTTP headers are stripped or rewritten at many L7 hops in cloud-native infrastructure (ingress controllers, service meshes, gateways). A protocol that depends on header preservation breaks under realistic deployment topologies.
- Cluster identity (mTLS peer) and end-user identity are different facts; conflating them at the transport layer makes audit ambiguous.

**Identity model** (sharpened in v0.1):

- **Issuer trust** — the federation gateway maintains an explicit IdP allow-list (`{issuer_url, jwks_uri, audience_required}`); JWTs from non-allow-listed issuers are rejected. Multi-IdP federation deployments are explicitly supported (different tenants can use different IdPs).
- **Audience binding** — every JWT must carry a federation-specific `aud` claim that names the federation's gateway service identity; tokens minted for some other service cannot be replayed against the federation gateway.
- **Subject format** — user identity is `{issuer, subject, email_claim_if_present}`; the audit record carries all three so log queries by email or by subject both work.
- **Delegation chain** — when an agent acts on behalf of a user, the envelope can carry both an agent identity claim and an `act` claim referencing the originating user (RFC 8693 token-exchange semantics). The audit record records both.
- **Tenant isolation** — a federation can be sliced into tenants; cross-tenant calls require explicit grant in central policy.
- **Expired/revoked tokens** — JWT validation includes `exp` enforcement; revocation is JWT-cache-busted on a configurable cadence (default: 60s) and operators with stricter requirements can plug in introspection (RFC 7662).

The audit record carries cluster identity (from mTLS peer SPIFFE ID) and user identity (from the JWT claim) as separate fields, never collapsed.

### 4.3 Cross-cluster network topology

Federation gateway and federation agents communicate via long-poll over HTTPS (mTLS). The agent dials out to the gateway; the gateway never initiates a connection to the agent. This is friendly to NAT, restrictive firewalls, and private clusters with no inbound exposure — the same topology pattern OCM's `cluster-proxy` adopts.

**Latency, delivery, and failure semantics** (added v0.1):
  - **Long-poll timeout**: agent issues `GET /dispatch/poll` with `?timeout=30s`; gateway responds when work is available or when the timeout fires (whichever first).
  - **Reconnect on disconnect**: agent reconnects with backoff (default: 100ms, jitter, capped at 5s); the durable queue holds dispatch records during the gap.
  - **Delivery guarantee**: at-least-once with call_id idempotency (see §3.4); duplicates surface to the agent's policy/dedup layer, not the user.
  - **Backpressure**: gateway returns 429 with retry-after when the durable queue is at watermark; agents back off; central policy can degrade gracefully (deny-fast for low-priority traffic).
  - **Latency characterization**: at low traffic, long-poll adds ≤ poll-interval-jitter to tail latency vs WebSocket. At higher traffic, long-poll latency is dominated by queue dwell time. We deliberately do not state a milliseconds-level claim until the M2 benchmark exists.

The choice of long-poll over WebSocket is deliberate: long-poll survives nearly every HTTP intermediary (corporate proxies, AWS NAT, GCP Cloud Armor); WebSocket survives most but not all. We accept measurably-higher tail latency at low traffic in exchange for "if HTTP works, federation works."

---

## 5. Trust model

### 5.1 Boundaries

```
| Trust boundary       | Crossed when                      | Authenticated by              |
|----------------------|-----------------------------------|-------------------------------|
| Agent → local gw     | local request                     | local cluster RBAC            |
| Local gw → fed gw    | leaving cluster                   | mTLS (cluster cert)           |
| Fed gw → fed agent   | leaving control plane             | mTLS (cluster cert)           |
| Fed agent → MCP      | local call, in-cluster            | local SA token / network pol  |
| End-user → all hops  | every hop                         | JWT in envelope               |
```

### 5.2 Adversaries explicitly considered

The threat model in [`threat-model.md`](./threat-model.md) is STRIDE-style across the seven trust boundaries. Briefly:

- **Compromised agent**: cannot forge gateway audit (gateway authors); cannot escalate beyond its agent identity (mTLS cert is per-cluster); can fabricate `OperationResult` but agent evidence chain prevents replay/tampering being undetected.
- **Compromised gateway**: bad. Mitigations: gateway is the audit author, so a compromised gateway can backdate or omit records, but agent evidence (hash-chained, signed at agent) creates a corroborating record outside the gateway's control. Detection of audit tampering relies on agent evidence reconciliation.
- **Compromised CA**: bad. Mitigations: short-lived certs, `CAProvider` interface lets operators rotate CA without touching gateway code, ability to use external CA (cert-manager, Vault PKI) reduces blast radius.
- **MITM on mTLS**: requires CA compromise. See above.
- **Replay of envelopes**: each envelope has a `nonce` and `not_before`/`not_after` window; gateway rejects replayed nonces.

The threat model is a v0.1 deliverable and will be re-reviewed before any Sandbox application.

### 5.3 Compliance-relevant guarantees

The protocol is designed to **support audit-evidence collection** rather than to certify any specific compliance program. We deliberately do not claim FedRAMP, HIPAA, or PCI compatibility — those certifications attach to deployments, not protocols, and require evidence (retention policy, access controls, evidence export, tenant separation, audit-store hardening) the protocol alone cannot supply.

What the protocol does provide that compliance programs typically rely on:

- **Auditability**: every call has a single canonical record. No stitching across N cluster audit logs. Audit store is append-only and tamper-evident (Merkle-style hash chain across records, with periodic external anchoring per §3.2).
- **Identity propagation**: end-user identity rides every hop. "Who actually invoked this" is answerable from the audit record alone.
- **Policy decision capture**: every allow/deny includes the policy version, the rule ID, and the evaluation context. Compliance can replay decisions historically against stored input.
- **Credential boundary clarity**: secret material never crosses a federation hop; only references do.

These four guarantees are not novel individually. The protocol's contribution is *carrying all four* on a single typed wire designed for cross-cluster agent traffic.

**Explicitly out of scope for the protocol** (operator responsibilities for any specific compliance program): audit-store retention policy, evidence-export workflow, tenant-isolation enforcement at the storage layer, FIPS-mode crypto bindings, BCP/DR for the audit store, and personnel-access audit on the gateway control plane. Future companion documents may map protocol features onto specific compliance-control catalogs; that work has not been done.

---

## 6. Adoption — how a cluster joins federation

### 6.1 What the operator does

```
1. Pick a federation gateway location (typically a separate "control" cluster
   or a managed service). Deploy the gateway binary; configure CA, durable
   queue backend, audit store.

2. For each member cluster:
   a. Deploy the agent binary as a Deployment with a long-poll connection
      to the gateway. Mount the cluster's mTLS cert (issued by gateway's CA
      or external CA).
   b. Configure the local agentgateway (Higress / kgateway / Solo.io) with a
      "federated tools" route that proxies to a sidecar this protocol provides.
      Sidecar speaks MCP locally and protocol-envelope upstream.
   c. Define the MCP servers the cluster contributes. Annotate them so the
      agent registers them with the federation gateway.

3. Configure central policy in the gateway. Configure local policies in
   each cluster's agent. Both expressed in OPA Rego or CEL.

4. Done. Agents in any member cluster can now invoke any registered MCP
   server in any other member cluster, with single-source identity, audit,
   and policy.
```

### 6.2 Migration story

This protocol is intended to be additive to existing infrastructure. An organization can:

- Start with one cluster federated → not-federated. The agent calls just go to the local gateway; the federation gateway is unused.
- Add a second cluster's MCP servers to the federation gateway's registry. Agents in cluster 1 can now call tools in cluster 2. The original local-only path still works (incremental adoption).
- Add federation policy. Existing local policies are unchanged (policy is layered, not replacing).
- After ≥12 months of federation use, optionally rip out per-team federation hacks (manual kubeconfig sharing, tool-by-tool VPN tunnels, etc.) that the protocol obviates.

There is no day-zero rip-and-replace. There is no client-library lock-in (agents speak MCP; the federation is invisible to the agent code).

**Bounded migration risk**, *not* zero. Adopting any new gateway, sidecar, identity-propagation layer, and policy point introduces operational risk:
  - **Deployment complexity**: an extra mTLS-fronted gateway service to operate, monitor, and patch
  - **Identity boundary**: a new audience on issuer JWTs; misconfiguration here causes denied calls until corrected
  - **Policy boundary**: introducing central policy alongside existing local policy creates a new failure mode (central deny on a previously-allowed path) — this is detectable and fixable but real
  - **Failure isolation**: federation-gateway outage stops new federated dispatches; in-flight calls drain via the durable queue, but new traffic blocks. Operators should treat the federation gateway as a Tier-0 control-plane component
  - **Rollback**: removing federation reverts each cluster to its local-only state in one config change; the federation agent is a long-poll client and its disappearance is a no-op for local traffic

We name these explicitly because v0.0's "zero migration risk" framing was indefensible.

---

## 7. Roadmap

### 7.1 Prototype state — what exists today

The current state is **prototype evidence**, not production maturity. Do not read the items below as adoption signal.

- **HTTP+JSON MVP gateway and agent** (`core/gateway`, `core/agent`): a Go-language proof-of-concept that has executed an end-to-end agent→gateway→agent→adapter flow against one internal Kubernetes cluster (`rlqa-usw2-dev01`) on 2026-04-13. This proves the wire shape compiles and a single happy-path call succeeds; it does not prove production readiness, multi-cluster correctness, sustained throughput, failure handling, or any property a production deployment would require.
- **One reference adapter** (`core/adapters/k8sgetpods`): a single read-only K8s `list pods` adapter. This validates one schema; it does not validate the schema-trust model, multi-schema interaction, or non-K8s adapters.
- **Pluggable interfaces** for `DurableQueue` (in-memory + an unfinished SQLite implementation, crash-safety target M1.5) and `CAProvider` (self-signed dev only — production CAProvider implementations for cert-manager and Vault PKI are M1.4).
- **10 design specifications** (`core/protocol/docs/`) covering state machine, identity lifecycle, policy placement, audit storage, credential references, concurrency, network topology, schema distribution, threat model, and architectural relationship to OCM. These are decision records; ratification across the named issues from §3 (schema trust, attestation channel, policy interop schema, lifecycle requirements) is M1.6.
- **CNCF governance scaffolding** (Apache 2.0, GOVERNANCE.md, MAINTAINERS.md, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md). MAINTAINERS.md currently names one person from one organization. This is not adoption signal; it's a scaffolding milestone.

**Repeatability**: a self-contained `make demo-up` flow (M1.3 deliverable) is required so external reviewers can reproduce the demo end-to-end. Until that lands, the "verified" claim is the authors' word; readers should weigh it accordingly.

**Multi-cluster results**: none yet. The named cluster is one cluster running both the gateway and the agent in different namespaces. M1.9 commits to a multi-cluster proof.

### 7.2 Milestone 1 — public-repo readiness

Tracked in `core/PROJECT.md` Phase 1. Seven deliverables (M1.1–M1.7) plus this whitepaper (M1.8) and a federated reference adapter (M1.9):

| # | Deliverable |
|---|---|
| M1.1 | Ratify D11 (no exec in protocol) + D12 (read-only v1) in a design-doc PR |
| M1.2 | Trademark + npm-name clearance for one of `{opspact, beacon, verdict, kap, convoke, parley, signet, attest, conduit}` |
| M1.3 | Subtree-split `core/` to `gnanirahulnutakki/<name>-mvp` preserving history |
| M1.4 | `CAProvider` impls for cert-manager + Vault (AWS PCA → M2) |
| M1.5 | SQLite `DurableQueue` crash-safety harness |
| M1.6 | One proto PR covering D1 (schema-addressed payload), D3 (version negotiation), D2 (heartbeat rename) |
| M1.7 | Public office hours cadence published; first meeting held even if empty |
| **M1.8** | **This whitepaper, submitted to TAG-Runtime + TAG-Observability Cloud Native AI WG** |
| **M1.9** | **One federated MCP server reference adapter** (e.g., GitHub-MCP or Postgres-MCP invoked from agent in cluster A by user in cluster B with audit + identity flowing through) |

### 7.3 Beyond M1 — gating, not timeline

- **M2**: schema-trust model fixed and ratified (§3.1); attestation channel implemented and audited end-to-end (§3.2); policy-interop schema specification (§3.3); SPIFFE identity issuance under cert-manager and Vault PKI (§3.6); agent-evidence channel hash-chain signing; first conformance test cases. **No Sandbox discussion yet.**
- **M3 — adoption-signal gate**: at minimum, named external design partners (≥2 organizations beyond the initial contributor) running the protocol against real workloads for ≥3 months with named maintainer points-of-contact who agree to be cited. Multi-organization MAINTAINERS.md with at least one external co-maintainer holding commit/review rights. **Sandbox application is *drafted* during M3 only when these are observed reality, not commitments.**
- **M4 — submission**: CNCF Sandbox application submitted, gated on green CLOMonitor, multi-organization governance, observable adoption, and resolved overlap discussion with OCM and any agentgateway-side donor projects. The TOC's published Sandbox criteria are the substantive bar; this section is not a shortcut.
- **M5**: CNCF Sandbox vote.

**No timeline is committed.** Sandbox readiness depends on signals that cannot be self-generated: external maintainer participation, design-partner adoption, community engagement, and resolution of overlap concerns. The authors' best-case planning assumption is "not before 12 months and not after 24 months from this RFC's first community review," but that is planning, not commitment. If the right answer is that this protocol's primitives belong inside an existing CNCF project, the right outcome is to pursue that path, not to push toward an independent Sandbox slot.

---

## 8. Compatibility with adjacent CNCF projects

This protocol is designed to compose, not compete. The compatibility statements below are the authors' design intent. **Engagement status is reported honestly** — most are aspirational and have not been validated through maintainer conversation. We invite each project's maintainers to push back on the rows that misrepresent their scope or roadmap.

| Project | Compatibility intent | Engagement status | Status as of |
|---|---|---|---|
| **kagent** | A kagent-managed agent uses MCP locally exactly as it does today. When the tool reference points to a federated server, the local kgateway / agentgateway forwards through this protocol's local sidecar. kagent itself unaware. | Not yet engaged. No issue, no PR, no maintainer conversation. | 2026-04-25 |
| **agentgateway** (Solo.io) | The same MCP/A2A traffic this gateway shapes inside one cluster crosses cluster boundaries via this protocol unchanged. agentgateway's session fan-out, bidirectional SSE, and per-agent tenancy continue to work. | Not yet engaged. Donation-in-progress; needs maintainer conversation about composition vs absorption. | 2026-04-25 |
| **agentregistry** (Solo.io) | Registries answer "what MCP servers / agents / skills exist." This protocol answers "how to invoke them across cluster boundaries." A federated registry entry is just `{registry_uri + cluster_locality_hint}`. | Not yet engaged. | 2026-04-25 |
| **agentevals** (Solo.io) | Orthogonal. An eval that calls an MCP server traverses the protocol like any other call. | Not yet engaged. | 2026-04-25 |
| **Higress** | Identical posture to agentgateway. Federation is layered on top of single-cluster gateway, not replacing it. | Not yet engaged. | 2026-04-25 |
| **llm-d** | Orthogonal at the wire level (different traffic class) but composable. An agent can invoke an MCP server hosted in a cluster running llm-d-served models; the model serving and the agent action live on different protocols. | Not yet engaged. | 2026-04-25 |
| **agent-sandbox** (k8s-sigs) | This protocol's federation agent runs as a Pod, possibly using `agent-sandbox`'s lifecycle CRD. Compatible by composition. | Not yet engaged. | 2026-04-25 |
| **OCM** | OCM's `cluster-proxy` could be used as the long-haul transport instead of direct mTLS; this is a deployment choice, not a protocol decision. *See §2.3 for fuller treatment.* | Not yet engaged. **Highest-priority engagement** — overlap with `cluster-proxy` is the most likely "this should be inside an existing project" critique and must be resolved before any Sandbox path. | 2026-04-25 |
| **MCP authorization spec** (Anthropic) | This protocol carries MCP traffic and respects the MCP authorization model on the agent ↔ MCP-server hop; the federation layer adds a separate identity layer for the user ↔ agent and agent ↔ gateway hops. | Not yet engaged. Should be coordinated as MCP itself evolves. | 2026-04-25 |

The "Not yet engaged" rows are the project's unfinished homework. M1 includes an engagement step — at minimum, a public issue or design discussion in each project's repo asking "is the table above wrong about your scope?" — before any positioning that depends on those compatibility claims being load-bearing.

---

## 9. Open questions for community discussion

This RFC raises questions where the authors have a leaning but explicitly want TAG-AI / CNAIWG input before fixing the answer. Earlier rounds of review pushed schema trust, attestation, policy interop, and lifecycle requirements *out* of this section into the spec body (§3.1, §3.2, §3.3, §3.6); what remains here are the genuinely-open design choices.

1. **Schema distribution mechanism**: §3.1 names three candidate trust models for `schema_uri` (OCI-anchored, maintainer-signed catalog, TOFU+revocation). The authors lean toward OCI-anchored. *Which is right for cloud-native?*
2. **Cross-protocol envelope versioning under fleet drift**: when MCP itself ships v1.1, how does the federation handle a mixed fleet (some clusters on v1.0, some on v1.1)? D3 covers wire-version negotiation; application-layer (MCP) version negotiation in a federated topology is unsolved.
3. **A2A vs MCP envelope unification**: the protocol carries both today, but should they share schema namespace conventions or remain independent? *Open.*
4. **Conformance testing scope**: what's the minimum reference suite an implementation must pass to claim "speaks the protocol"? Per-feature pass/fail, or a single "v0.1 conformant" bar?
5. **OCM `cluster-proxy` integration depth**: should the protocol *recommend* `cluster-proxy` as the long-haul transport when available, *require* it for OCM-environment deployments, or remain transport-neutral? *§2.3 frames this; the answer needs OCM-maintainer input, not authorial choice.*
6. **Belongs-elsewhere question**: should the primitives in §3 (typed envelope, canonical audit, dual policy, schema versioning) be donated to an existing project rather than become a new project? Specifically: agentgateway upstream, kagent upstream, OCM as a `cluster-proxy` extension, or a new MCP-side spec? *This is a real and appropriate question.*

The authors are intentionally short on prescriptions here. These should be decided in public, with the community.

---

## 10. References

- TOC initiative #1746 — *Cloud-Native Foundations for Distributed Agentic Systems*: https://github.com/cncf/toc/issues/1746
- CNCF Cloud Native AI Working Group: https://tag-runtime.cncf.io/wgs/cnaiwg/charter/
- CNCF Cloud Native AI whitepaper (predecessor): https://tag-runtime.cncf.io/wgs/cnaiwg/whitepapers/cloudnativeai/
- Kubernetes AI Conformance Program: https://www.cncf.io/announcements/2025/11/11/cncf-launches-certified-kubernetes-ai-conformance-program-to-standardize-ai-workloads-on-kubernetes/
- WG-Serving conclusion: https://www.cncf.io/blog/2026/02/26/kubernetes-wg-serving-concludes-following-successful-advancement-of-ai-inference-support/
- llm-d Sandbox announcement: https://www.cncf.io/blog/2026/03/24/welcome-llm-d-to-the-cncf-evolving-kubernetes-into-sota-ai-infrastructure/
- Higress Sandbox announcement: https://www.cncf.io/blog/2026/03/25/higress-joins-cncf-delivering-an-enterprise-grade-ai-gateway-and-a-seamless-path-from-nginx-ingress/
- kagent Sandbox: https://www.cncf.io/projects/kagent/
- Solo.io contributing kagent: https://www.solo.io/blog/bringing-agentic-ai-to-kubernetes-contributing-kagent-to-cncf
- agent-sandbox: https://kubernetes.io/blog/2026/03/20/running-agents-on-kubernetes-with-agent-sandbox/
- KubeCon EU 2026 recap (federation gap commentary): https://www.kubermatic.com/blog/kubecon-eu-2026-recap/
- MCP authorization spec: https://modelcontextprotocol.io/docs/tutorials/security/authorization
- 2025 CNCF Annual Survey: https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
- Open Cluster Management: https://open-cluster-management.io/
- This project's `why-not-ocm.md`: original OCM differentiation argument
- This project's `why-mcp-for-clusters.md`: gap mapping vs current CNCF AI projects
- This project's `PROJECT.md`: full architectural decision list (D1–D22)
- This project's `threat-model.md`: STRIDE threat model across 7 trust boundaries

---

## Appendix A — How to engage with this draft

- **Public repo and issue tracker**: not yet live. Pending M1.2 (name + trademark clearance) and M1.3 (subtree-split from `core/` to a vendor-neutral GitHub organization). The authors will update this section with the URL when ready; until then, **this RFC is not yet positioned for sustained community discussion**, and submitting to TAG-AI / CNAIWG is contingent on the public surface existing.
- **Public office hours**: not yet live. Will be published per M1.7 once the repo is up.
- **Direct contact**: Gnani Rahul, [gnanirahulnutakki](https://github.com/gnanirahulnutakki). Until the public repo is live, direct email or GitHub issue on the author's profile is the only feedback channel.
- **TAG-AI / CNAIWG submission**: deferred until the public engagement surface is live and at least one external maintainer is named. Submitting an RFC under those conditions to a CNCF TAG would be premature.

**Disagreement is welcome.** Especially disagreement that comes with a counter-proposal. Especially disagreement that says "this belongs inside an existing project."
