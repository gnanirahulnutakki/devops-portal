# Adapter schema distribution, versioning, and compatibility (D16)

This document pairs with **D1**: action payloads are **schema-addressed opaque bytes** (`schema_uri` + **`payload_digest`** + `payload`), not `google.protobuf.Any`. It freezes **v0.1** rules so wire generators and adapters can ship without ambiguity.

**Prior art.** [Protocol Buffers](https://protobuf.dev/programming-guides/proto3/) compatibility: adding fields is generally safe; removing/retyping is breaking—informal parallel for JSON adapter schemas. [OCM `ClusterManagementAddOn`](https://open-cluster-management.io/getting-started/core/register-cluster/) advertises **hub-side capabilities** per cluster; analog here is **per-agent adapter schema support** in `AgentHello`. **OCI artifacts** and **[Sigstore](https://docs.sigstore.dev/)** attestations are common CNCF patterns for **signed, content-addressed blobs**—we reference them for trust evolution, not v0.1 mandates.

---

## 1. `schema_uri` format (normative recommendation)

**Recommended v0.1 form:** a **HTTPS URI** under a project-controlled namespace:

`https://schemas.<project>.dev/adapters/<name>/<semver>.json`

Example: `https://schemas.TBD_PROJECT_NAME.dev/adapters/prometheus-read/v1.1.json`

**Why not only IPFS/OCI/Go import paths alone?**

- **HTTPS URI + semver path** is human-debuggable and stable for documentation.
- **Air-gapped operators** who cannot fetch the internet: schemas MUST be **mirrored** into their **artifact/registry mirror** or **bundled with the adapter release** (see §4). The URI is still the **logical name**; resolution is **pluggable**—offline installs load from **local file** or **internal registry** using the same string as key.

**Optional future:** content-addressed suffix (`…/v1.1.json#sha256:…`) for pin-down; **v0.1** uses **digest on the payload**, not in the URI.

---

## 2. `payload_digest` (SHA-256)

- **Definition:** `SHA-256` over the raw `payload` bytes (hex or fixed binary encoding per wire spec).
- **Protects against:** **accidental corruption** and **unintended mutation** in transit through brokers; **not** a substitute for TLS (confidentiality/authenticity of the channel).
- **Does not:** stop **replay** by a privileged insider—replay resistance belongs to **nonce/ID** at the action layer and **DurableQueue** idempotency (D7).
- **Validation:** **Gateway** validates digest **before** accepting an execute request into the queue; **Agent** validates digest **before** handing off to the adapter runtime (payload matches declared hash).

---

## 3. Schema versioning (semver)

Apply **semver** to each adapter schema document:

| Level | Meaning |
|-------|---------|
| **MAJOR** | Breaking: removed fields, changed types, renamed fields, stricter validation that rejects previously valid documents. |
| **MINOR** | Additive: new optional fields, extended enums with backward-compatible defaults. |
| **PATCH** | Non-semantic: descriptions, examples, default documentation only—**wire-identical** to previous patch under same minor. |

Align with **protobuf** field-addition story: treat **minor** like “add optional fields,” **major** like wire-breaking changes.

---

## 4. Schema lifecycle and publication (v0.1)

**v0.1 recommendation:** schemas are **baked into the adapter binary** (or an **adjacent file shipped in the same OCI image layer**) and registered at agent startup. The HTTPS URI is the **canonical ID**; the agent loads content from **embedded** or **local mirror** path.

**Future work:** runtime fetch from OCI or central catalog; **Kubernetes ConfigMap/CRD** “adapter catalog” for cluster admins—**not** v0.1 normative.

---

## 5. Capability advertisement

Each agent sends, in **`AgentHello`** / `supported_features` (D3), a compact list or hash of supported **`(schema_uri, semver range)`** pairs (exact encoding in wire spec). The gateway uses this for **routing decisions** and **compatibility checks** before enqueueing work.

**OCM analogy:** like **add-on availability** on the managed cluster, but **pull-based** from the agent.

---

## 6. Compatibility policy (D19 partial)

- **Deprecation window:** once a schema is marked deprecated, **reference gateway** MUST support it for **at least 2 minor gateway releases** or **90 days**, whichever is longer (calendar starts at deprecation notice in release notes).
- **Removal:** only on a **major** gateway release after the window; operators get **compile-time/log warnings** one release earlier.
- **Invocation when gateway knows schema S but agent lacks S:** gateway returns **`SCHEMA_NOT_SUPPORTED_BY_AGENT`** (name TBD in wire enum) **before** enqueue; caller must **upgrade agent** or **pin action** to older schema still advertised.

---

## 7. Signing and trust

- **v0.1:** schema **signing not required**. Trust derives from **signed adapter binaries/images** (organizational process) and **TLS** to gateway.
- **v0.2+:** recommend **Sigstore-style** signatures over schema blobs, with trust roots pinned in gateway config.

---

## 8. Example: `prometheus-read` v1.1 rollout

**Setup:** Schema `…/prometheus-read/v1.1.json` adds optional `timeout_ms` (MINOR bump from v1.0). **35 agents** upgrade over **two weeks**; remainder stay on v1.0.

| Caller targets | Gateway | Agent (v1.0) | Agent (v1.1) |
|----------------|---------|--------------|--------------|
| v1.0 payload | Accept; enqueue | Execute OK | Execute OK |
| v1.1 with `timeout_ms` | Accept; enqueue | **Reject at gateway** (agent did not advertise v1.1) **or** enqueue if gateway policy allows “unknown fields ignored”—**v0.1:** **reject if strict schema match required** | Execute OK |
| v1.1 without new fields | Same as v1.0 wire | OK | OK |

**Mixed fleet:** Gateway maintains **per-agent** advertised schema set. Dashboards show **version skew**. After deprecation window, gateway drops v1.0; stragglers fail with **`SCHEMA_DEPRECATED`** until upgraded.
