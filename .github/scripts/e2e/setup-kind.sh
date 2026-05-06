#!/usr/bin/env bash
# Set up the kind cluster + demo workloads + register it in the portal.
#
# Idempotent: safe to re-run. Produces:
#   - kind cluster `portal-demo`
#   - namespace `demo-app` with web (3 replicas of nginx) + api (2 replicas of http-echo)
#   - Service kubernetes,  Ingress demo-app
#   - In the portal DB: a Cluster row with the kubeconfig encrypted-at-rest
# Outputs (printed to stdout): KUBECONFIG_PATH, CLUSTER_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# Pick up ORG_ID + COOKIE_FILE from the env file login.sh writes. Each
# `bash X.sh` is a fresh process — exports from login.sh don't survive.
if [[ -f /tmp/e2e-env.sh ]]; then
  # shellcheck disable=SC1091
  source /tmp/e2e-env.sh
fi
if [[ -z "${ORG_ID:-}" ]]; then
  echo "ORG_ID not set; run login.sh first or export ORG_ID before this script" >&2
  exit 2
fi

CLUSTER_NAME="${KIND_CLUSTER_NAME:-portal-demo}"
KIND_CONFIG="${KIND_CONFIG:-$SCRIPT_DIR/../../kind/portal-demo.yaml}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/tmp/kind-portal-demo.kubeconfig}"

# 1. Create cluster if missing
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating kind cluster '$CLUSTER_NAME'..."
  kind create cluster --config "$KIND_CONFIG" --wait 120s
else
  echo "Kind cluster '$CLUSTER_NAME' already exists, skipping create"
fi

KIND_CTX="kind-${CLUSTER_NAME}"

# 2. Wait for nodes ready
kubectl --context "$KIND_CTX" wait --for=condition=Ready nodes --all --timeout=120s

# 3. Apply demo workloads (idempotent)
kubectl --context "$KIND_CTX" apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: demo-app
  labels:
    purpose: portal-smoke-test
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo-app
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports: [{ containerPort: 80 }]
          resources:
            requests: { cpu: 50m, memory: 32Mi }
            limits:   { cpu: 200m, memory: 64Mi }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: demo-app
spec:
  replicas: 2
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: hello
          image: hashicorp/http-echo:1.0
          args: ["-text=hello-from-api","-listen=:8080"]
          ports: [{ containerPort: 8080 }]
---
apiVersion: v1
kind: Service
metadata: { name: web, namespace: demo-app }
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 80, name: http }]
---
apiVersion: v1
kind: Service
metadata: { name: api, namespace: demo-app }
spec:
  selector: { app: api }
  ports: [{ port: 8080, targetPort: 8080, name: http }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-app
  namespace: demo-app
spec:
  rules:
    - host: demo.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: web, port: { number: 80 } } }
          - path: /api
            pathType: Prefix
            backend: { service: { name: api, port: { number: 8080 } } }
EOF

# 4. Wait for rollouts
kubectl --context "$KIND_CTX" -n demo-app rollout status deploy/web --timeout=120s
kubectl --context "$KIND_CTX" -n demo-app rollout status deploy/api --timeout=120s

# 5. Export kubeconfig pointing at the apiserver via host (kind sets `127.0.0.1:<random>`)
kind get kubeconfig --name "$CLUSTER_NAME" > "$KUBECONFIG_PATH"

# 6. Register the cluster in the portal (skip if already registered with same name)
EXISTING_ID=$(auth_curl "${PORTAL_URL}/api/clusters" 2>/dev/null \
  | jq -r --arg n "Kind E2E Cluster" '.data[] | select(.name == $n) | .id' \
  | head -1)

if [[ -n "$EXISTING_ID" ]]; then
  echo "Cluster already registered as id=$EXISTING_ID"
  CLUSTER_ID="$EXISTING_ID"
else
  KUBECONFIG_JSON=$(jq -Rs . < "$KUBECONFIG_PATH")
  BODY=$(cat <<EOF
{
  "name": "Kind E2E Cluster",
  "slug": "kind-e2e-cluster",
  "provider": "on-prem",
  "region": "local",
  "environment": "development",
  "authType": "standard",
  "kubeconfig": ${KUBECONFIG_JSON}
}
EOF
)
  RESP=$(curl -sS -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" \
    -X POST "${PORTAL_URL}/api/clusters" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  CLUSTER_ID=$(echo "$RESP" | jq -r '.data.id // empty')
  if [[ -z "$CLUSTER_ID" ]]; then
    echo "FAILED to register cluster. Response: $RESP" >&2
    exit 1
  fi
  echo "Registered cluster id=$CLUSTER_ID"
fi

# Persist for downstream scripts
echo "KUBECONFIG_PATH=$KUBECONFIG_PATH" > /tmp/e2e-env.sh
echo "CLUSTER_ID=$CLUSTER_ID"           >> /tmp/e2e-env.sh
echo "ORG_ID=$ORG_ID"                   >> /tmp/e2e-env.sh
echo "KIND_CTX=$KIND_CTX"               >> /tmp/e2e-env.sh
echo ""
echo "Setup complete. Sourced env:"
cat /tmp/e2e-env.sh
