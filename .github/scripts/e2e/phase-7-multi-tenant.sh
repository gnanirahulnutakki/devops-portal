#!/usr/bin/env bash
# Phase 7 — Multi-tenant boundary verification
# Creates a second org, a cluster scoped to it, then verifies the default
# org cannot see the second org's cluster (and vice versa).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"
PHASE_NAME="phase-7-multi-tenant"

if [[ -f /tmp/e2e-env.sh ]]; then
  # shellcheck disable=SC1091
  source /tmp/e2e-env.sh
fi

# Need direct DB access for multi-tenant fixture setup. Use the docker exec
# pattern locally; in CI the postgres service is on localhost:5432 directly.
PSQL_CMD=()
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^devops-portal-postgres$"; then
  # Local: use docker exec
  PSQL_CMD=(docker exec devops-portal-postgres psql -U postgres devops_portal)
else
  # CI: use psql directly (postgres service exposes 5432 to localhost)
  if ! command -v psql >/dev/null 2>&1; then
    record_task fail 7.0 "psql available for multi-tenant DB fixture setup" "psql not found and no devops-portal-postgres container"
    phase_summary
    exit $?
  fi
  PSQL_CMD=(psql "postgresql://postgres:postgres@localhost:5432/devops_portal")
fi

# Use a probe to confirm DB connectivity early
if ! "${PSQL_CMD[@]}" -tAc "SELECT 1" >/dev/null 2>&1; then
  record_task fail 7.0 "DB connectivity for multi-tenant test" "psql probe failed"
  phase_summary
  exit $?
fi

SUFFIX="$(date +%s)_$$"
ALPHA_ORG_ID="org_e2e_alpha_${SUFFIX}"
ALPHA_CLUSTER_ID="c_e2e_alpha_${SUFFIX}"
ALPHA_MEMBERSHIP_ID="m_e2e_alpha_${SUFFIX}"
ALPHA_SLUG="alpha-e2e-${SUFFIX}"

# Clean up any leftovers from earlier failed runs (slugs / IDs starting with
# our test prefix) — otherwise unique constraints block fresh inserts.
"${PSQL_CMD[@]}" -tAc "
  DELETE FROM clusters       WHERE id LIKE 'c_e2e_alpha_%' OR slug LIKE 'alpha-e2e%';
  DELETE FROM memberships    WHERE id LIKE 'm_e2e_alpha_%';
  DELETE FROM organizations  WHERE id LIKE 'org_e2e_alpha_%' OR slug LIKE 'alpha-e2e%';
" >/dev/null 2>&1 || true

# Get the user id so we can attach membership
USER_ID=$("${PSQL_CMD[@]}" -tAc "SELECT id FROM users WHERE email = '$PORTAL_USER';" | tr -d ' ')

if [[ -z "$USER_ID" ]]; then
  record_task fail 7.0 "Find user id for $PORTAL_USER" "no user row"
  phase_summary
  exit $?
fi

