# M1.9 — Federated MCP Reference Adapter (kind two-cluster demo)

This directory contains the reproducible two-cluster demonstration referenced
in the project's [whitepaper §7.1](../../../protocol/docs/whitepaper-mcp-for-clusters.md)
and scoped in
[`m1.9-federated-mcp-adapter-design.md`](../../../protocol/docs/m1.9-federated-mcp-adapter-design.md).

## What this demo proves

When `make m1.9-demo` succeeds:

1. **Cross-cluster MCP traffic** crosses a real Kubernetes cluster boundary.
   A caller pod in `m19-cluster-b` invokes a `tools/call` against a
   `github-mcp` server hosted in `m19-cluster-a`.
2. **The federation gateway dispatches** the call via durable queue + long-poll.
   The agent in cluster-a executes the MCP request and returns the result.
3. **Credential boundary holds** — the GitHub PAT is mounted into cluster-a's
   federation agent only, dereferenced at execution time, and never appears
   in any record or log on the gateway side.

## What this demo does *not* prove (yet)

The whitepaper's full federation claim has parts not yet implemented. We are
explicit about what's in v0.1 vs deferred:

| Claim | M1.9 demo | When |
|---|---|---|
| Cross-cluster MCP transport | ✓ | This demo |
| Credential reference (k8s://) dereferenced locally | ✓ | This demo |
| Agent never sees secret of clusters it doesn't serve | ✓ | This demo |
| Gateway records who, what, where, outcome | partial — `/result` returns `OperationStatus` with `OK`/`Error`; full `AuditEvent` schema per §3.2 | M2 |
| End-user JWT validated at every hop | not validated; bearer token is passed through | M2 |
| mTLS at every hop with SPIFFE identities | mTLS not configured (HTTP for demo); SPIFFE identity model | M2 |
| Central + local OPA/CEL policy | none in demo; gateway has its `EXECUTE_TOKEN` admission only | M2 |
| External anchoring of audit log | none | M2 |
| Schema-trust enforcement | hard-coded allow-list of one schema (`mcp://tools/call/v1.0`) | M2 (OCI-anchored or signed catalog) |

**M1.9 is prototype evidence of the transport claim**, not of every claim
in the whitepaper. This is consistent with the whitepaper §7.1 reframing.

## Topology

```
   m19-cluster-b (caller)            m19-cluster-a (callee)
   ─────────────────────             ─────────────────────

   ┌──────────────┐                  ┌──────────────┐
   │ demo-caller  │                  │  github-mcp  │
   │ (curl pod)   │                  │  Pod         │
   └──────┬───────┘                  └──────▲───────┘
          │  POST /execute                  │ HTTP /messages
          │                                 │ JSON-RPC tools/call
          ▼                                 │
                       host.docker          │
                       .internal:8080       │
   ┌──────────────────────────────────┐     │
   │  Federation Gateway (cluster-a)  │     │
   │  (NodePort 30080 → host 8080)    │     │
   │  • /execute                      │     │
   │  • /poll  ← agent long-poll      │     │
   │  • /submit-result                │     │
   │  • /result                       │     │
   └──────────┬───────────────────────┘     │
              │                             │
              │ dispatch via in-mem queue   │
              ▼                             │
   ┌──────────────────────────────────┐     │
   │  Federation Agent (cluster-a)    │─────┘
   │  • polls /poll                   │
   │  • runs `mcp-client` adapter     │
   │  • dereferences k8s://secret/    │
   │    github-pat?key=token from     │
   │    cluster-a's m19-mcp NS        │
   └──────────────────────────────────┘
```

The cluster-b `federation-agent` Deployment is included to demonstrate the
deployment pattern of a member cluster but is not exercised by the demo —
cluster-b is the *caller*, not a callee in this scenario.

## Prerequisites

- Docker (or OrbStack on macOS — verified with OrbStack on darwin/arm64)
- `kind` v0.20+ (verified on v0.30.0)
- `kubectl`
- A GitHub personal access token with `public_repo` (or `repo`) scope:
  https://github.com/settings/personal-access-tokens

## Setup

```bash
export GITHUB_TOKEN=<your-PAT>
make m1.9-doctor          # check prerequisites
make m1.9-build-images    # build gateway:m1.9 + agent:m1.9 from core/{gateway,agent}
make m1.9-up              # create both kind clusters, load images, apply manifests
make m1.9-demo            # run the federated MCP call
```

## Expected output of `make m1.9-demo`

```
==> Step 1: caller in cluster-b posts /execute to gateway in cluster-a
operation_id=<uuid>
==> Step 2: poll gateway /result for outcome
==> Result:
{"operation_id":"<uuid>","status":"completed","result":{"operation_id":"<uuid>","ok":true,"result_json":"<base64-encoded MCP CallToolResult containing 3 issues from kubernetes/kubernetes>"}}
==> Verification:
PASS: PAT bytes do not appear in gateway result (credential boundary preserved)
PASS: federated MCP call returned ok=true
```

## Known issue (verified 2026-04-25, blocking end-to-end)

**github-mcp v1.0.3 uses MCP Streamable HTTP transport, not simple JSON-RPC-over-POST.**

Direct probe of `ghcr.io/github/github-mcp-server:latest http` confirms:
- The MCP endpoint is at `/` (root), not `/messages` (the simple
  HTTP+SSE-pair pattern our adapter assumes).
- The transport is per the
  [MCP Streamable HTTP 2025-03-26 spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http):
  client POSTs to a single endpoint, server may respond with JSON OR
  upgrade to an SSE stream; session is tracked via `Mcp-Session-Id`
  response header that the client must echo on subsequent requests.
- The github-mcp server signals this via CORS headers naming
  `Mcp-Session-Id`, `Mcp-Protocol-Version`, `Last-Event-ID` as
  permitted.

The current `mcp-client` adapter in `core/adapters/mcpclient/adapter.go`
implements the simpler JSON-RPC-over-POST shape that some other MCP
servers expose. **Until the adapter learns Streamable HTTP, the
end-to-end demo will fail at the agent → github-mcp hop.**

The fix is tracked as M1.9 follow-up "Streamable HTTP transport for
mcp-client adapter": handle session establishment (initial POST returns
`Mcp-Session-Id`), send it on subsequent POSTs, handle both JSON and
`text/event-stream` Content-Type responses, parse the latter as SSE
events whose `data:` payload is the JSON-RPC response. Estimated
0.5 day of work.

