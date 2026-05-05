#!/usr/bin/env bash
# Top-level e2e orchestrator. Runs every phase in order.
# Each phase script collects its own pass/fail; this script aggregates.
# Exits non-zero if any phase failed. Safe to run locally OR in GHA.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

# Reset results file
: > "$E2E_RESULTS"

PHASES=(
  phase-1-auth.sh
  phase-2-cluster-reads.sh
  phase-3-pod-detail.sh
  phase-7-multi-tenant.sh
  phase-8-storage.sh
  phase-11-observability.sh
  phase-12-empty-state-pages.sh
)

OVERALL_FAIL=0
declare -a FAILED_PHASES=()

for phase in "${PHASES[@]}"; do
  echo ""
  echo "▶▶▶ Running $phase"
  echo "──────────────────────────────────────────────"
  if bash "$SCRIPT_DIR/$phase"; then
    echo "${CLR_GRN}■ $phase passed${CLR_RST}"
  else
    OVERALL_FAIL=1
    FAILED_PHASES+=("$phase")
    echo "${CLR_RED}■ $phase had failures (see above)${CLR_RST}"
  fi
done

# Aggregate from results jsonl. Use awk so we get exactly one integer:
# grep -c prints "0" then exits 1 when no matches, and bash's command
# substitution would then capture both grep's "0" and the fallback "0"
# producing "0\n0" — which crashes the (( )) arithmetic context.
TOTAL_PASS=$(awk '/"outcome":"ok"/  {n++} END {print n+0}' "$E2E_RESULTS" 2>/dev/null)
TOTAL_FAIL=$(awk '/"outcome":"fail"/{n++} END {print n+0}' "$E2E_RESULTS" 2>/dev/null)
TOTAL_PASS="${TOTAL_PASS:-0}"
TOTAL_FAIL="${TOTAL_FAIL:-0}"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "                       E2E SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "  ${CLR_GRN}Tasks passed: $TOTAL_PASS${CLR_RST}"
if (( TOTAL_FAIL > 0 )); then
  echo "  ${CLR_RED}Tasks failed: $TOTAL_FAIL${CLR_RST}"
  echo ""
  echo "  Failed phases:"
  for p in "${FAILED_PHASES[@]}"; do echo "    ${CLR_RED}- $p${CLR_RST}"; done
  echo ""
  echo "  Failed task details:"
  jq -c 'select(.outcome == "fail") | {phase, task_id, desc, detail}' "$E2E_RESULTS" 2>/dev/null \
    | while read -r line; do echo "    $line"; done
fi
echo "═══════════════════════════════════════════════════════════════"

# Emit a GitHub Actions step summary if running in CI
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## E2E Test Results"
    echo ""
    echo "- Tasks passed: **$TOTAL_PASS**"
    echo "- Tasks failed: **$TOTAL_FAIL**"
    echo ""
    if (( TOTAL_FAIL > 0 )); then
      echo "### Failed phases"
      for p in "${FAILED_PHASES[@]}"; do echo "- \`$p\`"; done
      echo ""
      echo "### Failed task details"
      echo ""
      echo "| Phase | Task | Description | Detail |"
      echo "|---|---|---|---|"
      jq -r 'select(.outcome == "fail") | "| \(.phase) | \(.task_id) | \(.desc) | \(.detail) |"' "$E2E_RESULTS" 2>/dev/null
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

exit $OVERALL_FAIL
