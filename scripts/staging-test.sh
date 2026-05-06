#!/usr/bin/env bash
#
# Run the e2e suite against a portal deployed to a staging namespace.
# Port-forwards the portal Service locally, then runs the same scripts
# the kind-based e2e workflow uses.
#
# Required env vars:
#   STAGING_NAMESPACE      target namespace
#
# Optional env vars:
#   STAGING_RELEASE        helm release name (default: devops-portal)
#   STAGING_PORTAL_PORT    portal Service port (default: 3000)
#   STAGING_LOCAL_PORT     local port to forward to (default: 3000)

set -euo pipefail

: "${STAGING_NAMESPACE:?STAGING_NAMESPACE is required}"

RELEASE="${STAGING_RELEASE:-devops-portal}"
SVC_PORT="${STAGING_PORTAL_PORT:-3000}"
LOCAL_PORT="${STAGING_LOCAL_PORT:-3000}"

# Pick the portal Service. The chart names it ${RELEASE}-portal or similar;
# fall back to anything matching the release label.
SVC=$(kubectl -n "$STAGING_NAMESPACE" get svc \
  -l "app.kubernetes.io/instance=${RELEASE},app.kubernetes.io/component=portal" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [[ -z "$SVC" ]]; then
  SVC=$(kubectl -n "$STAGING_NAMESPACE" get svc \
    -l "app.kubernetes.io/instance=${RELEASE}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
fi
if [[ -z "$SVC" ]]; then
  echo "✗ No Service found for release $RELEASE in namespace $STAGING_NAMESPACE" >&2
  echo "  Available services:" >&2
  kubectl -n "$STAGING_NAMESPACE" get svc >&2
  exit 2
fi

echo "→ Forwarding svc/$SVC port $SVC_PORT → localhost:$LOCAL_PORT"
kubectl -n "$STAGING_NAMESPACE" port-forward "svc/$SVC" \
  "$LOCAL_PORT:$SVC_PORT" >/tmp/staging-pf.log 2>&1 &
PF_PID=$!

# Always clean up the port-forward. Use SIGTERM (default) first so kubectl
# can close its websocket cleanly; we don't need SIGKILL for a port-forward.
trap 'kill $PF_PID 2>/dev/null || true; wait $PF_PID 2>/dev/null || true' EXIT

# Wait for the forward to be ready
for i in $(seq 1 30); do
  if curl -m 3 -fsS "http://localhost:${LOCAL_PORT}/api/health" 2>/dev/null | grep -q healthy; then
    echo "✓ Portal reachable via port-forward (after ${i}s)"
    break
  fi
  sleep 2
  if (( i == 30 )); then
    echo "✗ Portal port-forward never became healthy."
    cat /tmp/staging-pf.log >&2 || true
    kubectl -n "$STAGING_NAMESPACE" describe svc "$SVC" >&2 || true
    exit 3
  fi
done

# Hand off to the same e2e scripts the kind workflow uses. They take
# PORTAL_URL from env, so just point them at the forwarded port.
export PORTAL_URL="http://localhost:${LOCAL_PORT}"

bash .github/scripts/e2e/login.sh
# NOTE: setup-kind.sh in CI registers a kind cluster. For staging we don't
# have a kind to register; instead, we expect the operator to have already
# registered any clusters they want the portal to manage in staging via the
# UI. Skip cluster registration; phase-2 will run against whatever clusters
# already exist (could be empty — those phases gracefully handle empty lists).
bash .github/scripts/e2e/run-all.sh
