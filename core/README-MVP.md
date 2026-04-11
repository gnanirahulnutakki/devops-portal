# TBD_PROJECT_NAME — MVP Quickstart

> **Status**: MVP proof-of-concept. Deployable on a developer laptop in a single afternoon. **Not** production-grade. No auth, no TLS, no policy, no audit, no durability, no multi-cluster.

This is the minimum-viable demonstration that the protocol shape works: a central gateway, a connected agent, an adapter that reads real Kubernetes data through the agent, and a client that invokes it through the gateway.

## What this MVP is and is not

| Concern | In MVP | Deferred to v0.1 |
|---|---|---|
| Transport | HTTP + JSON, long-polling | gRPC bidirectional streaming |
| Wire format | plain Go structs in `core/protocol/mvp/types.go` | protobuf in `core/protocol/action-protocol.proto` |
| Identity | agent name, in-memory | CSR + join token + mTLS + rotation (DR-006) |
| Policy | none (allow-all) | OPA/CEL dual placement (DR-002) |
| Audit | stdout log | OTLP sink + redaction (DR-004) |
| Durability | in-memory map | NATS JetStream inbox/outbox (DR-005) |
| Adapters | `k8s-get-pods` only | full read + policy-gated write set |
| TLS / auth | none, localhost only | mTLS mandatory |
| Cluster scope | laptop (whatever kubeconfig points at) | multi-cluster fleet |

The MVP exists to validate the end-to-end protocol shape end-to-end. When the v0.1 gRPC implementation lands, the HTTP/JSON path gets removed.

## What you need

- **Go 1.24+**
- A working `kubectl` context (the MVP adapter uses whatever `$KUBECONFIG` or `~/.kube/config` points at)
- Any running Kubernetes cluster your kubeconfig can reach (a local `kind` cluster works fine)

No Docker, no Helm, no protoc, no buf. Just `go` and `make`.

## Run it

All four components are built and deployed from this directory (`core/`).

### One-shot demo

```sh
cd core
make deps         # go mod tidy — may take a minute the first time
make build        # compile gateway, agent, client into ./bin
make demo         # launch gateway + agent in background, run client, tear down
```

Expected output: a prettified JSON listing of pods in the `default` namespace of whatever cluster your kubeconfig points at.

### Three-terminal demo (more useful for debugging)

**Terminal 1 — gateway**:

```sh
cd core
make run-gateway
```

You should see `gateway listening on localhost:8080` and log lines as agents register and operations flow through.

**Terminal 2 — agent**:

```sh
cd core
make run-agent
```

You should see `agent registered as local-agent` and the long-poll loop logging.

**Terminal 3 — client**:

```sh
cd core
./bin/client get-pods -namespace default
```

You should see a JSON-pretty-printed pod list.

Try `-namespace ""` for all namespaces, or `-namespace kube-system` for system pods.

## What each component does

- **`core/gateway/`** — HTTP server on `localhost:8080`. Holds an in-memory registry of connected agents. Exposes:
  - `POST /register` — agents announce themselves
  - `GET /poll?agent_name=X` — long-polling endpoint agents use to receive commands
  - `POST /submit-result` — agents return operation results
  - `POST /execute` — clients invoke an adapter on a specific agent
- **`core/agent/`** — HTTP client that registers with the gateway and long-polls for commands. When it receives a command, it dispatches to a local adapter via `core/agent/internal/dispatcher`.
- **`core/adapters/k8sgetpods/`** — the single MVP adapter. Uses `client-go` with your kubeconfig to list pods in the requested namespace.
- **`core/cmd/client/`** — the CLI a human runs to invoke an adapter through the gateway.
- **`core/protocol/mvp/`** — the shared Go types used by all four components.

## What this proves

If the demo runs, we've validated:

1. The central-gateway + outbound-agent topology works end-to-end
2. Agents can be invoked on demand through the gateway without the gateway dialing into the spoke cluster
3. An adapter can execute real Kubernetes work on behalf of a remote caller
4. The protocol shape is correct enough to scaffold the full v0.1 gRPC implementation on top

## What this does NOT prove

1. The protocol is secure — it has **zero** security properties
2. The protocol is durable — a gateway restart loses every in-flight operation
3. The protocol is correct under load — there is no concurrency control
4. The protocol handles multi-cluster — there is exactly one agent
5. The protocol survives production conditions — it's a developer demo

## Where this goes next

The MVP is a throwaway. Once validated, the v0.1 gRPC wire protocol at `core/protocol/action-protocol.proto` replaces the HTTP types at `core/protocol/mvp/types.go`. The gateway, agent, and adapters are rewritten against the real protocol with identity, policy, audit, and durability as first-class properties — the work described in DR-001 through DR-010 in the CNCF Research Hub.

Think of this as a spike, not a foundation. It exists to prove the shape is right before we commit the real implementation effort.
