#!/usr/bin/env bash
#
# Helm-deploy the portal to the staging namespace and wait for rollout.
# Used by .github/workflows/integration-staging.yml AND can be run locally
# (with KUBECONFIG pointing at the staging kubeconfig).
#
# Required env vars:
#   STAGING_NAMESPACE   target namespace (e.g., duploservices-qaibtest)
#   IMAGE_TAG           container image tag to deploy (e.g., v0.1.1, sha-abc1234)
#
# Optional env vars:
#   STAGING_RELEASE     helm release name (default: devops-portal)
#   STAGING_HOST        external hostname for the Ingress (default: empty → no ingress)
#   STAGING_ARGOCD_URL, STAGING_PROMETHEUS_URL, STAGING_GRAFANA_URL,
#   STAGING_LOKI_URL    integration target URLs the deployed portal connects to
#

set -euo pipefail

: "${STAGING_NAMESPACE:?STAGING_NAMESPACE is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

RELEASE="${STAGING_RELEASE:-devops-portal}"
# The chart writes the runtime Secret to "<fullname>-secrets" — see
# helm/devops-portal/templates/sealed-secret.yaml. Match it here so we can
# read prior values back across redeploys.
SECRET_NAME="${RELEASE}-secrets"

# Generate strong secrets if not already provided. Re-use existing values
# from the previously-deployed Secret if present, so encrypted DB rows
# remain decryptable across redeploys.
NEXTAUTH_SECRET=$(kubectl -n "$STAGING_NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.NEXTAUTH_SECRET}' 2>/dev/null | base64 -d || true)
TOKEN_ENCRYPTION_KEY=$(kubectl -n "$STAGING_NAMESPACE" get secret "$SECRET_NAME" \
  -o jsonpath='{.data.TOKEN_ENCRYPTION_KEY}' 2>/dev/null | base64 -d || true)
[[ -z "$NEXTAUTH_SECRET"     ]] && NEXTAUTH_SECRET=$(openssl rand -base64 32)
[[ -z "$TOKEN_ENCRYPTION_KEY" ]] && TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)

echo "→ Release         : $RELEASE"
echo "→ Namespace       : $STAGING_NAMESPACE"
echo "→ Image tag       : $IMAGE_TAG"
echo "→ Host            : ${STAGING_HOST:-<none>}"
echo ""

# Build a temp values file. Two reasons over `--set`:
#   1. Secrets passed via --set show up in `ps aux` while helm runs;
#      values files are read once at startup and don't leak.
#   2. The chart's value structure has nested keys (config.*, secrets.*,
#      secrets.values.*) that --set's dot-path is awkward for.
#
# The chart's structure (verified in helm/devops-portal/values.yaml):
#   - config.enableCredentialsAuth → toggles credentials login
#   - secrets.create=true          → produce a regular Secret (vs sealed)
#   - secrets.useSealedSecrets=false → don't expect a SealedSecret to exist
#   - secrets.values.NEXTAUTH_SECRET / .TOKEN_ENCRYPTION_KEY → the actual values
#   - extraEnv: [{name: AUTH_MODE, value: multi}] → AUTH_MODE has no top-level
#     key in the chart; pipe it through extraEnv.
VALUES_FILE=$(mktemp /tmp/staging-values.XXXXXX.yaml)
trap 'rm -f "$VALUES_FILE"' EXIT

cat > "$VALUES_FILE" <<EOF
image:
  tag: "${IMAGE_TAG}"

config:
  enableCredentialsAuth: true
  baseUrl: "https://${STAGING_HOST:-devops-portal.staging.local}"

secrets:
  useSealedSecrets: false
  create: true
  values:
    NEXTAUTH_SECRET: "${NEXTAUTH_SECRET}"
    TOKEN_ENCRYPTION_KEY: "${TOKEN_ENCRYPTION_KEY}"

extraEnv:
  - name: AUTH_MODE
    value: multi
EOF

if [[ -n "${STAGING_HOST:-}" ]]; then
  cat >> "$VALUES_FILE" <<EOF

ingress:
  enabled: true
  hosts:
    - host: "${STAGING_HOST}"
      paths:
        - path: /
          pathType: Prefix
EOF
fi

if [[ -n "${STAGING_ARGOCD_URL:-}${STAGING_PROMETHEUS_URL:-}${STAGING_GRAFANA_URL:-}${STAGING_LOKI_URL:-}" ]]; then
  cat >> "$VALUES_FILE" <<EOF

integrations:
EOF
  [[ -n "${STAGING_ARGOCD_URL:-}"     ]] && printf '  argocd:\n    url: %q\n'     "$STAGING_ARGOCD_URL"     >> "$VALUES_FILE"
  [[ -n "${STAGING_PROMETHEUS_URL:-}" ]] && printf '  prometheus:\n    url: %q\n' "$STAGING_PROMETHEUS_URL" >> "$VALUES_FILE"
  [[ -n "${STAGING_GRAFANA_URL:-}"    ]] && printf '  grafana:\n    url: %q\n'    "$STAGING_GRAFANA_URL"    >> "$VALUES_FILE"
  [[ -n "${STAGING_LOKI_URL:-}"       ]] && printf '  loki:\n    url: %q\n'       "$STAGING_LOKI_URL"       >> "$VALUES_FILE"
fi

# Update chart deps. Don't suppress output or swallow errors — a missing
# dependency or repo registry failure should be loud, especially in CI.
helm dependency update helm/devops-portal/

# Helm-deploy. --install makes upgrade idempotent (creates if missing).
# --atomic rolls back if rollout fails. --wait blocks until pods Ready.
helm upgrade --install "$RELEASE" helm/devops-portal/ \
  --namespace "$STAGING_NAMESPACE" \
  -f "$VALUES_FILE" \
  --atomic --wait --timeout 10m

echo ""
echo "✓ Deploy complete."
kubectl -n "$STAGING_NAMESPACE" get pods -l "app.kubernetes.io/instance=$RELEASE"
