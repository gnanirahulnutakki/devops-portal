### DevOps Portal deployment runbook (keep updating)

This document is a living log of **exact commands** used to build, push, and roll out the DevOps Portal. Append new sections as we make changes.

---

### Current target environment (self-managed-test-dev01 / saasops1)

- **Kubeconfig**:

```bash
export KUBECONFIG=/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml
```

- **Namespace**: `duploservices-saasops1`
- **Deployment**: `devops-portal`
- **Docker Hub repo**: `rahulnutakki/devops-portal`

---

### Git workflow (commit the work)

From repo root:

```bash
cd /Users/nutakki/Documents/github/devops-portal
git status -sb
git diff --stat
```

Stage + commit:

```bash
git add -A
git commit -m "your message"
```

If staging is slow (large repo), use smaller batches:

```bash
git add -u
git add docs deployment helm scripts src prisma
git add public/monaco
```

---

### Local build (recommended)

#### Option A: Build via Docker (clean, reproducible)

This matches production build steps (`prisma generate` + `next build`) and avoids local `npm install` hangs.

```bash
docker build --progress=plain -t rahulnutakki/devops-portal:v2-latest .
```

#### Option B: Native build (requires dependencies installed)

```bash
npm ci
npm run build
```

If you see `sh: prisma: command not found`, dependencies were not installed (run `npm ci` first).

---

### Build + push Docker image

#### Push a regular tag

```bash
docker push rahulnutakki/devops-portal:v2-latest
```

#### Tag the image to match what K8s is using

Check what image tag the cluster expects:

```bash
kubectl -n duploservices-saasops1 get deployment devops-portal \
  -o jsonpath='{.spec.template.spec.containers[*].image}{"\n"}'
```

If it’s using `v2-openapi-4` (example), tag + push:

```bash
docker tag rahulnutakki/devops-portal:v2-latest rahulnutakki/devops-portal:v2-openapi-4
docker push rahulnutakki/devops-portal:v2-openapi-4
```

---

### CRITICAL: Architecture mismatch (exec format error)

#### Symptom

Pod crashes with:

```text
exec /usr/local/bin/docker-entrypoint.sh: exec format error
```

#### Cause

Image was built for the wrong platform (common on Apple Silicon when cluster nodes are `linux/amd64`).

#### Fix (build and push `linux/amd64`)

```bash
docker buildx create --name multiarch-builder --use || true

docker buildx build \
  --platform linux/amd64 \
  -t rahulnutakki/devops-portal:v2-openapi-4 \
  --push \
  .
```

---

### Kubernetes rollout (restart deployment)

List deployments:

```bash
kubectl -n duploservices-saasops1 get deployments
```

Restart and wait:

```bash
kubectl -n duploservices-saasops1 rollout restart deployment/devops-portal
kubectl -n duploservices-saasops1 rollout status deployment/devops-portal --timeout=10m
```

Verify pods + logs:

```bash
kubectl -n duploservices-saasops1 get pods -l app.kubernetes.io/instance=devops-portal -o wide
kubectl -n duploservices-saasops1 logs -l app.kubernetes.io/instance=devops-portal --tail=50
```

---

### Helm upgrade (apply chart changes)

```bash
helm -n duploservices-saasops1 upgrade devops-portal ./helm/devops-portal \
  -f helm/devops-portal/values-saasops1.yaml \
  --set image.repository=rahulnutakki/devops-portal \
  --set image.tag=v2-openapi-4 \
  --wait --timeout 10m
```

If the upgrade fails due to an immutable/patch conflict, force a recreate:

```bash
helm -n duploservices-saasops1 upgrade devops-portal ./helm/devops-portal \
  -f helm/devops-portal/values-saasops1.yaml \
  --set image.repository=rahulnutakki/devops-portal \
  --set image.tag=v2-openapi-4 \
  --force \
  --wait --timeout 10m
```

---

### Database migrations (apply SQL migrations directly)

When Prisma migrations can’t be run easily inside the app container, apply the generated SQL directly via `psql` in the Postgres pod:

```bash
kubectl -n duploservices-saasops1 exec devops-portal-postgres-0 -- \
  psql -U postgres -d devops_portal -c "select 1;"

kubectl -n duploservices-saasops1 exec -i devops-portal-postgres-0 -- \
  psql -v ON_ERROR_STOP=1 -U postgres -d devops_portal \
  < prisma/migrations/20260210000000_add_security_scans/migration.sql

kubectl -n duploservices-saasops1 exec -i devops-portal-postgres-0 -- \
  psql -v ON_ERROR_STOP=1 -U postgres -d devops_portal \
  < prisma/migrations/20260210001000_add_vanta_integration_provider/migration.sql
```

### Notes from last deployment session (2026-02-09)

- **Node version alignment**: Dockerfile updated to Node `22-alpine` to match `package.json` engines (`>=22`).
- **Build succeeded**: `next build` completed; only warnings (hooks deps / unused vars).
- **Push succeeded**: `rahulnutakki/devops-portal:v2-latest` and `:v2-openapi-4`.
- **Rollout issue**: initial rollout hit `exec format error` until `linux/amd64` build was pushed via `buildx`.

