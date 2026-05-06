#!/usr/bin/env bash
# Start the portal in dev mode in the background, wait for healthy, login.
# Used by GHA e2e job; locally you'd already have the portal running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# 1. Apply DB schema
echo "==> Applying Prisma schema + RLS + seed..."
npm run db:push
npm run db:setup-rls
npm run db:seed

# 2. Start portal in background
echo "==> Starting portal (npm run dev)..."
mkdir -p /tmp/devops-portal-logs
nohup npm run dev > /tmp/devops-portal-logs/portal.log 2>&1 &
echo $! > /tmp/devops-portal.pid

# 3. Wait healthy
wait_for_portal 180

# 4. Login + capture org id
login_and_get_org

# 5. Persist for downstream scripts
echo "PORTAL_URL=$PORTAL_URL"        > /tmp/e2e-env.sh
echo "COOKIE_FILE=$COOKIE_FILE"      >> /tmp/e2e-env.sh
echo "ORG_ID=$ORG_ID"                >> /tmp/e2e-env.sh

echo ""
echo "Portal up and authenticated:"
cat /tmp/e2e-env.sh
