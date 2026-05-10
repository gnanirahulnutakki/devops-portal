#!/usr/bin/env bash
# Phase 8 — Storage / S3 (MinIO) sanity
# Lighter than the full plan — just verifies the route returns sane data.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-8-storage"

# 8.1: Storage endpoint responds gracefully — anything but a 5xx.
#   200 — bucket configured + reachable (e2e.yml: env-configured S3 + MinIO container)
#   400 — S3 not configured for this org (integration.yml: no S3 env, no MinIO container)
#   404 — route present but resource not found (rare, but graceful)
# A 500 is a real bug; anything else (auth/csrf weirdness) is also a fail.
S_CODE=$(auth_curl_code "${PORTAL_URL}/api/storage/s3")
case "$S_CODE" in
  200|400|404)
    record_task ok 8.1 "Storage S3 endpoint responds gracefully (HTTP $S_CODE)"
    ;;
  *)
    record_task fail 8.1 "Storage S3 endpoint responds (200/400/404 expected)" "HTTP $S_CODE"
    ;;
esac

phase_summary
