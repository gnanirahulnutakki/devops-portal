#!/usr/bin/env bash
# Shared library for e2e scripts. Source this from each phase script.
#
# Env vars (with defaults so scripts work locally + in CI):
#   PORTAL_URL      base URL of running portal      (default http://localhost:3000)
#   COOKIE_FILE     curl cookie jar location        (default /tmp/cookies.txt)
#   ORG_ID          organization id (auto-detected if unset)
#   KIND_CONTEXT    kubectl context name            (default kind-portal-demo)
#   PORTAL_USER     login email                     (default admin@example.com)
#   PORTAL_PASS     login password                  (default admin123)
#   E2E_RESULTS     results file (jsonl)            (default /tmp/e2e-results.jsonl)

set -uo pipefail   # NOTE: no -e — phase scripts collect failures, don't bail

# Auto-source the env file login.sh / setup-kind.sh write — each phase
# script is its own bash process, so exports don't survive across them.
# We use the on-disk env file as the cross-process channel.
if [[ -f /tmp/e2e-env.sh ]]; then
  # shellcheck disable=SC1091
  source /tmp/e2e-env.sh
fi

PORTAL_URL="${PORTAL_URL:-http://localhost:3000}"
COOKIE_FILE="${COOKIE_FILE:-/tmp/cookies.txt}"
ORG_ID="${ORG_ID:-}"
KIND_CONTEXT="${KIND_CONTEXT:-kind-portal-demo}"
PORTAL_USER="${PORTAL_USER:-admin@example.com}"
PORTAL_PASS="${PORTAL_PASS:-admin123}"
E2E_RESULTS="${E2E_RESULTS:-/tmp/e2e-results.jsonl}"

# Color helpers (no-op if NO_COLOR set or stdout is not a TTY)
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  CLR_RED=$'\033[31m'; CLR_GRN=$'\033[32m'; CLR_YEL=$'\033[33m'; CLR_RST=$'\033[0m'
else
  CLR_RED=''; CLR_GRN=''; CLR_YEL=''; CLR_RST=''
fi

# Counters scoped to the current phase
PHASE_NAME="${PHASE_NAME:-unknown}"
PHASE_PASS=0
PHASE_FAIL=0
PHASE_FAILED_TASKS=()

# Wait for the portal to be ready (used by setup-portal.sh and integration tests
# that bring the portal up themselves).
wait_for_portal() {
  local max_attempts="${1:-90}"
  local attempt=0
  while (( attempt < max_attempts )); do
    if curl -m 3 -fsS "${PORTAL_URL}/api/health" 2>/dev/null | grep -q '"status":"healthy"'; then
      echo "${CLR_GRN}portal ready${CLR_RST} (after ${attempt}s)"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  echo "${CLR_RED}portal failed to come up after ${max_attempts}s${CLR_RST}" >&2
  return 1
}

