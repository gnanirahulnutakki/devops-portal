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

# Generate strong secrets if not already provided. We'll pass these as helm
# values so the Helm-managed Secret holds them. Repeat runs reuse the same
# values by reading them out of the existing Secret if present (so existing
# data — encrypted credentials, etc. — remains decryptable).
NEXTAUTH_SECRET=$(kubectl -n "$STAGING_NAMESPACE" get secret "${RELEASE}-portal" \
  -o jsonpath='{.data.NEXTAUTH_SECRET}' 2>/dev/null | base64 -d || true)
TOKEN_ENCRYPTION_KEY=$(kubectl -n "$STAGING_NAMESPACE" get secret "${RELEASE}-portal" \
  -o jsonpath='{.data.TOKEN_ENCRYPTION_KEY}' 2>/dev/null | base64 -d || true)
[[ -z "$NEXTAUTH_SECRET"     ]] && NEXTAUTH_SECRET=$(openssl rand -base64 32)
[[ -z "$TOKEN_ENCRYPTION_KEY" ]] && TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)

echo "→ Release         : $RELEASE"
echo "→ Namespace       : $STAGING_NAMESPACE"
echo "→ Image tag       : $IMAGE_TAG"
echo "→ Host            : ${STAGING_HOST:-<none>}"
echo ""

# Build optional helm value overrides
EXTRA_VALUES=()
[[ -n "${STAGING_HOST:-}"             ]] && EXTRA_VALUES+=(--set "ingress.enabled=true" --set "ingress.hosts[0].host=${STAGING_HOST}")
[[ -n "${STAGING_ARGOCD_URL:-}"       ]] && EXTRA_VALUES+=(--set-string "integrations.argocd.url=${STAGING_ARGOCD_URL}")
[[ -n "${STAGING_PROMETHEUS_URL:-}"   ]] && EXTRA_VALUES+=(--set-string "integrations.prometheus.url=${STAGING_PROMETHEUS_URL}")
[[ -n "${STAGING_GRAFANA_URL:-}"      ]] && EXTRA_VALUES+=(--set-string "integrations.grafana.url=${STAGING_GRAFANA_URL}")
[[ -n "${STAGING_LOKI_URL:-}"         ]] && EXTRA_VALUES+=(--set-string "integrations.loki.url=${STAGING_LOKI_URL}")

# Update chart deps before install — needed once the lockfile is missing or
# the chart has been modified. Cheap to run unconditionally.
helm dependency update helm/devops-portal/ >/dev/null 2>&1 || true

# Helm-deploy. --install makes upgrade idempotent (creates if missing).
# --atomic rolls back if rollout fails. --wait blocks until pods Ready.
helm upgrade --install "$RELEASE" helm/devops-portal/ \
  --namespace "$STAGING_NAMESPACE" \
  --set "image.tag=${IMAGE_TAG}" \
  --set-string "auth.nextAuthSecret=${NEXTAUTH_SECRET}" \
  --set-string "auth.tokenEncryptionKey=${TOKEN_ENCRYPTION_KEY}" \
  --set "auth.mode=multi" \
  --set "auth.enableCredentialsAuth=true" \
  "${EXTRA_VALUES[@]}" \
  --atomic --wait --timeout 10m

echo ""
echo "✓ Deploy complete."
kubectl -n "$STAGING_NAMESPACE" get pods -l "app.kubernetes.io/instance=$RELEASE"
