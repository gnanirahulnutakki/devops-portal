# Minion DP — Implementation Plan

**Date**: 2026-05-12
**Author**: Gnani Rahul Nutakki
**Companion to**: `2026-05-04-minion-dp-design.md`
**Status**: Draft — awaiting sign-off from security reviewer

---

## 1. Overview

This plan turns the Minion DP design document into executable milestones. It is organized by week, with daily granularity for the first two weeks and milestone-based blocks for the remainder. Each task includes:

- What to build
- What to verify (test or manual)
- What decisions need to be made (and by whom)
- Risk flags

**Assumptions**:
- Go 1.24 (latest stable)
- Central portal (Next.js) continues running as-is; Minion DP is additive
- Existing kubeconfig clusters keep working; agent-managed clusters are a new `authType='agent'`
- Tests against real fixtures (no mocks) per project policy

---

## 2. Decisions Required Before Day 1

| # | Decision | Options | Owner | Default if unset |
|---|---|---|---|---|
| 1 | Go module path | A) `github.com/gnanirahulnutakki/devops-portal/agent` in this repo<br>B) Separate repo `github.com/gnanirahulnutakki/minion-dp` | Author | **A** — keeps design + impl + central in one repo |
| 2 | gRPC transport | A) Real gRPC (grpc-go + protobuf)<br>B) Custom HTTP/2 + protobuf | Author | **A** — grpc-go is mature, well-supported, gives us streaming for free |
| 3 | Issuer signer deployment | A) Sidecar in same pod as Next.js<br>B) Separate K8s Deployment<br>C) AWS Lambda / Cloud Function | Author + Ops | **B** — separate deployment, can be scaled/restarted independently, HSM integration easier |
| 4 | Proto file location | A) `agent/proto/` in this repo<br>B) Separate `devops-portal-proto` repo | Author | **A** — single repo, versioned together |
| 5 | Existing queue wiring | A) Wire `startWorker()` into Next.js bootstrap before Minion DP<br>B) Minion DP workers run standalone (no shared queue infra) | Author | **B** — Minion DP is self-contained; queue integration is a later enhancement |
| 6 | Image registry | A) Docker Hub (same account as central)<br>B) GitHub Packages<br>C) AWS ECR | Author | **A** — `rahulnutakki/minion-dp`; reuse existing CI pipeline |
| 7 | Cluster cert CA | A) Self-managed CA at install time<br>B) cert-manager integration<br>C) External PKI (Vault, AWS PCA) | Author | **A** — self-managed CA in K8s Secret; TOFU + fingerprint pinning removes need for public CA trust |
| 8 | Issuer signing key storage | A) Env var / K8s Secret (Phase 1)<br>B) AWS KMS / GCP KMS<br>C) HashiCorp Vault | Author + Security | **A** for Phase 1; migrate to B/C in Phase 2 |

**Status**: All decisions **CONFIRMED** on 2026-05-12 by Gnani Rahul Nutakki.

**Blocker**: None remaining. Proceed to implementation.

---

## 3. Milestones

| Milestone | Target | Definition of Done |
|---|---|---|
| **M1** — Foundation | Week 1 | Go module, proto definitions, envelope signing lib, minimal central enrollment API |
| **M2** — Tunnel + Enrollment | Week 2 | mTLS connection up, enrollment end-to-end, cert lifecycle, heartbeat |
| **M3** — K8s Read RPCs | Week 3 | All K8s List/Get/Watch RPCs working, pod log streaming, event watching |
| **M4** — Service Adapters (4 of 9) | Week 4 | ArgoCD + Prometheus + Grafana + Loki adapters working |
| **M5** — Remaining Adapters + Hardening | Week 5 | ES + OpenSearch + Kibana + Fluentd + output sanitization + container hardening |
| **M6** — Integration + End-to-End | Week 6 | kind cluster + helm install + central smoke test through every Phase-1 RPC |
| **M7** — Security Review + Fixes | Week 7 | External security review, threat model walkthrough, fix findings |
| **M8** — Documentation + Release | Week 8 | Helm chart docs, runbook, ops guide, v0.5.0 tag |

**Total estimated duration**: 8 weeks (40 working days)

---

## 4. Week-by-Week Breakdown

### Week 1 — Foundation (M1)

