#!/usr/bin/env bash
# automation/auto_run.sh — DuLichCali prompt-driven automation runner
#
# Modeled on ai_trading_system/scripts/ai/ai_dev_loop.sh
#
# Usage:
#   ./automation/auto_run.sh automation/prompts/hair_salon_system_audit.md
#   ./automation/auto_run.sh automation/prompts/full_app_system_audit.md [--audit-only]
#
# What it does:
#   1. Reads the prompt file (the source of truth for the run)
#   2. Creates a timestamped run folder in automation/reports/auto_runs/
#   3. Collects project context (git, files, packages, env var NAMES only)
#   4. Runs safe checks (tests, lint, build — marks missing ones as SKIPPED)
#   5. Builds a Claude prompt file combining context + your prompt
#   6. Calls Claude API if ANTHROPIC_API_KEY is set; otherwise saves manual prompt
#   7. Writes auto_run_report.md
#   8. Prints run folder path and next step
#
# Claude then reads the report + context and applies approved changes per the prompt.
# This script never modifies source files.

set -uo pipefail

# ── args ────────────────────────────────────────────────────────────────────
PROMPT_FILE="${1:-}"
AUDIT_ONLY=0
CHECK_API=0

for arg in "${@:2}"; do
  case "$arg" in
    --audit-only) AUDIT_ONLY=1 ;;
    --check-api)  CHECK_API=1 ;;
    -h|--help)
      echo "Usage: ./automation/auto_run.sh <prompt_file> [--audit-only] [--check-api]"
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

# ── locate project root ──────────────────────────────────────────────────────
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# ── validate prompt file ─────────────────────────────────────────────────────
if [ "$CHECK_API" -eq 0 ] && [ -z "$PROMPT_FILE" ]; then
  echo "ERROR: No prompt file provided."
  echo "Usage: ./automation/auto_run.sh automation/prompts/<name>.md"
  echo "FINAL: FAIL"
  exit 2
fi

