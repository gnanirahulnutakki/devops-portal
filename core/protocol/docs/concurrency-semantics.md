# Concurrency and Conflict Semantics

## Purpose

DR-005 defines operation states, but those states are incomplete without conflict rules. If two operators submit overlapping operations and the protocol has no shared definition of “overlap,” then `accepted` and `running` mean very little. This document defines the concurrency model for v0.1.

The protocol adopts **pessimistic locking for writes**, **shared access for reads**, and **gateway-first conflict detection with agent-side recheck**. It does not define multi-target transactions. Callers that need all-or-nothing behavior across multiple clusters or resources must orchestrate that themselves and provide compensating actions.

## Conflict classes

The protocol defines conflicts at the operation envelope level using target identity plus operation class.

### 1. Same adapter + same target
Example: two `argocd-sync` operations for the same `cluster/namespace/Application/foo`.

This is always a conflict if either operation is write-class. Only one may hold the write lock.

### 2. Different adapters + same target
Example: `argocd-sync` while `kubectl-apply` touches the same application or underlying Deployment.

This is also a conflict if either operation is write-class. Different adapter names do not imply safe concurrency.

### 3. Same adapter + adjacent targets
Example: restarting two Pods from the same Deployment, or two Argo CD applications that map to the same namespace and object set.

This is adapter-defined. The adapter capability must declare its lock scope. If the adapter cannot narrow safely, it must widen to the enclosing workload boundary. v0.1 favors safety over maximum concurrency.

### 4. Read vs read on same target
Usually not a conflict. Multiple read-class operations may run concurrently unless the adapter explicitly declares that reads are destructive or expensive enough to require serialization.

### 5. Read vs write on same target
Always a conflict for the duration of the write. The protocol treats writes as mutating the observable truth of the target. A read issued concurrently may see inconsistent intermediate state and therefore must either queue behind the write or be rejected according to policy.

## Locking domain model

The protocol standardizes a lock as metadata attached to the operation envelope, not as an implementation-specific mutex hidden inside the gateway.

Each operation declares one or more lock keys derived from:

- cluster
- namespace
- resource kind
- resource name
- adapter-declared lock scope
- operation class (`read` or `write`)

v0.1 recommends this model:

- **Read lock**: shared lock on a target key
- **Write lock**: exclusive lock on a target key
- **Adapter scope extension**: adapters may widen the target key if their real side effects exceed a single object

Examples:
- `prometheus-read` on cluster-wide metrics may lock `cluster/<id>/metrics` as shared
- `argocd-sync` on app `foo` may lock `cluster/<id>/ns/<ns>/argocdapp/foo` as exclusive
- `k8s-read` on Deployment `bar` may lock `cluster/<id>/ns/<ns>/deployment/bar` as shared

The gateway is the primary lock owner. Locks must be durably recorded alongside accepted operations so a restart does not orphan exclusivity.

## Conflict detection and resolution

Conflict detection happens in two places.

### Gateway-side detection
The gateway checks requested lock keys before dispatch.

- If no incompatible lock exists, the operation may move to `ACCEPTED`.
- If an incompatible lock exists:
  - same `idempotency_key` and same logical request: the gateway attaches the second caller to the existing operation handle
  - otherwise: the operation is rejected before dispatch

v0.1 does **not** add a new `REJECTED` state. Conflict-before-dispatch is represented as terminal `FAILED` with reason `conflict_pre_dispatch`. That keeps DR-005 intact.

### Agent-side recheck
The agent must recheck local conflict conditions at execution time because the gateway may lack cluster-local truth. Examples:

- a local controller has already started a conflicting action
- an external operator is mutating the same object out of band
- the adapter widened its lock scope after inspecting local state

If the agent detects a conflict after central dispatch but before beginning side effects, the operation transitions from `ACCEPTED` to terminal `FAILED` with reason `conflict_local`. It must not enter `RUNNING`.

If the agent detects an irreversible conflict after side effects have started, normal DR-005 rules apply: return `FAILED` if the outcome is known, `UNKNOWN` if the adapter cannot determine post-conflict final state.

ASCII flow:

```text
submit
  |
  v
gateway conflict check
  |-- incompatible lock --> FAILED(conflict_pre_dispatch)
  |
  v
ACCEPTED
  |
  v
agent local recheck
  |-- local conflict before side effects --> FAILED(conflict_local)
  |
  v
RUNNING
  |-- conflict during side effects, outcome known --> FAILED(conflict_runtime)
  |-- conflict during side effects, outcome unknown --> UNKNOWN
  |
  v
SUCCEEDED / CANCELLED
```

## Pessimistic vs optimistic

v0.1 should require **pessimistic locking for write-class operations** and allow **optimistic concurrency only for reads**.

Why:
- the system is explicitly a day-2 operations substrate, not a best-effort task queue
- write collisions against the same workload create operator-visible damage
- relying on callers to coordinate through idempotency keys is not enough because distinct callers may issue conflicting but non-identical commands

Optimistic hints may exist later, but they should not be the default for mutating operations.

## Idempotency key semantics

The `operation_id` remains the unique logical operation identifier. The `idempotency_key` is the dedupe handle for retries and duplicate submissions.

When a second request arrives with the same `idempotency_key`:

- if the request body is semantically identical and the first operation is still active, the gateway returns the existing operation handle and current state; it does not enqueue a second execution
- if the request body is semantically identical and the first operation is terminal, the gateway returns the persisted terminal result inside the dedupe window
- if the request body differs, the gateway rejects it as `FAILED(idempotency_mismatch)`

This rule is stronger than simple dedupe. It prevents a caller from using the same idempotency key to smuggle a different operation through an existing concurrency slot.

## Fairness and starvation

Write locks can starve other work if the protocol has no queue policy. v0.1 should define:

- per-target FIFO queueing by default
- operation timeout while waiting for lock acquisition
- optional priority classes with strict limits; priority affects queue ordering but does not bypass exclusivity
- maximum lock hold duration, after which the gateway marks the operation for cancellation and begins reconciliation

If operator A holds a long-running write lock, operator B’s conflicting operation may either:
- wait in the queue until its queue timeout expires, then fail with `conflict_timeout`
- inherit the first operation if it is a true idempotent duplicate
- be rejected immediately if policy forbids waiting

The protocol should not permit indefinite starvation. Every queued operation must have a bounded wait budget.

## Explicit non-goal

The protocol does not define distributed transactions across targets. If an operator wants all-or-nothing behavior across three clusters or two unrelated workloads, that orchestration belongs above the protocol. The caller composes independent operations, tracks their outcomes, and issues compensating actions if partial success occurs.

## Required tests for v0.1

1. **Duplicate write with same idempotency key**
   - First request acquires the write lock.
   - Second identical request returns the first operation handle, not a second execution.

2. **Read arrives during write on same target**
   - Gateway detects shared/exclusive conflict.
   - Read either queues and later succeeds or fails with deterministic `conflict_timeout`, depending on queue budget.

3. **Gateway restart with held write lock**
   - A write is `ACCEPTED`, lock is durably recorded, gateway restarts, second conflicting write arrives.
   - Second write must still be blocked or rejected; lock loss after restart is a correctness failure.
