# Agent Evidence Channel (D5 Extension)

## Purpose

The gateway is the sole author of canonical `AuditEvent` records (D5). This document specifies the agent-side **corroborating evidence channel** — a tamper-evident, append-only signed log of what the agent observed and what local actions it took. It is NOT the canonical audit; it is a second witness.

## Why both are needed

Gateway-authored canonical audit eliminates the trust inversion where a compromised spoke could fabricate audit trails. However, gateway-only audit has a weakness: if the gateway itself is compromised or its audit stream is tampered with, there is no independent verification. For regulated environments, "gateway said so" without corroborating evidence from the spoke can be weaker than independent multi-source evidence.

The agent evidence channel provides:
- A second witness for forensic investigation when the gateway's record is disputed
- Proof of what the agent reported upstream, preventing a compromised agent from later claiming "I never got that command"
- A comparison surface to detect gateway tampering or replay attacks

## Evidence entry format

Each evidence entry contains:

- `entry_id`: monotonically increasing sequence number per agent
- `operation_id`: the operation this entry relates to (or empty for lifecycle events)
- `event_type`: one of `command_received`, `execution_started`, `execution_completed`, `execution_failed`, `credential_resolved`, `credential_rotation`, `policy_evaluated`
- `timestamp`: wall-clock time at the agent
- `payload_digest`: SHA-256 of the operation payload the agent received or produced
- `outcome_summary`: brief structured summary (adapter name, status, error class if any)
- `prev_hash`: SHA-256 of the previous entry's serialized bytes (hash chain)
- `signature`: ECDSA signature over the entire entry using the agent's client key

The hash chain ensures that entries cannot be inserted, deleted, or reordered without detection. The signature ensures that entries cannot be forged by an attacker without the agent's private key.

## Storage

**Default**: append-only file at a configurable local path (e.g., `/var/lib/tbd-agent/evidence.log`). Each entry is written as a newline-delimited JSON object. The file is opened with `O_APPEND | O_WRONLY | O_CREATE` and `fsync`'d after each write to minimize data loss on crash.

**Optional export**: the evidence log can be streamed to an external sink:
- A per-cluster SIEM (Splunk, Elastic, etc.)
- A Sigstore Rekor transparency log (provides public third-party attestation)
- A WORM volume (write-once-read-many storage for compliance)

Export is asynchronous and must not block operation execution. A failed export is logged but does not fail the operation.

## Reconciliation

When an operator or automated system compares the canonical audit stream (gateway) with agent evidence:

- **Agreement**: the operation's gateway `AuditEvent` and the agent's evidence entries describe the same command, outcome, and timing. Normal case.
- **Disagreement**: the gateway's record and the agent's record conflict on any field. This is a **first-class reconciliation event** that:
  - Is emitted to the canonical audit stream as an `AuditEvent` with type `evidence_disagreement`
  - Triggers an operator alert (severity depends on the nature of the conflict)
  - Does NOT automatically resolve in favor of either side — human investigation is required
- **Missing agent evidence**: the gateway has an `AuditEvent` for an operation but the agent has no corresponding evidence entry. This may indicate: agent crash during execution, evidence file corruption, or evidence export failure. Treated as a warning, not an error, unless the operation was security-sensitive.
- **Missing gateway audit**: the agent has evidence entries for an operation but the gateway has no corresponding `AuditEvent`. This is a **critical alert** — it may indicate gateway compromise, audit stream tampering, or a gateway restart that lost unflushed records.

## Protocol-level types (v0.1 design)

For the v0.1 proto, the agent evidence channel requires:

1. An `AgentAttestation` message type that wraps one evidence entry with its signature and hash-chain reference. This is included in the `AgentEnvelope` oneof alongside `OperationAck`, `OperationProgress`, and `OperationResult`.
2. The gateway receives `AgentAttestation` messages but does NOT include them in its canonical `AuditEvent`. It stores them separately as agent-claimed evidence.
3. A reconciliation endpoint or background process that periodically compares canonical audit with agent evidence and emits disagreement events.

Note: the `AgentAttestation` message is NOT `AuditEvent`. It is an untrusted claim by the agent about what it observed. The gateway treats it as telemetry, not authority.

## Failure modes

1. **Local evidence file write fails**: agent logs the failure and continues executing. Operations are NOT blocked by evidence write failures. The gap in the hash chain is recorded when writes resume.
2. **Hash chain broken**: on startup, the agent validates the last N entries of the evidence file. If the chain is broken (entries missing or tampered), the agent emits a `chain_break` lifecycle event and starts a new chain from the break point. The break itself is evidence of compromise or corruption.
3. **Agent private key compromised**: if the agent's signing key is compromised, all future evidence entries are unreliable. Revocation of the agent's certificate (D9) should trigger a re-key of the evidence signing key.
4. **Clock skew**: agent timestamps are local wall-clock. Significant clock skew between agent and gateway timestamps is a reconciliation signal. The protocol does not attempt to solve clock synchronization — it relies on the reconciliation process to surface timing anomalies.

## Scope boundary

The protocol defines:
- The evidence entry format and hash-chain structure
- The `AgentAttestation` message type in the wire spec
- The reconciliation event types and alerting semantics
- The failure mode behavior

The protocol does NOT define:
- How the evidence file is stored on disk (OS-specific)
- How export to external sinks is configured (operator-specific)
- How reconciliation alerts are routed (depends on the operator's alerting stack)
- How frequently reconciliation runs (operator-configurable, default suggested: every 5 minutes)