# Login as PORTAL_USER, capture session cookie + ORG_ID.
# Sets/exports ORG_ID so subsequent scripts can use it.
login_and_get_org() {
  local csrf_raw csrf_token
  csrf_raw=$(curl -fsS -c "$COOKIE_FILE" "${PORTAL_URL}/api/auth/csrf")
  csrf_token=$(echo "$csrf_raw" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')

  local http_code
  http_code=$(curl -fsS -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "${PORTAL_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf_token" \
    --data-urlencode "email=$PORTAL_USER" \
    --data-urlencode "password=$PORTAL_PASS" \
    -w "%{http_code}" -o /dev/null)

  if [[ "$http_code" != "302" && "$http_code" != "200" ]]; then
    echo "${CLR_RED}login failed (HTTP $http_code)${CLR_RST}" >&2
    return 1
  fi

  # Auto-detect ORG_ID from the user's memberships.
  # /api/organizations returns {data: [{id, slug, role, ...}]}.
  # Use :- expansion so this works even if ORG_ID was 'unset' (rather than
  # set-to-empty) before we got here. set -u is in effect.
  if [[ -z "${ORG_ID:-}" ]]; then
    local orgs_resp
    orgs_resp=$(curl -fsS -b "$COOKIE_FILE" "${PORTAL_URL}/api/organizations")
    ORG_ID=$(echo "$orgs_resp" | jq -r '(.data // .) | if type=="array" then .[0].id else empty end')
    if [[ -z "$ORG_ID" ]]; then
      echo "${CLR_RED}could not detect ORG_ID after login${CLR_RST}" >&2
      echo "  response: ${orgs_resp:0:200}" >&2
      return 1
    fi
  fi
  export ORG_ID
  echo "${CLR_GRN}logged in${CLR_RST} as $PORTAL_USER, org=$ORG_ID"
}

# Authenticated curl — wraps -b and the org header.
auth_curl() {
  curl -fsS -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" "$@"
}

# Authenticated curl returning HTTP code (no -fsS, so 4xx/5xx don't fail)
auth_curl_code() {
  local url="$1"; shift || true
  curl -sS -b "$COOKIE_FILE" -H "x-organization-id: $ORG_ID" -o /tmp/e2e-resp.json -w "%{http_code}" "$@" "$url"
}

# Record a task result.  Increments counters; appends to E2E_RESULTS (jsonl).
# Usage: record_task <ok|fail> <task_id> <description> [<detail>]
record_task() {
  local outcome="$1"; local task_id="$2"; local desc="$3"; local detail="${4:-}"
  local symbol color
  if [[ "$outcome" == "ok" ]]; then
    symbol="✓"; color="$CLR_GRN"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    symbol="✗"; color="$CLR_RED"
    PHASE_FAIL=$((PHASE_FAIL + 1))
    PHASE_FAILED_TASKS+=("$task_id: $desc")
  fi
  printf '%b%s%b %s — %s%s\n' "$color" "$symbol" "$CLR_RST" "$task_id" "$desc" \
    "${detail:+ ($detail)}"
  jq -nc \
    --arg phase "$PHASE_NAME" \
    --arg task_id "$task_id" \
    --arg outcome "$outcome" \
    --arg desc "$desc" \
    --arg detail "$detail" \
    '{phase:$phase,task_id:$task_id,outcome:$outcome,desc:$desc,detail:$detail,ts:now|todate}' \
    >> "$E2E_RESULTS"
}

# Assert a thing is true; record pass or fail accordingly.
# Usage:
#   assert <task_id> <description> <command-that-returns-truthy-or-exits-0>
# If the command exits non-zero or its stdout is empty, fail.
assert() {
  local task_id="$1"; local desc="$2"; shift 2
  local out rc
  out=$(eval "$@" 2>&1); rc=$?
  if (( rc == 0 )) && [[ -n "$out" || "$rc" -eq 0 ]]; then
    record_task ok "$task_id" "$desc"
  else
    record_task fail "$task_id" "$desc" "rc=$rc out=${out:0:120}"
  fi
}

# Assert HTTP code from a portal endpoint.
# Usage: assert_http <task_id> <expected-code> <description> <portal-path>
assert_http() {
  local task_id="$1"; local expected="$2"; local desc="$3"; local path="$4"
  local actual
  actual=$(auth_curl_code "${PORTAL_URL}${path}")
  if [[ "$actual" == "$expected" ]]; then
    record_task ok "$task_id" "$desc"
  else
    record_task fail "$task_id" "$desc" "expected $expected got $actual"
  fi
}

# Print phase summary; exit non-zero if any tasks failed.
phase_summary() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "Phase: $PHASE_NAME"
  echo "  ${CLR_GRN}passed: $PHASE_PASS${CLR_RST}"
  if (( PHASE_FAIL > 0 )); then
    echo "  ${CLR_RED}failed: $PHASE_FAIL${CLR_RST}"
    for task in "${PHASE_FAILED_TASKS[@]}"; do
      echo "    ${CLR_RED}- $task${CLR_RST}"
    done
  fi
  echo "═══════════════════════════════════════════════"
  return $(( PHASE_FAIL > 0 ? 1 : 0 ))
}