#### Day 1 — Module + Proto Skeleton
- [ ] Create `agent/` directory with Go module init
- [ ] Set up `buf` or `protoc` toolchain for proto compilation
- [ ] Define `agent/v1/agent.proto` with all RPCs from design §5.3.4
- [ ] Define envelope proto (`Envelope` message with v1 fields)
- [ ] Generate Go code from proto
- [ ] **Verify**: `go build ./...` passes, proto files compile without errors

#### Day 2 — Envelope Signing Library (central side)
- [ ] Implement `pkg/envelope` package:
  - `Sign(canonicalBytes, issuerKey) → envelope`
  - `Verify(envelope, trustedPubkeys) → error` with all 8 validation steps from design §5.3.5
  - Replay cache (in-memory LRU, 600s TTL)
  - Clock skew check (±60s)
- [ ] Unit tests: valid envelope, bad signature, replay, stale, mismatch, tampered args
- [ ] **Verify**: 100% coverage on `pkg/envelope`

#### Day 3 — Issuer Signer Service
- [ ] Standalone HTTP service (or gRPC service) that accepts signing requests
- [ ] Policy check: validate user_id + target_cluster_id against central DB before signing
- [ ] Ed25519 key generation + loading from env/secret
- [ ] Metrics endpoint (`/metrics`) for Prometheus
- [ ] Health endpoint (`/health`)
- [ ] **Verify**: `curl` test — signing request for valid user/cluster succeeds; invalid cluster rejected

#### Day 4 — Central Enrollment API
- [ ] `POST /api/agent/enroll` — accepts `{enrollment_token, csr_pem}`
- [ ] Token validation: 15-min TTL, single-use, atomic `UPDATE ... WHERE consumed_at IS NULL`
- [ ] CSR signing with central CA (Ed25519 or RSA — decide here; recommend Ed25519 for speed)
- [ ] Return `{cert_pem, cluster_id, issuer_pubkey}`
- [ ] Store cluster cert fingerprint in `Cluster` row
- [ ] **Verify**: enrollment test script (see §6.1)

#### Day 5 — Polish + Integration
- [ ] Wire issuer signer into Next.js: `SignEnvelope` utility that calls signer service
- [ ] Add `Cluster.authType = 'agent'` support in Prisma schema (migration)
- [ ] Admin UI stub: "New Agent-Managed Cluster" button (can be a simple form for now)
- [ ] End-of-week review: run all tests, ensure nothing is broken in central
- [ ] **Verify**: CI passes, existing 146 tests still green

**Week 1 Risk Flags**:
- ⚠️ Issuer signer service needs its own Dockerfile + deployment config. If ops team isn't ready to deploy it, it can run as a local process during development.
- ⚠️ Ed25519 CA for cluster certs — decide if central's CA is the same as the issuer signing key or separate. **Recommend separate** (CA for mTLS, Ed25519 for envelopes).

---

### Week 2 — Tunnel + Enrollment (M2)

#### Day 6 — Minion Bootstrap + Connection Manager
- [ ] Minion Go binary: `main.go` with config loading from env/flags
- [ ] Connection manager: dial central with mTLS, maintain persistent HTTP/2 connection
- [ ] Exponential backoff reconnection: 1s → 2s → 4s → ... → 5min max
- [ ] Health endpoint (`/healthz`) on minion side
- [ ] **Verify**: minion binary builds, runs, fails gracefully when central is unreachable

#### Day 7 — Enrollment Flow (Minion Side)
- [ ] On first boot: detect no cert on disk, read enrollment token from env/Secret
- [ ] Generate Ed25519 keypair in-pod, create CSR
- [ ] POST to `/api/agent/enroll`, verify central cert against pinned SHA-256
- [ ] Store returned cert + own key into K8s Secret (`secret-tls-cert`)
- [ ] Write enrollment marker (enrolled_at, cluster_id, issuer_pubkey) to same Secret
- [ ] **Verify**: end-to-end enrollment test against local central

#### Day 8 — mTLS Stream + Handshake
- [ ] Minion connects with its cert; central verifies cert chain + fingerprint
- [ ] gRPC bidi stream: `Agent` service `Stream` RPC (or individual RPCs over the same connection)
- [ ] Handshake: exchange semver, capabilities, adapter inventory
- [ ] Central records `last_seen`, `version`, `status = 'active'`
- [ ] **Verify**: `grpcurl` or custom client — connect, handshake, disconnect, reconnect

