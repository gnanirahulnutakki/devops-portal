Audit in this protocol is metadata-first and payload-minimizing by design. `AuditRecord` is not a dump of request or response bodies. It is the structured envelope around who asked, what adapter was selected, which policy verdicts were rendered, what state transition occurred, when it happened, and the integrity digest of any redacted payload. Raw operation payloads are excluded by default.

Storage backends are explicit. The primary path is an OTLP sink so operators can route audit envelopes into any OpenTelemetry-compatible collector and onward to their chosen backend. The secondary path is object storage, typically S3- or GCS-compatible, for long-term retention and evidentiary export. CRDs are explicitly forbidden as the primary audit store. etcd is not built for high-volume append-only audit retention, and storing raw payloads there creates a privileged exfiltration ledger. That was already called out in the codex blind spots review and it is still true.

Redaction is schema-driven and deny-by-default. Adapters declare `sensitive: true` fields in their schemas. The audit layer uses that declaration to redact before emission. Unknown fields are treated as sensitive unless explicitly allowlisted. This is the right default. Operators are bad at predicting which “temporary debug fields” later contain bearer tokens, tenant IDs, or customer data. The protocol should not assume discipline it cannot enforce.

Retention must be operator-configurable, but the reference model should define three default classes: short-term 30 days for active incident work, medium-term 1 year for routine operational review, and long-term 7 years for regulated environments. The class is attached at the audit pipeline level, not embedded in the wire message, because retention is an operator policy decision rather than a producer decision.

Payload size is capped. The audit envelope limit is 64 KB. If the redacted payload or metadata would exceed that limit, the system emits the envelope without content and includes only `redacted_payload_digest`. That preserves integrity and correlation without turning the audit pipeline into a bulk data channel.

The implementation rule is simple: log by metadata, not by curiosity. If an operator truly needs full bodies, that must be an explicit per-adapter opt-in with its own retention and risk review. It is never the default.

## D5 extension (post-synthesis, 2026-04-11)

The 3-reviewer synthesis concluded that gateway-authored canonical audit (revised D5) is the right direction but *incomplete* on its own. Cursor-agent's critique: "gateway-only audit fixes trust inversion for a compromised agent — good. It also means loss of agent-local evidence unless you add a parallel channel." For regulated customers, "gateway said so" without corroborating evidence from the spoke can be weaker than "agent signed what it observed."

The extended model for v0.1 is:

1. **Canonical audit is gateway-authored.** The gateway is the sole author of `AuditRecord` entries in the primary OTLP stream and object store. It synthesizes these from `OperationAck`, `OperationProgress`, `OperationResult` envelopes plus its own central `PolicyVerdict`. The compromised-agent-fabricates-audit threat is eliminated at this layer.

2. **Agent-side corroborating attestations are an append-only signed evidence stream.** Each agent maintains a local, tamper-evident log (hash-chained append-only, signed with the agent's client key) of what it observed and what local actions it took. This log is NOT the canonical audit — the gateway's stream is canonical. But it provides:
   - A second witness for forensic investigation when the gateway's record is disputed
   - Proof of what the agent reported upstream, so a compromised agent cannot later claim "I never got that command"
   - Evidence the auditor can compare against the gateway's synthesized record to detect gateway tampering or replay

3. **Reconciliation**: when canonical and agent evidence disagree, the canonical record stands as the authority for policy and compliance, but the disagreement itself is a first-class audit event that triggers investigation. The protocol must define the event type and the operator workflow for handling it.

4. **Agent evidence storage** is local (default: append-only file with hash chain signed per entry) and can be optionally exported to a secondary sink the operator trusts (e.g., a per-cluster SIEM, a Sigstore Rekor transparency log, or a WORM volume). This is deliberately not in the hot path so a local-evidence outage does not block operations.

This extended model has to be documented before v0.1 freeze because it affects the `AgentEnvelope` message set (the agent's signed attestations are a new message type or a new field on existing `OperationResult`) and the audit pipeline implementation. D5 is therefore *two* design deliverables: the gateway-authorship rule (already settled) and the agent-side evidence channel (to be specified in a future M1 doc).
