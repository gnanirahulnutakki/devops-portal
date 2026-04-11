# Threat Model: TBD_PROJECT_NAME v0.1

This document provides a comprehensive security analysis of the `TBD_PROJECT_NAME` multi-cluster operational protocol. As a CNCF Sandbox-track project, security is a foundational requirement, not an add-on. We employ the STRIDE methodology to identify threats across trust boundaries and define mandatory controls for the v0.1 release.

## 1. Trust Boundaries and Scope

The architecture of `TBD_PROJECT_NAME` involves several distinct trust zones. The primary goal is to ensure that a compromise in one zone (e.g., a spoke cluster) does not lead to a compromise of the central control plane or other spoke clusters.

### 1.1 Boundary: Caller -> Gateway
**Actors**: Human operators (CLI/UI), automation systems (CI/CD), or machine clients (AI agents).
**Interface**: HTTP/gRPC API.
**Trust Assumption**: The Gateway must verify the identity and authorization of every caller before admitting a request into the protocol.

### 1.2 Boundary: Gateway -> Agent
**Actors**: Central Gateway and Spoke Agents.
**Interface**: Outbound-only mTLS gRPC bidirectional stream (Agent initiates).
**Trust Assumption**: Mutual TLS provides transport-level identity. The Gateway trusts the Agent only to execute scoped actions and report status. The Agent trusts the Gateway to provide authorized intent and policy updates.

### 1.3 Boundary: Agent -> Adapter
**Actors**: Reference Go Agent and pluggable Tool Adapters.
**Interface**: In-process Go function calls (v0.1) or local IPC.
**Trust Assumption**: The Agent assumes Adapters are benign but isolates them via typed schemas and resource constraints. Adapters assume the Agent provides sanitized parameters.

### 1.4 Boundary: Adapter -> Target Cluster Service
**Actors**: Tool Adapters and upstream services (K8s API, Prometheus, ArgoCD).
**Interface**: Tool-specific APIs (REST, gRPC, etc.).
**Trust Assumption**: Upstream services rely on the credentials provided by the Adapter (sourced via the Credential Reference Resolver) to enforce local RBAC.

### 1.5 Boundary: Gateway -> Audit/Policy Sinks
**Actors**: Gateway and external storage/policy sources.
**Interface**: OTLP, Object Store APIs, OPA Bundle API.
**Trust Assumption**: The Gateway must ensure the integrity of data sent to sinks and the authenticity of policy bundles received.

---

## 2. STRIDE Threat Analysis

### 2.1 Spoofing (Impersonation)

#### [T1.1] Stolen Agent Certificate
*   **Threat**: An attacker exfiltrates an Agent's client certificate and private key, using it to impersonate a legitimate cluster from an unauthorized network location.
*   **Likelihood**: Medium
*   **Impact**: High (Attacker can receive operations intended for that cluster and forge heartbeat/status).
*   **Current Mitigation**: Short-lived certificates (24h default) per DR-006.
*   **Required Control (v0.1 Gate)**: Server-side revocation list (denylist) keyed by `agent_fingerprint`. Implementation of `RevocationNotice` to force immediate disconnect.
*   **Post-v0.1**: Integration with hardware-backed identity (TPM/KMS) to prevent key exfiltration.

#### [T1.2] Gateway Impersonation (MITM)
*   **Threat**: An attacker poisons DNS or intercepts traffic to present a rogue Gateway to an Agent.
*   **Likelihood**: Low
*   **Impact**: Critical (Agent may execute malicious commands or leak cluster metadata).
*   **Current Mitigation**: mTLS ensures the Agent validates the Gateway's certificate against a trusted CA bundle.
*   **Required Control (v0.1 Gate)**: Agent must support strict CA pinning and refuse to connect if the Gateway certificate does not match the pinned root or SAN.

#### [T1.3] Operator Token Theft
*   **Threat**: An attacker obtains a bearer token for a human operator or machine principal.
*   **Likelihood**: High
*   **Impact**: High (Attacker can trigger any action the operator is authorized for).
*   **Current Mitigation**: Handled by external IDP (Prisma/NextAuth in downstream portal).
*   **Required Control (v0.1 Gate)**: Gateway-side rate limiting per `operator_id`. Central policy (D2) must support time-of-day and IP-range restrictions for sensitive actions.

### 2.2 Tampering

#### [T2.1] Policy Bundle Tampering
*   **Threat**: A compromised distribution path (e.g., a subverted S3 bucket) serves a malicious OPA/CEL bundle that allows unauthorized actions.
*   **Likelihood**: Medium
*   **Impact**: Critical
*   **Current Mitigation**: `PolicyUpdate` message includes `policy_hash`.
*   **Required Control (v0.1 Gate)**: The Gateway must sign policy bundles. The Agent must verify the signature using a public key provided during enrollment before applying the bundle.