#### Day 9 — Heartbeat + Cert Renewal
- [ ] Heartbeat: minion sends every 30s; central responds with status + deprecation notices
- [ ] Cert renewal: at 60-day mark, minion calls `RenewCert` RPC using existing valid cert as auth
- [ ] Central issues new cert, updates fingerprint; old cert remains valid for 24h grace period
- [ ] Minion hot-reloads new cert without restart (Secret watcher + signal)
- [ ] **Verify**: mock time-forward test or use short-lived test certs (1-hour TTL)

#### Day 10 — Failure Modes + Reconnection
- [ ] Central cert revocation: CRL check, connection drop, minion enters `[shutdown-and-alert]`
- [ ] Network partition: verify reconnect + replay cache correctness after disconnect
- [ ] Central restart: minion reconnects, stream resumes
- [ ] **Verify**: chaos test — kill central pod, verify minion reconnects within 30s

**Week 2 Risk Flags**:
- ⚠️ gRPC streaming with Go can be tricky with context cancellation. Use `grpc.KeepaliveParams`.
- ⚠️ K8s Secret hot-reload via fsnotify — test on real cluster, not just locally.

---

### Week 3 — K8s Read RPCs (M3)

#### Day 11 — K8s Client + RBAC
- [ ] In-cluster K8s client using ServiceAccount token
- [ ] Default-deny ClusterRole (from design §5.5.1)
- [ ] ServiceAccount + ClusterRoleBinding Helm templates
- [ ] Implement `ListNodes`, `ListNamespaces`
- [ ] **Verify**: against kind cluster — list nodes returns correct count

#### Day 12 — Pod + Workload RPCs
- [ ] `ListPods`, `GetPod`, `ListWorkloads` (deployments, statefulsets, daemonsets)
- [ ] Namespace filtering support
- [ ] Label selector support
- [ ] **Verify**: create test deployments in kind, verify list/get accuracy

#### Day 13 — Services, Ingresses, Events, CRDs
- [ ] `ListServices`, `ListIngresses`, `ListEvents`, `ListCRDs`
- [ ] Event filtering by namespace, type, reason
- [ ] **Verify**: create test service + ingress, verify list accuracy

#### Day 14 — YAML + Streaming
- [ ] `GetYaml` — returns any K8s object as YAML
- [ ] `StreamPodLogs` — returns `stream LogChunk` over gRPC
- [ ] `WatchEvents` — returns `stream Event` over gRPC
- [ ] Flow control: backpressure handling, client disconnect cleanup
- [ ] **Verify**: stream pod logs from a running container, verify no memory leak on disconnect

#### Day 15 — Response Sanitization
- [ ] Central-side sanitizer: apply all 6 redactors (JWT, AWS key, GitHub PAT, PEM, password=, kubeconfig)
- [ ] Per-line truncation: 8 KB max, marker appended
- [ ] Per-message cap: 8 MB
- [ ] **Verify**: create a pod that logs a fake AWS key, verify redaction in UI

**Week 3 Risk Flags**:
- ⚠️ `WatchEvents` over gRPC requires careful stream lifecycle management. Test with rapid event generation.
- ⚠️ Response sanitization is a hard requirement — do not skip tests.

---

### Week 4 — Service Adapters: ArgoCD + Prom + Grafana + Loki (M4)

#### Day 16 — Adapter Framework
- [ ] Common `Adapter` interface in `agent/adapters/adapter.go`
- [ ] `ServiceConfig` + `Credentials` structs
- [ ] Adapter registry: load enabled adapters from Helm values
- [ ] Per-adapter metrics: `minion_adapter_request_total{adapter,outcome}`, `minion_adapter_request_duration_seconds{adapter}`
- [ ] **Verify**: register 2 dummy adapters, verify metrics exposed

#### Day 17 — ArgoCD Adapter
- [ ] `ListApplications`, `GetApplication`, `ListAppProjects`, `ListApplicationSets`
- [ ] Auth: bearer token (from K8s Secret), TLS verify default ON
- [ ] **Verify**: install ArgoCD in kind, create Application, verify list/get

#### Day 18 — Prometheus Adapter
- [ ] `PromQuery`, `PromQueryRange`, `PromListAlerts`, `PromListTargets`
- [ ] Auth: none (in-cluster), basic, or bearer
- [ ] **Verify**: install Prometheus in kind, run a query, verify response

