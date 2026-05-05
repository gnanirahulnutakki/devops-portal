# DevOps Portal

A self-hostable, multi-cluster Kubernetes operations portal. Connect any number of clusters, browse pods/workloads/services/ingresses, view live events and logs, and proxy your existing platform tooling (ArgoCD, Prometheus, Grafana, Loki, and more) — all from one UI.

**Status**: pre-1.0. Core multi-cluster read paths are working and tested end-to-end against [kind](https://kind.sigs.k8s.io/). See the [roadmap](#roadmap) below for what's coming.

**License**: [Apache 2.0](LICENSE)

---

## What it does today

- **Register Kubernetes clusters** by uploading a kubeconfig — no agent install required.
- **Browse cluster state**: nodes, namespaces, pods, deployments, statefulsets, daemonsets, services, ingresses, CRDs, events.
- **Live pod log streaming** over Server-Sent Events.
- **YAML viewer** with Monaco editor for any resource.
- **ArgoCD integration**: view applications, app projects, ApplicationSets across registered clusters.
- **Prometheus / Grafana / Loki** integrations for monitoring views.
- **Multi-tenant**: organizations isolate their own clusters and integrations via Postgres Row-Level Security.
- **Auth**: email/password (bcrypt), Keycloak SSO, GitHub OAuth, Google OAuth, Azure AD.

## What's coming

The next major feature is an in-cluster **Portal Agent** that connects clusters via an outbound mTLS tunnel — for environments where the central portal can't reach the cluster's K8s API directly. Three configurable identity postures are planned: a built-in CA (zero-dependency), bring-your-own-CA (cert-manager / Vault PKI / AWS Private CA), and SPIFFE/SPIRE federation. Read-only first; mutations gated behind a separate security review. v0.5 target. Discussion / design RFC will land as a GitHub Discussion when implementation kicks off.

## Tech stack

- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS, shadcn/ui, Monaco Editor
- **Backend**: Next.js API Routes, Prisma 6 ORM
- **Database**: PostgreSQL 16 (with Row-Level Security for multi-tenancy)
- **Cache / Queue**: Redis 7, BullMQ
- **Object Storage**: MinIO / AWS S3
- **Authentication**: NextAuth v5
- **Logging**: Pino (JSON structured)
- **Container runtime**: Node.js 22+

## Quick start (local development)

### Prerequisites

- Node.js 22+
- Docker (or Docker-compatible runtime — [OrbStack](https://orbstack.dev/) and [Colima](https://github.com/abiosoft/colima) both work)
- A Kubernetes cluster you can produce a kubeconfig for. If you don't have one, install [kind](https://kind.sigs.k8s.io/) and create a local cluster:
  ```bash
  kind create cluster --name portal-demo
  ```

### Install in 5 minutes

```bash
# 1. Clone
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal

# 2. Install dependencies
npm install

# 3. Bring up Postgres + Redis + MinIO
docker compose up -d postgres redis minio minio-init

# 4. Generate a .env from the template, plus two secrets
cp .env.example .env
SECRET1=$(openssl rand -base64 32)
SECRET2=$(openssl rand -base64 32)
sed -i.bak \
  -e "s|NEXTAUTH_SECRET=your-secret-here|NEXTAUTH_SECRET=${SECRET1}|" \
  -e "s|TOKEN_ENCRYPTION_KEY=your-base64-key-here|TOKEN_ENCRYPTION_KEY=${SECRET2}|" \
  .env && rm -f .env.bak

# Allow local credentials sign-in for the first run
cat >> .env <<'EOF'

# Local-dev overrides
AUTH_MODE=multi
ENABLE_CREDENTIALS_AUTH=true
OTEL_ENABLED=false
EOF

# 5. Push the schema and seed an admin user
npm run db:push
npm run db:setup-rls
npm run db:seed

# 6. Start the dev server
npm run dev
```

Open <http://localhost:3000>. Sign in with the seeded admin: `admin@example.com` / `admin123`.

> **Production**: don't ship the seeded credentials. Change them via the Settings page or run with `ENABLE_CREDENTIALS_AUTH=false` and use SSO/OAuth.

### Add your first cluster

1. Click **Clusters** in the sidebar.
2. Click **Add cluster**.
3. Paste your kubeconfig YAML (e.g. from `kind get kubeconfig --name portal-demo`).
4. Set the cluster name, environment, provider (`on-prem` for kind/k3s).
5. Save. Your cluster appears in the sidebar; click into it to see nodes, namespaces, pods, etc.

### What you'll see

- **Cluster overview**: node count, namespace list, workload health.
- **Per-cluster pages**: Pods, Workloads, Services, Ingresses, Events, CRDs, Helm releases, Argo Rollouts (if installed).
- **Pod detail**: Logs (live SSE stream), Exec, Metrics, YAML, Info tabs.
- **Per-namespace filtering**: dropdown at the top of the cluster sidebar.

## Configuration

See [`.env.example`](.env.example) for all environment variables. The minimum to run is `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `NEXTAUTH_URL`.

Optional integrations (set the URLs and tokens to enable):
- `ARGOCD_URL` + `ARGOCD_TOKEN`
- `GRAFANA_URL` + `GRAFANA_API_KEY`
- `PROMETHEUS_URL`
- `GITHUB_TOKEN` + `GITHUB_ORGANIZATION`
- `KEYCLOAK_ID` + `KEYCLOAK_SECRET` + `KEYCLOAK_ISSUER`

## Architecture

```
┌──────────────────┐
│  Next.js App     │  React UI + API routes
│  (port 3000)     │
└────────┬─────────┘
         │
   ┌─────┼─────┬──────┐
   │     │     │      │
┌──▼─┐ ┌─▼──┐ ┌▼───┐ ┌▼────────────────┐
│ PG │ │ Rd │ │ S3 │ │ Cluster kube-API│
│    │ │    │ │    │ │ (per registered │
│    │ │    │ │    │ │  cluster)       │
└────┘ └────┘ └────┘ └─────────────────┘
```

Multi-tenant boundaries enforced at three layers:

1. **NextAuth session** ↔ user
2. **Per-org cookie / `x-organization-id` header** ↔ org context (validated against membership in the JWT)
3. **Postgres Row-Level Security** on tenant-scoped tables (`clusters`, `deployments`, `audit_logs`, `bulk_operations`, `alert_rules`, `integration_credentials`)

For a deeper architecture walkthrough see [`docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`](docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md).

## Tests

```bash
npm test                  # unit + integration (Vitest, no mocks per project policy)
npm run lint              # ESLint with --max-warnings 0
npm run typecheck         # tsc --noEmit
```

The test suite uses real services (Postgres, Redis on localhost via the docker-compose stack). There are no `vi.mock()` / `jest.mock()` calls — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the rationale.

## Deployment

For Kubernetes, see the Helm chart at [`helm/devops-portal/`](helm/devops-portal/). Note: the chart was originally written for a private deployment and may need adjustment for OSS use cases. Improvements welcome.

For a single-node Docker deployment, see [`Dockerfile`](Dockerfile).

## Roadmap

- **v0.1** (current): kubeconfig-based cluster federation, 9 platform integrations, multi-tenant central
- **v0.5**: in-cluster Portal Agent (outbound-only mTLS tunnel) for unreachable / air-gapped clusters; first mutations behind security review
- **v1.0**: full mutation set (scale, restart, exec) with audit + step-up auth; CNCF Sandbox application

## Contributing

PRs welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, testing policy (no mocks), and review process.

## Security

For security disclosure, see [`SECURITY.md`](SECURITY.md). **Please do not open public issues for vulnerabilities.**

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to abide by it.

## License

[Apache License 2.0](LICENSE) — see the LICENSE file for the full text.

---

Built originally as internal tooling, opened for community use under Apache 2.0. If you find it useful, drop a star or open a discussion.
