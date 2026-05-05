# Portal Agent — security-first OSS design

**Date**: 2026-05-05
**Author**: Gnani Rahul (pair-designed with Claude Opus 4.7)
**Status**: Draft, awaiting review
**Replaces**: `2026-05-04-minion-dp-design.md` (rejected by 3-way review; SDC integration variant rejected by 3-way review; reframed as OSS)
**License of the artifact being built**: **Apache License 2.0**

> This is a **design** document. It defines architecture, interfaces, threat model, and security controls for an open-source agent that connects a customer's Kubernetes cluster to a centrally-hosted DevOps Portal. It does not prescribe day-by-day implementation order — that goes in a companion implementation plan.

---

## 1. What we're building, in one paragraph

Portal Agent is an in-cluster Go binary that gives the central DevOps Portal read access to Kubernetes and a small set of platform services (Prometheus, ArgoCD, with more to follow) running inside the cluster. The agent dials home over a single mTLS-authenticated outbound connection. The central never holds cluster credentials; the agent does, executes intents using its own cluster-scoped identity, and forwards results back. Identity comes from one of three configurable backends: a built-in central CA (default, zero-dependency), bring-your-own-CA (cert-manager / Vault PKI / AWS PCA), or SPIFFE/SPIRE federation. All three speak the same on-the-wire protocol; identifiers are SPIFFE-format regardless of issuer. **v0.1 is strictly read-only** — every RPC is `Get/List/Watch/Query`. Mutations come in v0.5+ after independent security review.

## 2. Goals and non-goals

### Goals
- **OSS-first.** Apache 2.0, public repo, public threat model, public security disclosure process.
- **Zero external infrastructure dependencies.** Works on a homelab Pi cluster or a Fortune-500 production environment with the same install path.
- **One-line install** per cluster. `helm install portal-agent ...` with one secret reference.
- **Outbound-only network**. Agent dials home; central never opens a connection to the cluster.
- **No central-held cluster credentials.** Agent holds its own ServiceAccount; central holds only an opaque cluster identity.
- **Three identity postures, all first-class**: built-in CA / BYO-CA / SPIFFE-SPIRE.
- **Survivable to a compromise of central**: a compromised central cannot pivot to arbitrary K8s mutation in any cluster.
- **Single conceptual model for all platform services** the portal proxies (K8s, Prom, ArgoCD at v0.1; more in subsequent releases).
- **Cleanly versioned wire protocol** with a written deprecation policy.

### Non-goals (v0.1)
- Mutations of any kind. No scale, no exec, no apply, no delete.
- Multi-tenant central. v0.1 is single-tenant per central deployment. Multi-tenant central is for v1+.
- Adapters beyond Kubernetes, Prometheus, and ArgoCD. Other adapters (Grafana, Loki, ES, OS, Kibana, Fluentd) ship as separate releases or community contributions.
- HA on the agent side beyond simple replicas.
- Automatic upgrades. Operators choose when to upgrade.

## 3. Glossary

| Term | Meaning |
|---|---|
| **Central** | The DevOps Portal Next.js application |
| **Agent** | The Go binary deployed in each managed cluster |
| **Cluster** | A K8s cluster managed by one Agent instance |
| **Tenant / Org** | An `Organization` row in central's DB; central-side multi-tenant boundary |
| **Trust domain** | SPIFFE construct: the namespace under which all identities in a deployment live, e.g. `portal.local` |
| **SVID** | SPIFFE Verifiable Identity Document — an X.509 cert (or JWT) with a SPIFFE URI in its SAN |
| **Posture** | The identity issuance backend in use: A (built-in CA), B (BYO-CA), or C (SPIRE) |
| **Envelope** | Signed wrapper around every RPC carrying user/command/timestamp/nonce |

## 4. Threat model

### 4.1 Trust boundaries