#### Day 19 — Grafana Adapter
- [ ] `GrafanaListDashboards`, `GrafanaGetDashboard`, `GrafanaListDataSources`
- [ ] Auth: API key (viewer role), basic auth
- [ ] **Verify**: install Grafana in kind, create dashboard, verify list/get

#### Day 20 — Loki Adapter
- [ ] `LokiQuery`, `LokiQueryRange` (LogQL)
- [ ] Auth: none, basic, bearer, `X-Scope-OrgID`
- [ ] **Verify**: install Loki in kind, push logs, query via adapter

**Week 4 Risk Flags**:
- ⚠️ ArgoCD in kind needs enough resources. Use `kind` with extra nodes or limit test data.
- ⚠️ Loki LogQL parsing — adapter should not validate LogQL syntax, just proxy. Central handles validation.

---

### Week 5 — Remaining Adapters + Hardening (M5)

#### Day 21 — Elasticsearch + OpenSearch Adapters
- [ ] `ESListIndices`, `ESSearch`, `ESHealth`
- [ ] OpenSearch: same wire types, separate adapter for type evolution
- [ ] Auth: basic, API key, bearer
- [ ] **Verify**: ES and OS containers in docker-compose/kind, verify search

#### Day 22 — Kibana + Fluentd Adapters
- [ ] `KibanaListSavedObjects`, `KibanaListDashboards`
- [ ] `FluentdGetMetrics`, `FluentdGetPlugins`
- [ ] Auth: basic, API key (Kibana); none (Fluentd)
- [ ] **Verify**: Kibana container in docker-compose, verify saved objects list

#### Day 23 — Container Hardening
- [ ] Multi-arch Dockerfile (amd64, arm64) using `gcr.io/distroless/static:nonroot`
- [ ] `cosign sign --keyless` in CI
- [ ] SBOM generation (CycloneDX)
- [ ] SLSA L2 build provenance via reusable GitHub Actions workflow
- [ ] `trivy fs` + `grype` in CI; block on HIGH+
- [ ] **Verify**: build image, scan with Trivy, verify no HIGH/CRITICAL

#### Day 24 — NetworkPolicy + RBAC Helm Templates
- [ ] NetworkPolicy: default-deny + DNS + K8s API + Central + per-service egress blocks
- [ ] Dynamic K8s API CIDR resolution at install time (Helm helper)
- [ ] PodSecurityContext: non-root, read-only root fs, dropped caps, seccomp
- [ ] **Verify**: `helm template` renders correct NetworkPolicy; install in kind, verify no unintended egress

#### Day 25 — Audit Log + Reconciliation
- [ ] Central `agent_audit` table + `SECURITY DEFINER` insert function
- [ ] Minion JSON stdout log schema
- [ ] `ReportAuditCounts` RPC: minion sends daily counts, central reconciles
- [ ] **Verify**: run 100 RPCs, verify central audit table has 100 rows, minion log has 100 entries, reconciliation passes

**Week 5 Risk Flags**:
- ⚠️ NetworkPolicy dynamic CIDR is tricky. If K8s API Service IP isn't resolvable at Helm time, use `0.0.0.0/0` with a comment that operators should tighten it.
- ⚠️ SLSA L2 provenance requires specific GitHub Actions setup. May need infra team help.

---

### Week 6 — Integration + End-to-End (M6)

#### Day 26 — docker-compose Integration Stack
- [ ] `docker-compose.yml` with: central (Next.js), Postgres, Redis, MinIO, minion (Go), kind cluster
- [ ] One-command spin-up: `docker compose up`
- [ ] **Verify**: `curl /api/health` on central returns green; minion status shows `active`

#### Day 27 — kind + Helm Install
- [ ] `kind` cluster with test workloads (nginx, ArgoCD, Prometheus, Grafana, Loki)
- [ ] Helm install minion chart against local central
- [ ] Enrollment via UI or script
- [ ] **Verify**: cluster status in central UI shows `active`

#### Day 28 — Smoke Test All Phase-1 RPCs
- [ ] Script or `grpcurl` sequence that calls every Phase-1 RPC
- [ ] Verify response shapes match proto definitions
- [ ] Verify no 5xx on central side
- [ ] **Verify**: all 25+ RPCs return expected data

#### Day 29 — Performance + Chaos
- [ ] Sustained load: 1k RPCs/sec per minion connection
- [ ] p99 latency < 50ms for `List*` on 5k-pod cluster
- [ ] Chaos: network partition during log stream, verify reconnect + no duplicate events
- [ ] **Verify**: benchmark script + chaos test script pass

