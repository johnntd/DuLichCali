#!/usr/bin/env bash
set -euo pipefail

# codex_review_cycle.sh — AI Project Template
# Runs the Codex → Claude audit workflow for a given Codex review file.
#
# Usage:
#   scripts/ai/codex_review_cycle.sh <codex_review_file>
#
# Workflow:
#   1. Copy Codex review into .ai_runs/latest/
#   2. Run baseline tests
#   3. Generate classification template for Claude to fill in
#   4. Build claude_manual_prompt.txt with embedded context
#   Claude then classifies each finding:
#     CONFIRMED_BUG → fix it
#     VALID_IMPROVEMENT → needs user approval
#     FALSE_POSITIVE → document and skip
#     OUT_OF_SCOPE → skip
#     NEEDS_HUMAN_DECISION → flag for user

CODEX_REVIEW="${1:-}"
if [ -z "$CODEX_REVIEW" ] || [ ! -f "$CODEX_REVIEW" ]; then
  echo "Usage: scripts/ai/codex_review_cycle.sh <codex_review_file>"
  echo "  Example: scripts/ai/codex_review_cycle.sh ai_reviews/codex_reviews/2026-04-26_feature-x.md"
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

echo "== $PROJECT_NAME — CODEX REVIEW CYCLE =="
echo "Run ID:  $RUN_ID"
echo "Codex:   $CODEX_REVIEW"
echo "Run dir: $RUN_DIR"
echo

# ── step 1: copy review ───────────────────────────────────────────────────────
cp "$CODEX_REVIEW" "$RUN_DIR/codex_review_used.md"
echo "== Step 1: Codex review saved =="
echo "  $RUN_DIR/codex_review_used.md"
echo

# ── step 2: capture state ─────────────────────────────────────────────────────
echo "== Step 2: Capturing state =="
git diff > "$RUN_DIR/diff.patch"
git status --short | tee "$RUN_DIR/status.txt"
echo

# ── step 3: baseline tests ────────────────────────────────────────────────────
echo "== Step 3: Baseline tests =="
detect_test_runner() {
  if [ -f "$CONFIG_FILE" ]; then
    local first_cmd
    first_cmd="$(python3 -c "
import json
try:
  d=json.load(open('$CONFIG_FILE'))
  cmds=d.get('safe_validation_commands',[])
  print(cmds[0] if cmds else '')
except: print('')
" 2>/dev/null)"
    [ -n "$first_cmd" ] && { echo "$first_cmd"; return 0; }
  fi
  [ -f "tests/runner.js" ] && command -v node >/dev/null 2>&1 && { echo "node tests/runner.js"; return 0; }
  if [ -f "package.json" ] && command -v npm >/dev/null 2>&1; then
    python3 -c "import json; d=json.load(open('package.json')); exit(0 if d.get('scripts',{}).get('test') else 1)" 2>/dev/null && { echo "npm test"; return 0; }
  fi
  for py in ".venv/bin/python" "venv/bin/python"; do
    [ -f "$py" ] && "$py" -m pytest --version >/dev/null 2>&1 && { echo "$py -m pytest"; return 0; }
  done
  command -v pytest >/dev/null 2>&1 && { echo "pytest"; return 0; }
  return 1
}

if TEST_CMD="$(detect_test_runner)"; then
  { eval "$TEST_CMD"; } 2>&1 | tee "$RUN_DIR/tests.txt" || true
else
  echo "(no test runner — SKIPPED)" | tee "$RUN_DIR/tests.txt"
fi
echo

# ── step 4: classification template ──────────────────────────────────────────
echo "== Step 4: Generating classification template =="
cat > "$RUN_DIR/codex_classifications.md" << TEMPLATE
# Codex Finding Classifications — $PROJECT_NAME

Codex review: $CODEX_REVIEW
Date: $(date '+%Y-%m-%d %H:%M:%S')

## Classification Rules

| Code | Meaning | Action |
|------|---------|--------|
| CONFIRMED_BUG | Verified against source — definitely broken | Fix it |
| VALID_IMPROVEMENT | Real improvement, not a bug | Needs user approval |
| FALSE_POSITIVE | Codex was wrong; code is correct | Document and skip |
| OUT_OF_SCOPE | Correct but unrelated to this PR | Skip |
| NEEDS_HUMAN_DECISION | Ambiguous or risky | Flag for user |

## Findings

| ID | Codex Finding | File(s) | Classification | Decision | Notes |
|----|---------------|---------|---------------|---------|-------|
| C-01 | | | | | |
| C-02 | | | | | |
| C-03 | | | | | |

## Confirmed Bugs to Fix
[Fill in after Claude audits each finding]

## False Positives
[Fill in — explain why Codex was wrong]

## Requires Human Decision
[Fill in — explain what decision is needed]
TEMPLATE
echo "  $RUN_DIR/codex_classifications.md"
echo

# ── step 5: build claude prompt ───────────────────────────────────────────────
echo "== Step 5: Building Claude prompt =="
cat > "$RUN_DIR/claude_manual_prompt.txt" << EOF
You are auditing Codex review findings for the $PROJECT_NAME project.

Your job:
1. Read each Codex finding carefully.
2. Verify it against the actual source files.
3. Classify each finding (CONFIRMED_BUG / VALID_IMPROVEMENT / FALSE_POSITIVE / OUT_OF_SCOPE / NEEDS_HUMAN_DECISION).
4. Fix ONLY confirmed bugs.
5. Document all findings not fixed and explain why.
6. After fixes, run: scripts/ai/full_system_dry_run.sh
7. Must end FINAL: PASS before this review is complete.

Do not blindly apply Codex suggestions.
Do not touch unrelated files.

Output exactly one verdict line first:
VERDICT: APPROVE
or
VERDICT: REQUEST_CHANGES
or
VERDICT: BLOCK

Then explain.

===== CODEX REVIEW =====
$(cat "$RUN_DIR/codex_review_used.md")

===== AGENTS.md (excerpt) =====
$(head -80 AGENTS.md 2>/dev/null || echo "(not found)")

===== CLAUDE.md (key rules) =====
$(head -60 CLAUDE.md 2>/dev/null || echo "(not found)")

===== GIT STATUS =====
$(cat "$RUN_DIR/status.txt")

===== CURRENT DIFF =====
$(cat "$RUN_DIR/diff.patch" 2>/dev/null || echo "(no uncommitted changes)")

===== BASELINE TESTS =====
$(cat "$RUN_DIR/tests.txt" 2>/dev/null || echo "(no test output)")

===== CLASSIFICATION TEMPLATE =====
$(cat "$RUN_DIR/codex_classifications.md")
EOF
echo "  $RUN_DIR/claude_manual_prompt.txt"
echo

echo "== Codex Review Cycle Ready =="
echo
echo "Next steps:"
echo "  1. Claude reads:     $RUN_DIR/claude_manual_prompt.txt"
echo "  2. Claude fills in:  $RUN_DIR/codex_classifications.md"
echo "  3. Claude fixes only CONFIRMED_BUG items"
echo "  4. Run:              scripts/ai/full_system_dry_run.sh"
echo "  5. Must end FINAL: PASS"
echo
echo "Files:"
echo "  Codex:           $RUN_DIR/codex_review_used.md"
echo "  Classifications: $RUN_DIR/codex_classifications.md"
echo "  Claude prompt:   $RUN_DIR/claude_manual_prompt.txt"
echo "  Baseline tests:  $RUN_DIR/tests.txt"
echo "  Diff:            $RUN_DIR/diff.patch"