#### [T2.2] Command Replay
*   **Threat**: An attacker captures a valid `ControlEnvelope` and replays it later to repeat a mutation.
*   **Likelihood**: Medium
*   **Impact**: Medium/High
*   **Current Mitigation**: `command_id` (ULID) provides uniqueness.
*   **Required Control (v0.1 Gate)**: Monotonic nonces per agent in the `AgentEnvelope` and gateway-tracked `issued_at` timestamps in `OperationRequest`. Any request older than $N$ minutes is rejected.

#### [T2.3] Local Adapter Parameter Injection
*   **Threat**: An operator provides malicious input that escapes the Adapter's intended logic (e.g., shell injection in a poorly written adapter).
*   **Likelihood**: Medium
*   **Impact**: High
*   **Current Mitigation**: Use of typed `google.protobuf.Struct` and schema validation.
*   **Required Control (v0.1 Gate)**: Mandatory JSON Schema validation for all Adapter inputs at both Gateway (central) and Agent (local). Adapters must not use string concatenation for command construction.

### 2.3 Repudiation

#### [T3.1] Agent Withholding Audit Events
*   **Threat**: A compromised agent executes a command but suppresses the `AuditEvent` or `OperationResult` to hide its tracks.
*   **Likelihood**: High
*   **Impact**: Medium
*   **Current Mitigation**: D5 (Gateway-authored audit). The Gateway is the source of record for the operation lifecycle.
*   **Required Control (v0.1 Gate)**: The Gateway must record an audit event for every state transition (`ACCEPTED`, `RUNNING`, etc.). If an Agent fails to report a result within the `timeout`, the Gateway records a terminal `UNKNOWN` state with a "Result Timeout" reason.

#### [T3.2] Operator Denies Initiating Action
*   **Threat**: A user claims they did not trigger a destructive command.
*   **Likelihood**: Low
*   **Impact**: Low
*   **Current Mitigation**: Gateway logs all incoming requests.
*   **Required Control (v0.1 Gate)**: `AuditEvent` must include the `operator_id` and the `command_id`. The Gateway should ideally log the raw (redacted) request signature from the caller if available.

### 2.4 Information Disclosure

#### [T4.1] Cross-Tenant Leak in Audit Stream
*   **Threat**: In a multi-tenant Gateway, Tenant A views the audit logs of Tenant B.
*   **Likelihood**: Medium
*   **Impact**: Medium
*   **Current Mitigation**: D4 (Audit metadata-only).
*   **Required Control (v0.1 Gate)**: The Gateway audit sink must enforce tenant isolation. OTLP exports must include `tenant_id` resource attributes, and the backend must filter by these.

#### [T4.2] Secret Leak in Audit Payloads
*   **Threat**: An adapter returns a result containing a bearer token or PII, which is then stored in the central audit log.
*   **Likelihood**: High
*   **Impact**: High
*   **Current Mitigation**: D4 (Redaction by default).
*   **Required Control (v0.1 Gate)**: Adapters must declare `sensitive: true` fields in their output schemas. The Agent must redact these fields before sending the `OperationResult` to the Gateway.

#### [T4.3] Metadata Leak in Heartbeats
*   **Threat**: Agent heartbeats leak sensitive cluster details (e.g., node names, pod counts, internal IP ranges) to a Gateway that may have lower security classification.
*   **Likelihood**: Low
*   **Impact**: Low
*   **Current Mitigation**: Heartbeats are restricted to liveness and cert expiry metadata.
*   **Required Control (v0.1 Gate)**: Strict schema for `Heartbeat.stats` to prevent arbitrary unstructured data from being leaked.

### 2.5 Denial of Service

#### [T5.1] Enrollment Request Flood
*   **Threat**: An attacker floods the Gateway with `EnrollRequest` messages to exhaust CA resources or storage.
*   **Likelihood**: Medium
*   **Impact**: Medium
*   **Current Mitigation**: Join tokens have short TTLs.
*   **Required Control (v0.1 Gate)**: Rate limiting on the `Enroll` endpoint by source IP and `join_token` ID.

#### [T5.2] Agent Resource Exhaustion
*   **Threat**: A malicious or poorly configured adapter consumes all CPU/RAM on a spoke node.
*   **Likelihood**: High
*   **Impact**: Medium (Affects spoke cluster stability).
*   **Current Mitigation**: None (in MVP).
*   **Required Control (v0.1 Gate)**: The Agent must run Adapters with resource limits (cgroups/K8s resource limits). The `OperationRequest` must include a `timeout` that the Agent enforces strictly.