```
┌───────────────────────────────────────────────────────────┐
│  Public internet                                          │
│                                                           │
│  ┌────────────────────┐ ┌─────────────────────────────┐  │
│  │  Central Portal    │ │  one outbound mTLS gRPC     │  │
│  │  (Next.js + Pg)    │ │  stream per agent           │  │
│  │  + FRP server      │◄┼───────── per agent ─────────┤  │
│  │  + Built-in CA     │ │                             │  │
│  │  (Posture A)       │ │                             │  │
│  └─────────┬──────────┘ └─────────────────────────────┘  │
│            │                                              │
│            │ admin web UI (different port)                │
│  ┌─────────┴──────┐                                       │
│  │  Operator      │                                       │
│  └────────────────┘                                       │
│                                                           │
│ ─── trust boundary ────────────────────────────────────── │
│                                                           │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Customer Kubernetes cluster                       │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  portal-agent namespace                      │  │   │
│  │  │  - portal-agent Deployment (Go binary)       │  │   │
│  │  │  - FRP client (embedded in same binary)      │  │   │
│  │  │  - K8s Secret with cert+key (Posture A or B) │  │   │
│  │  │  - SPIRE Workload API socket (Posture C)     │  │   │
│  │  │  - ServiceAccount with read-only ClusterRole │  │   │
│  │  │  - NetworkPolicy: outbound only              │  │   │
│  │  └────────┬───────────┬─────────────────────────┘  │   │
│  │           │           │                             │   │
│  │      K8s API   ArgoCD/Prom (in-cluster, native DNS)│   │
│  └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Adversaries

| Adversary | Capability | Defended by |
|---|---|---|
| External network attacker | passive + active MITM, packet capture, traffic analysis | TLS 1.3, mTLS, PFS-only ciphers, per-cluster cert pinning |
| Compromised central | full code execution + DB access on central | Per-RPC envelope signing with separated signer key, agent-side RBAC enforcement, both-side audit, command policy on agent overrides central |
| Compromised agent | code exec inside the agent pod | NetworkPolicy egress-only, agent SA with read-only RBAC by default, no cluster-admin, response sanitization on central side, blast radius bounded to one cluster |
| Compromised user account on central | session creds stolen | NextAuth MFA, short session TTL, per-RPC envelopes carry user identity for audit, mutation requests can require step-up auth (v0.5+) |
| Curious cluster operator | can read agent's K8s Secrets if they have RBAC | Per-cluster identity bound to agent enrollment; central rejects RPCs from a fingerprint not bound to that cluster_id; operator with full SA access cannot impersonate a cluster they don't already control (RBAC scope) |
| Supply-chain attack on agent image | malicious dep, typosquat, build pipeline compromise | Pinned digests, cosign keyless signing, CycloneDX SBOM, SLSA L2+ build provenance, Dependabot, Trivy + govulncheck in CI |
| Compromised CA (Posture A only) | central's root key stolen | Operator rotates root + re-enrolls all clusters. Posture B/C escape this by using external CAs |
| Compromised customer K8s API server | full cluster takeover | Out of scope: if the cluster is owned, the agent can be replaced. Documented limitation. |

### 4.3 What survives a central compromise

The agent **does not blindly execute commands** even from an authenticated central:
- **Local policy file** in agent (read-only at runtime, mounted from ConfigMap) declares which intents the agent accepts. Default v0.1: `{"allowed_intents": ["List*", "Get*", "Watch*", "Query*"]}`.
- Even if a compromised central sends a signed `ScaleWorkload`, the agent rejects it because v0.1 policy doesn't list it.
- This is "central is honest but might be compromised" defense — a second authorization gate.

### 4.4 What does not survive

- **A compromised K8s API server in the customer cluster.** If the customer's cluster is owned, the agent's RBAC is moot. We document this as out-of-scope and direct readers to general K8s hardening.
- **A compromised central CA root key (Posture A).** Operator rotates root + re-enrolls. This is the cost of self-contained operation. Operators wanting stronger guarantees move to Posture B or C.

## 5. Architecture overview

### 5.1 Components

**Central side** (on top of existing devops-portal Next.js app):
- **`/api/agent/enroll`** (HTTPS, port 8443, mTLS not required) — accepts one-time enrollment requests in Posture A/B
- **`/api/agent/grpc`** (HTTPS, port 8443, **mTLS required**) — bidi gRPC endpoint
- **Built-in CA service** (Posture A): root key in a K8s Secret (or env var for local-dev central), short-lived intermediate, agent certs 24h
- **Issuer-signing service** (separate from web tier): holds Ed25519 signing key for command envelopes; web tier asks it to sign per-RPC; in single-tenant single-binary central it can be in-process behind an interface
- **Admin UI**: cluster registration page, cluster detail page, agent health dashboard

**Agent side** (single Go binary):
- Bootstraps identity using whichever posture is configured (A, B, or C)
- Embeds an FRP client; opens a single outbound connection to central's FRP server
- Inside the FRP tunnel, runs gRPC server (using the agent's SVID for mTLS)
- Dispatcher → adapters → K8s/Prom/ArgoCD APIs
- Edge-redacts secrets in responses before they leave the cluster
- Local audit sink (stdout JSON)
- Watches its identity material for rotation; reloads without process restart

### 5.2 The three identity postures

This is the load-bearing design choice. All three produce identities of the form `spiffe://<trust-domain>/agent/<cluster-id>`. The agent picks the posture from its Helm values; central accepts whichever posture verifies.

#### Posture A — Self-contained (the default)

