#!/usr/bin/env bash
# Phase 3 — Pod-detail UI affordances (logs, exec, metrics, YAML).
# Exec test is best done via UI; here we verify the routes return sane HTTP codes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-3-pod-detail"

if [[ -f /tmp/e2e-env.sh ]]; then
  # shellcheck disable=SC1091
  source /tmp/e2e-env.sh
fi
CID="${CLUSTER_ID:-}"
KIND_CTX="${KIND_CTX:-kind-portal-demo}"
if [[ -z "$CID" ]]; then
  echo "${CLR_RED}CLUSTER_ID not set — run setup-kind.sh first${CLR_RST}" >&2
  exit 2
fi

POD_NAME=$(kubectl --context "$KIND_CTX" -n demo-app get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
if [[ -z "$POD_NAME" ]]; then
  record_task fail 3.0 "Find a web pod for testing" "no pod found"
  phase_summary
  exit $?
fi

# 3.1: Pod metrics endpoint — returns 200 even when metrics-server not installed
# (kind doesn't ship metrics-server by default; the route should produce a
# graceful empty response, not a 500).
M_CODE=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/pods/$POD_NAME/metrics?namespace=demo-app")
if [[ "$M_CODE" == "200" || "$M_CODE" == "404" ]]; then
  record_task ok 3.1 "Pod metrics endpoint returns 200 or 404 (graceful when metrics-server absent)"
else
  record_task fail 3.1 "Pod metrics endpoint" "got HTTP $M_CODE (expected 200 or 404)"
fi

# 3.3: YAML editor read path
Y_CODE=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/yaml?apiVersion=v1&kind=Pod&name=$POD_NAME&namespace=demo-app")
if [[ "$Y_CODE" == "200" ]]; then
  Y_KIND=$(cat /tmp/e2e-resp.json | jq -r '.data.yaml' 2>/dev/null | grep -m1 "^kind:" | awk '{print $2}')
  if [[ "$Y_KIND" == "Pod" ]]; then
    record_task ok 3.3 "Pod YAML read returns Pod manifest"
  else
    record_task fail 3.3 "Pod YAML read returns Pod manifest" "kind: $Y_KIND"
  fi
else
  record_task fail 3.3 "Pod YAML read" "HTTP $Y_CODE"
fi

# 3.5: YAML apply refuses Secret (security gate)
SECRET_BODY='{"yaml":"apiVersion: v1\nkind: Secret\nmetadata:\n  name: e2e-test-secret\n  namespace: demo-app\ntype: Opaque\ndata:\n  hello: aGVsbG8=\n"}'
SECRET_CODE=$(curl -m 5 -sS -o /tmp/e2e-resp.json -w "%{http_code}" \
  -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" \
  -X PUT "${PORTAL_URL}/api/clusters/$CID/yaml?apiVersion=v1&kind=Secret&name=e2e-test-secret&namespace=demo-app" \
  -H "Content-Type: application/json" \
  -d "$SECRET_BODY")
if [[ "$SECRET_CODE" == "403" ]]; then
  POLICY=$(cat /tmp/e2e-resp.json | jq -r '.error.code' 2>/dev/null)
  if [[ "$POLICY" == "POLICY_VIOLATION" ]]; then
    record_task ok 3.5 "YAML PUT refuses Secret (POLICY_VIOLATION)"
  else
    record_task fail 3.5 "YAML PUT refuses Secret with POLICY_VIOLATION code" "got code: $POLICY"
  fi
else
  record_task fail 3.5 "YAML PUT refuses Secret with HTTP 403" "got HTTP $SECRET_CODE — possible security regression"
fi

phase_summary
