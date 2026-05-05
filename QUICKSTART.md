# Quickstart

Get from zero to running portal connected to a Kubernetes cluster in **under 10 minutes**. This is the copy-paste path. For the full overview see [`README.md`](README.md).

## What you'll have at the end

- Portal running at <http://localhost:3000>
- One Kubernetes cluster registered (your own, or a local `kind` cluster created in step 0)
- Live pod / workload / service / ingress views
- Live pod log streaming
- All running via Docker on your machine — nothing in the cloud, no accounts to create

## Requirements

| Tool | Minimum | How to install |
|---|---|---|
| Node.js | 22 | <https://nodejs.org/> or `brew install node@22` |
| Docker (or compatible) | any recent | Docker Desktop, [OrbStack](https://orbstack.dev/), or [Colima](https://github.com/abiosoft/colima) |
| `kind` (only for step 0) | 0.30+ | `brew install kind` or <https://kind.sigs.k8s.io/docs/user/quick-start/#installation> |
| `kubectl` | any recent | `brew install kubectl` |

## Step 0 — Optional: spin up a kind cluster (skip if you already have a kubeconfig)

```bash
kind create cluster --name portal-demo
```

This gives you a 1-node Kubernetes cluster on your machine. The portal will read from it.

If you want something a bit more interesting in the cluster:

```bash
kubectl --context kind-portal-demo create deployment hello --image=nginx:1.27-alpine --replicas=2
kubectl --context kind-portal-demo expose deployment hello --port=80
```

## Step 1 — Clone and install

```bash
git clone https://github.com/gnanirahulnutakki/devops-portal.git
cd devops-portal
npm install
```

`npm install` takes 1–2 min on first run.

## Step 2 — Bring up Postgres, Redis, MinIO

```bash
docker compose up -d postgres redis minio minio-init
```

Wait for them to become healthy (typically 10 seconds):

```bash
docker compose ps
```

You should see all four with `Up ... (healthy)` status.

## Step 3 — Configure environment

```bash
cp .env.example .env

# generate two real secrets
SECRET1=$(openssl rand -base64 32)
SECRET2=$(openssl rand -base64 32)
sed -i.bak \
  -e "s|NEXTAUTH_SECRET=your-secret-here|NEXTAUTH_SECRET=${SECRET1}|" \
  -e "s|TOKEN_ENCRYPTION_KEY=your-base64-key-here|TOKEN_ENCRYPTION_KEY=${SECRET2}|" \
  .env && rm -f .env.bak

# enable email/password sign-in for the first run
cat >> .env <<'EOF'

# Local-dev overrides
AUTH_MODE=multi
ENABLE_CREDENTIALS_AUTH=true
OTEL_ENABLED=false
EOF
```

> **Production**: do NOT use `ENABLE_CREDENTIALS_AUTH=true` in production. Use SSO (Keycloak / GitHub / Google / Azure). Email/password is for first-run convenience only.

## Step 4 — Set up the database

```bash
npm run db:push        # sync the Prisma schema to Postgres
npm run db:setup-rls   # apply Row-Level Security policies (multi-tenant isolation)
npm run db:seed        # create the default org + admin user
```

The seed step will print:

```
Admin:  admin@example.com / admin123
Guest:  guest@example.com / guest123
```

## Step 5 — Start the portal

```bash
npm run dev
```

First compile takes ~90 seconds (Next.js + 1500+ modules). Subsequent reloads are <5s.

When you see:
```
✓ Ready in <N>s
```

…open <http://localhost:3000>. Sign in with `admin@example.com` / `admin123`.

## Step 6 — Register your cluster

In a new terminal, get your cluster's kubeconfig:

```bash
# If you used kind in step 0:
kind get kubeconfig --name portal-demo > /tmp/my-cluster.kubeconfig

# Or for an existing cluster: copy ~/.kube/config to /tmp/my-cluster.kubeconfig
```

In the portal UI:

1. Click **Clusters** in the left sidebar.
2. Click the **+ Add cluster** button (top right).
3. Fill in:
   - **Name**: e.g. `My Local Cluster`
   - **Slug**: e.g. `my-local`
   - **Provider**: `on-prem` (for kind, k3s, k3d), `aws`, `gcp`, or `azure`
   - **Region**: e.g. `local` or `us-west-2`
   - **Environment**: `development`
   - **Auth type**: `standard`
   - **Kubeconfig**: paste the contents of `/tmp/my-cluster.kubeconfig`
4. Click **Save**.

The cluster appears in the cluster list. Click into it.

## Step 7 — Explore

You should see:

- **Nodes** tab: your cluster's nodes with K8s version, CPU, memory, pod count
- **Namespaces** tab: all namespaces with pod counts
- **Pods** tab: all pods, status, restarts. Click a pod for logs / YAML / metrics
- **Workloads** tab: Deployments, StatefulSets, DaemonSets
- **Services** tab: ClusterIPs and ports
- **Ingresses** tab: hosts and paths
- **Events** tab: recent K8s events
- **Helm** tab: detected Helm releases (empty for fresh kind)
- **Rollouts** tab: Argo Rollouts (empty unless installed)
- **CRDs** tab: cluster CRDs

For pod logs: click a pod name → the **Logs** tab shows live SSE streaming. The **YAML** tab shows a Monaco-editor view of the pod manifest.

## Troubleshooting

### "Internal Server Error" on `/login`
Most often: missing `NEXTAUTH_SECRET` or `TOKEN_ENCRYPTION_KEY`. Verify with `grep -E "^(NEXTAUTH_SECRET|TOKEN_ENCRYPTION_KEY)=" .env` — both should have non-empty values longer than 30 chars.

### Sign-in succeeds but `/clusters` shows "Application error"
Hard-refresh the browser; this should be fixed in 0.1.0+, but if you see it open a bug.

### `/api/clusters` returns `ORGANIZATION_REQUIRED`
This is normal for direct API calls. The browser sends the org via cookie; for `curl` testing, set `-H "x-organization-id: <orgId>"` (find your orgId in `npm run db:studio` → Organization table).

### Cluster pages return 500 with "Required parameter namespace was null"
Pre-0.1.0 bug — fixed. Update to latest. If you hit this on 0.1.0+ please file a bug.

### Pod logs show "disconnected" with 0 lines
Check `docker compose logs postgres redis` and the dev server output for errors. Most often: pod was terminated, or the container has no logs yet (just-started pod).

## What's next

- Configure integrations: ArgoCD, Prometheus, Grafana, Loki — see the **Settings → Integrations** page or set the env vars in `.env` before starting.
- Production deployment: Helm chart is at [`helm/devops-portal/`](helm/devops-portal/). Note: this chart was originally written for an internal deployment; PRs welcome to make it more generic.
- Multi-cluster: register more clusters in the UI. Each lives independently; switch between them in the cluster sidebar.
- Multiple orgs: the portal is multi-tenant via Postgres Row-Level Security. Create more orgs via `prisma db studio` or the API (UI for org management is at `/organizations`).

## Tear down

```bash
# stop the portal: Ctrl-C in the npm run dev terminal

# stop the supporting services
docker compose down

# (keeps DB data — re-run docker compose up -d to resume)

# OR remove DB volumes too:
docker compose down -v

# delete the kind cluster if you created one
kind delete cluster --name portal-demo
```

## Got stuck?

Open a [GitHub Discussion](https://github.com/gnanirahulnutakki/devops-portal/discussions) or [issue](https://github.com/gnanirahulnutakki/devops-portal/issues) — bug reports for first-run friction are highest priority.