```yaml
# values.yaml
identity:
  posture: builtin       # default
  centralUrl: https://portal.example.com:8443
  centralCaSha256: sha256:<pinned-fingerprint-of-central-CA-root>
  enrollment:
    tokenSecretRef:
      name: portal-agent-enrollment
      key: token         # one-time, 15-min TTL
```

Flow:
1. Central operator creates a "cluster registration" in admin UI; central mints `clusterId`, a 15-min enrollment token, returns a copy-pasteable helm command + `centralCaSha256`.
2. Operator runs `helm install ...`. The chart creates a Secret holding the enrollment token; agent mounts it.
3. Agent generates Ed25519 keypair locally; key never leaves the pod.
4. Agent posts CSR + token to `/api/agent/enroll`, validating central's TLS cert against the pinned `centralCaSha256`.
5. Central atomically marks token consumed (DB transaction with `WHERE consumed_at IS NULL` predicate), signs CSR with the built-in CA, returns:
   - The agent's cert (24h lifetime)
   - The current command-envelope issuer pubkey
   - The central CA bundle (for the agent to verify central's TLS in steady state)
6. Agent writes cert + key + issuer pubkey to a separate Secret; the enrollment-token Secret is deleted.
7. Agent re-enrolls (renews) at the 18-hour mark via a `RenewCert` RPC that authenticates with the existing valid cert. If renewal fails for >6h, the agent disconnects loudly and waits for operator action.

Trust property: TOFU on the central CA. If central's root is compromised, all clusters re-enroll. Acceptable for self-hosted single-org deployments.

#### Posture B — Bring-your-own-CA

```yaml
identity:
  posture: byo-ca
  centralUrl: https://portal.example.com:8443
  caBundleSecretName: portal-agent-ca-bundle    # central's CA cert chain
  certIssuer:
    type: cert-manager   # or "vault" or "aws-pca"
    issuerRef:
      name: corp-internal-ca
      kind: ClusterIssuer
    spiffeId: spiffe://portal.local/agent/<cluster-id>
```

Flow:
1. Same admin UI flow on central; central does NOT issue the cert.
2. Operator deploys a `Certificate` resource (cert-manager) or `PKI Engine` lease (Vault) that issues a cert with the SPIFFE URI in the SAN.
3. Agent mounts the cert + key from the K8s Secret cert-manager creates.
4. Agent connects directly to central's gRPC; central verifies the agent's cert against its trust bundle (which the operator provides at central install time, via `central.trustedCAs`).
5. Cert rotation is handled entirely by cert-manager / Vault. Agent's fsnotify watcher reloads on Secret update.

Trust property: rooted in the operator's existing PKI. Survives a compromise of central's web/DB tier provided central's trust bundle isn't tampered with.

#### Posture C — SPIFFE / SPIRE federation

```yaml
identity:
  posture: spiffe
  spire:
    workloadApiSocket: /spire/workload-api/spire-agent.sock
    trustDomain: corp.example.com
    expectedSpiffeId: spiffe://corp.example.com/portal-agent/<cluster-id>
  centralUrl: https://portal.example.com:8443
  centralFederationBundle:
    secretName: portal-central-trust-bundle    # exported from central's SPIRE setup
```

Flow:
1. Operator already runs SPIRE Server + Agents in the customer cluster.
2. The portal-agent Pod is registered in SPIRE with appropriate selectors (e.g. namespace + ServiceAccount).
3. Agent fetches its SVID from the SPIRE Workload API socket; rotation is handled by SPIRE (typically hourly).
4. Agent dials central; mTLS uses the SVID; central verifies against the federated trust bundle.
5. No enrollment step. Identity is platform-attested by SPIRE.

Trust property: strongest. Workload identity is rooted in the customer's existing zero-trust infrastructure. Central never issues certs. Federation between central's trust domain and the customer's is a one-time bundle exchange.

#### How the agent picks the posture

```go
// agent boot
switch cfg.Identity.Posture {
case "builtin":
    src = identity.NewBuiltinClientSource(cfg.Identity.Builtin)
case "byo-ca":
    src = identity.NewBYOCASource(cfg.Identity.BYOCA)
case "spiffe":
    src = identity.NewSpiffeSource(cfg.Identity.Spire)
default:
    log.Fatalf("unknown identity.posture: %q", cfg.Identity.Posture)
}
// All three implement the same interface:
//   GetCertificate() (*tls.Certificate, error)
//   TrustBundle() (*x509.CertPool, error)
//   SpiffeId() spiffeid.ID
```

The on-wire protocol is identical across all three. Central doesn't know (and doesn't need to know) which posture the agent uses — only that the certificate chain validates against the trust bundle central has been told to trust.

### 5.3 Wire protocol

#### 5.3.1 Transport: FRP, embedded