Until then, the bits of M1.9 that ARE verified end-to-end:
- The Go adapter compiles, tests pass (8 cases, 1000-iter UUID test)
- The two-cluster kind topology comes up cleanly
- The federation gateway accepts /execute, queues, agent polls and runs
- The agent dereferences the K8s Secret correctly
- The PAT bytes never leak to the gateway

What is not yet verified end-to-end (because of the above):
- The agent's actual MCP `tools/call` against github-mcp returns real GitHub
  issues data (i.e., the round-trip)
- The recorded session for whitepaper §7.1

## Troubleshooting

- **`make m1.9-up` fails with "image not found"**: run `make m1.9-build-images`
  first.
- **Agent in cluster-b can't reach gateway**: verify `host.docker.internal`
  resolves inside the cluster-b pod with
  `kubectl --context kind-m19-cluster-b exec demo-caller -n m19-mcp -- nslookup host.docker.internal`.
  On Linux Docker (not OrbStack/Docker Desktop), `host.docker.internal` is
  not auto-defined and you may need
  `--add-host=host.docker.internal:host-gateway` on the kind worker.
- **`make m1.9-demo` returns "transport returned status 404" or 401 from
  the agent**: see "Known issue" above; the adapter needs the Streamable
  HTTP fix to talk to github-mcp v1.0.3.

## Cleanup

```bash
make m1.9-down
```

## What this demonstrates, in one paragraph

A federation gateway in cluster-a accepts an MCP `tools/call` request from a
caller in cluster-b, dispatches via durable queue to a federation agent in
cluster-a, which then dereferences a local Kubernetes Secret to authenticate
to a github-mcp server (also in cluster-a) and returns the result. The
cross-cluster path runs over HTTP (mTLS + SPIFFE per whitepaper §3.6 are M2),
the audit record is the gateway's `OperationStatus` with success/error and
the operation parameters but not the richer `AuditEvent` schema per §3.2
(also M2). This is enough to prove the transport works; the whitepaper's
full claim — single canonical audit, JWT propagation through every hop,
mTLS at every hop with SPIFFE identities — is M2 work and should be
read against this demo as such.

## Cross-references

- Design: [`../../../protocol/docs/m1.9-federated-mcp-adapter-design.md`](../../../protocol/docs/m1.9-federated-mcp-adapter-design.md)
- Whitepaper §7.1 (the paragraph that gets rewritten when this demo lands):
  [`../../../protocol/docs/whitepaper-mcp-for-clusters.md`](../../../protocol/docs/whitepaper-mcp-for-clusters.md)
- MCP client adapter Go code: [`../../../adapters/mcpclient/adapter.go`](../../../adapters/mcpclient/adapter.go)
