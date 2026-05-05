# Minion DP — security-first design

**Date**: 2026-05-04
**Author**: Gnani Rahul (pair-designed with Claude Opus 4.7)
**Status**: Draft, awaiting review
**Replaces**: nothing — this is a new product line within the devops-portal repo
**Consumers of this doc**: implementation plan author, security review, ops team, future maintainers

> This is a **design** document. It defines the architecture, interfaces, threat model, and security controls. It does not prescribe the day-by-day implementation order — that is in the companion implementation plan.

---

## 1. What we're building, in one paragraph

Minion DP is an in-cluster agent that the central DevOps Portal uses to read state from, and (in a later phase) issue actions against, a Kubernetes cluster and the platform services running inside it (ArgoCD, Prometheus, Grafana, Loki, Elasticsearch, OpenSearch, Kibana, Fluentd). The agent dials home over a single mTLS-authenticated outbound HTTP/2 connection. The central portal never holds cluster credentials; the minion holds them, executes intents using its own cluster-scoped identity, and forwards results back. This Phase 1 release is **strictly read-only** — every RPC is a `Get/List/Watch/Query`. Mutations are deferred to Phase 2 and require additional design review.

## 2. Goals and non-goals

### Goals
- One-line install via `helm install` against any K8s cluster ≥ 1.27.
- Outbound-only network requirement: minion dials central; central never opens a connection to the cluster.
- Central holds zero cluster credentials. All cluster credentials live in K8s Secrets in the minion's namespace.
- Production-grade security defaults out of the box (mTLS, default-deny RBAC, NetworkPolicy, distroless image, signed images, SBOM).
- Single conceptual model for 9 services on day one (K8s + 8 adapters).
- Cleanly versioned wire protocol with deprecation policy.
- Survivable to compromise of the central portal: an attacker who owns central cannot pivot to arbitrary cluster mutation.

### Non-goals (Phase 1)
- Mutations of any kind (no scale, no exec, no apply, no delete).
- Multi-region HA on the minion side. One minion deployment per cluster, with replicas, is fine; cross-cluster failover is not.
- Workload runtime metrics collection / replacement of Prometheus. Minion proxies Prom; it doesn't replace it.
- Service mesh integration beyond standard NetworkPolicy.
- Automatic updates (operator chooses when to upgrade Minion DP via Helm).

## 3. Glossary

| Term | Meaning |
|---|---|
| **Central** | The existing devops-portal Next.js app at `https://portal.example.com` |
| **Minion DP** | The new Go agent deployed per cluster |
| **Tenant / Org** | An `Organization` row in central's DB; multi-tenant boundary |
| **Cluster** | A K8s cluster managed by one minion |
| **Adapter** | A pluggable client inside the minion that talks to one platform service (e.g. `ArgoCDAdapter`) |
| **Envelope** | Signed wrapper around every RPC carrying user/command/timestamp/nonce |
| **Enrollment token** | One-time, 15-min, single-use credential the minion uses on first boot |
| **Cluster cert** | Long-lived X.509 cert the minion uses for mTLS after enrollment |
| **Issuer key** | Central's Ed25519 signing key for command envelopes; ideally in HSM/KMS |
| **TOFU** | Trust on first use — central pins minion's cert fingerprint on first connect |

## 4. Threat model

### 4.1 Trust boundaries

```
                ┌────────────────────────────────────────┐
                │  Internet (public)                     │
                │                                        │
   ┌────────────┴───────────┐    one mTLS wss/h2 stream  │
   │                        │ ◄──────── per minion ──────┤
   │   Central Portal       │                            │
   │   (Next.js + Postgres) │                            │
   │                        │                            │
   └─────┬──────────────────┘                            │
         │ admin web UI                                  │
         │ (separate port)                               │
   ┌─────┴───────┐                                       │
   │   Operator  │                                       │
   │   (human)   │                                       │
   └─────────────┘                                       │
                                                         │
   ──────────────────────────── trust boundary ─────────┴──
                                                         │
                ┌────────────────────────────────────────┴┐
                │  Customer K8s cluster                   │
                │   ┌──────────────────────────┐           │
                │   │ Minion DP namespace      │           │
                │   │  - minion-dp Deployment  │           │
                │   │  - K8s Secrets (creds)   │           │
                │   │  - ServiceAccount        │           │
                │   │  - NetworkPolicy         │           │
                │   └─────┬───┬──────────────┬─┘           │
                │         │   │              │              │
                │   K8s API│   │ ArgoCD/Prom/Loki/...    │
                │   server │                                │
                └────────────────────────────────────────────┘
```

### 4.2 Adversaries

| Adversary | Capability | Defended by |
|---|---|---|
| External network attacker | passive + active MITM, packet capture, traffic analysis | TLS 1.3, mTLS, PFS ciphers, certificate pinning |
| Compromised central portal | full code execution + DB access on central | Per-RPC envelope signing with HSM-backed key, minion-side RBAC enforcement, both-side audit log, command policy on minion side overrides central |
| Compromised minion | code exec inside the minion pod | NetworkPolicy egress-only allowlist, minion ServiceAccount with default-read RBAC, no cluster-admin, response sanitization on central side, blast radius limited to one cluster |
| Compromised user account on central | legitimate user creds stolen | NextAuth MFA enforcement (already in place for SSO), short session lifetime, per-RPC envelopes carry user identity for audit, mutation requests can require step-up auth (Phase 2) |
| Curious cluster operator | install minion, can read its Secrets, can run arbitrary kubectl in its namespace | Per-cluster identity is bound to the cluster's enrollment; central rejects RPCs from a fingerprint not bound to that cluster_id |
| Supply-chain attack on minion image | malicious dependency, typosquat, build pipeline compromise | Pinned digests, cosign keyless signing, SBOM, SLSA L2 build provenance, Renovate, Trivy scan in CI |
| Compromised cert authority | signing fraudulent certs | TOFU + per-cluster fingerprint pinning means CA compromise alone doesn't grant access; the central must explicitly accept a new fingerprint via admin re-enrollment |