- **FRP (https://github.com/fatedier/frp), Apache 2.0**, used for the outbound TCP tunnel.
- Central ships a Docker image that bundles `frps` (FRP server) on a separate port from the human web UI.
- Agent ships a Docker image that bundles `frpc` (FRP client). Agent process launches `frpc` as a child or links the FRP library directly (decision in implementation plan).
- Inside the FRP tunnel, the agent's gRPC server listens on a local Unix socket; central proxies gRPC through the tunnel to that socket.
- **Dedicated tunnel server per central**: not shared with any other product. Operators can run multiple central instances (each with its own FRP server) for tenant isolation.

Why FRP and not invent our own:
- Apache 2.0
- Mature (used at TikTok, Tencent scale)
- Supports TCP, KCP, WebSocket, multiplexed
- Active maintenance, large community
- Survives proxy-hostile networks

#### 5.3.2 Authentication

- **TLS 1.3 only** between agent and central. Cipher allowlist: `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`. No CBC, no RSA key exchange.
- **mTLS required**: agent presents SVID; central verifies against trust bundle (Posture A: built-in; B: operator-provided; C: federated).
- **The FRP layer's own auth**: operator sets a token (random 32-byte, base64) via the same enrollment flow OR via a separate Helm value. Defense in depth: even if mTLS were misconfigured, FRP rejects the connection.

#### 5.3.3 Authorization

- **Envelope signing**: every RPC carries a metadata header `x-portal-envelope` (base64 JSON):

```json
{
  "v": 1,
  "command_id": "0d2c4f3a-uuidv4",
  "issued_at": "2026-05-05T20:15:30.123Z",
  "user_id": "u_abcdef",
  "tenant_id": "org_default",
  "cluster_id": "c_123",
  "intent": "ListPods",
  "args_hash": "sha256:abcdef...",
  "issuer_kid": "central-2026-q2",
  "sig": "ed25519:base64..."
}
```

- `sig` is over the canonical JSON of the rest, signed by central's issuer key.
- `args_hash` is over the actual transmitted gRPC request bytes (not the parsed message — protobuf serialization is not canonical, so we sign raw bytes as the reviewer pointed out).
- Agent validates in this order, rejecting on first failure:
  1. `v == 1` → else `UNSUPPORTED_ENVELOPE_VERSION`
  2. `cluster_id == self.cluster_id` → else `MISMATCHED_CLUSTER`
  3. `issued_at` within `[now-60s, now+60s]` → else `STALE_OR_FUTURE`
  4. `command_id` not in replay cache (10-min sliding window, **persisted to disk** so restart doesn't reset; reviewer flagged in-memory-only) → else `REPLAY_DETECTED`
  5. `issuer_kid` is one of the trusted keys (rotation: trust set is fetched at agent startup AND pushed via heartbeat) → else `UNKNOWN_ISSUER`
  6. `sig` verifies under the issuer pubkey for that `kid` → else `BAD_SIGNATURE`
  7. `args_hash` matches SHA-256 of the actual gRPC request body bytes → else `ARGS_TAMPER`
  8. `intent` matches the gRPC `fullMethodName` → else `INTENT_METHOD_MISMATCH`
  9. `intent` is in the agent's local policy allowlist → else `LOCAL_POLICY_DENY`

On any failure, agent logs the rejection (with envelope id, NOT the full envelope) and returns gRPC `PERMISSION_DENIED`.

#### 5.3.4 The TLS-SNI-through-tunnel problem (reviewer-flagged, addressed)

The reviewer correctly pointed out: when central calls `https://kubernetes.default.svc:443` through an FRP tunnel that terminates at `tunnel-host:5001`, naive TLS verification fails because the cert is for `kubernetes.default.svc`, not `tunnel-host`.

**Resolution**: central does not call services through the tunnel directly. Central calls *the agent's gRPC*, and the agent makes the in-cluster service call locally with proper TLS verification.

That is: central sends `ListPods{namespace="demo"}` to the agent. The agent calls its in-cluster K8s API server (via the agent's own ServiceAccount, with the correct CA bundle from `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`). The agent gets the pod list. The agent serializes it, redacts any embedded secrets, returns it through the gRPC stream.

This means: TLS issues are bounded to the agent ↔ in-cluster-service hop, where the agent has the correct CA bundle and DNS. The central ↔ agent hop is its own mTLS. No SNI translation needed.

#### 5.3.5 Streaming reconnect protocol

Reviewer-flagged: pod log tails, watches, exec, port-forward die dirty if the tunnel restarts.

**Resolution per stream type**:
- **Watches** (`WatchEvents`, `WatchPods`): agent uses K8s `resourceVersion` for resume. On reconnect, the agent re-establishes the watch from the last seen `resourceVersion`. Central is told via stream metadata: "resumed from rv=12345"; central deduplicates events.
- **Pod logs** (`StreamPodLogs`): agent passes a `sinceTime` derived from the last log line's timestamp on resume. Some duplication is possible at the boundary; central deduplicates by exact-match on the timestamped line. Central's UI shows a "stream resumed" indicator.
- **Exec, attach, port-forward**: cannot resume cleanly. v0.1 doesn't support these (read-only). v0.5+ surfaces a hard disconnect indicator.

Central-side behavior on tunnel drop: the gRPC stream errors with `UNAVAILABLE`. Central retries with backoff; UI shows "reconnecting." After 60s of failed reconnects, UI shows "cluster unreachable."

### 5.4 RBAC

#### 5.4.1 Default ClusterRole (read-only)

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: portal-agent-read
rules:
  - apiGroups: [""]
    resources:
      - namespaces
      - nodes
      - pods
      - pods/log
      - services
      - endpoints
      - configmaps          # NOT secrets — explicit non-grant
      - events
      - persistentvolumeclaims
      - persistentvolumes
      - resourcequotas
      - limitranges
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: [deployments, statefulsets, daemonsets, replicasets]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: [ingresses, networkpolicies, ingressclasses]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: [jobs, cronjobs]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apiextensions.k8s.io"]
    resources: [customresourcedefinitions]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: [pods, nodes]
    verbs: ["get", "list"]
  # ArgoCD CRDs (when ArgoCD adapter is enabled)
  - apiGroups: ["argoproj.io"]
    resources: [applications, appprojects, applicationsets]
    verbs: ["get", "list", "watch"]
```

**Explicitly NOT granted**: `secrets`, `serviceaccounts`, `roles`, `rolebindings`, `clusterroles`, `clusterrolebindings`, anything in `rbac.authorization.k8s.io`, no `*` verbs.

#### 5.4.2 v0.5+ opt-in expansions

```yaml
permissions:
  scaleWorkloads: false
  restartWorkloads: false
  exec: false
  applyYaml: false        # likely never recommended; gated separately
  manageSecrets: false
  manageRBAC: false
```

Each flag gates BOTH the ClusterRole expansion AND the agent's local policy. Both must be true for the action to succeed.

### 5.5 Edge redaction

Reviewer-flagged: K8s Events, ConfigMaps, pod logs, and resource YAML routinely contain secrets in plaintext (env vars dumped on container start, JWT in error messages, kubeconfigs in ConfigMaps, etc.).

**Resolution**: the agent applies a redactor pipeline to every response field of type "free-form text" before transmitting:

```go
type Redactor func(s string) string

var defaults = []Redactor{
    redactBearerJWT,         // eyJ... → [REDACTED:JWT]
    redactAWSAccessKey,      // AKIA[A-Z0-9]{16} → [REDACTED:AWS]
    redactGitHubPAT,         // ghp_... → [REDACTED:GH]
    redactPEMBlocks,         // -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY----- → [REDACTED:PEM]
    redactBasicAuthURLs,     // https://user:pass@host → https://user:[REDACTED]@host
    redactKubeconfigYAML,    // 'token:', 'client-key-data:', 'password:' lines
    redactPasswordEquals,    // password= / pwd= patterns
    // ... extensible via plugin/regex config
}
```

Applied to: pod log lines (per-line, before stream flush), Event message strings, K8s object YAML, and adapter responses (search hits, etc.).

This is **best-effort, not a security boundary**. Documented as such. Operators who need stronger guarantees disable adapters that surface free-form text (e.g. `pods/log` permission) at the RBAC level.

### 5.6 Audit

#### Central side

```sql
CREATE TABLE agent_audit (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cluster_id      TEXT NOT NULL,
  user_id         TEXT,                  -- null for system-issued (heartbeats, etc.)
  command_id      UUID NOT NULL UNIQUE,
  intent          TEXT NOT NULL,
  args_hash       BYTEA NOT NULL,
  outcome         TEXT NOT NULL,         -- ok | rejected | error
  outcome_detail  TEXT,
  duration_ms     INT
);
CREATE INDEX agent_audit_cluster_time ON agent_audit(cluster_id, occurred_at DESC);
CREATE INDEX agent_audit_user_time    ON agent_audit(user_id, occurred_at DESC);
```

Append-only via `SECURITY DEFINER` Postgres function. App user can `INSERT`, never `UPDATE/DELETE`.

#### Agent side

JSON to stdout, picked up by whatever log pipeline the cluster already runs:

```json
{
  "ts": "2026-05-05T20:15:30.456Z",
  "level": "info",
  "msg": "envelope_handled",
  "cluster_id": "c_123",
  "command_id": "0d2c4f3a-...",
  "intent": "ListPods",
  "user_id": "u_abcdef",
  "args_hash": "sha256:...",
  "envelope_verify": "ok",
  "rpc_outcome": "ok",
  "duration_ms": 12,
  "code": "OK"
}
```

#### Reconciliation

**Hourly** job (not daily — reviewer flagged 24h as too long): central queries each connected agent for its audit count by intent in the last hour, compares to central's own count. Discrepancy alerts SecOps. v0.1 ships the count-check; v1+ adds a hash-chained log comparison for tamper detection.

### 5.7 Helm chart layout

```
deployment/helm-portal-agent/
├── Chart.yaml
├── values.yaml                 # documented defaults
├── values.schema.json          # JSON-schema validated at install
├── README.md
├── crds/                       # (none in v0.1)
└── templates/
    ├── _helpers.tpl
    ├── serviceaccount.yaml
    ├── clusterrole.yaml        # default read-only
    ├── clusterrolebinding.yaml
    ├── deployment.yaml         # the agent
    ├── service.yaml            # ClusterIP for /healthz, /readyz
    ├── secret-bootstrap.yaml   # Posture A: enrollment token + central CA SHA (15-min TTL note)
    ├── networkpolicy.yaml      # rendered from values.services
    ├── poddisruptionbudget.yaml
    ├── servicemonitor.yaml     # optional, if Prometheus operator is present
    └── tests/
        └── connection-smoke.yaml  # `helm test` — verifies agent connects
```

Values schema enforces:
- Exactly one of `identity.posture: builtin | byo-ca | spiffe` is fully configured.
- `central.url` must be HTTPS.
- `central.caSha256` is required for posture `builtin`; rejected for posture `spiffe`.
- Inline credentials in `services.*.credentials` are rejected — must be `credentialSecretName` references.
- `permissions.*` flags are all `false` in v0.1 (mutations not implemented).
- `central.insecureSkipTLSVerify: true` requires also `central.acknowledgeInsecure: true` (deliberate friction).

### 5.8 Adapter pattern

Common Go interface:

```go
package adapter

type Adapter interface {
    Name() string
    HealthCheck(ctx context.Context) error
    Configure(cfg ServiceConfig) error
    Close() error
}

type ServiceConfig struct {
    BaseURL          *url.URL
    Credentials      Credentials
    TLSConfig        *tls.Config
    Timeout          time.Duration
}

type Credentials struct {
    Type     CredType    // basic, bearer, mTLS, spiffe, none
    Username string
    Password string
    Token    string
    ClientCertPEM []byte
    ClientKeyPEM  []byte
}
```

Per-adapter sub-interface:

```go
type ArgoCDAdapter interface {
    Adapter
    ListApplications(ctx, ListAppsRequest) (*ApplicationsResponse, error)
    GetApplication(ctx, GetAppRequest) (*Application, error)
    ListAppProjects(ctx, ListProjectsRequest) (*AppProjectsResponse, error)
    ListApplicationSets(ctx, ListAppSetsRequest) (*ApplicationSetsResponse, error)
}
```

#### v0.1 adapter inventory

| Adapter | RPCs at v0.1 | Auth modes |
|---|---|---|
| Kubernetes (built-in) | List/Get for Pods/Namespaces/Nodes/Workloads/Services/Ingresses/Events/CRDs/YAML; StreamPodLogs; WatchEvents | In-cluster ServiceAccount only |
| Prometheus | Query, QueryRange, ListAlerts, ListTargets | none (in-cluster); basic auth; bearer |
| ArgoCD | ListApplications, GetApplication, ListAppProjects, ListApplicationSets | bearer token (preferred — dedicated read-only account); username/password (discouraged) |

Adapters explicitly deferred to community / future releases: Grafana, Loki, Elasticsearch, OpenSearch, Kibana, Fluentd. Each is a self-contained module under `agent/adapters/<service>/`. Contribution doc shows how to add one.

### 5.9 Container hardening

| Item | Value |
|---|---|
| Base image | `gcr.io/distroless/static:nonroot` (Go static binary) |
| User | UID 65532, GID 65532, no shell |
| Filesystem | Read-only root; `emptyDir` for `/tmp` and `/var/cert-cache` |
| Capabilities | All dropped, none added |
| Seccomp | `RuntimeDefault` |
| AppArmor | `runtime/default` |
| Privilege escalation | Disabled |
| HostPID/Net/IPC | False |
| Image | Multi-arch (amd64, arm64), signed via `cosign sign --keyless` |
| SBOM | CycloneDX, attached as cosign attestation |
| SLSA | L2 build provenance via reusable GitHub Actions workflow |
| CVE scanning | `trivy fs`, `grype`, `govulncheck` in CI; block on HIGH+ |

### 5.10 Distribution & supply chain

- **Repository**: stays in `gnanirahulnutakki/devops-portal` as a monorepo. Agent code lives under `/agent/`. Helm chart under `/deployment/helm-portal-agent/`.
- **License**: Apache 2.0 (`LICENSE` at repo root, headers in source files).
- **Container images**: published to `ghcr.io/gnanirahulnutakki/portal-agent:<version>` and `:central:<version>`.
- **Helm chart**: published to a chart repo (initially `https://charts.example.com/devops-portal/` — TBD).
- **Image signing**: cosign keyless via Sigstore Fulcio + Rekor. Verification via Helm chart's pre-install hook (Kyverno policy as a separate optional install).
- **SBOM**: CycloneDX, attached to each release.
- **SLSA**: L2 build provenance via the `slsa-framework/slsa-github-generator` action. Aiming for L3 once GitHub-Actions-hosted runners support it.
- **Renovate**: enabled for dependency updates; security-only PRs auto-merged after CI passes.
- **Threat model**: published as `SECURITY.md` at repo root, links to a `docs/THREAT_MODEL.md` for the full STRIDE breakdown.
- **Security disclosure**: `SECURITY.md` lists `security@<domain>` and a GPG key. GitHub Security Advisories enabled.

### 5.11 Versioning & deprecation

- **Wire protocol**: `agent/v1` is the only namespace at GA. Breaking changes require `agent/v2` running in parallel for ≥6 months.
- **Agent ↔ central skew**: agent N can talk to central N or N+1. Central N+1 supports agent ≥ N-1 for a quarter, then drops. Both sides advertise version at handshake.
- **Helm chart**: semver. Major bumps signal breaking values changes.
- **Deprecation notice**: sent in `Heartbeat` response when central is about to drop support for the connected agent's version.

### 5.12 Phased rollout

#### v0.1 (target: 6-8 weeks of focused work)
- Posture A + Posture B (Posture C documented but not shipped)
- Adapters: K8s, Prometheus, ArgoCD (read-only)
- Single-tenant central
- mTLS, signed envelopes, replay protection, edge redaction
- Helm chart with cosign-signed images
- Public threat model
- Pilot: kind cluster + this devops-portal central running locally

#### v0.5 (target: +3 months)
- Posture C (SPIFFE/SPIRE federation)
- Adapters: Grafana + Loki
- v0.5 mutations behind a separate security review: `ScaleWorkload`, `RestartDeployment`. No `exec`, no `applyYaml` yet.
- Multi-tenant central (multiple `Org`s mapping to multiple agents independently)
- External pen-test before GA

#### v1.0 (target: +6 months from v0.1)
- Adapters: Elasticsearch, OpenSearch, Kibana, Fluentd
- `exec` adapter behind explicit per-cluster admin opt-in + step-up auth
- HA central (multi-region)
- CNCF Sandbox application (if community traction is there)

### 5.13 Migration path for the existing kubeconfig clusters

Existing `Cluster.authType in ('standard','duplo','eks')` clusters keep working. v0.1 adds `'agent'` as a fourth authType. Both modes coexist indefinitely. If/when adoption of agent mode warrants it, a future release deprecates kubeconfig with a 12-month sunset.

## 6. Failure modes & operator runbook (highlights)

| Symptom | First check | Likely cause |
|---|---|---|
| Agent stuck in `enrolling` (Posture A) | agent logs: TLS handshake error | Wrong `central.caSha256` or central URL unreachable |
| Agent stuck after enrollment, no RPCs | central audit shows successful enroll | Egress NetworkPolicy too tight, or central:8443 firewall closed |
| Many `BAD_SIGNATURE` rejections | Issuer key rotated without distributing pubkey to agents | Restart agents to pick up new pubkey OR push via heartbeat |
| `REPLAY_DETECTED` in logs | HTTP/2 retry races (benign) OR central double-signing (not benign) | Investigate central's signing service if sustained |
| All adapters reporting auth errors | Operator rotated cluster passwords without updating Secrets | Update Secrets via ESO/Sealed/manual; agent auto-reloads |
| Agent CPU spike | Streaming consumers without backpressure handling | Drop subscribers; verify central respects flow control |
| Posture C: agent can't fetch SVID | SPIRE Workload API unreachable | Check SPIRE Agent in cluster; check workload registration |
| Posture B: cert expired and not renewed | cert-manager / Vault issuance stuck | Inspect cert-manager events; verify Issuer is healthy |

Full runbook lives in `docs/RUNBOOK.md`.

## 7. Testing strategy

| Layer | Approach |
|---|---|
| Unit | Per-adapter against live in-Docker fixtures (real ArgoCD, Prom — no mocks per project policy) |
| Integration | Agent + central in docker-compose; signed-envelope round-trip; cert lifecycle for all 3 postures |
| End-to-end | kind cluster + helm install agent + central running locally; smoke through every v0.1 RPC |
| Streaming durability | Kill the FRP server mid-stream; verify central reconnects, agent resumes watches via `resourceVersion`, dedup works |
| Fuzzing | go-fuzz on envelope parser and RPC handler input messages |
| Chaos | Random network partitions during streams; replay attacks; clock skew injection |
| Security review | External pen-test of enrollment + envelope flow before GA. Public threat-model walkthrough |
| Performance | 1k RPCs/sec sustained per agent connection; p99 under 50ms for `List*` on a 5k-pod cluster |

## 8. What we're NOT building (explicit non-goals)

| Topic | Where it lives |
|---|---|
| Day-by-day implementation steps | `docs/superpowers/plans/2026-05-05-portal-agent-implementation.md` (next doc) |
| Specific Go module layout | implementation plan |
| v0.5 mutation design | `docs/superpowers/plans/<future>-portal-agent-mutations.md` |
| Multi-region central HA | future |
| CLI tool for ops | future |
| Auto-update | explicitly out of scope |
| Mutation `applyYaml` | explicitly out of scope, possibly forever |

## 9. Decisions captured here that need to stay decided

1. **Read-only v0.1**. No mutation RPCs at all in v0.1.
2. **Three identity postures**, all first-class, all configurable.
3. **SPIFFE-format identifiers** across all postures.
4. **FRP for transport**, embedded in both agent and central images.
5. **mTLS + signed envelope** for auth/authz. Bearer-token-only is rejected.
6. **Outbound-only** tunnel.
7. **Default-deny RBAC**; only read verbs in v0.1.
8. **NetworkPolicy ON by default**.
9. **Distroless, non-root, signed images, SBOM, SLSA L2** at GA.
10. **Audit on both sides** with hourly reconciliation.
11. **Edge redaction** in agent before responses leave the cluster.
12. **Issuer key separated** from web tier (signer service interface; can be in-process for single-binary central).
13. **No auto-update**.
14. **Co-existence with the existing kubeconfig clusters** — both modes work side by side.
15. **Apache 2.0 license**, monorepo at `gnanirahulnutakki/devops-portal`.
16. **`spiffe://` trust domain**: auto-generated UUID at first central install (`portal.<uuid>.local`), operator can override with `--trust-domain`.
17. **Hourly audit reconciliation** (not daily) per reviewer feedback.
18. **In-disk replay cache** (not in-memory only) per reviewer feedback.
19. **`args_hash` over raw transmitted bytes** (not parsed protobuf) per reviewer feedback.
20. **Envelope `intent` bound to gRPC `fullMethodName`** per reviewer feedback.

## 10. Sign-off

This document needs review from:
- [ ] Author of the implementation plan (next doc in the series)
- [ ] Security reviewer (someone other than the design author)
- [ ] Cluster ops reviewer
- [ ] At least one community reviewer (if seeking external traction)

Once signed off, this document is frozen except for amendments tracked at the bottom in a "Changes since approval" log.

---

## Appendix A — Differences from the rejected `2026-05-04-minion-dp-design.md`

| Original Minion DP design | Portal Agent (this doc) |
|---|---|
| Custom mTLS protocol invented from scratch | FRP-embedded transport (Apache 2.0, mature) |
| Single identity posture (built-in CA only) | Three configurable postures (built-in / BYO-CA / SPIFFE-SPIRE) |
| 9 adapters at GA | 3 adapters at v0.1 (K8s, Prom, ArgoCD); rest as community contributions |
| `service Agent { rpc ListPods... }` (broken — central can't call methods on agent that's the gRPC client) | `Connect(stream→stream)` carrying envelope-wrapped typed messages over FRP |
| Daily audit reconciliation | Hourly |
| In-memory replay cache | On-disk persistent cache |
| `args_hash` over parsed protobuf (non-canonical) | `args_hash` over raw transmitted bytes |
| Envelope `intent` not bound to RPC method | Envelope `intent == fullMethodName` enforced |
| TLS SNI through tunnel was unaddressed | Resolved: agent makes in-cluster service calls locally; tunnel only carries agent ↔ central traffic |
| Streaming reconnect not designed | Per-stream resume protocol: watches via `resourceVersion`, logs via `sinceTime`, exec/attach surface hard disconnect |
| WSS fallback "with the same gRPC framing" (impossible as stated) | Single transport (FRP); FRP itself handles proxy traversal |
| Inline `enrollment.token` Helm value accepted | Only `tokenSecretRef` accepted; inline rejected by `values.schema.json` |
| Closed-source assumption | Apache 2.0 OSS, public threat model, public security disclosure |
| Phase 2 mutations pre-allocated in schema | Mutations explicitly out of scope until v0.5 + separate security review |
| PSP referenced (removed in K8s 1.25+) | Removed; PSA labels + Kyverno policies documented |