#### Day 30 — Bug Fix + Polish
- [ ] Fix any issues from smoke/performance tests
- [ ] Error handling: graceful degradation when adapter is down
- [ ] Logging: ensure all errors are structured and actionable
- [ ] **Verify**: CI green, all tests pass

**Week 6 Risk Flags**:
- ⚠️ Performance target (1k RPCs/sec) may be aggressive. If not met, document actual numbers and optimize in v0.5.1.
- ⚠️ kind with many services may strain local machine. Use lightweight fixtures where possible.

---

### Week 7 — Security Review + Fixes (M7)

#### Day 31 — Threat Model Walkthrough
- [ ] Schedule 2-hour session with security reviewer (external to design author)
- [ ] Walk through §4 (Threat Model) + §5 (Architecture) + enrollment flow
- [ ] Document findings
- [ ] **Verify**: meeting notes + action items logged

#### Day 32–33 — Fix Security Findings
- [ ] Address all HIGH/CRITICAL findings from review
- [ ] Re-run enrollment tests, chaos tests, audit tests
- [ ] **Verify**: no regressions, tests pass

#### Day 34 — Penetration Test
- [ ] External pen-tester attacks enrollment endpoint, envelope signing, mTLS stream
- [ ] Fuzz envelope parser (`go-fuzz` or similar)
- [ ] **Verify**: no critical vulnerabilities found (or documented + accepted)

#### Day 35 — Final Security Sign-Off
- [ ] Security reviewer approves design + implementation
- [ ] Update threat model with any new mitigations discovered during review
- [ ] **Verify**: sign-off recorded in this document

**Week 7 Risk Flags**:
- ⚠️ External security reviewer may not be available immediately. Book them before Week 7 starts.
- ⚠️ Pen-test findings could require significant rework. Buffer 2–3 days for fixes.

---

### Week 8 — Documentation + Release (M8)

#### Day 36 — Helm Chart Docs
- [ ] `helm/devops-portal/Chart.yaml` + `values.yaml` fully documented
- [ ] `values.schema.json` validation
- [ ] `README.md` in chart directory: install, upgrade, uninstall
- [ ] **Verify**: `helm lint` passes; `helm template` renders without errors

#### Day 37 — Runbook
- [ ] `docs/operations/MINION_DP_RUNBOOK.md`: all failure modes from design §6 + new ones discovered
- [ ] Enrollment troubleshooting
- [ ] Cert renewal failure recovery
- [ ] Adapter auth failure diagnosis
- [ ] **Verify**: ops reviewer reads runbook, confirms it covers their concerns

#### Day 38 — Ops Guide
- [ ] `docs/operations/MINION_DP_OPS_GUIDE.md`: monitoring, alerting, scaling, secret rotation, upgrade procedures
- [ ] Prometheus metrics reference
- [ ] Alert rules (PrometheusRule YAML)
- [ ] **Verify**: alert rules render correctly in Prometheus

#### Day 39 — Final Integration Test
- [ ] Full end-to-end: kind cluster + helm install + central + all adapters + all RPCs + audit + chaos
- [ ] CI pipeline: build → test → scan → sign → publish image
- [ ] **Verify**: CI green, image published to registry with signed SBOM

#### Day 40 — v0.5.0 Tag + Release Notes
- [ ] Tag `v0.5.0`
- [ ] Release notes: what's new, breaking changes, upgrade guide, security advisories
- [ ] Announce: GitHub Discussion, README update
- [ ] **Verify**: release page has binaries, Helm chart, Docker image digest, SBOM, checksums

**Week 8 Risk Flags**:
- ⚠️ Image registry setup (GitHub Packages, Docker Hub, ECR?) — decide before Week 8.
- ⚠️ Release notes need security advisories section even if none found (transparency).

---

## 5. Dependencies and External Blockers

| Dependency | Who | When Needed | Risk if Late |
|---|---|---|---|
| Security reviewer availability | SecOps / external | Week 7 | Slip by 1–2 weeks |
| HSM/KMS for issuer key (optional) | Infra / security | Week 1 (if using HSM) | Can start with env var / file, migrate later |
| Image registry + CI pipeline | DevOps / GitHub Actions | Week 8 | Can test locally, but release blocked |
| kind cluster access for dev/test | Local machine | Week 1 | Blocker — no tests without cluster |
| Cosign keyless signing setup | Infra / GitHub | Week 5 | Can use key-based signing as fallback |

