#!/usr/bin/env bash
# Phase 2 — Cluster federation read paths against kind
# Verifies all the K8s read endpoints we ship as features.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-2-cluster-reads"

# Pull cluster id from setup
if [[ -f /tmp/e2e-env.sh ]]; then
  # shellcheck disable=SC1091
  source /tmp/e2e-env.sh
fi
CID="${CLUSTER_ID:-}"
if [[ -z "$CID" ]]; then
  echo "${CLR_RED}CLUSTER_ID not set — run setup-kind.sh first${CLR_RST}" >&2
  exit 2
fi

# 2.1: List clusters returns ≥1
COUNT=$(auth_curl "${PORTAL_URL}/api/clusters" | jq '.data | length' 2>/dev/null)
if [[ -n "$COUNT" && "$COUNT" -ge 1 ]]; then
  record_task ok 2.1 "List clusters returns ≥1"
else
  record_task fail 2.1 "List clusters returns ≥1" "count=$COUNT"
fi

# 2.2: Get single cluster
NAME=$(auth_curl "${PORTAL_URL}/api/clusters/$CID" | jq -r '.data.name' 2>/dev/null)
if [[ "$NAME" == "Kind E2E Cluster" ]]; then
  record_task ok 2.2 "Get single cluster returns expected name"
else
  record_task fail 2.2 "Get single cluster returns expected name" "got '$NAME'"
fi

# 2.3: Cluster overview
OVERVIEW=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/overview")
if [[ "$OVERVIEW" == "200" ]]; then
  record_task ok 2.3 "Cluster overview"
else
  record_task fail 2.3 "Cluster overview" "HTTP $OVERVIEW"
fi

# 2.4: Nodes — kind config has 1 control-plane (CI) or 3 (prior local config)
NODES=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/nodes" | jq '.data | length' 2>/dev/null)
if [[ -n "$NODES" && "$NODES" -ge 1 ]]; then
  record_task ok 2.4 "List nodes returns ≥1"
else
  record_task fail 2.4 "List nodes returns ≥1" "count=$NODES"
fi

# 2.5: Namespaces — kind has at least 5 (default + 4 system) plus our demo-app = ≥6
NS_COUNT=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/namespaces" | jq '.data | length' 2>/dev/null)
if [[ -n "$NS_COUNT" && "$NS_COUNT" -ge 5 ]]; then
  record_task ok 2.5 "List namespaces returns ≥5"
else
  record_task fail 2.5 "List namespaces returns ≥5" "count=$NS_COUNT"
fi

# 2.6: Pods (all namespaces)
POD_COUNT=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/pods" | jq '.data | length' 2>/dev/null)
if [[ -n "$POD_COUNT" && "$POD_COUNT" -ge 5 ]]; then
  record_task ok 2.6 "List pods (all namespaces) returns ≥5"
else
  record_task fail 2.6 "List pods (all namespaces) returns ≥5" "count=$POD_COUNT"
fi

# 2.7: Pods (single namespace)
DEMO_PODS=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/pods?namespace=demo-app" | jq '.data | length' 2>/dev/null)
if [[ -n "$DEMO_PODS" && "$DEMO_PODS" -ge 5 ]]; then
  record_task ok 2.7 "List pods (demo-app namespace) returns ≥5"
else
  record_task fail 2.7 "List pods (demo-app namespace) returns ≥5" "count=$DEMO_PODS"
fi