### 4.3 STRIDE per component

#### 4.3.1 Tunnel (mTLS HTTP/2 between minion and central)

| Threat | Detail | Mitigation |
|---|---|---|
| **Spoofing minion** | Attacker impersonates a known cluster | Mutual cert validation; central pins per-cluster fingerprint after first enroll; mismatch → connection rejected, alert raised |
| **Spoofing central** | DNS hijack or BGP attack redirects minion to attacker | Minion pins central's CA SHA-256 from the helm install. TLS handshake fails on mismatch |
| **Tampering** | Active MITM modifies in-flight RPC | TLS 1.3 + mTLS; gRPC integrity; envelope signature is the second integrity layer |
| **Replay** | Attacker captures encrypted blob and replays | Each envelope has `command_id` (UUIDv4) + `issued_at` (RFC3339Nano). Minion rejects `command_id` it has seen in last 600s, rejects `issued_at` outside ±60s |
| **DoS** | Flood of fake connect attempts to central:8443 | Per-IP rate limit, per-fingerprint rate limit, max concurrent streams per cluster, hard timeout on enrollment requests |

#### 4.3.2 Enrollment (one-time token → mTLS cert)

| Threat | Mitigation |
|---|---|
| Token theft from CI logs / GitOps | 15-min TTL, single-use, bound to one `clusterId`, revocable from admin UI |
| Token in helm release Secret | Acceptable: the token is dead within 15 min and after first use. Even if leaked from helm release after install, useless |
| Token brute force | 256-bit token entropy (`crypto/rand`), failed-attempt rate limit per cluster_id, exponential backoff |
| Cert key extraction from minion | Stored in K8s Secret with RBAC scoped to the minion ServiceAccount; not readable by other workloads. Key generated inside the pod, never transmitted |
| Replay of enrollment | Token marked consumed in central DB atomically (`UPDATE ... WHERE token_hash=$1 AND consumed_at IS NULL RETURNING id`) before issuing cert |

#### 4.3.3 Per-RPC signed envelope

| Threat | Mitigation |
|---|---|
| Forged commands by compromised central web tier | Issuer key is held in HSM/KMS, separate from web tier. Web tier asks signing service to sign; signing service enforces policy (e.g. "this user can only target clusters in their org") |
| Replay across clusters | Envelope includes `cluster_id`; minion rejects mismatches |
| Replay within same cluster | `command_id` cache (10-min sliding window) + ±60s clock skew window |
| Long-running streams (e.g. log tail) | Envelope signs the stream-open RPC; subsequent stream messages are integrity-protected by the gRPC transport (TLS + HTTP/2 framing) |

#### 4.3.4 Service adapters (minion → ArgoCD/Prom/Loki/etc.)

| Threat | Mitigation |
|---|---|
| Credential exposure to other workloads in cluster | Secret RBAC scoped to minion SA only. PodSecurityStandards: `restricted`. SecretProviderClass for those who use Vault CSI |
| Adapter exfiltrates more than asked | Adapter has its own scope: it can only call the configured `baseUrl`, all egress goes through cluster NetworkPolicy allowlist |
| TLS bypass on adapter | Default `tlsVerify: true`. Self-signed support via `caBundleSecretName`. Insecure mode requires explicit `tlsVerify: false` and emits a warning every restart |
| Privileged credential (ArgoCD admin) | Strong recommendation in docs + Helm-time policy check that flags use of `admin` for ArgoCD. Read-only service account is the documented happy path |

#### 4.3.5 Central — minion response handling

| Threat | Mitigation |
|---|---|
| Compromised minion sends crafted response → XSS in central UI | All UI rendering uses React's safe escaping. Pod logs render in `<pre>` only. **Raw-HTML React props (`dangerously*`) are forbidden by ESLint rule `react/no-danger`.** CSP `default-src 'self'` |
| Response exceeds size budget | Hard cap on per-message body (8 MB), per-stream rate (10 MB/s), with truncation indicator |
| Secret material leaked through logs/events | Pluggable redaction: GitHub PAT, AWS access key, JWTs, `BEGIN PRIVATE KEY`, `password=` patterns. Applied on the central side before any user sees the data |

## 5. Architecture

### 5.1 Components

#### Central side