---

## 6. Test Scripts (Reference)

### 6.1 Enrollment Test Script

```bash
#!/bin/bash
# test-enrollment.sh

CENTRAL_URL="http://localhost:8443"
TOKEN="test-token-from-ui"

# Generate keypair + CSR
openssl genpkey -algorithm Ed25519 -out minion.key
openssl req -new -key minion.key -out minion.csr -subj "/CN=minion-test"

# Enroll
CSR_PEM=$(cat minion.csr | base64 -w0)
curl -X POST "$CENTRAL_URL/api/agent/enroll" \
  -H "Content-Type: application/json" \
  -d "{\"enrollment_token\":\"$TOKEN\",\"csr_pem\":\"$CSR_PEM\"}"
```

### 6.2 Smoke Test Script

```bash
#!/bin/bash
# test-smoke.sh — calls every Phase-1 RPC

# Assumes grpcurl or custom client is installed
ENDPOINT="localhost:8443"

echo "=== ListNodes ==="
grpcurl -plaintext -d '{"cluster_id":"test"}' $ENDPOINT devops_portal.agent.v1.Agent/ListNodes

echo "=== ListPods ==="
grpcurl -plaintext -d '{"cluster_id":"test","namespace":"default"}' $ENDPOINT devops_portal.agent.v1.Agent/ListPods

# ... repeat for all RPCs
```

### 6.3 Chaos Test Script

```bash
#!/bin/bash
# test-chaos.sh

# Start a log stream
# While streaming, kill the central pod
# Verify minion reconnects and stream resumes (or fails gracefully)

kubectl delete pod -l app=devops-portal -n devops-portal
sleep 5
# Check minion logs for reconnection
kubectl logs -l app=minion-dp -n minion-dp | grep "reconnect\|heartbeat"
```

---

## 7. Rollback Plan

If Minion DP proves unstable or security review fails catastrophically:

1. **v0.5.0 is additive** — existing kubeconfig clusters (`authType != 'agent'`) continue working untouched.
2. **Agent clusters can be downgraded** — change `authType` back to `'standard'`, upload kubeconfig.
3. **Minion binary can be stopped** — `kubectl delete deployment/minion-dp -n minion-dp` stops all outbound connections.
4. **Central enrollment API can be disabled** — remove `/api/agent/enroll` and `/api/agent/grpc` routes via feature flag.

---

## 8. Changes Log

| Date | Change | Author |
|---|---|---|
| 2026-05-12 | Initial draft | Gnani Rahul |

---

## 9. Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| Author | Gnani Rahul Nutakki | 2026-05-12 | ✅ Draft complete |
| Security Reviewer | **TBD — recommend external security engineer or trusted peer not involved in design** | | ⏳ **ACTION REQUIRED: Assign before Week 7** |
| Cluster Ops Reviewer | **TBD — recommend someone who manages K8s clusters / Helm charts for this project** | | ⏳ **ACTION REQUIRED: Assign before Week 5** |

### Reviewer Assignment Guidance

**Security Reviewer criteria:**
- Not the design author (you)
- Has experience with mTLS, gRPC security, or K8s security
- Can dedicate ~4 hours for threat model walkthrough + 2–3 hours for findings review
- Suggested: colleague from previous security work, or hired consultant

**Cluster Ops Reviewer criteria:**
- Maintains the existing `helm/devops-portal/` chart
- Familiar with the internal K8s deployment environment
- Can review NetworkPolicy, RBAC, and container hardening
- Suggested: whoever owns the existing QA2/saasops1 deployments

**Note**: If no one is available for formal review, the implementation can proceed through Week 6, but Week 7 (security review milestone) will block until a reviewer is found.

**Fallback if no external reviewer available:**
- Author conducts structured self-review using the threat model (§4) as a checklist
- Document findings in `docs/superpowers/security/self-review-YYYY-MM-DD.md`
- Ship v0.5 with self-review flag; require external review before Phase 2 mutations
- This is acceptable for read-only Phase 1 because blast radius is limited

**Next action**: Schedule security reviewer for Week 7 (or earlier for design review). Assign cluster ops reviewer for Helm chart + runbook review in Week 5–6.