# 2.8: Pod detail (via list+filter — UI does it the same way; no per-pod GET route)
POD_NAME=$(kubectl --context "${KIND_CTX:-kind-portal-demo}" -n demo-app get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
if [[ -z "$POD_NAME" ]]; then
  record_task fail 2.8 "Pod detail" "no web pod found in demo-app"
else
  POD_STATUS=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/pods?namespace=demo-app" \
    | jq -r --arg n "$POD_NAME" '.data[] | select(.name == $n) | .status' 2>/dev/null)
  if [[ "$POD_STATUS" == "Running" ]]; then
    record_task ok 2.8 "Pod detail (via list+filter) shows Running"
  else
    record_task fail 2.8 "Pod detail (via list+filter) shows Running" "status=$POD_STATUS"
  fi
fi

# 2.9: Pod logs (one-shot)
if [[ -n "$POD_NAME" ]]; then
  LOG_LEN=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/pods/$POD_NAME/logs?namespace=demo-app&tailLines=20" \
    | jq -r '.data.logs' 2>/dev/null | wc -c)
  if [[ "$LOG_LEN" -gt 50 ]]; then
    record_task ok 2.9 "Pod logs (one-shot) returns ≥50 chars"
  else
    record_task fail 2.9 "Pod logs (one-shot) returns ≥50 chars" "got $LOG_LEN chars"
  fi
fi

# 2.10: Pod logs SSE stream — fetch 5 seconds, expect at least one data: chunk
if [[ -n "$POD_NAME" ]]; then
  STREAM_OUT=$(timeout 5 curl -m 8 -N -fsS -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" \
    "${PORTAL_URL}/api/clusters/$CID/pods/$POD_NAME/logs/stream?namespace=demo-app&tailLines=20&container=nginx" \
    2>/dev/null || true)
  if echo "$STREAM_OUT" | grep -qE "^data: "; then
    record_task ok 2.10 "Pod logs SSE stream emits data chunks"
  else
    record_task fail 2.10 "Pod logs SSE stream emits data chunks" "stream output empty or no 'data:' lines"
  fi
fi

# 2.11: Workloads
WORKLOADS=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/workloads" | jq '.data | length' 2>/dev/null)
if [[ -n "$WORKLOADS" && "$WORKLOADS" -ge 4 ]]; then
  record_task ok 2.11 "List workloads returns ≥4 (api+web+coredns+local-path)"
else
  record_task fail 2.11 "List workloads returns ≥4" "count=$WORKLOADS"
fi

# 2.12: Services
SVC_COUNT=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/services" | jq '.data | length' 2>/dev/null)
if [[ -n "$SVC_COUNT" && "$SVC_COUNT" -ge 3 ]]; then
  record_task ok 2.12 "List services returns ≥3"
else
  record_task fail 2.12 "List services returns ≥3" "count=$SVC_COUNT"
fi

# 2.13: Ingresses
ING_HOST=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/ingresses" | jq -r '.data[0].hosts // .data[0].host // empty' 2>/dev/null)
if [[ "$ING_HOST" == "demo.local" ]]; then
  record_task ok 2.13 "List ingresses includes demo.local"
else
  record_task fail 2.13 "List ingresses includes demo.local" "first host='$ING_HOST'"
fi

# 2.14: Events (we don't trigger a fresh restart in CI to keep timing stable;
# recently-created pods produce events that K8s keeps for 1h)
EVT=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/events?namespace=demo-app")
if [[ "$EVT" == "200" ]]; then
  record_task ok 2.14 "Events endpoint returns 200"
else
  record_task fail 2.14 "Events endpoint returns 200" "HTTP $EVT"
fi

# 2.15: CRDs (kind has none; expect 200 with empty array)
CRD_COUNT=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/crds" | jq '.data | length' 2>/dev/null)
if [[ -n "$CRD_COUNT" ]]; then
  record_task ok 2.15 "CRDs endpoint returns 200 (empty for kind is fine)"
else
  record_task fail 2.15 "CRDs endpoint returns 200" "no .data in response"
fi

# 2.16: Helm releases — empty for kind, but endpoint must work
HELM_CODE=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/helm")
if [[ "$HELM_CODE" == "200" ]]; then
  HELM_COUNT=$(auth_curl "${PORTAL_URL}/api/clusters/$CID/helm" | jq '.data | length' 2>/dev/null)
  if [[ "$HELM_COUNT" == "0" ]]; then
    record_task ok 2.16 "Helm releases empty for kind (no false positives from system Secrets)"
  else
    record_task fail 2.16 "Helm releases empty for kind" "got $HELM_COUNT (expected 0; old labelSelector bug?)"
  fi
else
  record_task fail 2.16 "Helm releases empty for kind" "HTTP $HELM_CODE"
fi

# 2.17: Argo Rollouts must return 404 (CRDs not installed) not 500
ROL=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/rollouts")
if [[ "$ROL" == "404" ]]; then
  ROL_CODE=$(cat /tmp/e2e-resp.json | jq -r '.error.code' 2>/dev/null)
  if [[ "$ROL_CODE" == "ROLLOUTS_CRD_NOT_INSTALLED" ]]; then
    record_task ok 2.17 "Rollouts returns 404 ROLLOUTS_CRD_NOT_INSTALLED"
  else
    record_task fail 2.17 "Rollouts returns 404 with right error code" "code=$ROL_CODE"
  fi
else
  record_task fail 2.17 "Rollouts returns 404 not 500" "got HTTP $ROL"
fi

# 2.18: YAML for an arbitrary K8s object
YAML_CODE=$(auth_curl_code "${PORTAL_URL}/api/clusters/$CID/yaml?apiVersion=apps/v1&kind=Deployment&name=web&namespace=demo-app")
if [[ "$YAML_CODE" == "200" ]]; then
  YAML_KIND=$(cat /tmp/e2e-resp.json | jq -r '.data.yaml' 2>/dev/null | grep -m1 "^kind:" | awk '{print $2}')
  if [[ "$YAML_KIND" == "Deployment" ]]; then
    record_task ok 2.18 "YAML endpoint returns Deployment manifest"
  else
    record_task fail 2.18 "YAML endpoint returns Deployment manifest" "kind line: $YAML_KIND"
  fi
else
  record_task fail 2.18 "YAML endpoint" "HTTP $YAML_CODE"
fi

phase_summary