- **`/api/agent/enroll`** (HTTPS, port `:8443`, mTLS not required)
  - Accepts `{enrollment_token, csr_pem}` for one-time enrollment.
  - Validates token, signs CSR, returns `{cert_pem, cluster_id, issuer_pubkey}`.
  - Hosted on the same Next.js app but behind a TLS proxy (or directly with Node's TLS server); separate port from the human web UI to make ingress rules tight.

- **`/api/agent/grpc`** (HTTPS, port `:8443`, mTLS required)
  - The bidi gRPC endpoint. Minion connects with its cert; central pins the fingerprint and accepts.
  - Implements the `agent/v1` service.

- **Admin web UI**
  - "Cluster registration" page: creates an entry in `Cluster` table with `authType='agent'`, mints an enrollment token, shows the helm command and the install bundle download.
  - "Cluster detail" page: shows agent metadata, last seen, configured services, health.

- **Issuer signing service** (out of band from the web tier)
  - Runs as a separate process or sidecar holding the Ed25519 issuer key.
  - Web tier calls it: `Sign(envelope_canonical_bytes, user_id, target_cluster_id)`.
  - Service enforces policy (user has access to target cluster) before signing.
  - In Phase 1 (read-only), envelope is still signed even for reads — establishes the pattern; Phase 2 mutations rely on it.

#### Minion side

- **Single Go binary**, single Deployment, single Service (ClusterIP for health).
- **Connection manager**: dials central, maintains the gRPC stream, reconnects with exponential backoff (`1s, 2s, 4s, 8s, ..., max 5min`).
- **RPC dispatcher**: validates envelope, looks up handler, calls into the correct adapter or K8s client.
- **Adapter registry**: 9 adapters (K8s + 8 services). Each loaded based on Helm config.
- **Identity store**: cert+key on disk (mounted from K8s Secret). Watcher reloads on Secret update (rotation without restart).
- **Local audit sink**: emits a structured JSON line per envelope handled (`stdout` → cluster's existing log pipeline).

### 5.2 Network topology

```
   ┌────────────────────────────────────────────────────────┐
   │  Central                                                │
   │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
   │  │ web :3000  │  │ agent :8443│  │ issuer-signer    │  │
   │  └─────┬──────┘  └────┬───────┘  └────────┬─────────┘  │
   │        │              │                    │           │
   │        └──────────────┴────────────────────┘           │
   │                       │                                │
   │                  Postgres                              │
   └───────────────────────┼────────────────────────────────┘
                           │
                  TLS 1.3 + mTLS over HTTP/2
                  outbound, agent-initiated
                           │
   ────────────────────────┼─────────────────── Internet
                           │
   ┌───────────────────────┼────────────────────────────────┐
   │  Customer K8s cluster                                   │
   │                       │                                 │
   │   ┌───────────────────┴───────────┐                    │
   │   │  Minion DP pod                │                    │
   │   │  - mounts ./tls/ (cert+key)   │                    │
   │   │  - mounts ./creds/argocd, ... │                    │
   │   └────┬───────┬────────┬─────────┘                    │
   │        │       │        │                              │
   │   K8s API   ArgoCD   Prom/Loki/Grafana/ES/OS/Kibana/   │
   │   (in-cluster)         Fluentd                         │
   └─────────────────────────────────────────────────────────┘
```

### 5.3 Wire protocol

#### 5.3.1 Transport

- **HTTP/2 over TLS 1.3** for normal operation.
- **wss (WebSocket Secure) tunneling** as a fallback for proxy-hostile environments where HTTP/2 connection upgrade fails. Detected at startup; minion tries h2 first, falls back to wss-tunneled HTTP/1.1 with the same gRPC framing.
- **Connection pinning**: one long-lived bidi stream; multiple RPCs multiplexed within it.

#### 5.3.2 Authentication

- **TLS 1.3 cipher suites**: `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`. No CBC, no RSA key exchange.
- **mTLS**: minion presents `cluster_id`-bound cert; central verifies signature chain to its CA AND pins the SHA-256 fingerprint stored in the `Cluster` row.
- **Cert renewal**: certs are 90-day, with auto-renewal via `RenewCert` RPC at the 60-day mark. Renewal uses the existing valid cert as auth.

#### 5.3.3 Authorization

- **Envelope signing** as described. Issuer key in HSM/KMS where available; in self-hosted setups, in a sealed Secret with restricted access.
- **Replay window**: ±60s clock skew, 600s `command_id` cache.
- **Local policy on minion**: in addition to envelope acceptance, minion checks its local Helm-configured permission map. A signed `ScaleWorkload` is rejected if the chart was installed with `permissions.scaleWorkloads: false` (Phase 2 only — no mutations in Phase 1).

#### 5.3.4 Protocol Buffers schema overview

Service definition (`proto/agent/v1/agent.proto`):

```protobuf
syntax = "proto3";
package devops_portal.agent.v1;

option go_package = "github.com/your-org/devops-portal/agent/proto/agent/v1";

import "google/protobuf/timestamp.proto";

service Agent {
  // Lifecycle
  rpc AgentMetadata(AgentMetadataRequest) returns (AgentMetadataResponse);
  rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);
  rpc RenewCert(RenewCertRequest) returns (RenewCertResponse);

  // K8s read RPCs
  rpc ListNodes(K8sListRequest) returns (NodesResponse);
  rpc ListNamespaces(K8sListRequest) returns (NamespacesResponse);
  rpc ListPods(K8sListPodsRequest) returns (PodsResponse);
  rpc GetPod(K8sGetPodRequest) returns (Pod);
  rpc ListWorkloads(K8sListRequest) returns (WorkloadsResponse);
  rpc ListServices(K8sListRequest) returns (ServicesResponse);
  rpc ListIngresses(K8sListRequest) returns (IngressesResponse);
  rpc ListEvents(K8sListRequest) returns (EventsResponse);
  rpc ListCRDs(K8sListRequest) returns (CRDsResponse);
  rpc GetYaml(K8sGetYamlRequest) returns (YamlResponse);

  // Streaming
  rpc StreamPodLogs(StreamPodLogsRequest) returns (stream LogChunk);
  rpc WatchEvents(WatchEventsRequest) returns (stream Event);

  // Service adapters (read-only Phase 1)
  rpc ArgoListApplications(ArgoListAppsRequest) returns (ArgoApplicationsResponse);
  rpc ArgoGetApplication(ArgoGetAppRequest) returns (ArgoApplication);
  rpc ArgoListAppProjects(ArgoListProjectsRequest) returns (ArgoAppProjectsResponse);
  rpc ArgoListApplicationSets(ArgoListAppSetsRequest) returns (ArgoApplicationSetsResponse);

  rpc PromQuery(PromQueryRequest) returns (PromQueryResponse);
  rpc PromQueryRange(PromQueryRangeRequest) returns (PromQueryResponse);
  rpc PromListAlerts(PromListAlertsRequest) returns (PromAlertsResponse);
  rpc PromListTargets(PromListTargetsRequest) returns (PromTargetsResponse);

  rpc GrafanaListDashboards(GrafanaListDashboardsRequest) returns (GrafanaDashboardsResponse);
  rpc GrafanaGetDashboard(GrafanaGetDashboardRequest) returns (GrafanaDashboard);
  rpc GrafanaListDataSources(GrafanaListDataSourcesRequest) returns (GrafanaDataSourcesResponse);

  rpc LokiQuery(LokiQueryRequest) returns (LokiQueryResponse);
  rpc LokiQueryRange(LokiQueryRangeRequest) returns (LokiQueryResponse);

  rpc ESListIndices(ESListIndicesRequest) returns (ESIndicesResponse);
  rpc ESSearch(ESSearchRequest) returns (ESSearchResponse);
  rpc ESHealth(ESHealthRequest) returns (ESHealthResponse);

  // OpenSearch shares the ES message types
  rpc OSListIndices(ESListIndicesRequest) returns (ESIndicesResponse);
  rpc OSSearch(ESSearchRequest) returns (ESSearchResponse);
  rpc OSHealth(ESHealthRequest) returns (ESHealthResponse);

  rpc KibanaListSavedObjects(KibanaListSavedObjectsRequest) returns (KibanaSavedObjectsResponse);
  rpc KibanaListDashboards(KibanaListDashboardsRequest) returns (KibanaDashboardsResponse);

  rpc FluentdGetMetrics(FluentdMetricsRequest) returns (FluentdMetricsResponse);
  rpc FluentdGetPlugins(FluentdPluginsRequest) returns (FluentdPluginsResponse);
}

// Every request includes the envelope as a metadata header `x-agent-envelope`,
// not in the body, so generic gRPC interceptors can validate it.
// See § 5.3.5 for the envelope schema.
```

#### 5.3.5 Signed envelope (gRPC metadata)

Sent as gRPC metadata header `x-agent-envelope`, base64-encoded JSON:

```json
{
  "v": 1,
  "command_id": "0d2c4f3a-...-uuid",
  "issued_at": "2026-05-04T20:15:30.123Z",
  "user_id": "u_abcdef",
  "tenant_id": "org_default",
  "cluster_id": "c_123",
  "intent": "ListPods",
  "args_hash": "sha256:abcdef...",
  "issuer_kid": "central-issuer-2026-q2",
  "sig": "ed25519:base64..."
}
```

`sig` is computed over the canonical bytes of the rest of the envelope (sorted keys, no whitespace) using the issuer's Ed25519 private key. `args_hash` is SHA-256 over the canonical bytes of the gRPC request body, binding the envelope to the actual request.

Minion validates in this order, rejecting on first failure:
1. `v == 1` (else → `UNSUPPORTED_ENVELOPE_VERSION`)
2. `cluster_id == self.cluster_id` (else → `MISMATCHED_CLUSTER`)
3. `issued_at` within `[now - 60s, now + 60s]` (else → `STALE_OR_FUTURE`)
4. `command_id` not in replay cache (else → `REPLAY_DETECTED`)
5. `issuer_kid` is one of the trusted keys (else → `UNKNOWN_ISSUER`)
6. `sig` verifies under the issuer pubkey for that `kid` (else → `BAD_SIGNATURE`)
7. `args_hash` matches SHA-256 of the actual gRPC request body (else → `ARGS_TAMPER`)
8. (Phase 2) `intent` is allowed by local minion policy (else → `LOCAL_POLICY_DENY`)

On any failure, minion logs the rejection (with envelope id, NOT the full envelope) and returns gRPC `PERMISSION_DENIED`.

### 5.4 Identity & enrollment state machines

#### 5.4.1 Central side

```
[clusterRegistrationCreated]
   │ admin clicks "Create cluster registration"
   ▼
[awaitingEnrollment]
   │ enrollment_token minted, 15-min TTL
   │ shown to admin (download or copy-paste)
   │
   ├─ [token expired] ───► [needsRotation] (admin re-mints)
   │
   │ minion calls /api/agent/enroll with {token, csr}
   │ central validates, atomically marks token consumed
   │ central signs CSR, returns cert
   ▼
[awaitingFirstConnect]
   │ minion connects via mTLS within 24h
   │ central pins fingerprint
   ▼
[active]
   │ steady state — RPCs flowing
   │ heartbeats every 30s
   │
   ├─ [no heartbeat 10min] ──► [degraded] (UI shows yellow)
   ├─ [no heartbeat 1h]    ──► [unreachable] (UI shows red, alerts fire)
   ├─ [admin revokes]      ──► [revoked] (cert added to CRL, all open streams closed)
   └─ [admin re-enrolls]   ──► [awaitingEnrollment]
```

#### 5.4.2 Minion side

```
[fresh-install]
   │ no cert on disk; reads enrollment.token + central.url + centralCaSha256 from env
   │
   ▼
[enrolling]
   │ generates Ed25519 keypair in-pod
   │ writes CSR to memory only
   │ POST /api/agent/enroll  (verifies central cert against pinned SHA-256)
   │ stores returned cert + own key into K8s Secret
   │ writes a marker in the same Secret: enrolled_at, cluster_id, issuer_pubkey
   ▼
[connected]
   │ steady-state mTLS gRPC stream
   │
   ├─ [tls error]              ──► [retrying] backoff 1s..5min
   ├─ [cert >60d old]          ──► [renewing] calls RenewCert RPC
   ├─ [cert revoked by central] ──► [shutdown-and-alert] (logs reason, sleeps; admin re-enrolls)
   └─ [Secret rotated]         ──► [hot-reload] watcher reloads cert without process restart
```

### 5.5 RBAC

#### 5.5.1 Default ClusterRole

Phase 1 ships *only* read verbs:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: minion-dp-read
rules:
  # Core
  - apiGroups: [""]
    resources:
      - namespaces
      - nodes
      - pods
      - pods/log
      - services
      - endpoints
      - configmaps             # NOTE: NOT secrets — explicit non-grant
      - events
      - persistentvolumeclaims
      - persistentvolumes
      - resourcequotas
      - limitranges
    verbs: ["get", "list", "watch"]
  # Apps
  - apiGroups: ["apps"]
    resources: [deployments, statefulsets, daemonsets, replicasets]
    verbs: ["get", "list", "watch"]
  # Networking
  - apiGroups: ["networking.k8s.io"]
    resources: [ingresses, networkpolicies, ingressclasses]
    verbs: ["get", "list", "watch"]
  # Batch
  - apiGroups: ["batch"]
    resources: [jobs, cronjobs]
    verbs: ["get", "list", "watch"]
  # Custom resources discovery
  - apiGroups: ["apiextensions.k8s.io"]
    resources: [customresourcedefinitions]
    verbs: ["get", "list", "watch"]
  # Metrics
  - apiGroups: ["metrics.k8s.io"]
    resources: [pods, nodes]
    verbs: ["get", "list"]
  # ArgoCD CRDs (optional, for direct CRD access vs API)
  - apiGroups: ["argoproj.io"]
    resources: [applications, appprojects, applicationsets, rollouts]
    verbs: ["get", "list", "watch"]
```

**Explicitly NOT granted:** `secrets`, `serviceaccounts`, `roles`, `rolebindings`, `clusterroles`, `clusterrolebindings`, anything in `rbac.authorization.k8s.io`, anything with `*` verbs.

#### 5.5.2 Phase 2 opt-in expansions (documented now, implemented later)

```yaml
permissions:
  scaleWorkloads: false   # adds 'patch' on apps/{deployments,statefulsets} replica subresource
  restartWorkloads: false # adds 'patch' on apps/{deployments,statefulsets,daemonsets} for rollout restart
  exec: false             # adds 'create' on pods/exec  (HIGH RISK — gates separate audit channel)
  applyYaml: false        # adds 'create,update,patch' on a curated allowlist of Kinds (HIGH RISK)
  manageSecrets: false    # NEVER recommended; adds 'get,list,create,update,delete' on secrets
  manageRBAC: false       # NEVER recommended; adds verbs on roles/rolebindings
```

Each opt-in flag both expands the ClusterRole AND enables the corresponding RPC in the minion's local policy. Both must be true for the action to succeed.

### 5.6 NetworkPolicy

Default chart applies this to the minion namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: minion-dp-deny-all, namespace: minion-dp }
spec:
  podSelector: { matchLabels: { app: minion-dp } }
  policyTypes: [Ingress, Egress]
  ingress: []                  # no inbound
  egress:
    # DNS
    - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } } }]
      ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]
    # K8s API server
    - to: [{ ipBlock: { cidr: 0.0.0.0/0 } }]
      ports: [{ port: 443, protocol: TCP }]
      # NOTE: real chart will resolve apiserver via kubernetes.default Service; the simple form above
      # is replaced by a dynamically-rendered policy at install time using the cluster's service CIDR.
    # Central portal
    - to: [{ ipBlock: { cidr: <central public IP / cidr from values> } }]
      ports: [{ port: 8443, protocol: TCP }]
    # Per-service egress (rendered from helm values.services)
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: argocd } }
          podSelector: { matchLabels: { app.kubernetes.io/name: argocd-server } }
      ports: [{ port: 443, protocol: TCP }]
    # ... one block per enabled service ...
```

The chart helper template generates the egress section from `values.services[*]`. If a service is `enabled: false` it is not rendered. If a service's `baseUrl` is outside the cluster (e.g. SaaS Grafana), the egress block uses `ipBlock: <resolved IP>` with a refresh job (we don't try to be a DNS-aware NP).

### 5.7 Service adapter pattern

Common Go interface:

```go
package adapter

type Adapter interface {
    Name() string                 // "argocd", "prometheus", ...
    HealthCheck(ctx) error
    Configure(cfg ServiceConfig) error
    Close() error
}

type ServiceConfig struct {
    BaseURL          *url.URL
    Credentials      Credentials      // username/password OR token OR cert
    TLSConfig        *tls.Config
    Timeout          time.Duration
    AdditionalParams map[string]string // adapter-specific extension
}

type Credentials struct {
    Type     CredType // basic, bearer, mTLS, none
    Username string
    Password string  // pulled from K8s Secret at startup AND on Secret update
    Token    string
    ClientCertPEM []byte
    ClientKeyPEM  []byte
}
```

Per-adapter sub-interface for the read RPCs it serves:

```go
type ArgoCDAdapter interface {
    Adapter
    ListApplications(ctx, ListAppsRequest) (*ApplicationsResponse, error)
    GetApplication(ctx, GetAppRequest) (*Application, error)
    ListAppProjects(ctx, ListProjectsRequest) (*AppProjectsResponse, error)
    ListApplicationSets(ctx, ListAppSetsRequest) (*ApplicationSetsResponse, error)
}
```

Adapters live in `agent/adapters/<service>/<service>.go`. Each adapter:
- Encapsulates the HTTP client (separate `http.Client` per adapter, with its own TLS config and timeouts).
- Validates response shape strictly (no `interface{}` fields propagated up).
- Translates error types to a small enum (`ErrAuth`, `ErrNotFound`, `ErrServiceUnavailable`, `ErrTransient`).
- Records metrics: `minion_adapter_request_total{adapter,outcome}`, `minion_adapter_request_duration_seconds{adapter}`.

#### 5.7.1 Adapter inventory (Phase 1)

| Adapter | Phase-1 RPCs | Auth modes |
|---|---|---|
| Kubernetes (built-in, not an "adapter" but uses same pattern) | List/Get for Pods/Namespaces/Nodes/Workloads/Services/Ingresses/Events/CRDs/YAML; StreamPodLogs; WatchEvents | In-cluster ServiceAccount only |
| ArgoCD | ListApplications, GetApplication, ListAppProjects, ListApplicationSets | bearer token (preferred — dedicated read-only account); username/password (discouraged) |
| Prometheus | Query, QueryRange, ListAlerts, ListTargets | none (in-cluster); basic auth; bearer |
| Grafana | ListDashboards, GetDashboard, ListDataSources | API key (preferred, viewer role); basic auth |
| Loki | Query, QueryRange (LogQL) | none; basic auth; bearer; X-Scope-OrgID for multi-tenant |
| Elasticsearch | ListIndices, Search, GetIndexHealth | basic auth; API key; bearer |
| OpenSearch | Same as ES (separate adapter to keep type evolution independent; shares the wire types) | basic auth; AWS SigV4 (deferred to Phase 2 if EKS-managed); bearer |
| Kibana | ListSavedObjects, ListDashboards | basic auth; API key |
| Fluentd | GetMetrics, GetPlugins | none (typical); basic auth via reverse proxy |

### 5.8 Helm chart layout

```
deployment/helm-minion/
├── Chart.yaml
├── values.yaml                      # documented defaults
├── values.schema.json               # JSON-schema validation at install time
├── README.md
├── crds/                            # none in P1
└── templates/
    ├── _helpers.tpl
    ├── serviceaccount.yaml
    ├── clusterrole.yaml             # the read-only role
    ├── clusterrolebinding.yaml
    ├── deployment.yaml              # the minion
    ├── service.yaml                 # ClusterIP for /healthz
    ├── secret-tls-bootstrap.yaml    # holds enrollment token + central CA SHA, ttl-bound
    ├── secret-tls-cert.yaml         # empty until first enroll; minion writes here
    ├── networkpolicy.yaml           # rendered from values.services
    ├── poddisruptionbudget.yaml
    ├── podsecuritypolicy.yaml       # for clusters still using PSP (deprecated; PSS labels recommended)
    ├── servicemonitor.yaml          # optional, if Prometheus operator present
    └── tests/
        └── connection-smoke.yaml    # `helm test` — verifies minion sees the cluster
```

Values schema (excerpt):

```yaml
central:
  url: "https://portal.example.com:8443"          # required
  caSha256: "sha256:..."                          # required; pinned
  insecureSkipTLSVerify: false                    # explicit opt-out (DO NOT use in prod)

enrollment:
  # exactly one of:
  token: ""                                        # plaintext (for `--set`); written to Secret then used + zeroed
  tokenSecretRef:                                  # OR ref to existing Secret
    name: ""
    key: token

services:
  argocd:
    enabled: false
    baseUrl: ""                                    # required when enabled
    credentialSecretName: ""                       # references a K8s Secret with username/password OR token
    tlsVerify: true
    caBundleSecretName: ""                         # optional, for self-signed
  prometheus:
    enabled: false
    baseUrl: ""
    credentialSecretName: ""                       # optional
    tlsVerify: true
  grafana: { ... }
  loki: { ... }
  elasticsearch: { ... }
  opensearch: { ... }
  kibana: { ... }
  fluentd: { ... }

permissions:
  scaleWorkloads: false       # all default false in Phase 1; flags exist now to validate the schema
  restartWorkloads: false
  exec: false
  applyYaml: false
  manageSecrets: false
  manageRBAC: false

resources:
  limits: { cpu: 500m, memory: 512Mi }
  requests: { cpu: 100m, memory: 128Mi }

securityContext:
  runAsNonRoot: true
  runAsUser: 65532
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities: { drop: [ALL] }
  seccompProfile: { type: RuntimeDefault }

networkPolicy:
  enabled: true                  # default ON
```

The `values.schema.json` rejects: `central.insecureSkipTLSVerify: true` unless also `central.acknowledgeInsecure: true` (a deliberate friction step), inline credentials in service blocks (must be Secret refs), and missing `central.caSha256` if `central.url` is set.

### 5.9 Enrollment UX — both paths

#### 5.9.1 Path A — copy-paste helm command (the easy path)

Admin in central UI:
1. Goes to `Clusters → New (agent-managed)`.
2. Enters: cluster name, environment, optional notes.
3. Central mints `cluster_id`, enrollment token, captures the central CA's SHA-256.
4. UI shows three things, copy-able:
   - The full `helm install` command with all `--set` values pre-filled.
   - The expected `kubectl create secret` commands for each service-credentials secret the operator will need.
   - A 15-min countdown timer.
5. Operator copies, runs.
6. Within ~30s the cluster status moves from `awaitingEnrollment` → `active`.

#### 5.9.2 Path B — air-gapped install bundle (the enterprise path)

Same UI flow, but admin clicks "Download install bundle" and gets a `.tar.gz` containing:

```
minion-dp-bundle/
├── manifests/                    # rendered yaml — no helm needed at install site
│   ├── 00-namespace.yaml
│   ├── 01-serviceaccount.yaml
│   ├── 02-clusterrole.yaml
│   ├── 03-clusterrolebinding.yaml
│   ├── 04-secret-bootstrap.yaml  # enrollment token; ttl note in comments
│   ├── 05-deployment.yaml
│   ├── 06-service.yaml
│   ├── 07-networkpolicy.yaml
│   └── 08-pdb.yaml
├── images/                       # OCI image as a tarball (loadable via `crictl load` / `docker load`)
│   └── minion-dp-1.0.0.tar
├── values-applied.yaml           # what the bundle was generated from
├── INSTALL.md                    # step-by-step
├── checksums.txt                 # sha256 of every file
└── checksums.txt.sig             # cosign signature of checksums.txt
```

Operator process:
1. Verify `cosign verify-blob --signature checksums.txt.sig checksums.txt`.
2. Verify file checksums.
3. `crictl/docker load` the image into the cluster's registry / local node cache.
4. `kubectl apply -f manifests/`.
5. Done.

Both paths produce the same end state; central can't tell them apart.

### 5.10 Audit log

#### Central side

Append-only Postgres table `agent_audit`:

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
CREATE INDEX agent_audit_user_time    ON agent_audit(user_id,    occurred_at DESC);
```

Writes are wrapped in a SECURITY DEFINER function so application code can only INSERT (no UPDATE/DELETE without a privileged role).

#### Minion side

JSON-structured log to stdout. Schema:

```json
{
  "ts": "2026-05-04T20:15:30.456Z",
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

Operators are expected to ship this to their existing log pipeline (Loki, ES, Splunk). The chart's Helm values include a `audit.shipToFluentBit: true` toggle that adds a Fluent Bit sidecar pre-configured to the cluster's logging endpoint.

#### Reconciliation

A daily job in central compares: for each `cluster_id`, the count of envelopes by intent in central's table vs. the minion's reported count (sent via a `ReportAuditCounts` RPC). Mismatches alert SecOps.

### 5.11 Output sanitization

A central-side `Sanitizer` interface runs on every minion response before it's exposed in any UI or API:

```ts
type Redactor = (s: string) => string;

const REDACTORS: Redactor[] = [
  redactBearerJWT,                         // eyJ... → [REDACTED:JWT]
  redactAWSAccessKey,                      // AKIA[A-Z0-9]{16} → [REDACTED:AWS]
  redactGitHubPAT,                         // ghp_... ghs_... → [REDACTED:GH]
  redactPEMBlocks,                         // -----BEGIN ...----- / -----END ----- → [REDACTED:PEM]
  redactPasswordEquals,                    // password= / pwd= patterns
  redactBasicAuthURLs,                     // https://user:pass@host → https://user:[REDACTED]@host
  redactKubeconfigYAML,                    // any 'token:' / 'client-key-data:' / 'password:' line in YAML
];
```

Applied to:
- Pod log lines (per-line, before SSE flush).
- Event message strings.
- Kubernetes Object YAML responses.
- Adapter responses (search hits, etc.) — adapter-specific opt-out for fields the operator explicitly marks safe.

Length caps:
- Single log line: 8 KB (excess truncated, marker appended).
- Single message body: 8 MB.
- Stream rate: soft limit 10 MB/s with backpressure.

### 5.12 Container hardening checklist

| Item | Detail |
|---|---|
| Base image | `gcr.io/distroless/static:nonroot` (Go static binary) |
| User | UID 65532, GID 65532, no shell |
| Filesystem | Read-only root; writable `emptyDir` for `/tmp` and `/var/cert-cache` |
| Capabilities | All dropped, none added |
| Seccomp | `RuntimeDefault` |
| AppArmor | `runtime/default` if available |
| Privilege escalation | Disabled |
| HostPID/Net/IPC | False |
| Image | Multi-arch (amd64, arm64), signed via `cosign sign --keyless` |
| SBOM | CycloneDX, attached as cosign attestation |
| SLSA | L2 build provenance via reusable GitHub Actions workflow |
| CVE scanning | `trivy fs` and `grype` in CI; block on HIGH+ |

### 5.13 Versioning & deprecation

- Wire protocol: `agent/v1` is the only namespace at GA. Breaking changes require `agent/v2` running in parallel for ≥6 months.
- Minion ↔ central version skew: minion N can talk to central N or N+1. Central N+1 supports minion ≥ N-1 for a quarter, then stops.
- Both sides advertise their semver in the handshake; central's `Cluster` row records the connected minion's version.
- Deprecation notice is sent in `Heartbeat` response when central is about to drop support for the connected minion's version.

### 5.14 Migration path for the existing kubeconfig clusters

Existing `Cluster.authType in ('standard','duplo','eks')` clusters keep working. Phase 1 adds a fourth: `'agent'`. The UI gains a "Migrate to agent" action on a kubeconfig cluster, which:
1. Creates a new `Cluster` row of type `agent` (so the migration is non-destructive).
2. Generates the enrollment token + helm command.
3. After the agent is connected, admin can confirm and the old kubeconfig row is archived (not deleted; admin can revert).

We don't auto-migrate. Both modes coexist.

## 6. Failure modes & operator runbook (highlights)

| Symptom | First check | Likely cause |
|---|---|---|
| Minion stuck in `enrolling` | Minion logs: TLS handshake error | Wrong `central.caSha256` or central URL unreachable |
| Minion stuck in `awaitingFirstConnect` after enrollment | Central's `agent_audit` shows successful enroll but no RPCs | Egress NetworkPolicy too tight, or central :8443 firewall closed |
| Many `BAD_SIGNATURE` rejections | Issuer key rotated without distributing new pubkey to minions | Run `kubectl rollout restart deployment/minion-dp` to pick up new pubkey from cert refresh |
| `REPLAY_DETECTED` in logs | Likely benign (HTTP/2 retry races) | If sustained, investigate central's signing service for double-sign behavior |
| All adapters reporting auth errors | Operator rotated cluster passwords without updating Secrets | Update Secrets via ESO/Sealed/manual; minion auto-reloads |
| Minion CPU spike | Streaming consumers (logs/events) without backpressure handling | Drop subscribers; verify central's consumer respects flow control |

Full runbook lives in the chart's `docs/RUNBOOK.md` (to be authored alongside implementation).

## 7. Testing strategy

| Layer | Approach |
|---|---|
| Unit | Per-adapter, against live in-Docker fixtures (real ArgoCD, Prom, Grafana, Loki, ES, OS, Kibana, Fluentd containers — no mocks per project policy) |
| Integration | Minion + central in docker-compose; signed envelope round-trips; cert lifecycle |
| End-to-end | kind cluster + helm install minion + central running locally; smoke through every Phase-1 RPC |
| Fuzzing | go-fuzz on the envelope parser, the RPC handlers' input messages |
| Chaos | Random network partitions during streams; verify reconnect + replay-cache correctness |
| Security review | External pen-test of the enrollment + envelope flow before GA. Threat-model walkthrough with a SecOps reviewer |
| Performance | 1k RPCs/sec sustained per minion connection; p99 under 50ms for List* on a 5k-pod cluster |

## 8. What's not in this design (deferred to companion docs)

| Topic | Where it lives |
|---|---|
| Day-by-day implementation steps | `2026-05-04-minion-dp-implementation.md` (next doc) |
| Specific Go module layout | implementation plan |
| Phase 2 mutation design | `2026-XX-XX-minion-dp-phase2-mutations.md` (after Phase 1 ships) |
| Multi-region central HA | future |
| CLI tool for ops (`minion-dp-cli`) | future |

## 9. Decisions captured here that need to stay decided

1. **Read-only Phase 1**: no mutation RPCs at all in v1.0. Phase 2 follows after security review.
2. **Both enrollment UX paths at GA**: helm command + air-gapped bundle.
3. **9 adapters at GA**: K8s, ArgoCD, Prom, Grafana, Loki, ES, OS, Kibana, Fluentd.
4. **mTLS + signed envelope** as the auth stack. Bearer-token-only is rejected as insufficient.
5. **HTTP/2 primary, wss fallback** for transport; gRPC framing on both.
6. **Outbound-only**, agent-initiated tunnel.
7. **One-time, 15-min, single-use enrollment tokens**; cert+key never leave the minion pod.
8. **Default-deny RBAC**; only read verbs in Phase 1.
9. **NetworkPolicy ON by default**, generated from `values.services`.
10. **Distroless, non-root, signed images, SBOM, SLSA L2** at GA.
11. **Audit on both sides** with reconciliation; central audit table is append-only via `SECURITY DEFINER`.
12. **Output sanitization** is a hard requirement, not best-effort.
13. **Issuer key separation**: web tier doesn't hold the signing key directly; goes through a signer service (HSM/KMS-friendly).
14. **No auto-update**: operators choose when to upgrade Helm releases.
15. **Co-existence with the existing kubeconfig clusters** — both modes work side by side.

## 10. Sign-off

This document needs review from:
- [ ] Author of the implementation plan (next doc in the series)
- [ ] Security reviewer (someone other than the design author)
- [ ] Cluster ops reviewer
- [ ] Compliance reviewer (if customer's regulated workloads will run under this)

Once signed off, this document is frozen except for amendments tracked at the bottom in a "Changes since approval" log.
