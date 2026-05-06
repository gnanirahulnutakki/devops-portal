#!/usr/bin/env bash
# Phase 12 — Pages without configured backends must show a graceful empty
# state, not 500. Uses HEAD/GET on the page route directly (renders SSR).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-12-empty-state-pages"

# Pages that should render even without their backend integration configured.
# We hit them with the cookie + org header to get past auth/middleware, then
# expect a 200 from the rendering layer (or a 404 if the route was removed —
# which is also fine, that's an explicit "feature unavailable" signal).
declare -a PAGES=(
  "/dashboard"
  "/clusters"
  "/repositories"
  "/pull-requests"
  "/github-actions"
  "/argocd"
  "/argocd/applicationsets"
  "/argocd/projects"
  "/gitops-studio"
  "/monitoring/grafana/dashboards"
  "/monitoring/grafana/alerts"
  "/monitoring/grafana/insights"
  "/monitoring/dora"
  "/monitoring/credential-health"
  "/monitoring/loki"
  "/scorecards"
  "/vulnerability"
  "/storage"
  "/uptime-kuma"
  "/team"
  "/organizations"
  "/helm"
  "/diagrams"
  "/mcp"
  "/api-docs"
  "/settings"
  "/settings/configurations"
  "/settings/configurations/argocd"
  "/settings/configurations/grafana"
  "/settings/configurations/github"
  "/settings/configurations/llm"
  "/settings/configurations/uptime-kuma"
  "/alerts"
  "/deployments"
)

PASS=0; FAIL=0; FAIL_PAGES=()
# Next.js dev mode compiles pages on first hit (~5-10s for some routes in
# CI). Use a generous per-page timeout so a slow compile doesn't fail
# what's actually a working page.
for path in "${PAGES[@]}"; do
  CODE=$(curl -m 60 -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
    -H "x-organization-id: $ORG_ID" \
    -H "Cookie: $(awk '/authjs.session-token/ {print "authjs.session-token=" $7}' "$COOKIE_FILE")" \
    "${PORTAL_URL}${path}")
  case "$CODE" in
    200|307|308)  # 200 OK, 307/308 redirect (e.g. to login)
      PASS=$((PASS + 1))
      ;;
    *)
      FAIL=$((FAIL + 1))
      FAIL_PAGES+=("$path → HTTP $CODE")
      ;;
  esac
done

if (( FAIL == 0 )); then
  record_task ok 12.0 "All ${#PAGES[@]} dashboard pages render without 5xx"
else
  for f in "${FAIL_PAGES[@]}"; do
    record_task fail "12.x" "Page $f"
  done
  record_task fail 12.0 "Some pages 5xx'd: $FAIL of ${#PAGES[@]} failed"
fi

phase_summary