# 7.1: Create alpha org
# Prisma uses camelCase column names except where @map() overrides — most
# columns here are camelCase (createdAt, updatedAt). Cluster's organization_id
# IS @map'd to snake_case but that's just for the Cluster table.
INSERT_ERR=$("${PSQL_CMD[@]}" -tAc "
  INSERT INTO organizations (id, name, slug, settings, \"createdAt\", \"updatedAt\")
  VALUES ('$ALPHA_ORG_ID', 'Alpha E2E Org', '$ALPHA_SLUG', '{}', NOW(), NOW());
" 2>&1)
if "${PSQL_CMD[@]}" -tAc "SELECT 1 FROM organizations WHERE id = '$ALPHA_ORG_ID';" | grep -q 1; then
  record_task ok 7.1 "Created second org for tenant boundary test"
else
  record_task fail 7.1 "Created second org for tenant boundary test" "psql: ${INSERT_ERR:0:200}"
  phase_summary
  exit $?
fi

# 7.2: Add admin to alpha org. Memberships table has columns:
# id, role, featureFlags, userId, organizationId, createdAt, updatedAt.
"${PSQL_CMD[@]}" -tAc "
  INSERT INTO memberships (id, \"userId\", \"organizationId\", role, \"createdAt\", \"updatedAt\", \"featureFlags\")
  VALUES ('$ALPHA_MEMBERSHIP_ID', '$USER_ID', '$ALPHA_ORG_ID', 'ADMIN', NOW(), NOW(), '{}');
" >/dev/null 2>&1

# 7.3: Create a cluster in alpha org. Clusters table uses snake_case via @map.
"${PSQL_CMD[@]}" -tAc "
  INSERT INTO clusters (id, name, slug, provider, region, environment, status, organization_id, created_at, updated_at)
  VALUES ('$ALPHA_CLUSTER_ID', 'Alpha E2E Cluster', '$ALPHA_SLUG', 'on-prem', 'local', 'development', 'UNKNOWN', '$ALPHA_ORG_ID', NOW(), NOW());
" >/dev/null 2>&1
if "${PSQL_CMD[@]}" -tAc "SELECT 1 FROM clusters WHERE id = '$ALPHA_CLUSTER_ID';" | grep -q 1; then
  record_task ok 7.2 "Created cluster scoped to alpha org"
else
  record_task fail 7.2 "Created cluster scoped to alpha org"
fi

# IMPORTANT: the user's NextAuth JWT was minted at login time and does NOT
# know about the alpha-org membership we just inserted directly into the DB.
# Middleware will reject alpha-org requests as "not a member" until the JWT
# refreshes. Force a fresh login to pick up the new membership.
rm -f "$COOKIE_FILE"
ORG_ID=""
if ! login_and_get_org > /tmp/e2e-relogin.log 2>&1; then
  record_task fail 7.x "Re-login after adding alpha membership" "see /tmp/e2e-relogin.log"
  phase_summary
  exit $?
fi
# After re-login ORG_ID may have changed — we want the original default-org
# id for the negative test. Default org is whichever has slug='default'.
DEFAULT_ORG_ID=$("${PSQL_CMD[@]}" -tAc "SELECT id FROM organizations WHERE slug = 'default';" | tr -d ' ')

# 7.3: Default org cannot see alpha's cluster
DEFAULT_LIST=$(curl -m 5 -fsS -b "$COOKIE_FILE" -H "x-organization-id: $DEFAULT_ORG_ID" \
  "${PORTAL_URL}/api/clusters" | jq -r '.data[].name' 2>/dev/null)
if echo "$DEFAULT_LIST" | grep -q "Alpha E2E Cluster"; then
  record_task fail 7.3 "Default org leaked alpha's cluster — RLS BROKEN"
else
  record_task ok 7.3 "Default org cannot see alpha cluster (RLS working)"
fi

# 7.4: Alpha org sees ONLY alpha cluster (not default's clusters)
ALPHA_LIST=$(curl -m 5 -fsS -b "$COOKIE_FILE" -H "x-organization-id: $ALPHA_ORG_ID" \
  "${PORTAL_URL}/api/clusters" | jq -r '.data[].name' 2>/dev/null)
ALPHA_HAS_OWN=$(echo "$ALPHA_LIST" | grep -c "Alpha E2E Cluster" || true)
ALPHA_HAS_KIND=$(echo "$ALPHA_LIST" | grep -c "Kind E2E Cluster" || true)
if [[ "$ALPHA_HAS_OWN" -ge 1 && "$ALPHA_HAS_KIND" -eq 0 ]]; then
  record_task ok 7.4 "Alpha org sees its own cluster but not default's"
else
  record_task fail 7.4 "Alpha org isolation broken" "own=$ALPHA_HAS_OWN kind=$ALPHA_HAS_KIND"
fi

# 7.5: Cross-org access by ID — 404 is the cleanest answer (compound key
# returned no row), but 403 is also acceptable (middleware caught it before
# the route ran). Both indicate proper isolation. The defect would be a 200.
CROSS_CODE=$(curl -m 5 -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -H "x-organization-id: $ALPHA_ORG_ID" \
  "${PORTAL_URL}/api/clusters/${CLUSTER_ID:-not-real}")
case "$CROSS_CODE" in
  404|403)
    record_task ok 7.5 "Cross-org cluster GET denied (HTTP $CROSS_CODE)"
    ;;
  200)
    record_task fail 7.5 "Cross-org cluster GET returned 200 — BOUNDARY LEAK"
    ;;
  *)
    record_task fail 7.5 "Cross-org cluster GET denied" "unexpected HTTP $CROSS_CODE"
    ;;
esac

# 7.6: Cleanup
"${PSQL_CMD[@]}" -tAc "
  DELETE FROM clusters WHERE id = '$ALPHA_CLUSTER_ID';
  DELETE FROM memberships WHERE id = '$ALPHA_MEMBERSHIP_ID';
  DELETE FROM organizations WHERE id = '$ALPHA_ORG_ID';
" >/dev/null 2>&1
record_task ok 7.6 "Cleanup test fixtures"

phase_summary
