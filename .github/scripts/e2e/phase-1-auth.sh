#!/usr/bin/env bash
# Phase 1 — Auth + session + org switching
# Tests that the login flow + tenant boundary work as specified in
# docs/development/2026-05-05-v0.1.0-feature-verification.md.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-1-auth"

# 1.1: Login page renders
ACTUAL=$(curl -m 5 -sS -o /dev/null -w "%{http_code}" "${PORTAL_URL}/login")
if [[ "$ACTUAL" == "200" ]]; then
  record_task ok 1.1 "Login page renders"
else
  record_task fail 1.1 "Login page renders" "expected 200 got $ACTUAL"
fi

# 1.2: Login already done by setup-portal.sh; verify cookie is present
if grep -q "authjs.session-token" "$COOKIE_FILE" 2>/dev/null; then
  record_task ok 1.2 "Email/password login produced session cookie"
else
  record_task fail 1.2 "Email/password login produced session cookie" "no authjs cookie in $COOKIE_FILE"
fi

# 1.3: Authenticated session reaches the session endpoint
SESSION=$(curl -m 5 -fsS -b "$COOKIE_FILE" "${PORTAL_URL}/api/auth/session" 2>/dev/null)
if echo "$SESSION" | jq -e '.user.email' >/dev/null 2>&1; then
  record_task ok 1.3 "Session endpoint returns user info"
else
  record_task fail 1.3 "Session endpoint returns user info" "got: ${SESSION:0:120}"
fi

# 1.4: Org listing returns membership
ORG_COUNT=$(curl -m 5 -fsS -b "$COOKIE_FILE" "${PORTAL_URL}/api/organizations" 2>/dev/null \
  | jq 'if type=="array" then length else (.data | length) end' 2>/dev/null)
if [[ -n "$ORG_COUNT" && "$ORG_COUNT" -ge 1 ]]; then
  record_task ok 1.4 "Org listing returns membership"
else
  record_task fail 1.4 "Org listing returns membership" "count=$ORG_COUNT"
fi

# 1.5: SECURITY — tenant API rejects requests without org header
NO_ORG=$(curl -m 5 -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "${PORTAL_URL}/api/clusters")
if [[ "$NO_ORG" == "400" ]]; then
  record_task ok 1.5 "Tenant API rejects request without x-organization-id (boundary)"
else
  record_task fail 1.5 "Tenant API rejects request without x-organization-id (boundary)" "got HTTP $NO_ORG (expected 400)"
fi

# 1.6: WITH org header, request succeeds
WITH_ORG=$(curl -m 5 -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" "${PORTAL_URL}/api/clusters")
if [[ "$WITH_ORG" == "200" ]]; then
  record_task ok 1.6 "Tenant API accepts request with valid org header"
else
  record_task fail 1.6 "Tenant API accepts request with valid org header" "got HTTP $WITH_ORG"
fi

# 1.7: CSRF token endpoint works (NextAuth dependency)
CSRF=$(curl -m 5 -fsS "${PORTAL_URL}/api/auth/csrf" 2>/dev/null | jq -r '.csrfToken' 2>/dev/null)
if [[ -n "$CSRF" && ${#CSRF} -ge 32 ]]; then
  record_task ok 1.7 "CSRF token endpoint produces valid token"
else
  record_task fail 1.7 "CSRF token endpoint produces valid token" "len=${#CSRF}"
fi

# 1.8: Auth providers endpoint lists configured methods
PROVIDERS=$(curl -m 5 -fsS "${PORTAL_URL}/api/auth/providers" 2>/dev/null | jq 'keys | length' 2>/dev/null)
if [[ -n "$PROVIDERS" && "$PROVIDERS" -ge 1 ]]; then
  record_task ok 1.8 "Auth providers endpoint lists configured methods"
else
  record_task fail 1.8 "Auth providers endpoint lists configured methods" "count=$PROVIDERS"
fi

phase_summary
