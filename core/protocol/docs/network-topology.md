# Network topology, load balancing, and mTLS (D15)

This document freezes **v0.1** decisions for how the standalone Go **gateway** binary is reached across production networks, where **mTLS terminates**, and how **agent identity** is preserved across hops. It complements the identity spec: identity is established at the TLS layer or an explicitly trusted substitute; this doc maps that to real topologies.

**Prior art contrast.** [OCM](https://open-cluster-management.io/) uses a **hub-side gRPC server** in the control plane; identity is Kubernetes-native. **Here** the gateway is **standalone** (not a controller surface). [Clusternet](https://clusternet.io/) uses **full-duplex WebSockets** child→parent; we use **gRPC streams** with similar outbound posture. [Envoy](https://www.envoyproxy.io/) **Proxy Protocol v2** preserves **original client IP** toward upstream—needed for NLB audit paths.

---

## 1. mTLS termination matrix and identity survival

| Topology | Where mTLS terminates | How agent identity survives |
|----------|----------------------|------------------------------|
| **Direct agent → gateway** (localhost or L3) | At the gateway’s TLS stack | Standard TLS client cert → SPIFFE ID / subject mapping; no intermediaries. |
| **Agent → L4 LB → gateway** (AWS NLB, GCP TCP LB) | **At the gateway** (TCP passthrough) | NLB does not terminate TLS; client cert reaches the gateway. Use **[Proxy Protocol v2](https://www.envoyproxy.io/docs/envoy/latest/configuration/listeners/listener_filters/proxy_protocol)** (Envoy/HAProxy/target) when the LB hides **source IP** for audit. **Client cert identity** is always from the **TLS session at the gateway**, not PPv2. |
| **Agent → HTTP CONNECT proxy → gateway** | **Often at the proxy** for the outer TLS tunnel | If the proxy terminates TLS to the gateway hostname, **mTLS to the gateway is not possible** through that hop. **v0.1:** define **no alternate “join behind CONNECT” wire**. Agents MUST use a network path where they open a **direct TLS socket** to the gateway after CONNECT (CONNECT establishes a byte tunnel; mTLS is then end-to-end inside the tunnel). If the enterprise proxy **inspects or re-signs** TLS, see MITM row. |
| **TLS-intercepting (MITM) proxy** | At the **corporate MITM**, not at the gateway | **mTLS cannot survive** in the cryptographic sense. **v0.1 behavior: fail closed** for the streaming session: agent logs `TLS_HANDSHAKE_FAILED` / `UNTRUSTED_PEER` and does not send action traffic. **No bootstrap downgrade** in v0.1. Operator remediation: **allowlist** the gateway FQDN from interception (or deploy a private PKI trust bundle only on the agent—still fail closed if the presented chain is not the gateway’s). |
| **Allowlisted egress only** | At the gateway | Gateway URL MUST be an **FQDN on the allowlist** (not a raw IP unless the allowlist permits it). Prefer a **single stable hostname** per tenant/environment (e.g. `gateway.<tenant>.example.com:443`). |
| **Air-gapped + local relay** | Conceptually at gateway or relay | **Out of scope for v0.1.** v0.2+ may specify **store-and-forward relays** with explicit trust domains. v0.1 agents in air-gap **cannot** claim conformance. |

---

## 2. L7 proxies (Envoy, HAProxy, NGINX) in front of the gateway

Adopters may place L7 proxies for WAF, rate limiting, or routing. **Normative for v0.1:**

- **Primary identity:** still **client certificate** verified at the **first process that terminates TLS** toward the agent.
- If TLS terminates at **Envoy** (or NGINX/HAProxy), the gateway MUST receive:
  - **`x-forwarded-client-cert`** (XFCC, Envoy style) **or**
  - **`x509_pem`** / documented mutual headers (implementation-specific) **only if** the hop from proxy to gateway is **mTLS or loopback** and the gateway is configured to trust that injection.
- **Proxy Protocol v2** remains valid for **L4** paths; at **L7**, prefer **XFCC** or **SPIFFE** (below).

**SPIFFE / SPIRE (recommended v0.1 capability):** as an **alternative** to raw cert forwarding, the gateway SHOULD accept **[SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/)**-derived identities injected by a local agent or trusted proxy: e.g. Envoy **SPIFFE mTLS** to gateway, gateway maps **SPIFFE ID** → agent identity. This is **not** a second-class path; it is **peer** to presenting an X.509 directly to the gateway where deployment complexity warrants it.

---

## 3. Gateway endpoint topology

- **gRPC surface:** one **gRPC over HTTP/2** service on **TCP** by default.
- **Ports (recommended):**
  - **Agent-facing:** one port exposing **stream + enrollment** RPCs only (narrow blast radius).
  - **Operator-facing (internal):** separate port for **execute/admin** RPCs, reachable only on admin networks/VPN/service mesh.
- **Local development:** **Unix domain socket** SHOULD be supported as **default** for laptop MVPs (`unix:///var/run/.../gateway.sock`) with **direct** identity (peer creds optional; often skipped in dev).

---

## 4. Gateway HA (v0.1)

**v0.1:** multiple gateway replicas **behind an L4 LB are supported** for **availability** only if **agent session state** is **externalized** per **D7 (DurableQueue choice)**—otherwise sticky sessions would be required and are **not** normative in v0.1. If D7 is “in-memory only,” treat **v0.1 as single-instance** from a correctness standpoint; **HA without durable queue is best-effort** (documented **degraded** behavior on failover). **v0.2** target: explicit HA story once queue + lease semantics are fixed.

---

## 5. Proxy fallback matrix (agents)

If outbound mTLS cannot be established:

1. **Retry** with exponential backoff and jitter (transient TCP/DNS).
2. After **policy-defined** max failures: enter **`UNREACHABLE`** state: **no silent polling fallback** in v0.1 (polling would change threat and consistency assumptions).
3. Emit **structured logs + local metrics**; optional **operator webhook** is out of scope for v0.1 wire.

---

## 6. Deployment modes (v0.1)

| Mode | Supported v0.1 |
|------|----------------|
| Local dev: localhost / UDS | **Yes** |
| Corporate intranet: L3 direct | **Yes** |
| SaaS: internet → NLB → gateway (PPv2 as needed) | **Yes** |
| Edge/retail: internet + optional HTTP CONNECT tunnel with E2E TLS inside | **Yes** if CONNECT is a **byte tunnel** and MITM does not apply |
| Air-gapped / store-and-forward | **No** (v0.2+ design) |
| HTTPS-intercepting proxy without allowlist | **No** — **fail closed**; operator must allowlist gateway domain |

---

## 7. SaaS operator path (ASCII)

End-to-end TLS to gateway; NLB is TCP pass-through; identity from client cert at gateway.

```
  [ Agent process ]
        |  TLS+mTLS (client cert)
        v
  [ AWS NLB / GCP TCP LB ]  ---- TCP pass-through ---->
        |  (optional Proxy Protocol v2 to preserve source IP)
        v
  [ Gateway :443 ]  <-- mTLS TERMINATES HERE; agent identity from client cert
        |
        +-- SPIFFE / XFCC if L7 proxy terminates TLS upstream of gateway
```

**Summary:** In the default SaaS path, **mTLS terminates at the gateway**. NLB is transparent to TLS. Use **PPv2** when you need **original source** for audit/rate limits, not to replace **client certificate authentication**.
