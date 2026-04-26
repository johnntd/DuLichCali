#!/usr/bin/env bash
set -euo pipefail

# patch_cycle.sh — DuLichCali controlled patch workflow
# Mirrors ai_trading_system codex_then_claude_audit.sh + precommit_ai_gate.sh pattern
#
# Usage:
#   scripts/ai/patch_cycle.sh prompts/phase1_hair_salon_fix.md
#   scripts/ai/patch_cycle.sh prompts/<any_prompt>.md [--scope <targeted-scope>]
#
# Workflow:
#   1. Copy prompt into .ai_runs/latest/prompt_used.md
#   2. Run pre-check (targeted dry run if scope given, else full)
#   3. Build claude_manual_prompt.txt with embedded context
#   4. Claude applies only scoped changes from the prompt
#   5. Run targeted dry run after changes
#   6. Run full_system_dry_run.sh
#   7. Generate patch_cycle_report.md
#   Require FINAL: PASS before marking complete.

PROMPT_FILE="${1:-}"
SCOPE=""

for arg in "${@:2}"; do
  case "$arg" in
    --scope) ;;
    hair-salon|booking|travel|marketplace|ai-receptionist) SCOPE="$arg" ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

if [ -z "$PROMPT_FILE" ]; then
  echo "Usage: scripts/ai/patch_cycle.sh prompts/<prompt>.md [--scope <scope>]"
  exit 2
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Prompt file not found: $PROMPT_FILE"
  exit 2
fi

RUN_DIR=".ai_runs/latest"
mkdir -p "$RUN_DIR"

echo "== DULICHCALI PATCH CYCLE =="
echo "Prompt:   $PROMPT_FILE"
echo "Scope:    ${SCOPE:-full}"
echo "Run dir:  $RUN_DIR"
echo

# ── step 1: copy prompt ───────────────────────────────────────────────────────
cp "$PROMPT_FILE" "$RUN_DIR/prompt_used.md"
echo "== Step 1: Prompt saved =="
echo "  $RUN_DIR/prompt_used.md"
echo

# ── step 2: capture pre-patch state ──────────────────────────────────────────
echo "== Step 2: Pre-patch state =="
git diff > "$RUN_DIR/diff_before.patch"
git status --short | tee "$RUN_DIR/status_before.txt"
echo

# ── step 3: run pre-check dry run ────────────────────────────────────────────
echo "== Step 3: Pre-check dry run =="
if [ -n "$SCOPE" ]; then
  echo "  Running targeted dry run: $SCOPE"
  bash scripts/ai/targeted_dry_run.sh "$SCOPE" | tee "$RUN_DIR/precheck_targeted.txt" || true
else
  echo "  Running full system dry run"
  bash scripts/ai/full_system_dry_run.sh | tee "$RUN_DIR/precheck_full.txt" || true
fi
echo

# ── step 4: build claude manual prompt ───────────────────────────────────────
echo "== Step 4: Building Claude prompt =="
cat > "$RUN_DIR/claude_manual_prompt.txt" << EOF
You are applying a scoped patch to the DuLichCali project.

Read the prompt below carefully. Apply ONLY the changes it describes.
Do not touch unrelated files. Do not rewrite unrelated flows.
Do not break Luxurious Nails (the reference standard for salon/vendor pages).

After applying changes:
1. Run: scripts/ai/targeted_dry_run.sh ${SCOPE:-hair-salon}
2. Run: scripts/ai/full_system_dry_run.sh
3. Both must end with FINAL: PASS before this patch is complete.

===== PATCH PROMPT =====
$(cat "$RUN_DIR/prompt_used.md")

===== CLAUDE.md KEY RULES =====
$(grep -A3 "RULE #1\|RULE #2\|JS VERSION\|PRODUCTION DOMAIN" CLAUDE.md 2>/dev/null | head -60 || echo "(CLAUDE.md not found)")

===== CURRENT GIT STATUS =====
$(cat "$RUN_DIR/status_before.txt")

===== CURRENT DIFF (uncommitted changes) =====
$(cat "$RUN_DIR/diff_before.patch" 2>/dev/null || echo "(no uncommitted changes)")

===== PRE-CHECK RESULT =====
$(cat "$RUN_DIR/precheck_targeted.txt" 2>/dev/null || cat "$RUN_DIR/precheck_full.txt" 2>/dev/null || echo "(no precheck output)")
EOF
echo "  $RUN_DIR/claude_manual_prompt.txt"
echo

# ── step 5: tell user how to proceed ─────────────────────────────────────────
echo "== Step 5: Apply patch =="
echo "  Claude should now read: $RUN_DIR/claude_manual_prompt.txt"
echo "  and apply ONLY the changes described in: $PROMPT_FILE"
echo
echo "  After Claude applies changes, run:"
if [ -n "$SCOPE" ]; then
  echo "    scripts/ai/targeted_dry_run.sh $SCOPE"
fi
echo "    scripts/ai/full_system_dry_run.sh"
echo

# ── step 6: generate patch_cycle_report.md ───────────────────────────────────
cat > "$RUN_DIR/patch_cycle_report.md" << REPORT
# Patch Cycle Report — DuLichCali

Date:         $(date '+%Y-%m-%d %H:%M:%S')
Prompt:       $PROMPT_FILE
Scope:        ${SCOPE:-full}
Run dir:      $RUN_DIR

## Status

- Pre-check: see \`$RUN_DIR/precheck_targeted.txt\` or \`precheck_full.txt\`
- Patch applied: [fill in after Claude applies changes]
- Post-check: [fill in after running targeted_dry_run + full_system_dry_run]
- Final verdict: PENDING

## Files in This Run

| File | Purpose |
|------|---------|
| \`prompt_used.md\` | Exact prompt that drove this patch |
| \`status_before.txt\` | Git status before any changes |
| \`diff_before.patch\` | Git diff before any changes |
| \`precheck_targeted.txt\` | Targeted dry run before patch |
| \`claude_manual_prompt.txt\` | Combined context + prompt for Claude |

## Required Before Marking Complete

- [ ] scripts/ai/targeted_dry_run.sh ${SCOPE:-hair-salon} → FINAL: PASS
- [ ] scripts/ai/full_system_dry_run.sh → FINAL: PASS
- [ ] Manual QA: Luxurious Nails still works
- [ ] Manual QA: Beauty Hair OC shows vendor-specific data
- [ ] No console errors
- [ ] No exposed secrets

## Final Verdict

[Fill in: READY_FOR_USER_REVIEW / NEEDS_MORE_FIXES / BLOCKED_NEEDS_HUMAN_DECISION]
REPORT
echo "  $RUN_DIR/patch_cycle_report.md"
echo

echo "PATCH CYCLE READY — waiting for Claude to apply changes."
echo "After changes are applied, run:"
echo "  scripts/ai/full_system_dry_run.sh"
