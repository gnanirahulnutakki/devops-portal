#!/usr/bin/env bash
#
# Bootstrap a namespace for use as a long-lived staging environment.
#
# This is a ONE-TIME setup. Run with cluster-admin kubeconfig. It will:
#   1. Create the staging namespace (if not present)
#   2. Create a ServiceAccount the CI / dev tooling will use
#   3. Bind that SA to the built-in `edit` ClusterRole, scoped to the namespace
#   4. Generate a long-lived bearer-token kubeconfig and print it
#
# After running this, copy the kubeconfig output to a GitHub Actions secret
# named STAGING_KUBECONFIG (gh secret set STAGING_KUBECONFIG < /tmp/staging.kubeconfig)
# and set a repository variable STAGING_ENABLED=true.
#
# Usage:
#   ./scripts/bootstrap-staging-rbac.sh \
#     --context self-managed-qa \
#     --namespace duploservices-qaibtest \
#     [--sa-name devops-portal-ci]    # default: devops-portal-ci
#     [--output /tmp/staging.kubeconfig]
#
# Idempotent: re-running creates new tokens and overwrites the kubeconfig.
# Doesn't delete prior tokens — if you want to rotate, delete the old Secret
# manually first.

set -euo pipefail

CONTEXT=""
NAMESPACE=""
SA_NAME="devops-portal-ci"
OUTPUT="/tmp/staging.kubeconfig"
SECRET_NAME=""   # auto-derived from SA name if empty

while [[ $# -gt 0 ]]; do
  case "$1" in
    --context)    CONTEXT="$2"; shift 2 ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --sa-name)    SA_NAME="$2"; shift 2 ;;
    --output)     OUTPUT="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^set -e/p' "$0" | head -25
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2; exit 1
      ;;
  esac
done

if [[ -z "$CONTEXT" || -z "$NAMESPACE" ]]; then
  echo "ERROR: --context and --namespace are required" >&2
  exit 1
fi

SECRET_NAME="${SA_NAME}-token"

echo "→ Cluster context : $CONTEXT"
echo "→ Namespace       : $NAMESPACE"
echo "→ ServiceAccount  : $SA_NAME"
echo "→ Output          : $OUTPUT"
echo ""

# 1. Probe access
if ! kubectl --context "$CONTEXT" auth can-i create namespaces 2>/dev/null | grep -q yes; then
  echo "✗ This kubeconfig context can't create namespaces."
  echo "  This script needs cluster-admin or close to it (creates namespace + RBAC bindings)."
  echo "  After bootstrap, the CI ServiceAccount will be namespace-scoped only."
  exit 2
fi

# 2. Namespace
kubectl --context "$CONTEXT" create namespace "$NAMESPACE" --dry-run=client -o yaml \
  | kubectl --context "$CONTEXT" apply -f - >/dev/null
echo "✓ Namespace ready"

# 3. ServiceAccount
kubectl --context "$CONTEXT" -n "$NAMESPACE" \
  create sa "$SA_NAME" --dry-run=client -o yaml \
  | kubectl --context "$CONTEXT" apply -f - >/dev/null
echo "✓ ServiceAccount $SA_NAME"

# 4. RoleBinding to the built-in `edit` ClusterRole, scoped to this namespace.
#    `edit` allows creating/updating/deleting most workload resources but
#    explicitly excludes: viewing/managing Roles or RoleBindings, and managing
#    ResourceQuota / Namespace / Node etc. Right tool for "deploy app + run tests".
kubectl --context "$CONTEXT" -n "$NAMESPACE" \
  create rolebinding "${SA_NAME}-edit" \
  --clusterrole=edit \
  --serviceaccount="${NAMESPACE}:${SA_NAME}" \
  --dry-run=client -o yaml \
  | kubectl --context "$CONTEXT" apply -f - >/dev/null
echo "✓ RoleBinding (edit ClusterRole, namespace-scoped)"

# 5. Long-lived token Secret. K8s 1.24+ no longer auto-creates these for
#    ServiceAccounts; we create one explicitly.
kubectl --context "$CONTEXT" -n "$NAMESPACE" apply -f - <<EOF >/dev/null
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  annotations:
    kubernetes.io/service-account.name: $SA_NAME
type: kubernetes.io/service-account-token
EOF

# 6. Wait for the controller to populate the token (usually instant)
for i in $(seq 1 30); do
  if kubectl --context "$CONTEXT" -n "$NAMESPACE" get secret "$SECRET_NAME" \
       -o jsonpath='{.data.token}' 2>/dev/null | grep -q .; then
    break
  fi
  sleep 1
done
echo "✓ Token Secret populated"

# 7. Build the kubeconfig.
TOKEN=$(kubectl --context "$CONTEXT" -n "$NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.token}' | base64 -d)
CA=$(kubectl --context "$CONTEXT" -n "$NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl --context "$CONTEXT" config view --raw -o json \
  | jq -r --arg ctx "$CONTEXT" '.contexts[]|select(.name==$ctx).context.cluster as $c | .clusters[]|select(.name==$c).cluster.server')
CLUSTER_NAME=$(kubectl --context "$CONTEXT" config view --raw -o json \
  | jq -r --arg ctx "$CONTEXT" '.contexts[]|select(.name==$ctx).context.cluster')

cat > "$OUTPUT" <<EOF
apiVersion: v1
kind: Config
current-context: ${CLUSTER_NAME}
clusters:
- name: ${CLUSTER_NAME}
  cluster:
    server: ${SERVER}
    certificate-authority-data: ${CA}
contexts:
- name: ${CLUSTER_NAME}
  context:
    cluster: ${CLUSTER_NAME}
    namespace: ${NAMESPACE}
    user: ${SA_NAME}
users:
- name: ${SA_NAME}
  user:
    token: ${TOKEN}
EOF

chmod 600 "$OUTPUT"

echo "✓ Kubeconfig written to: $OUTPUT"
echo ""
echo "── Next steps ──────────────────────────────────────────────"
echo "1. Verify it works:"
echo "     KUBECONFIG=$OUTPUT kubectl get pods"
echo ""
echo "2. Add as a GitHub Actions secret + variable:"
echo "     gh secret set STAGING_KUBECONFIG < $OUTPUT"
echo "     gh variable set STAGING_NAMESPACE --body '$NAMESPACE'"
echo "     gh variable set STAGING_ENABLED --body 'true'"
echo ""
echo "3. Trigger the workflow:"
echo "     gh workflow run integration-staging.yml"
echo "─────────────────────────────────────────────────────────"
