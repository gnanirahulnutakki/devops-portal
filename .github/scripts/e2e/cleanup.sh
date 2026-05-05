#!/usr/bin/env bash
# Best-effort teardown. Safe to run anywhere.

set -uo pipefail

# Stop the portal if we started it
if [[ -f /tmp/devops-portal.pid ]]; then
  PID=$(cat /tmp/devops-portal.pid)
  kill "$PID" 2>/dev/null || true
  rm -f /tmp/devops-portal.pid
fi

# Kill any leftover next-server processes
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

# Surface portal log on failure (CI artifact friendly)
if [[ -n "${CI:-}" && -f /tmp/devops-portal-logs/portal.log ]]; then
  echo "═══ Portal stdout/stderr (last 200 lines) ═══"
  tail -200 /tmp/devops-portal-logs/portal.log
fi
