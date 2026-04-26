#!/usr/bin/env bash
set -euo pipefail

RUN_DIR=".ai_runs/latest"
OUTPUT="$RUN_DIR/full_system_dry_run.txt"
mkdir -p "$RUN_DIR"

find_node_runner() {
  for n in "node" "nodejs"; do
    if command -v "$n" >/dev/null 2>&1; then
      echo "$n"
      return 0
    fi
  done
  return 1
}

if ! NODE="$(find_node_runner)"; then
  {
    echo "== DULICHCALI FULL DRY RUN =="
    echo "No node runner found."
    echo "Install Node.js: https://nodejs.org"
    echo
    echo "FINAL: FAIL"
  } | tee "$OUTPUT"
  exit 1
fi

# Explicit test targets — same discipline as ai_trading_system TEST_TARGETS array.
# Each entry is a human-readable label mapped to its runner command below.
TEST_TARGETS=(
  "[Prompt Integrity]              tests/runner.js — Prompt Integrity suite"
  "[State Parser]                  tests/runner.js — State Parser suite"
  "[Availability Logic]            tests/runner.js — Availability Logic suite"
  "[Regression Case Library]       tests/runner.js — Regression Case Library"
  "[UI Overlay Regression]         tests/runner.js — UI Overlay Regression (marketplace.js)"
  "[Voice Mode Regression]         tests/runner.js — Voice Mode Regression (voice-mode.js)"
  "[Receptionist Syntax Stability] tests/runner.js — Receptionist.js Syntax Stability"
)

set +e
{
  echo "== DULICHCALI FULL DRY RUN =="
  echo "Run folder: $RUN_DIR"
  echo "Output: $OUTPUT"
  echo "Node runner: $NODE"
  echo
  echo "Safe validation only:"
  echo "- no production deploy"
  echo "- no Firestore writes"
  echo "- no live booking writes"
  echo "- no real customer notifications"
  echo "- no real payment actions"
  echo "- no API key printing"
  echo "- no secret exposure"
  echo
  echo "== Test targets =="
  printf '  %s\n' "${TEST_TARGETS[@]}"
  echo
  echo "== Running tests =="
  $NODE tests/runner.js
} 2>&1 | tee "$OUTPUT"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -eq 0 ]; then
  echo "FINAL: PASS" | tee -a "$OUTPUT"
else
  echo "FINAL: FAIL" | tee -a "$OUTPUT"
fi

exit "$status"
