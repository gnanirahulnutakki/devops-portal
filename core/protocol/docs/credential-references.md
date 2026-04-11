# Credential References

## Purpose

The protocol needs a stable way for adapters to declare **what credential they require** without turning the wire format into a secret transport. This document defines that reference layer. It exists because credential sourcing is not adapter trivia; it is part of interoperability. As codex already flagged, two nominally identical `prometheus-read` adapters can behave incompatibly if one expects an in-cluster service account, another expects Vault, and a third reads a file path. If the protocol does not standardize the reference semantics, conformance is meaningless.

This design borrows from OCM ManagedServiceAccount, where the hub controls the identity shape while the managed-side agent creates, rotates, and reports token state. OCM’s docs are explicit that the addon projects tokens, rotates them dynamically, and reports token status back to the hub: <https://open-cluster-management.io/docs/getting-started/integration/managed-serviceaccount/>.

## Credential reference envelope

The protocol defines a `CredentialReference` envelope carried in adapter capability metadata and, when needed, in operation dispatch context. The envelope contains:

- `credential_uri`: scheme-qualified identifier for the credential source. Examples:
  - `k8s-sa://default/prometheus-sa`
  - `vault://secret/data/adapters/prom`
  - `file:///var/run/secrets/prom/token`
  - `env:KUBECONFIG`
  - `aws-iam-role://arn:aws:iam::123456789012:role/prom-reader`
- `credential_version`: monotonically increasing generation or rotation version. This is not globally meaningful; it is provider-relative, but it must be comparable for staleness detection.
- `provider`: opaque resolver hint such as `k8s-serviceaccount`, `vault-kv-v2`, `filesystem`, `env`, `aws-iam`. The protocol does not interpret provider internals; it routes and audits them.
- `required_scope`: declared permissions or audience constraints the adapter expects before execution. Examples:
  - `prometheus.query`
  - `argocd.app.get`
  - `kubernetes.namespaces.get`
  - `audience=https://kubernetes.default.svc`

The protocol never carries the credential value itself. It only carries the reference, its observed generation, and enough scope metadata for preflight validation and audit.

## Resolution model

Credential resolution happens on the agent, not the gateway. The agent owns a credential provider chain. Given a `CredentialReference`, it asks providers in order whether they can resolve the URI. Providers may return:

- a usable credential handle plus `credential_version`
- a retryable resolution failure
- a terminal resolution failure
- a revocation signal

Adapters receive an in-memory credential handle from the resolver, not the raw protocol envelope. Providers are responsible for local secret access, caching, and renewal. The protocol is responsible for the lifecycle semantics around those events.

## Rotation expectations

Rotation is expected, not exceptional. The resolver must refresh credentials on any of these triggers:

- before execution if the current credential is near expiry
- when the provider reports a newer `credential_version`
- when the adapter returns a stale-credential error class
- when an in-flight credential crosses its provider-defined safe-use window

The reference pattern is OCM ManagedServiceAccount: managed-side agent creates or reflects the token, rotates it dynamically, and reports freshness/state back to the hub. We are adapting that pattern to a provider-neutral credential reference model, not copying the API.

The agent must surface credential rotation failures upstream as structured operation progress or result metadata. The gateway must see whether a failure was:
- `resolution_failed`
- `refresh_failed`
- `revoked`
- `version_conflict`

These are protocol-level failure categories because they affect state transitions and retry behavior.

## Failure modes

1. **Resolver cannot produce a credential before execution**
   - The agent rejects local execution before `RUNNING`.
   - Operation stays in `ACCEPTED` until local evaluation completes, then transitions to `FAILED`.
   - The terminal result includes a credential failure class and the last observed `credential_version` if any.

2. **Credential is revoked mid-operation**
   - If the adapter can safely stop, it returns `FAILED`.
   - If the adapter cannot determine execution outcome because revocation occurs during an external side effect, the operation may transition to `UNKNOWN` per DR-005.
   - Revocation is never silently retried.

3. **Credential version changes during `RUNNING`**
   - Reads may continue on the version already acquired if the provider marks the old handle still valid for the operation lifetime.
   - Writes must revalidate provider policy. If the provider says “old version invalid immediately,” the adapter fails fast.
   - The protocol does not allow an adapter to silently swap credentials mid-step without recording the version change.

4. **Concurrent operations hold stale vs fresh credentials**
   - Each operation binds to the credential version it started with.
   - A later operation may start with a newer version.
   - The gateway must not infer semantic equivalence across them; audit records must preserve the version observed per operation.

## Protocol boundary

The protocol defines:

- the credential reference envelope shape
- required version/generation reporting
- required scope declaration
- stale/revoked/refresh-failed error classes
- state transition rules when credential events occur

Each provider plugin defines:

- how `vault://`, `k8s-sa://`, `file://`, `env:`, or cloud IAM references are resolved
- how credentials are cached
- how version numbers are computed
- how provider-specific refresh is implemented

That split keeps the wire stable while allowing provider-specific integrations to evolve independently.

## Example walkthrough

An adapter advertises that it requires `k8s-sa://duploservices-svc/prometheus-reader`, provider `k8s-serviceaccount`, scope `prometheus.query`, version `42`. The gateway dispatches a read operation. The agent resolves the reference through its provider chain, obtains a projected service-account token, verifies that the token audience and RBAC satisfy `prometheus.query`, and starts execution.

Halfway through `RUNNING`, the service-account token rotates and the provider publishes version `43`. If the old token remains valid for the current request, the adapter completes with version `42`, and the result records that it executed on generation `42` while version `43` became available during runtime. If the provider marks version `42` invalid immediately, the adapter does not guess. It stops at the next safe checkpoint and returns a deterministic credential failure. The gateway sees a normal terminal state, not a hidden retry loop. A subsequent retry binds to version `43` explicitly.

That determinism is the point: credential rotation changes behavior in a way the protocol can explain, test, and audit.
