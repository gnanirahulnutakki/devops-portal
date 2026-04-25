# Why MCP-for-Clusters

**Added 2026-04-25** as part of the strategic pivot from "generic multi-cluster day-2 protocol" to "MCP federation across clusters."

## The gap, named by CNCF

[TOC initiative #1746](https://github.com/cncf/toc/issues/1746) — *Cloud-Native
Foundations for Distributed Agentic Systems* — is an *accepted* CNCF TOC
initiative. Its deliverables list, in writing, the gaps the foundation is asking
the community to fill:

| Gap (verbatim from #1746) | Status | Incumbent |
|---|---|---|
| **MCP-for-Clusters** — auth, discovery, streaming | spec proposal pending | **none** |
| **Agent CRD** — fleet-level schema + lifecycle | spec proposal pending | none at fleet scale |
| **AgentMemory API** — memory abstraction | project pending | **none** |
| **AgentBench-CN** — benchmarking | project pending | none |
| **Observability spec** — minimum OTel schema for autonomous behavior | spec pending | **none** |
| **Policy CRDs** — Kyverno/Gatekeeper for autonomy | spec pending | **none** |

The three gaps marked with **none** as incumbent are the highest-leverage targets.
We are positioning the protocol against the **MCP-for-Clusters** gap directly.

## Where current CNCF Sandbox AI projects already fit

| Project | Maturity | Scope | Overlap with us |
|---|---|---|---|
| **[llm-d](https://www.cncf.io/blog/2026/03/24/welcome-llm-d-to-the-cncf-evolving-kubernetes-into-sota-ai-infrastructure/)** | Sandbox 2026-03-24 | Distributed LLM **inference** | None — they serve models, we federate tool invocations |
| **[Higress](https://www.cncf.io/blog/2026/03/25/higress-joins-cncf-delivering-an-enterprise-grade-ai-gateway-and-a-seamless-path-from-nginx-ingress/)** | Sandbox 2026-03-25 | **Single-cluster** AI-native gateway (Envoy/Istio) | Adjacent — they own ingress to one cluster's models; we own cross-cluster MCP traffic |
| **[kagent](https://www.cncf.io/projects/kagent/)** | Sandbox 2025-05-22 | **In-cluster** runtime for AI agents acting on cloud-native infra | Adjacent — they run agents inside a cluster; we federate the calls those agents make across clusters |
| **agentgateway** (Solo.io) | being contributed | **Single-cluster** HTTP/gRPC proxy with MCP + A2A protocol awareness | Adjacent + load-bearing — agentgateway handles in-cluster MCP traffic; we extend it to cross-cluster |
| **agentregistry** (Solo.io) | donation in progress | Catalog of agents, MCP tools, agent skills | Complementary — registries answer "what exists"; we answer "how to call it across boundaries" |
| **agentevals** (Solo.io) | open-source | Standardizing agent evaluation | Orthogonal |
| **[agent-sandbox](https://kubernetes.io/blog/2026/03/20/running-agents-on-kubernetes-with-agent-sandbox/)** (sigs) | k8s SIG | **Single-pod** stateful agent lifecycle CRD | We don't compete; we federate at a layer above |

The territory each owns is clearly mapped. The federation slot — *one MCP server
in cluster A invoked by an agent in cluster B with central audit, identity, and
policy* — is unclaimed.

## What "federation" means in this protocol's terms

Concretely, a federated MCP call traverses:

```
agent (cluster B)
  ─→ local agentgateway (Higress / kgateway / our own)
     ─→ this protocol's gateway (running anywhere)
        ─→ this protocol's agent (cluster A, dialed-out)
           ─→ MCP server (cluster A)
                ─→ result back upstream
```

At each hop, this protocol contributes:

1. **Typed envelope** — schema-addressed payload (D1) carries an MCP request as
   `schema_uri = mcp://tools/call/v1.0` + `payload_digest` + `bytes`. Every
   intermediate node can validate the schema reference without knowing the
   tool's implementation.

2. **Identity propagation** — agent and end-user identity are signed claims
   on the envelope, not request headers. mTLS at every hop proves cluster
   identity; in-envelope claims prove user identity. Survives N hops.

3. **Canonical audit** — gateway authors a single auth/dispatch/result tuple
   per call. `who → what → where → outcome` lives in one record, not
   distributed across N cluster audit logs that have to be joined out-of-band.

4. **Dual policy** — central OPA/CEL gate at the federation gateway (pre-dispatch,
   "is this call even allowed?") + local OPA/CEL gate at the agent
   (pre-execution, "given local context, can this run?"). Either can deny;
   both reasons go in the audit record.

5. **Credential reference semantics** (D8) — secrets stay where they were
   minted. The protocol carries `credential_uri + version + provider` references
   that the agent dereferences locally. Useful for MCP servers that need
   downstream auth (databases, APIs).

6. **Pluggable durability** (D7) — In-memory + SQLite for dev/edge, BadgerDB
   or external broker for production. Lets a federation deployment pick its
   durability/cost trade-off.

## What MCP federation does NOT do

Critical to keep this list short and explicit:

- **Not an MCP server runtime.** The protocol carries MCP traffic; it does
  not host MCP servers. Run those in agentgateway, kagent, or kubernetes-sigs/agent-sandbox.
- **Not a model server.** llm-d owns that.
- **Not a registry.** agentregistry owns that.
- **Not a single-cluster gateway.** Higress and kgateway own that.
- **Not an evaluator.** agentevals owns that.
- **Not a memory backend.** That's a separate gap (#1746 lists it as
  "AgentMemory API" — open for someone else to fill).

## Why this answers the TOC's "OCM rejection precedent" concern

CNCF TOC has rejected projects that overlap with OCM ([OpenChoreo #442,
CrossView #460](https://github.com/cncf/toc/issues)). The original
"day-2 actions" framing fought OCM head-on (OCM has `ManifestWork` for
declarative state and `Pushing-Kube-API-Requests` for imperative ops; the
overlap was real and the differentiation argument was load-bearing in
`why-not-ocm.md`).

The MCP-for-Clusters reframe **eliminates the OCM overlap question.** OCM does
not address MCP traffic at all. There is no other CNCF project that does.
The differentiation argument shifts from "we are different from OCM" to
"we extend the cloud-native fabric to a wire protocol OCM does not address."

That argument is structurally easier to win at TOC review.

## Implications for the v0.1 wire freeze

The wire decisions ratified before this pivot still stand:

- D1 schema-addressed payload ✓ (lets `schema_uri` carry MCP version + tool name)
- D2 heartbeat rename ✓
- D3 version negotiation ✓ (MCP versions negotiate alongside protocol version)
- D5 gateway-authored audit ✓
- D6 standalone Go binary ✓
- D7 pluggable durable queue ✓
- D8 credential reference semantics ✓
- D9 CAProvider with external CA ✓
- D11 no `kubectl exec` in protocol ✓ (also: no MCP `tools/call` for shell-like tools without explicit policy approval)
- D12 read-only v1 ✓
- D13 public repo from M1 ✓
- D14 concurrency semantics ✓
- D15 network topology ✓
- D16 schema distribution ✓ (now applies to MCP tool schemas too)

**No new wire decisions are introduced by the pivot.** The protocol primitives
were always sufficient for MCP federation; the pivot is in framing and target
gap, not in technology.

## What changes in M1 deliverables

Per the existing M1 plan in `PROJECT.md`:

| Deliverable | Original | After pivot |
|---|---|---|
| M1.1 — Ratify D11 + D12 | unchanged | unchanged |
| M1.2 — Trademark-clear a name | unchanged | unchanged |
| M1.3 — Public-repo extraction | unchanged | unchanged (target name TBD) |
| M1.4 — External CA backends | unchanged | unchanged |
| M1.5 — DurableQueue SQLite crash-safety | unchanged | unchanged |
| M1.6 — v0.1 wire freeze proposal | unchanged | unchanged |
| M1.7 — Public office hours | unchanged | unchanged |
| **M1.8 (new)** — Whitepaper | "Foundations for Multi-Cluster Day-2 Action Protocol" | **"Foundations for Multi-Cluster MCP Federation"** — submitted to TAG-Runtime + TAG-Observability under [Cloud Native AI WG](https://tag-runtime.cncf.io/wgs/cnaiwg/) |
| **M1.9 (new)** — Reference adapter | k8s-get-pods only | **k8s-get-pods + 1 federated MCP server** (e.g., GitHub-MCP or Postgres-MCP invoked from agent in cluster A by user in cluster B) |

## Cross-references

- TOC initiative #1746 (the gap): https://github.com/cncf/toc/issues/1746
- TAG-AI / Cloud Native AI WG charter: https://tag-runtime.cncf.io/wgs/cnaiwg/charter/
- KubeCon EU 2026 recap on agent infra: https://www.kubermatic.com/blog/kubecon-eu-2026-recap/
- MCP authorization spec: https://modelcontextprotocol.io/docs/tutorials/security/authorization
- This project's `why-not-ocm.md` — argues the original day-2 framing
- This project's `PROJECT.md` — front matter updated 2026-04-25 with the pivot