if [ "$CHECK_API" -eq 0 ] && [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  echo "FINAL: FAIL"
  exit 2
fi

# ── timestamped run directory ─────────────────────────────────────────────────
DATE_TS="$(date +%Y-%m-%d_%H%M%S)"
if [ -n "$PROMPT_FILE" ]; then
  PROMPT_SLUG="$(basename "$PROMPT_FILE" .md | tr '[:upper:]' '[:lower:]' | tr ' /.' '_')"
else
  PROMPT_SLUG="api_check"
fi
RUN_DIR="$ROOT/automation/reports/auto_runs/${DATE_TS}_${PROMPT_SLUG}"
mkdir -p "$RUN_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DuLichCali Auto Runner                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "  Prompt:  ${PROMPT_FILE:-<none>}"
echo "  Run dir: $RUN_DIR"
echo "  Date:    $DATE_TS"
echo ""

# ── check Claude API ─────────────────────────────────────────────────────────
_call_claude_api() {
  local prompt_text="$1"
  local output_file="$2"
  local error_file="$3"

  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ANTHROPIC_API_KEY not set — skipping API call." | tee "$error_file"
    return 1
  fi

  python3 - "$prompt_text" "$ANTHROPIC_API_KEY" "$output_file" "$error_file" <<'PYEOF'
import json, sys, urllib.request, urllib.error

prompt_text = sys.argv[1]
api_key     = sys.argv[2]
out_file    = sys.argv[3]
err_file    = sys.argv[4]

payload = json.dumps({
    "model": "claude-sonnet-4-6",
    "max_tokens": 8192,
    "messages": [{"role": "user", "content": prompt_text}],
}).encode()

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=payload,
    headers={
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    text = data["content"][0]["text"]
    with open(out_file, "w") as f:
        f.write(text)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    with open(err_file, "w") as f:
        f.write(body)
    sys.exit(1)
except Exception as e:
    with open(err_file, "w") as f:
        f.write(str(e))
    sys.exit(1)
PYEOF
}

check_claude_ready() {
  local err="$RUN_DIR/claude_error.txt"
  : > "$err"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "  ANTHROPIC_API_KEY not set."
    echo "  Add to shell: export ANTHROPIC_API_KEY=\"sk-ant-...\""
    echo "  Then: source ~/.bash_profile (or ~/.zshrc)"
    return 1
  fi
  if _call_claude_api "Say OK" "$RUN_DIR/claude_check.txt" "$err"; then
    echo "  Claude API ready (model: claude-sonnet-4-6)"
    return 0
  fi
  echo "  Claude API check failed:"
  cat "$err"
  return 1
}

if [ "$CHECK_API" -eq 1 ]; then
  echo "== Checking Claude API readiness =="
  if check_claude_ready; then
    echo "FINAL: PASS"
    exit 0
  else
    echo "FINAL: FAIL"
    exit 1
  fi
fi

# ── copy prompt into run dir ──────────────────────────────────────────────────
cp "$PROMPT_FILE" "$RUN_DIR/prompt_used.md"
echo "== Prompt saved =="
echo "  $RUN_DIR/prompt_used.md"
echo ""

# ── git context ──────────────────────────────────────────────────────────────
echo "== Collecting git context =="
{
  echo "=== Git Branch ==="
  git branch --show-current 2>/dev/null || echo "(detached HEAD)"
  echo ""
  echo "=== Git Status ==="
  git status --short
  echo ""
  echo "=== Latest 5 Commits ==="
  git log --oneline -5
  echo ""
  echo "=== Files Changed vs main ==="
  git diff --name-only main...HEAD 2>/dev/null | head -40 || echo "(no diff vs main)"
} | tee "$RUN_DIR/git_status.txt"
echo ""

# ── file inventory ────────────────────────────────────────────────────────────
echo "== Collecting file inventory =="
{
  echo "=== Core App Files ==="
  for f in index.html style.css desktop.css script.js destinations.js \
            ai-engine.js aiOrchestrator.js chat.js notifications.js \
            travel.html travel-packages.js \
            firebase.json firestore.rules firestore.indexes.json; do
    if [ -f "$f" ]; then
      wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
    fi
  done

  echo ""
  echo "=== Hairsalon ==="
  for f in hairsalon/index.html hairsalon/receptionist.js; do
    [ -f "$f" ] && wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
  done

  echo ""
  echo "=== Nailsalon (reference standard) ==="
  for f in nailsalon/index.html nailsalon/receptionist.js nailsalon/voice-mode.js nailsalon/salon.css; do
    [ -f "$f" ] && wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
  done

  echo ""
  echo "=== Marketplace ==="
  for f in marketplace/marketplace.js marketplace/marketplace.css marketplace/services-data.js marketplace/vendor-data-service.js; do
    [ -f "$f" ] && wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
  done

  echo ""
  echo "=== Admin / Vendor / Driver ==="
  for f in admin.html vendor-admin.html vendor-login.html driver-admin.html driver-login.html salon-admin.html; do
    [ -f "$f" ] && wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
  done

  echo ""
  echo "=== Functions ==="
  for f in functions/index.js functions/travelDispatch.js; do
    [ -f "$f" ] && wc -l "$f" | awk '{printf "  %-45s %s lines\n", $2, $1}'
  done

  echo ""
  echo "=== Tests ==="
  ls -1 tests/cases/ 2>/dev/null | wc -l | awk '{print "  tests/cases/ — " $1 " case files"}'
  [ -f "tests/runner.js" ] && wc -l tests/runner.js | awk '{printf "  %-45s %s lines\n", $2, $1}'

  echo ""
  echo "=== Scripts / Automation ==="
  [ -f "scripts/ai_review_flow.sh" ] && echo "  scripts/ai_review_flow.sh"
  [ -f "automation/auto_run.sh" ]    && echo "  automation/auto_run.sh"
  ls automation/prompts/ 2>/dev/null | awk '{print "  automation/prompts/" $0}'

} | tee "$RUN_DIR/file_inventory.txt"
echo ""

# ── package scripts ───────────────────────────────────────────────────────────
echo "== Package scripts =="
{
  echo "=== package.json (root) ==="
  node -e "const p=require('./package.json'); Object.entries(p.scripts||{}).forEach(([k,v])=>console.log('  '+k+': '+v))" 2>/dev/null \
    || echo "  (no scripts or node unavailable)"
  echo ""
  echo "=== functions/package.json ==="
  node -e "const p=require('./functions/package.json'); Object.entries(p.scripts||{}).forEach(([k,v])=>console.log('  '+k+': '+v))" 2>/dev/null \
    || echo "  (no scripts or node unavailable)"
} | tee -a "$RUN_DIR/context.txt"
echo ""

# ── environment variable names (NO VALUES) ────────────────────────────────────
{
  echo ""
  echo "=== Environment Variable Names Used (values NOT shown) ==="
  echo "  Server-side (Firebase Secret Manager):"
  grep -h "defineSecret(" functions/index.js 2>/dev/null \
    | grep -oE "defineSecret\('[^']+'\)" | sed "s/defineSecret('/  - /; s/')//"
  echo "  Client-side (browser localStorage keys):"
  grep -h "dlc_claude_key\|dlc_openai_key\|dlc_gemini_key" \
    aiOrchestrator.js ai-engine.js 2>/dev/null \
    | grep -oE "dlc_[a-z_]+" | sort -u | awk '{print "  - " $0}'
  echo "  CLI tools:"
  echo "  - ANTHROPIC_API_KEY (process.env)"
} | tee -a "$RUN_DIR/context.txt"
echo ""

# ── key file excerpts for audit context ───────────────────────────────────────
echo "== Extracting key file excerpts =="
{
  echo ""
  echo "=== hairsalon/index.html (first 100 lines) ==="
  head -100 hairsalon/index.html 2>/dev/null || echo "(not found)"

  echo ""
  echo "=== marketplace/services-data.js — hair/beauty vendor block ==="
  awk '/id:.*beauty-hair-oc/,/^  \}/' marketplace/services-data.js 2>/dev/null | head -100 \
    || echo "(not found)"

  echo ""
  echo "=== marketplace/services-data.js — nail reference vendor block (first 80 lines) ==="
  awk '/id:.*luxurious-nails/,/^  \}/' marketplace/services-data.js 2>/dev/null | head -80 \
    || echo "(not found)"

  echo ""
  echo "=== nailsalon/index.html (first 80 lines) — reference standard ==="
  head -80 nailsalon/index.html 2>/dev/null || echo "(not found)"

  echo ""
  echo "=== firestore.rules (full) ==="
  cat firestore.rules 2>/dev/null | head -80 || echo "(not found)"

  echo ""
  echo "=== firebase.json (full) ==="
  cat firebase.json 2>/dev/null || echo "(not found)"

} > "$RUN_DIR/file_excerpts.txt" 2>&1
echo "  Saved: $RUN_DIR/file_excerpts.txt"
echo ""

# ── run safe checks ───────────────────────────────────────────────────────────
echo "== Running safe checks =="
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_SKIPPED=0
CHECK_RESULTS=""

run_check() {
  local label="$1"
  local cmd="$2"
  echo -n "  $label ... "
  if eval "$cmd" >> "$RUN_DIR/checks.log" 2>&1; then
    echo "PASS"
    CHECK_RESULTS="${CHECK_RESULTS}  PASS    | $label | $cmd\n"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo "FAIL"
    CHECK_RESULTS="${CHECK_RESULTS}  FAIL    | $label | $cmd\n"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  fi
}

skip_check() {
  local label="$1"
  local reason="$2"
  echo "  SKIPPED | $label — $reason"
  CHECK_RESULTS="${CHECK_RESULTS}  SKIPPED | $label — $reason\n"
  CHECKS_SKIPPED=$((CHECKS_SKIPPED + 1))
}

echo "" >> "$RUN_DIR/checks.log"
echo "=== Checks run at $DATE_TS ===" >> "$RUN_DIR/checks.log"

run_check "npm run test:receptionist" "npm run test:receptionist"

if node -e "const p=require('./package.json'); if(!p.scripts||!p.scripts.lint) process.exit(1);" 2>/dev/null; then
  run_check "npm run lint" "npm run lint"
else
  skip_check "lint" "no lint script in package.json"
fi

if node -e "const p=require('./package.json'); if(!p.scripts||!p.scripts.build) process.exit(1);" 2>/dev/null; then
  run_check "npm run build" "npm run build"
else
  skip_check "build" "no build step (static HTML project)"
fi

if node -e "const p=require('./package.json'); if(!p.scripts||!p.scripts.typecheck) process.exit(1);" 2>/dev/null; then
  run_check "npm run typecheck" "npm run typecheck"
else
  skip_check "typecheck" "no typecheck script"
fi

echo ""
echo "  Passed:  $CHECKS_PASSED | Failed: $CHECKS_FAILED | Skipped: $CHECKS_SKIPPED"
echo "  Log:     $RUN_DIR/checks.log"
echo ""

# ── build Claude prompt ───────────────────────────────────────────────────────
echo "== Building Claude prompt =="
cat > "$RUN_DIR/claude_prompt.txt" <<PROMPT_HEADER
You are auditing the DuLichCali project (dulichcali21.com).

This is an automated run created by automation/auto_run.sh.
Run ID: ${DATE_TS}_${PROMPT_SLUG}
Run dir: $RUN_DIR

Read the following context carefully before executing the prompt below.

===== PROMPT (source of truth for this run) =====
$(cat "$RUN_DIR/prompt_used.md")

===== GIT STATUS =====
$(cat "$RUN_DIR/git_status.txt")

===== FILE INVENTORY =====
$(cat "$RUN_DIR/file_inventory.txt")

===== PACKAGE SCRIPTS + ENV VAR NAMES =====
$(cat "$RUN_DIR/context.txt")

===== CHECK RESULTS =====
$(printf '%b' "$CHECK_RESULTS")
Full check log: $RUN_DIR/checks.log

===== KEY FILE EXCERPTS =====
$(cat "$RUN_DIR/file_excerpts.txt")

===== CLAUDE.md RULES SUMMARY =====
Mobile is primary. No hardcoded strings in any language. Bump ?v= on every JS change.
Firebase Hosting is production (www.dulichcali21.com). No build step — static HTML/JS.
Vendor pages must show vendor-specific data (not directory data).
Luxurious Nails is the visual/behavioral reference for salon/vendor pages.
All customer-facing strings must exist in vi + en + es.
PROMPT_HEADER

echo "  Saved: $RUN_DIR/claude_prompt.txt"
echo ""

# ── call Claude API if key available ─────────────────────────────────────────
API_RESULT="SKIPPED"
if [ -n "${ANTHROPIC_API_KEY:-}" ] && [ "$AUDIT_ONLY" -eq 0 ]; then
  echo "== Calling Claude API =="
  ERR_FILE="$RUN_DIR/claude_error.txt"
  OUT_FILE="$RUN_DIR/claude_output.txt"
  : > "$ERR_FILE"
  if _call_claude_api "$(cat "$RUN_DIR/claude_prompt.txt")" "$OUT_FILE" "$ERR_FILE"; then
    echo "  Claude response saved: $OUT_FILE"
    API_RESULT="PASS"
  else
    echo "  Claude API call failed. See: $ERR_FILE"
    API_RESULT="FAIL"
  fi
else
  echo "== Claude API call skipped =="
  echo "  (set ANTHROPIC_API_KEY to enable, or pass --audit-only to skip)"
  echo "  Manual prompt ready: $RUN_DIR/claude_prompt.txt"
fi
echo ""

# ── generate auto_run_report.md ──────────────────────────────────────────────
echo "== Writing auto_run_report.md =="
OVERALL_STATUS="PASS"
[ "$CHECKS_FAILED" -gt 0 ] && OVERALL_STATUS="FAIL"
[ "$API_RESULT" = "FAIL" ] && OVERALL_STATUS="FAIL"

cat > "$RUN_DIR/auto_run_report.md" <<REPORT
# Auto Run Report — DuLichCali

Run ID:     ${DATE_TS}_${PROMPT_SLUG}
Date:       $DATE_TS
Prompt:     $PROMPT_FILE
Run dir:    $RUN_DIR
Status:     $OVERALL_STATUS

---

## Prompt Used

See: \`$RUN_DIR/prompt_used.md\`

---

## Check Results

| Result | Check | Command |
|--------|-------|---------|
$(printf '%b' "$CHECK_RESULTS" | sed 's/^  //' | awk -F'|' '{printf "| %s | %s | %s |\n", $1, $2, $3}')

Full log: \`$RUN_DIR/checks.log\`

---

## Claude API

Status: $API_RESULT

$([ "$API_RESULT" = "PASS" ] && echo "Output: \`$RUN_DIR/claude_output.txt\`" || echo "Manual prompt: \`$RUN_DIR/claude_prompt.txt\`")

---

## Files in This Run

| File | Purpose |
|------|---------|
| \`prompt_used.md\` | The exact prompt that drove this run |
| \`git_status.txt\` | Branch, status, recent commits |
| \`file_inventory.txt\` | Key file sizes and paths |
| \`context.txt\` | Package scripts + env var names |
| \`file_excerpts.txt\` | Hair salon, nail salon, Firestore excerpts |
| \`checks.log\` | Raw check output |
| \`claude_prompt.txt\` | Combined context + prompt sent to Claude |
$([ -f "$RUN_DIR/claude_output.txt" ] && echo "| \`claude_output.txt\` | Claude API response |")
$([ -f "$RUN_DIR/claude_error.txt" ] && echo "| \`claude_error.txt\` | API errors if any |")

---

## Next Steps

$(if [ "$API_RESULT" = "PASS" ]; then
  echo "1. Read Claude's output: \`$RUN_DIR/claude_output.txt\`"
  echo "2. Review findings in the audit."
  echo "3. Classify confirmed bugs vs false positives."
  echo "4. If ready to fix: run \`./automation/auto_run.sh automation/prompts/phase1_hair_salon_fix.md\`"
else
  echo "1. Read the manual prompt: \`$RUN_DIR/claude_prompt.txt\`"
  echo "2. Paste it into Claude Code chat to run the audit interactively."
  echo "3. Claude will perform the audit described in the prompt."
  echo "4. Save Claude's response to: \`$RUN_DIR/claude_output.txt\`"
fi)
$([ "$CHECKS_FAILED" -gt 0 ] && echo "⚠  $CHECKS_FAILED check(s) failed — review checks.log before proceeding.")

---

## Integration with ai_reviews/

If this was triggered from a PR review:
- Copy findings to: \`ai_reviews/codex_reviews/YYYY-MM-DD_<branch>_codex.md\`
- Classify with template: \`ai_reviews/templates/claude_audit_template.md\`
- Write fix report to: \`ai_reviews/fix_reports/YYYY-MM-DD_<branch>_fix_report.md\`

REPORT

echo "  Saved: $RUN_DIR/auto_run_report.md"
echo ""

# ── final output ──────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Run complete                                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Run folder:   $RUN_DIR"
echo "  Report:       $RUN_DIR/auto_run_report.md"
echo "  Checks:       Passed=$CHECKS_PASSED Failed=$CHECKS_FAILED Skipped=$CHECKS_SKIPPED"
echo "  Claude API:   $API_RESULT"
echo ""
if [ "$API_RESULT" = "PASS" ]; then
  echo "  Next: read $RUN_DIR/claude_output.txt"
else
  echo "  Next: paste $RUN_DIR/claude_prompt.txt into Claude Code chat"
fi
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo "FINAL: FAIL ($CHECKS_FAILED checks failed)"
  exit 1
fi
echo "FINAL: PASS"
exit 0
