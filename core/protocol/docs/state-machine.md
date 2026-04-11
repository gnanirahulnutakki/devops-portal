The operation state machine exists to solve the transport problem that the stream alone does not solve: once a request exists, every participant must be able to answer whether it was durably accepted, whether execution started, and what to do after a disconnect or restart.

State diagram:

```
             +-----------+
             | ACCEPTED  |
             +-----------+
                   |
                   v
             +-----------+
             |  RUNNING  |
             +-----------+
              /    |    \
             v     v     v
      +---------+ +------+ +-----------+
      |SUCCESS  | |FAIL  | |CANCELLED  |
      +---------+ +------+ +-----------+
                   \
                    \
                     v
                 +--------+
                 |UNKNOWN |
                 +--------+

`ACCEPTED` is the first durable state. The gateway MUST not emit `ACCEPTED` until it has committed the operation to durable storage using an inbox/outbox pattern over NATS JetStream. “Durable” here means a process crash, pod eviction, or control-plane restart cannot silently lose the operation. If the gateway crashes after persistence but before replying to the caller, the recovered gateway MUST either replay the request from the durable log or explicitly roll it back. Silent loss is forbidden.

`RUNNING` starts only after the agent has received the request, evaluated local policy, and acknowledged execution. `SUCCEEDED`, `FAILED`, and `CANCELLED` are terminal. `UNKNOWN` is also terminal per DR-005. It is not a transient “waiting” state; it is the explicit statement that the system no longer has enough evidence to claim success, failure, or cancellation.

Idempotency has two layers. `operation_id` is a client-supplied ULID and is globally unique. The gateway validates uniqueness and treats a duplicate `operation_id` as a replay of the same logical operation. `idempotency_key` is separate and exists for retry behavior. A caller may retry with the same `idempotency_key` inside a configurable dedupe window, default one hour. Same key plus materially different request body is a hard rejection. Same key plus identical request returns the previously persisted result or current state.

Reconnect behavior is adapter-declared. During `RUNNING`, if the gRPC stream breaks, the gateway keeps the operation in `RUNNING` while the reconciliation window is open. On reconnect, the agent chooses one of three behaviors declared in `CapabilityAdvertisement`: `replay`, `resume`, or `reject`. `replay` means restart from the last deterministic step boundary. `resume` means continue from the last durable checkpoint. `reject` means the adapter refuses to continue safely after disconnect and returns a terminal failure immediately. This must be visible to operators and automation; it cannot be an undocumented implementation quirk.

The default reconciliation window before freezing to `UNKNOWN` is 15 minutes. It is configurable per adapter, but bounded; v0.1 should not allow “infinite reconciliation.” When the window expires, the gateway freezes the operation at `UNKNOWN`. It does not retry forever and it does not guess. The operator must issue a fresh compensating action if they want to re-establish the desired state.

Cancellation is cooperative only. A cancel request changes intent, not reality. The gateway may emit `OperationCancel`, but a disconnected or mid-step agent cannot be forced to stop. `CANCELLED` is valid only after the agent acknowledges cancellation.

Concrete walks:

1. Normal path: request arrives, gateway durably commits it and returns `ACCEPTED`, agent acknowledges and enters `RUNNING`, adapter finishes, terminal `SUCCEEDED`.
2. Mid-flight disconnect: request is `ACCEPTED`, then `RUNNING`, stream breaks, agent reconnects within 15 minutes, advertises `resume`, continues from last checkpoint, ends `SUCCEEDED`.
3. Agent crash: request is `ACCEPTED`, then `RUNNING`, agent disappears, no reconnect arrives before reconciliation window expires, gateway freezes the operation at terminal `UNKNOWN`. No hidden retry occurs.
