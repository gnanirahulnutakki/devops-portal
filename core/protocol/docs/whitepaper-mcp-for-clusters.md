# Foundations for Multi-Cluster MCP Federation

A typed protocol for cross-cluster Model Context Protocol traffic with central audit, identity, and policy.

| | |
|---|---|
| **Status** | Draft v0.1 — 2026-04-25 |
| **Audience** | CNCF TAG-Runtime, TAG-Observability, Cloud Native AI Working Group, TOC reviewers |
| **Working name** | TBD_PROJECT_NAME (trademark-clearance pending) |
| **Authors** | Gnani Rahul ([gnanirahulnutakki](https://github.com/gnanirahulnutakki)) — lead. Co-maintainer cultivation in progress per `core/PROJECT.md` Phase 1 plan. |
| **Affiliation** | RadiantLogic (initial contributor; vendor-neutrality posture per CNCF guidance) |
| **License** | Apache 2.0 (manuscript and reference implementation) |
| **Replaces** | Original framing in `core/PROJECT.md` (pre-pivot, "multi-cluster day-2 actions"). Pivot rationale in `core/protocol/docs/why-mcp-for-clusters.md`. |

---

## Abstract

Model Context Protocol (MCP) is settling as the de facto wire for agent-to-tool and agent-to-agent communication, with single-cluster traffic handling already addressed by [Higress](https://higress.cn/), [agentgateway](https://agentgateway.dev/), and similar gateways. **Federation across clusters and across heterogeneous backends is unaddressed**: there is no standard way for an agent in cluster *A* to invoke an MCP server hosted in cluster *B* with single-source identity, single-record audit, and central-plus-local policy. CNCF TOC initiative #1746 ("Cloud-Native Foundations for Distributed Agentic Systems") names this gap explicitly as *MCP-for-Clusters* and lists no incumbent.

This whitepaper proposes a typed wire protocol that fills exactly that slot. The protocol is intentionally narrow: it does not run agents, host MCP servers, serve models, edit Kubernetes manifests, or replace existing service meshes. It carries one class of traffic — typed agent operations, primarily MCP and A2A — across cluster and trust boundaries. Its primitives are a schema-addressed opaque payload, a gateway-authored canonical audit record, dual OPA/CEL policy placement, pluggable durable queues, and pluggable certificate authorities. A reference implementation in Go has shipped end-to-end against a real Kubernetes cluster as a proof of protocol shape; v0.1 wire freeze is in progress.

The contribution is one wire that lets every cloud-native AI project — kagent, llm-d, Higress, agentgateway, agentregistry, agent-sandbox — compose into a federated whole instead of forcing each integration to invent its own cross-cluster story.

---

## 1. Problem statement

Three trends collide in 2026:

**Trend 1 — Kubernetes is the AI platform.** 82% of organizations run AI workloads on Kubernetes per the [2025 CNCF Annual Survey](https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/). The Kubernetes AI Conformance Program ([launched November 2025](https://www.cncf.io/announcements/2025/11/11/cncf-launches-certified-kubernetes-ai-conformance-program-to-standardize-ai-workloads-on-kubernetes/)) codified Kubernetes AI Requirements (KARs); WG-Serving [concluded successfully](https://www.cncf.io/blog/2026/02/26/kubernetes-wg-serving-concludes-following-successful-advancement-of-ai-inference-support/) with the inference battle won at the infrastructure layer. The platform fight is over; the protocol fight is starting.

**Trend 2 — MCP is winning the agent-tool wire.** Anthropic's Model Context Protocol has, in the words of the [KubeCon EU 2026 recap](https://www.kubermatic.com/blog/kubecon-eu-2026-recap/), *"appeared in sessions across every track"* and is being treated by infrastructure teams as the standard agent-tool wire in 2026. Adjacent specifications (A2A for agent-to-agent, agent skills for capability advertising) are converging on the same envelope shape.

**Trend 3 — Multi-cluster is now the typical Kubernetes deployment.** Fleet management (OCM, Karmada, KubeStellar), workload distribution (ApplicationSet, Fleet), and inference scaling (llm-d) all assume the operator is running multiple Kubernetes clusters. The single-cluster assumption that defined cloud-native through 2023 is no longer load-bearing.

Where these three meet, an architectural gap appears: **agents in cluster A want to call MCP servers in cluster B with the same identity, audit, and policy guarantees they would have inside one cluster**. Today, every integration that needs this — Argo CD addons calling agent tools, ML pipelines invoking inference servers in foreign regions, security agents pulling logs from sister clusters — has to invent its own cross-cluster auth, its own audit-stitching, its own policy placement. The result is a dozen incompatible federation layers, each with its own breach surface.

**A successful federation protocol is the single thing missing.** Define it once, and every cloud-native AI project plugs in.

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

The pattern is unmistakable: every adjacent project terminates at the cluster boundary or stays below it. **No CNCF project addresses cross-cluster MCP federation today.**

### 2.3 Why this is structurally distinct from OCM

[Open Cluster Management](https://open-cluster-management.io/) (CNCF Incubating) addresses *declarative state synchronization* across clusters via `ManifestWork` and *imperative API push* via `Pushing-Kube-API-Requests`. OCM's wire is the Kubernetes API server. This protocol's wire is MCP/A2A. Different traffic, different control plane, different trust model. The full architectural justification is in [`why-not-ocm.md`](./why-not-ocm.md); the short form is in [`why-mcp-for-clusters.md`](./why-mcp-for-clusters.md).

The reframe from earlier project framing ("multi-cluster day-2 actions") to current framing ("MCP-for-Clusters") was made specifically to eliminate the OCM overlap question. OCM does not address MCP traffic. There is no overlap.

---

## 3. Protocol primitives

The protocol is defined by six primitives. Each was decided independently of the MCP-for-Clusters application before the 2026-04-25 pivot; their suitability is not a coincidence — these are the primitives that any cross-cluster typed-RPC protocol needs.

### 3.1 Schema-addressed opaque payload (D1)

**Decision** (ratified 2026-04-11, see `core/PROJECT.md`): the wire envelope is `{ schema_uri: string, payload_digest: bytes, payload: bytes }`.

**Why**: a centralized type registry creates governance friction (who owns the registry?) and slows adapter evolution (every new tool needs a registry entry). Schema-addressed payload defers schema knowledge to the endpoints that actually need it. Intermediate hops (gateways, agents) validate `schema_uri` against an allow-list and `payload_digest` against the bytes; the type itself is end-to-end.

**Application to MCP**: `schema_uri = mcp://tools/call/v1.0` (or `v1.1`, etc.) carries an MCP `CallToolRequest`. Distinct from `mcp://prompts/get/v1.0`, `mcp://resources/read/v1.0`, A2A schemas, or future agent-skill schemas. Versioning is explicit per-call.

**Adapter independence**: the same wire carries `mcp://`, `a2a://`, custom typed action schemas without protocol changes.

### 3.2 Gateway-authored canonical audit (D5)

**Decision**: the gateway is the sole author of a single `AuditEvent` per call. The agent contributes cryptographic evidence of execution (hash-chained attestations); the gateway combines its own dispatch record with the agent evidence into one canonical record.

**Why**: distributed audit (per-cluster K8s audit logs, per-tool event streams, per-CI run logs) requires out-of-band stitching to answer "who invoked what, and was it allowed." A canonical audit author lets compliance answer that question with one query.

**Application to MCP**: every MCP call becomes one `AuditEvent` with `actor` (signed user identity), `action` (`mcp://tools/call/v1.0/<tool-name>`), `target` (cluster + MCP server), `decision` (allow/deny + policy ref), `outcome` (success/failure + agent evidence). The audit record is keyed on `(orgId, callId, agentEvidenceDigest)`.

### 3.3 Dual OPA/CEL policy placement (load-bearing)

**Decision**: policy evaluates at two points:
1. **Central, gateway pre-dispatch**: "is this caller allowed to invoke this `schema_uri` against this target at all?" — coarse-grained, identity- and target-aware.
2. **Local, agent pre-execution**: "given the local cluster's runtime state, is this specific call safe to execute now?" — fine-grained, runtime-aware (e.g., reject calls during a maintenance window even if gateway policy allows).

**Why**: central-only policy can't know about agent-side conditions (paused rollouts, locked tenants). Local-only policy can't enforce cross-cluster policy ("no break-glass calls without two-person approval"). Both are needed; neither is sufficient.

**Application to MCP**: gateway policy bears on `(actor, schema_uri, target_cluster, target_mcp_server)`. Agent policy bears on `(local_namespace_state, target_object_state, time_window, mcp_tool_args)`.

**Engines**: OPA (Rego) and CEL are both supported per the [Kyverno/Gatekeeper convergence](https://kyverno.io/) on CEL. The protocol does not mandate either; it carries the policy verdict as an envelope field.

### 3.4 Pluggable durable queue (D7)

**Decision**: gateway depends on a `DurableQueue` interface, not a specific durable store. Reference implementations: in-memory (dev), SQLite (single-node prod, [crash-safety target for M1.5](../PROJECT.md#m1)), planned future BadgerDB or external broker (Kafka/NATS/Redpanda) for multi-region.

**Why**: forcing operators to run NATS/Kafka/etc. raises the deployment bar to the point where small teams won't adopt. Pluggable durability with a credible single-node default makes the protocol viable for a 10-cluster shop *and* a 10,000-cluster shop.

**Application to MCP**: durable queue holds `OperationDispatch` records between gateway-accept and agent-poll. Tail latency depends on the chosen backend; correctness does not.

### 3.5 Credential reference semantics (D8)

**Decision**: the wire carries `(credential_uri, version, provider, required_scope)` references, not credential material. Agent dereferences locally; the gateway never holds the dereferenced secret.

**Why**: long-lived secrets in the gateway database are an unbounded breach surface. Reference semantics keep secrets where they were minted.

**Application to MCP**: an MCP server that needs downstream auth (e.g., a `postgres-mcp` server reading from a database) describes its credential requirement via `credential_uri = vault://data/postgres-prod#scope=read`. Agent fetches from local Vault or local K8s Secret. Credential rotation propagates without protocol changes.

### 3.6 Pluggable Certificate Authority (D9)

**Decision**: mTLS at every hop. Gateway is the optional default CA for development; production deployments configure cert-manager, Vault PKI, AWS Private CA, or any other [`CAProvider`](../../gateway/internal/ca/ca.go) implementation.

**Why**: cluster identity is the bedrock of federation trust. mTLS proves the cluster on the other end of a long-haul connection is who it claims to be. Forcing operators to use a vendor-specific CA breaks the vendor-neutral posture; not requiring mTLS at all is a non-starter for production.

**Application to MCP**: every gateway↔agent and agent↔gateway hop is mTLS. End-user identity rides as a signed claim *inside* the envelope, not as a transport header.

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

- HTTP headers are stripped or rewritten at almost every L7 hop in modern infrastructure (ingress controllers, service meshes, gateways). A protocol that depends on header preservation breaks under realistic deployment topologies.
- Cluster identity (mTLS peer) and end-user identity are different facts; conflating them at the transport layer makes audit ambiguous.

Specifically: the envelope contains a JWT-shaped claim signed by the originating identity provider. Each hop validates the JWT against the IdP's published JWKS. The audit record carries both the cluster identity (from mTLS peer) and the user identity (from the JWT claim) as separate fields.

### 4.3 Cross-cluster network topology

Federation gateway and federation agents communicate via long-poll over HTTPS (mTLS). The agent dials out to the gateway; the gateway never initiates a connection to the agent. This is friendly to NAT, restrictive firewalls, and private clusters with no inbound exposure — the same topology pattern OCM's `cluster-proxy` adopts and validates.

The choice of long-poll over WebSocket is deliberate: long-poll survives every HTTP intermediary (corporate proxies, AWS NAT, GCP Cloud Armor); WebSocket survives most but not all. The cost is slightly higher tail latency at low traffic; the benefit is "if HTTP works, federation works."

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

For organizations subject to SOC 2, ISO 27001, FedRAMP, or sector-specific compliance (HIPAA, PCI):

- **Auditability**: every call has a single canonical record. No stitching across N cluster audit logs. Audit store is append-only and tamper-evident (Merkle-style hash chain across records).
- **Identity propagation**: end-user identity rides every hop. "Who actually invoked this" is answerable.
- **Policy decision capture**: every allow/deny includes the policy version, the rule ID, and the evaluation context. Compliance can replay decisions historically.
- **Credential boundary clarity**: secret material never crosses a federation hop; only references do.

These are not novel guarantees individually. The novelty is having all four in a single protocol designed for them.

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

This protocol is additive to existing infrastructure. An organization can:

- Start with one cluster federated → not-federated. The agent calls just go to the local gateway; the federation gateway is unused. **Zero migration risk.**
- Add a second cluster's MCP servers to the federation gateway's registry. Agents in cluster 1 can now call tools in cluster 2. The original local-only path still works. **Incremental adoption.**
- Add federation policy. Existing local policies are unchanged. **Policy is layered, not replacing.**
- After 6–12 months of federation use, optionally rip out per-team federation hacks (manual kubeconfig sharing, tool-by-tool VPN tunnels, etc.) that the protocol obviates.

There is no day-zero rip-and-replace. There is no client-library lock-in (agents speak MCP; the federation is invisible to the agent code).

---

## 7. Roadmap

### 7.1 What has shipped

- HTTP+JSON MVP gateway and agent (`core/gateway`, `core/agent`) — verified end-to-end against `rlqa-usw2-dev01` Kubernetes cluster on 2026-04-13.
- Reference adapter `k8s-get-pods` (`core/adapters/k8sgetpods`) — proves the protocol shape with a real Kubernetes API call.
- Pluggable interfaces for `DurableQueue` (in-memory + SQLite) and `CAProvider` (self-signed dev) in Go.
- 10 design specifications (`core/protocol/docs/`) covering state machine, identity lifecycle, policy placement, audit storage, credential references, concurrency, network topology, schema distribution, threat model, and architectural justification vs OCM.
- CNCF governance scaffolding (Apache 2.0, GOVERNANCE.md, MAINTAINERS.md, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md).

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

### 7.3 Beyond M1

- **M2**: agent-evidence channel hash-chain signing; conformance test suite (M2 candidate: 10 reference adapters across 3+ domains); AWS PCA `CAProvider`; multi-tenancy (D17) shipped.
- **M3**: two design partners running in production for ≥3 months; one external co-maintainer signed up; CNCF Sandbox application drafted.
- **M4**: CNCF Sandbox application submitted (target gate: green CLOMonitor on the public repo, MAINTAINERS.md non-single-vendor, design partners with case studies).
- **M5**: CNCF Sandbox vote.

Timeline is deferred until M1 closes per `core/PROJECT.md`. Honest expectation: 12–18 months from this whitepaper to Sandbox vote, contingent on external adoption signal.

---

## 8. Compatibility with adjacent CNCF projects

This protocol is designed to compose, not compete. Specific compatibility commitments:

- **kagent**: a kagent-managed agent uses MCP locally exactly as it does today. When the tool reference points to a federated server, the local kgateway / agentgateway forwards through this protocol's local sidecar. kagent itself unaware.
- **agentgateway**: the same MCP/A2A traffic this gateway shapes inside one cluster crosses cluster boundaries via this protocol unchanged. agentgateway's session fan-out, bidirectional SSE, and per-agent tenancy continue to work.
- **agentregistry**: registries answer "what MCP servers / agents / skills exist." This protocol answers "how to invoke them across cluster boundaries." A federated registry entry is just `{registry_uri + cluster_locality_hint}`.
- **agentevals**: orthogonal. An eval that calls an MCP server traverses the protocol like any other call.
- **Higress**: identical posture to agentgateway. Federation is layered on top of single-cluster gateway, not replacing it.
- **llm-d**: orthogonal at the wire level (different traffic class) but composable. An agent can invoke an MCP server hosted in a cluster running llm-d-served models; the model serving and the agent action live on different protocols, both running over the federated control plane.
- **agent-sandbox**: this protocol's federation agent runs as a Pod, possibly using `agent-sandbox`'s lifecycle CRD. Compatible by composition.
- **OCM**: orthogonal. OCM's `cluster-proxy` could be used as the long-haul transport instead of direct mTLS; this is a deployment choice, not a protocol decision.

---

## 9. Open questions

This whitepaper is v0.1; the following are explicit unknowns the authors invite the community to weigh in on:

1. **Schema distribution**: how do federation participants discover what `schema_uri` values are valid? A central registry (governance friction) or a decentralized "trust on first use + signature verification" model? See `schema-distribution.md` D16.
2. **Cross-protocol envelope versioning**: when MCP itself ships v1.1, how does the federation handle a mixed fleet (some clusters on v1.0, some on v1.1)? D3 covers wire-version negotiation; the application-layer (MCP) version negotiation needs more design.
3. **A2A vs MCP envelope unification**: the protocol carries both today, but should they share schema namespace conventions? Open.
4. **Conformance testing**: what's the minimum reference suite an implementation must pass to claim "speaks the protocol"? D21 in PROJECT.md.
5. **External adoption gate**: at what concrete number does CNCF TOC consider "external adoption sufficient for Sandbox"? Talking with TOC reviewers directly is part of M2.

The whitepaper is intentionally short on prescriptions for these. They should be decided in public, with the community.

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

- File issues, PRs, or RFCs against the public repo (URL TBD pending M1.3 subtree split + M1.2 trademark clearance).
- Public office hours: weekly, time TBD per M1.7. First meeting will be held regardless of attendance to set cadence.
- TAG-Runtime + TAG-Observability Cloud Native AI Working Group: this whitepaper is being submitted for review per M1.8. Comments via the WG's standard channels (mailing list + meeting agenda).
- Direct contact: Gnani Rahul, [gnanirahulnutakki](https://github.com/gnanirahulnutakki).

Disagreement is welcome. Especially disagreement that comes with a counter-proposal.
