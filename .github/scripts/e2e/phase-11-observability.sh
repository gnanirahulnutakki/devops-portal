#!/usr/bin/env bash
# Phase 11 — Health, metrics, openapi (production observability surfaces)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-11-observability"

# 11.1: /api/health
HEALTH=$(curl -m 5 -fsS "${PORTAL_URL}/api/health" 2>/dev/null)
if echo "$HEALTH" | jq -e '.checks.database, .checks.auth' >/dev/null 2>&1; then
  STATUS=$(echo "$HEALTH" | jq -r .status)
  if [[ "$STATUS" == "healthy" ]]; then
    record_task ok 11.1 "/api/health reports healthy"
  else
    record_task fail 11.1 "/api/health reports healthy" "status=$STATUS"
  fi
else
  record_task fail 11.1 "/api/health returns shape with checks.database/auth"
fi

# 11.2: /api/metrics (Prometheus format)
METRICS=$(curl -m 5 -fsS "${PORTAL_URL}/api/metrics" 2>/dev/null)
if echo "$METRICS" | grep -qE "^# HELP|^# TYPE"; then
  record_task ok 11.2 "/api/metrics returns Prometheus exposition"
else
  record_task fail 11.2 "/api/metrics returns Prometheus exposition" "first 80 chars: ${METRICS:0:80}"
fi

# 11.3: /api/openapi
OPENAPI=$(curl -m 5 -fsS "${PORTAL_URL}/api/openapi" 2>/dev/null)
PATHS_COUNT=$(echo "$OPENAPI" | jq '.paths | keys | length' 2>/dev/null)
if [[ -n "$PATHS_COUNT" && "$PATHS_COUNT" -ge 30 ]]; then
  record_task ok 11.3 "/api/openapi returns spec with ≥30 paths"
else
  record_task fail 11.3 "/api/openapi returns spec with ≥30 paths" "got $PATHS_COUNT"
fi

# 11.4: Version in package.json matches openapi spec version
PKG_VER=$(jq -r .version package.json)
SPEC_VER=$(echo "$OPENAPI" | jq -r '.info.version' 2>/dev/null)
if [[ "$PKG_VER" == "$SPEC_VER" ]]; then
  record_task ok 11.4 "OpenAPI spec version matches package.json"
else
  record_task fail 11.4 "OpenAPI spec version matches package.json" "pkg=$PKG_VER spec=$SPEC_VER"
fi

phase_summary
