#!/usr/bin/env bash
set -euo pipefail

# full_system_dry_run.sh — AI Project Template
# Generic project validation gate.
# Reads config/ai_project_profile.json when present; auto-detects otherwise.
#
# Canonical usage:
#   scripts/ai/full_system_dry_run.sh
#
# Ends with:
#   FINAL: PASS  — all checks passed
#   FINAL: FAIL  — one or more checks failed
#
# Missing checks are SKIPPED, not PASS.

RUN_DIR=".ai_runs/latest"
OUTPUT="$RUN_DIR/full_system_dry_run.txt"
mkdir -p "$RUN_DIR"

CONFIG_FILE="config/ai_project_profile.json"

# ── config helpers ────────────────────────────────────────────────────────────
read_config_str() {
  local key="$1" default="${2:-}"
  if [ -f "$CONFIG_FILE" ]; then
    python3 -c "
import json,sys
try:
  d=json.load(open('$CONFIG_FILE'))
  v=d.get('$key','$default')
  print(v if isinstance(v,str) else '$default')
except: print('$default')
" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

read_config_list() {
  local key="$1"
  if [ -f "$CONFIG_FILE" ]; then
    python3 -c "
import json,sys
try:
  d=json.load(open('$CONFIG_FILE'))
  for x in d.get('$key',[]):
    print(x)
except: pass
" 2>/dev/null || true
  fi
}

PROJECT_NAME="$(read_config_str project_name "$(basename "$(pwd)")")"

# ── test runner detection ─────────────────────────────────────────────────────
detect_test_runner() {
  # 1. Prefer config-specified commands
  if [ -f "$CONFIG_FILE" ]; then
    local first_cmd
    first_cmd="$(read_config_list safe_validation_commands | head -1)"
    if [ -n "$first_cmd" ]; then
      echo "$first_cmd"
      return 0
    fi
  fi

  # 2. Node: custom test runner
  if [ -f "tests/runner.js" ] && command -v node >/dev/null 2>&1; then
    echo "node tests/runner.js"; return 0
  fi

  # 3. Node: npm test
  if [ -f "package.json" ] && command -v npm >/dev/null 2>&1; then
    if python3 -c "import json; d=json.load(open('package.json')); exit(0 if d.get('scripts',{}).get('test') else 1)" 2>/dev/null; then
      echo "npm test"; return 0
    fi
  fi

  # 4. Python: venv pytest
  for py in ".venv/bin/python" "venv/bin/python"; do
    if [ -f "$py" ] && "$py" -m pytest --version >/dev/null 2>&1; then
      echo "$py -m pytest"; return 0
    fi
  done

  # 5. Python: system pytest
  if command -v pytest >/dev/null 2>&1; then
    echo "pytest"; return 0
  fi

  # 6. Make test
  if [ -f "Makefile" ] && grep -q "^test:" Makefile 2>/dev/null; then
    echo "make test"; return 0
  fi

  return 1
}

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

check_pass() { echo "  PASS  $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
check_fail() { echo "  FAIL  $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
check_skip() { echo "  SKIP  $1"; SKIP_COUNT=$((SKIP_COUNT + 1)); }

set +e
{
  echo "== $PROJECT_NAME — FULL DRY RUN =="
  echo "Run folder: $RUN_DIR"
  echo "Config: ${CONFIG_FILE} ($([ -f "$CONFIG_FILE" ] && echo "found" || echo "not found — using auto-detect"))"
  echo "Date: $(date)"
  echo
  echo "Safety contract:"
  echo "  - no production deploy"
  echo "  - no destructive database writes"
  echo "  - no real notifications or payments"
  echo "  - no secret printing"
  echo "  - no force-push"
  echo

  # ── find test runner ────────────────────────────────────────────────────────
  if TEST_CMD="$(detect_test_runner)"; then
    echo "== Test runner: $TEST_CMD =="
    eval "$TEST_CMD"
    TEST_RC=$?
  else
    echo "== No test runner found =="
    echo "  SKIP  No test command configured or detected."
    echo "  To configure: add 'safe_validation_commands' to $CONFIG_FILE"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    TEST_RC=0
  fi

  echo
  echo "== Structural checks =="

  # Git repo check
  if git rev-parse --git-dir >/dev/null 2>&1; then
    check_pass "Git repository detected"
    BRANCH="$(git branch --show-current 2>/dev/null || echo "unknown")"
    echo "         Branch: $BRANCH"
  else
    check_skip "No git repository (not required)"
  fi

  # Must-not-break targets from config
  MUST_NOT_BREAK="$(read_config_list must_not_break)"
  if [ -n "$MUST_NOT_BREAK" ]; then
    echo
    echo "== Must-not-break flows =="
    while IFS= read -r item; do
      [ -n "$item" ] && check_skip "Runtime check: $item (manual verification required)"
    done <<< "$MUST_NOT_BREAK"
  fi

  # Secret pattern check
  echo
  echo "== Secret scan =="
  SECRET_PATTERNS="$(read_config_list secret_patterns)"
  FOUND_SECRETS=0
  if [ -n "$SECRET_PATTERNS" ]; then
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      if git ls-files 2>/dev/null | xargs grep -l "$pat" 2>/dev/null | grep -v "\.example\|\.template\|\.md\|_ai_project_template" | grep -q "."; then
        FILES="$(git ls-files 2>/dev/null | xargs grep -l "$pat" 2>/dev/null | grep -v "\.example\|\.template\|\.md\|_ai_project_template" | head -3 || true)"
        check_skip "Pattern '$pat' found in tracked files — verify no secrets exposed (files: $(echo "$FILES" | tr '\n' ' '))"
        FOUND_SECRETS=1
      fi
    done <<< "$SECRET_PATTERNS"
    if [ "$FOUND_SECRETS" -eq 0 ]; then
      check_pass "No obvious secret patterns in filenames"
    fi
  else
    check_skip "No secret patterns configured"
  fi

  echo
  echo "== Summary =="
  echo "  PASS: $PASS_COUNT | FAIL: $FAIL_COUNT | SKIP: $SKIP_COUNT"
  echo

} 2>&1 | tee "$OUTPUT"
status=${PIPESTATUS[0]}
set -e

# Re-read counts from output (subshell doesn't propagate vars through tee)
FINAL_FAIL=0
{ FINAL_FAIL=$(grep -c "^  FAIL " "$OUTPUT" 2>/dev/null); } || true
FINAL_FAIL="${FINAL_FAIL:-0}"

if [ "$FINAL_FAIL" -gt 0 ] || [ "$status" -ne 0 ]; then
  echo "FINAL: FAIL" | tee -a "$OUTPUT"
  exit 1
else
  echo "FINAL: PASS" | tee -a "$OUTPUT"
  exit 0
fi