#### [T5.3] Control Path Saturation
*   **Threat**: An agent floods the Gateway with high-frequency heartbeats or status updates, saturating the gRPC stream.
*   **Likelihood**: Medium
*   **Impact**: Medium
*   **Current Mitigation**: Bidir gRPC flow control.
*   **Required Control (v0.1 Gate)**: Gateway-side backpressure. If an agent exceeds $X$ messages per second, the Gateway throttles the stream or disconnects the agent.

### 2.6 Elevation of Privilege

#### [T6.1] Credential Resolver Compromise (D8)
*   **Threat**: An attacker compromises a Credential Provider (e.g., subverts a Vault instance) to return highly privileged credentials for a requested `credential_uri`.
*   **Likelihood**: Low
*   **Impact**: Critical
*   **Current Mitigation**: Protocol defines semantics; providers are external.
*   **Required Control (v0.1 Gate)**: The protocol must support "Required Scope" declarations. An adapter requesting `k8s-sa://readonly` must reject a credential that identifies as `cluster-admin`.

#### [T6.2] Local Adapter Escape
*   **Threat**: A user with "Read Only" access to the Gateway uses a bug in the `prometheus-read` adapter to perform a write or exfiltrate secrets from the Agent's filesystem.
*   **Likelihood**: Medium
*   **Impact**: High
*   **Current Mitigation**: Typed parameters and schema validation.
*   **Required Control (v0.1 Gate)**: Adapters must run with the "Principle of Least Privilege." The ServiceAccount assigned to the Agent/Adapter should only have the minimum permissions required for its advertised capabilities.

---

## 3. Residual Risks

The following risks are acknowledged but will not be fully mitigated in v0.1:

1.  **Compromised Upstream Infrastructure**: If the target Kubernetes API itself is compromised, `TBD_PROJECT_NAME` cannot protect the cluster.
2.  **Zero-Day Vulnerabilities in gRPC/Go**: We rely on the security of our underlying stack.
3.  **Physical/Console Access**: If an attacker has physical access to a spoke node, they can exfiltrate the Agent's identity and keys.
4.  **Malicious Adopters**: The protocol provides the framework; it cannot prevent an authorized admin from doing something intentionally destructive (though it will audit it).

---

## 4. CNCF Reviewer FAQ (Sandbox Readiness)

**Q: How do you prevent a compromised spoke cluster from attacking the central control plane?**
**A**: The Gateway is the sole author of audit records (D5) and uses a push-based model from the Agent's perspective (outbound mTLS). The Gateway treats all Agent input as untrusted, validating it against strict schemas before processing. There is no path for an Agent to "dial back" into the Gateway's internal management network.

**Q: How do you handle certificate revocation at scale?**
**A**: We adopt the OCM pattern of short-lived certificates (24h) combined with a server-side denylist. Revocation is pushed via the `RevocationNotice` message for immediate effect, while the denylist prevents reconnects.

**Q: Is the protocol susceptible to replay attacks?**
**A**: No. We use monotonic nonces per agent and TTL-bounded `issued_at` timestamps in every operation request. The Gateway maintains the "High Water Mark" for nonces for every enrolled agent.

**Q: How is multi-tenancy enforced?**
**A**: Multi-tenancy is a first-class citizen in the wire spec. Every `OperationRequest` carries a `tenant_id`. The Gateway's policy engine (D2) and audit sink (D4) use this ID to ensure strict isolation of intent, policy, and evidence.

---

## 5. Threat Summary Table

| ID | Category | Threat | Likelihood | Impact | Current Status | v0.1 Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| T1.1 | Spoofing | Stolen Agent Cert | Medium | High | Short TTL | Denylist + RevokeNotice |
| T1.2 | Spoofing | Gateway Impersonation | Low | Critical | mTLS | CA Pinning |
| T2.1 | Tampering | Policy Bundle Tamper | Medium | Critical | Hash in msg | Signing/Verification |
| T2.2 | Tampering | Command Replay | Medium | Medium | ULID | Nonce + TTL check |
| T2.3 | Tampering | Parameter Injection | Medium | High | Structs | Schema Validation |
| T3.1 | Repudiation | Audit Withholding | High | Medium | D5 Synthesis | Timeout -> UNKNOWN |
| T4.1 | Info Disc | Cross-Tenant Leak | Medium | Medium | Metadata-only | Tenant isolation in sink |
| T4.2 | Info Disc | Secret Leak in Audit | High | High | Redaction | Mandatory Redaction |
| T5.2 | DoS | Agent Resource Exhaustion | High | Medium | None | Cgroups + Timeouts |
| T6.2 | Priv Esc | Local Adapter Escape | Medium | High | Schemas | Least Privilege SA |

*Document Version: 0.1.0*
*Last Updated: 2026-04-11*
*Status: Draft for Review*
