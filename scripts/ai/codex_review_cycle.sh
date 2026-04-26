#!/usr/bin/env bash
set -euo pipefail

# codex_review_cycle.sh — DuLichCali Codex → Claude audit workflow
# Mirrors ai_trading_system codex_then_claude_audit.sh + precommit_ai_gate.sh
#
# Usage:
#   scripts/ai/codex_review_cycle.sh <codex_review_file>
#   scripts/ai/codex_review_cycle.sh ai_reviews/codex_reviews/2026-04-26_feature-x_codex.md
#
# Workflow:
#   1. Copy Codex review into .ai_runs/latest/codex_review_used.md
#   2. Generate classification template for Claude to fill in
#   3. Build claude_manual_prompt.txt with embedded context for Claude audit
#   4. Claude classifies each finding before fixing anything
#   5. After fixes: run full_system_dry_run.sh
#   6. Only CONFIRMED_BUG items get fixed without user approval

CODEX_REVIEW="${1:-}"
if [ -z "$CODEX_REVIEW" ]; then
  echo "Usage: scripts/ai/codex_review_cycle.sh <codex_review_file>"
  echo "  Example: scripts/ai/codex_review_cycle.sh ai_reviews/codex_reviews/2026-04-26_my-branch_codex.md"
  exit 2
fi

if [ ! -f "$CODEX_REVIEW" ]; then
  echo "Codex review file not found: $CODEX_REVIEW"
  exit 2
fi

RUN_DIR=".ai_runs/latest"
mkdir -p "$RUN_DIR"

RUN_ID="$(date +%Y%m%d-%H%M%S)"
echo "== DULICHCALI CODEX REVIEW CYCLE =="
echo "Run ID:  $RUN_ID"
echo "Codex:   $CODEX_REVIEW"
echo "Run dir: $RUN_DIR"
echo

# ── step 1: copy Codex review ─────────────────────────────────────────────────
cp "$CODEX_REVIEW" "$RUN_DIR/codex_review_used.md"
echo "== Step 1: Codex review saved =="
echo "  $RUN_DIR/codex_review_used.md"
echo

# ── step 2: capture current state ────────────────────────────────────────────
echo "== Step 2: Capturing state =="
git diff > "$RUN_DIR/diff.patch"
git status --short | tee "$RUN_DIR/status.txt"
echo

# ── step 3: run baseline tests ───────────────────────────────────────────────
echo "== Step 3: Baseline tests =="
{
  node tests/runner.js
} 2>&1 | tee "$RUN_DIR/tests.txt" || true
echo

# ── step 4: generate classification template ──────────────────────────────────
echo "== Step 4: Generating classification template =="
FINDING_COUNT=$(grep -c "^#\|^\- \|^[0-9]\." "$CODEX_REVIEW" 2>/dev/null || echo "?")
cat > "$RUN_DIR/codex_classifications.md" << TEMPLATE
# Codex Finding Classifications — DuLichCali

Codex review: $CODEX_REVIEW
Date:         $(date '+%Y-%m-%d %H:%M:%S')

## Classification Rules

| Code | Meaning | Action |
|------|---------|--------|
| CONFIRMED_BUG | Verified against source — definitely broken | Fix it |
| VALID_IMPROVEMENT | Real improvement but not a bug | Needs user approval |
| FALSE_POSITIVE | Codex was wrong; code is correct | Document and skip |
| OUT_OF_SCOPE | Correct but unrelated to this PR | Skip |
| NEEDS_HUMAN_DECISION | Ambiguous; too risky to decide alone | Flag for user |

## Findings

| ID | Codex Finding (summary) | File(s) | Classification | Decision | Notes |
|----|------------------------|---------|---------------|---------|-------|
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

# ── step 5: build Claude audit prompt ────────────────────────────────────────
echo "== Step 5: Building Claude audit prompt =="
cat > "$RUN_DIR/claude_manual_prompt.txt" << EOF
You are auditing Codex review findings for the DuLichCali project.

Your job:
1. Read each Codex finding carefully.
2. Verify it against the actual current source files.
3. Classify each finding (CONFIRMED_BUG / VALID_IMPROVEMENT / FALSE_POSITIVE / OUT_OF_SCOPE / NEEDS_HUMAN_DECISION).
4. Fix ONLY confirmed bugs.
5. Document all findings not fixed and explain why.
6. After any fixes, run: scripts/ai/full_system_dry_run.sh
7. Both must end FINAL: PASS before this review cycle is complete.

Do not blindly apply Codex suggestions.
Do not touch unrelated files.
Do not break Luxurious Nails (reference standard for salon/vendor pages).

Output exactly one verdict line first:
VERDICT: APPROVE
or
VERDICT: REQUEST_CHANGES
or
VERDICT: BLOCK

Then explain.

===== CODEX REVIEW =====
$(cat "$RUN_DIR/codex_review_used.md")

===== CLAUDE.md KEY RULES =====
$(grep -A3 "RULE #1\|RULE #2\|JS VERSION\|PRODUCTION DOMAIN\|HOSTING ARCHITECTURE" CLAUDE.md 2>/dev/null | head -80 || echo "(CLAUDE.md not found)")

===== GIT STATUS =====
$(cat "$RUN_DIR/status.txt")

===== CURRENT DIFF =====
$(cat "$RUN_DIR/diff.patch" 2>/dev/null || echo "(no uncommitted changes)")

===== BASELINE TEST OUTPUT =====
$(cat "$RUN_DIR/tests.txt" 2>/dev/null || echo "(no test output)")

===== CLASSIFICATION TEMPLATE =====
$(cat "$RUN_DIR/codex_classifications.md")
EOF
echo "  $RUN_DIR/claude_manual_prompt.txt"
echo

echo "== Codex Review Cycle Ready =="
echo
echo "Next steps:"
echo "  1. Claude reads: $RUN_DIR/claude_manual_prompt.txt"
echo "  2. Claude classifies each finding in: $RUN_DIR/codex_classifications.md"
echo "  3. Claude fixes only CONFIRMED_BUG items"
echo "  4. Run: scripts/ai/full_system_dry_run.sh"
echo "  5. Must end FINAL: PASS"
echo
echo "Files:"
echo "  Codex:           $RUN_DIR/codex_review_used.md"
echo "  Classifications: $RUN_DIR/codex_classifications.md"
echo "  Claude prompt:   $RUN_DIR/claude_manual_prompt.txt"
echo "  Baseline tests:  $RUN_DIR/tests.txt"
echo "  Diff:            $RUN_DIR/diff.patch"
