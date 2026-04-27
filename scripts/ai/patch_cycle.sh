#!/usr/bin/env bash
set -euo pipefail

# patch_cycle.sh — AI Project Template
# Prompt-driven patch helper. Captures state, runs pre-check, builds Claude prompt.
#
# Usage:
#   scripts/ai/patch_cycle.sh prompts/<prompt>.md [--scope <scope>]
#
# This is a SECONDARY helper. The canonical workflow uses ai_dev_loop.sh.
# Use patch_cycle.sh when you want to manually prepare a Claude prompt
# for a specific patch without running the full dev loop.

PROMPT_FILE="${1:-}"
SCOPE=""
shift 2>/dev/null || true

while [ "$#" -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$PROMPT_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "Usage: scripts/ai/patch_cycle.sh prompts/<prompt>.md [--scope <scope>]"
  echo "  Example: scripts/ai/patch_cycle.sh prompts/phase1_fix.md --scope frontend"
  exit 2
fi

RUN_DIR=".ai_runs/latest"
mkdir -p "$RUN_DIR"

CONFIG_FILE="config/ai_project_profile.json"

read_config_str() {
  local key="$1" default="${2:-}"
  [ -f "$CONFIG_FILE" ] || { echo "$default"; return; }
  python3 -c "
import json
try:
  d=json.load(open('$CONFIG_FILE'))
  v=d.get('$key','$default')
  print(v if isinstance(v,str) else '$default')
except: print('$default')
" 2>/dev/null || echo "$default"
}

PROJECT_NAME="$(read_config_str project_name "$(basename "$(pwd)")")"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

echo "== $PROJECT_NAME PATCH CYCLE =="
echo "Run ID:       $RUN_ID"
echo "Prompt:       $PROMPT_FILE"
echo "Scope:        ${SCOPE:-"(none)"}"
echo "Run dir:      $RUN_DIR"
echo

# ── step 1: copy prompt ───────────────────────────────────────────────────────
cp "$PROMPT_FILE" "$RUN_DIR/prompt_used.md"
echo "== Step 1: Prompt saved =="
echo "  $RUN_DIR/prompt_used.md"
echo

# ── step 2: capture state ─────────────────────────────────────────────────────
echo "== Step 2: Capturing state =="
git diff > "$RUN_DIR/diff_before.patch"
git status --short | tee "$RUN_DIR/status_before.txt"
echo

# ── step 3: pre-check ─────────────────────────────────────────────────────────
echo "== Step 3: Pre-check =="
PRE_CHECK_OUTPUT="$RUN_DIR/pre_check.txt"
if [ -n "$SCOPE" ] && [ -f "scripts/ai/targeted_dry_run.sh" ]; then
  echo "Running targeted_dry_run.sh $SCOPE"
  bash scripts/ai/targeted_dry_run.sh "$SCOPE" 2>&1 | tee "$PRE_CHECK_OUTPUT" || true
elif [ -f "scripts/ai/full_system_dry_run.sh" ]; then
  echo "Running full_system_dry_run.sh"
  bash scripts/ai/full_system_dry_run.sh 2>&1 | tee "$PRE_CHECK_OUTPUT" || true
else
  echo "(no pre-check script found)" | tee "$PRE_CHECK_OUTPUT"
fi
echo

# ── step 4: build claude prompt ───────────────────────────────────────────────
echo "== Step 4: Building Claude prompt =="
cat > "$RUN_DIR/claude_manual_prompt.txt" << EOF
You are a safety reviewer for the $PROJECT_NAME project.

Task (from prompt file: $PROMPT_FILE):
$(cat "$PROMPT_FILE")

Output exactly one verdict line FIRST:
VERDICT: APPROVE
or
VERDICT: REQUEST_CHANGES
or
VERDICT: BLOCK

Then explain your findings.

===== AGENTS.md (excerpt) =====
$(head -80 AGENTS.md 2>/dev/null || echo "(not found)")

===== CLAUDE.md (excerpt) =====
$(head -60 CLAUDE.md 2>/dev/null || echo "(not found)")

===== GIT STATUS =====
$(cat "$RUN_DIR/status_before.txt" 2>/dev/null || echo "(not found)")

===== PRE-CHECK OUTPUT =====
$(cat "$PRE_CHECK_OUTPUT" 2>/dev/null || echo "(not found)")

===== CURRENT DIFF =====
$(cat "$RUN_DIR/diff_before.patch" 2>/dev/null || echo "(empty — no tracked changes)")
EOF
echo "  $RUN_DIR/claude_manual_prompt.txt"
echo

# ── step 5: report ────────────────────────────────────────────────────────────
cat > "$RUN_DIR/patch_cycle_report.md" << EOF
# Patch Cycle Report — $PROJECT_NAME
Run ID: $RUN_ID
Prompt: $PROMPT_FILE
Scope:  ${SCOPE:-"(none)"}

## Pre-Check Result
$(tail -3 "$PRE_CHECK_OUTPUT" 2>/dev/null || echo "(no pre-check)")

## Files
- Prompt:       $RUN_DIR/prompt_used.md
- State:        $RUN_DIR/status_before.txt
- Diff (before): $RUN_DIR/diff_before.patch
- Claude prompt: $RUN_DIR/claude_manual_prompt.txt
- Pre-check:    $PRE_CHECK_OUTPUT

## Next Steps
1. Use ai_dev_loop.sh for automated review:
   scripts/ai/ai_dev_loop.sh --audit-only $PROMPT_FILE
2. Or paste the prompt manually:
   $RUN_DIR/claude_manual_prompt.txt
3. After fixes, validate:
   scripts/ai/full_system_dry_run.sh
EOF

echo "== Patch Cycle Ready =="
echo "  Prompt:         $RUN_DIR/claude_manual_prompt.txt"
echo "  Report:         $RUN_DIR/patch_cycle_report.md"
echo
echo "Next:"
echo "  scripts/ai/ai_dev_loop.sh --audit-only $PROMPT_FILE"
