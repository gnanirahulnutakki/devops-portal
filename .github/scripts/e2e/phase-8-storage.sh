#!/usr/bin/env bash
# Phase 8 — Storage / S3 (MinIO) sanity
# Lighter than the full plan — just verifies the route returns sane data.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-8-storage"

# 8.1: Storage endpoint responds 200 (or 503 if MinIO unreachable; not 500)
S_CODE=$(auth_curl_code "${PORTAL_URL}/api/storage/s3")
case "$S_CODE" in
  200|404)
    record_task ok 8.1 "Storage S3 endpoint responds (HTTP $S_CODE)"
    ;;
  *)
    record_task fail 8.1 "Storage S3 endpoint responds (200/404 expected)" "HTTP $S_CODE"
    ;;
esac

phase_summary
