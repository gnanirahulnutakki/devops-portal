#!/usr/bin/env bash
# Login-only helper for CI, where the portal is already running and the
# DB is already seeded. Locally, prefer setup-portal.sh which does the
# full "from scratch" setup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# Wait healthy first — useful when CI just started the portal one step ago
wait_for_portal 60

# Login + capture ORG_ID
login_and_get_org

# Persist for downstream scripts
echo "PORTAL_URL=$PORTAL_URL"   > /tmp/e2e-env.sh
echo "COOKIE_FILE=$COOKIE_FILE" >> /tmp/e2e-env.sh
echo "ORG_ID=$ORG_ID"           >> /tmp/e2e-env.sh
echo ""
echo "Login OK:"
cat /tmp/e2e-env.sh
