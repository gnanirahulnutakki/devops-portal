# Staging environment

Long-lived staging deployment of the portal in a real Kubernetes namespace, used for **manual feature testing**, **PR review**, and **automated end-to-end CI**.

This is **opt-in** — set the `STAGING_ENABLED` repo variable to `true` to activate it. Forks without this variable see the workflow skip cleanly with an `::notice::` log.

## What gets deployed

| Component | Where | Notes |
|---|---|---|
| Portal (Next.js + DB schema) | `<STAGING_NAMESPACE>` | helm release `devops-portal`; chart at `helm/devops-portal/` |
| Postgres / Redis / MinIO | same namespace, sub-charts | chart deps; see `helm/devops-portal/Chart.yaml` |
| ArgoCD / Prometheus / Grafana / Loki | **NOT** managed by this workflow | Bring-your-own. Provide URLs via repo variables; the deployed portal connects to those. Cluster-admin is needed to install these so it's a one-time bootstrap, separate from CI. |

## One-time bootstrap

Run with **cluster-admin** kubeconfig pointing at the target cluster:

```bash
./scripts/bootstrap-staging-rbac.sh \
  --context <kubectl-context> \
  --namespace <namespace> \
  [--sa-name devops-portal-ci] \
  [--output /tmp/staging.kubeconfig]
```

This script:

1. Creates the namespace if missing
2. Creates a `ServiceAccount` (default name `devops-portal-ci`)
3. Binds it to the built-in `edit` ClusterRole, scoped to the namespace
4. Generates a long-lived bearer-token kubeconfig

Then wire it into GitHub Actions:

```bash
gh secret set STAGING_KUBECONFIG < /tmp/staging.kubeconfig
gh variable set STAGING_NAMESPACE --body 'duploservices-qaibtest'
gh variable set STAGING_ENABLED   --body 'true'

# Optional — if there are pre-existing services in the cluster the portal
# should integrate with, set their URLs as variables:
gh variable set STAGING_ARGOCD_URL     --body 'https://argocd.qa.example.com'
gh variable set STAGING_PROMETHEUS_URL --body 'http://prometheus.monitoring.svc.cluster.local:9090'
gh variable set STAGING_GRAFANA_URL    --body 'https://grafana.qa.example.com'
gh variable set STAGING_LOKI_URL       --body 'http://loki-gateway.loki.svc.cluster.local'
gh variable set STAGING_HOST           --body 'devops-portal.qa.example.com'
```

After this, the workflow runs automatically on every push to `main` and on demand via `gh workflow run integration-staging.yml`.

## Manual feature testing flow

Reviewer wants to exercise a PR's feature against real services? Trigger a one-off deploy of that branch into staging:

```bash
gh workflow run integration-staging.yml --ref <branch-name>
# OR with the workflow_dispatch ref input:
gh workflow run integration-staging.yml -f ref=feat/some-feature
```

The workflow's `concurrency: integration-staging / cancel-in-progress: true` setting means a newer dispatch automatically supersedes any running deploy — no need to wait or manually cancel. **Caveat**: this means a `push: main` while someone is testing a feature branch will replace the feature branch with main. For longer-form review, coordinate via Slack or use a separate review namespace.

## Smoke-test it locally

The same scripts the workflow runs are runnable from your laptop:

```bash
# Point kubectl at the staging cluster
export KUBECONFIG=/path/to/staging.kubeconfig

# Deploy a specific image tag
STAGING_NAMESPACE=duploservices-qaibtest \
IMAGE_TAG=v0.1.1 \
  bash scripts/staging-deploy.sh

# Run the e2e suite against the deployed portal (port-forwards locally)
STAGING_NAMESPACE=duploservices-qaibtest \
  bash scripts/staging-test.sh
```

## RBAC scope (defense in depth)

The CI service account uses Kubernetes' built-in `edit` ClusterRole, **scoped to the namespace via RoleBinding** (not ClusterRoleBinding). This means:

- Can manage workloads, services, secrets, configmaps inside the namespace ✓
- Cannot read/write any other namespace ✗
- Cannot view or modify cluster-scoped resources (Nodes, CRDs, ClusterRoles, ClusterRoleBindings) ✗
- Cannot grant permissions (Role/RoleBinding management is excluded from `edit`) ✗

If a future feature needs cluster-wide access (CRDs, observing nodes), that's an explicit RBAC change requiring cluster-admin to make — not something CI should be able to grant itself.

## Tear down

```bash
KUBECONFIG=/path/to/staging.kubeconfig \
  helm uninstall devops-portal -n duploservices-qaibtest
```

To rotate the CI service account's token:

```bash
kubectl -n duploservices-qaibtest delete secret devops-portal-ci-token
./scripts/bootstrap-staging-rbac.sh --context ... --namespace ...
gh secret set STAGING_KUBECONFIG < /tmp/staging.kubeconfig
```

## Why a long-lived environment instead of ephemeral?

Two reasons:

1. **Manual feature testing benefits from persistent state.** A reviewer poking at a feature wants the portal's DB to remember registered clusters between sessions. Ephemeral environments lose that on every CI run.
2. **Service install is expensive.** Standing up ArgoCD + kube-prometheus-stack + Loki takes ~15 minutes of helm work. Doing that on every CI run wastes runner minutes and accelerates GHA quota burn. With a long-lived environment, services install once, the portal redeploys in <2 minutes per run.

The tradeoff: state can drift, and concurrent PRs trying to deploy step on each other. We mitigate the second with `concurrency: cancel-in-progress: true` and accept the first (testers can `helm uninstall` + redeploy if they want a clean slate).
