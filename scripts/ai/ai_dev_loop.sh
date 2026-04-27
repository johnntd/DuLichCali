#!/usr/bin/env bash
set -euo pipefail

# ai_dev_loop.sh — AI Project Template
# Generic Codex → test gate → Claude review driver.
# Reads config/ai_project_profile.json when present; auto-detects otherwise.
#
# Canonical usage:
#   scripts/ai/ai_dev_loop.sh prompts/<task_prompt>.md
#
# Flags:
#   --audit-only      Skip Codex; audit current working tree
#   --manual-claude   Build prompt only; skip Claude API call
#   --check-claude    Only verify Claude API readiness
#   --auto-commit     Commit after APPROVE verdict (requires --commit-message)
#   --max-loops N     Repair loop count (default 1)
#   --commit-message  Required with --auto-commit
#
# Ends with FINAL: PASS or FINAL: FAIL.
# Never pushes to remote. Never deploys to production.

RUN_DIR=".ai_runs/latest"
TASK_FILE=""
AUDIT_ONLY=0
MANUAL_CLAUDE=0
CHECK_CLAUDE=0
AUTO_COMMIT=0
MAX_LOOPS=1
COMMIT_MESSAGE=""
ALLOW_DIRTY=0
SELF_TEST=0
IMPLEMENTER_TIMEOUT="${IMPLEMENTER_TIMEOUT:-900}"

CONFIG_FILE="config/ai_project_profile.json"

usage() {
  cat <<'EOF'
Usage:
  scripts/ai/ai_dev_loop.sh [--audit-only] [--manual-claude] [--check-claude]
                             [--auto-commit|--commit] [--allow-dirty]
                             [--max-loops N] [--commit-message "..."] prompts/task.md

Modes:
  default          Run Codex non-interactively (when supported), then test/audit.
  --audit-only     Skip Codex; audit the current working tree.
  --manual-claude  Build prompt for manual paste; skip Claude API.
  --check-claude   Verify Claude API readiness only.
  --self-test      Run automation self-test (no Codex, no API calls).

Safety:
  --auto-commit / --commit  Commit after APPROVE verdict (requires --commit-message).
  --allow-dirty             Allow running with uncommitted changes (default: FAIL if dirty).
  --timeout N               Implementer timeout in seconds (default: 900; env: IMPLEMENTER_TIMEOUT).
  --max-loops defaults to 1.
  Default: no commit, no push, no deploy.
  Deployment is always manual — run firebase deploy only after user approval.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --audit-only)      AUDIT_ONLY=1; shift ;;
    --manual-claude)   MANUAL_CLAUDE=1; AUDIT_ONLY=1; shift ;;
    --check-claude)    CHECK_CLAUDE=1; shift ;;
    --auto-commit)     AUTO_COMMIT=1; shift ;;
    --commit)          AUTO_COMMIT=1; shift ;;
    --allow-dirty)     ALLOW_DIRTY=1; shift ;;
    --self-test)       SELF_TEST=1; shift ;;
    --timeout)         IMPLEMENTER_TIMEOUT="${2:-900}"; shift 2 ;;
    --max-loops)       MAX_LOOPS="${2:-}"; shift 2 ;;
    --loops)           MAX_LOOPS="${2:-}"; shift 2 ;;
    --commit-message)  COMMIT_MESSAGE="${2:-}"; shift 2 ;;
    -h|--help)         usage; exit 0 ;;
    --*)               echo "Unknown flag: $1"; usage; echo "FINAL: FAIL"; exit 2 ;;
    *)                 TASK_FILE="$1"; shift ;;
  esac
done

if ! [[ "$MAX_LOOPS" =~ ^[0-9]+$ ]] || [ "$MAX_LOOPS" -lt 1 ]; then
  echo "--max-loops must be a positive integer"; echo "FINAL: FAIL"; exit 2
fi
if [ "$AUTO_COMMIT" -eq 1 ] && [ -z "$COMMIT_MESSAGE" ]; then
  echo "--auto-commit requires --commit-message"; echo "FINAL: FAIL"; exit 2
fi
if [ "$CHECK_CLAUDE" -eq 0 ] && [ "$AUDIT_ONLY" -eq 0 ] && [ -z "$TASK_FILE" ]; then
  usage; echo "FINAL: FAIL"; exit 2
fi
if [ -n "$TASK_FILE" ] && [ ! -f "$TASK_FILE" ]; then
  echo "Task prompt not found: $TASK_FILE"; echo "FINAL: FAIL"; exit 2
fi

mkdir -p "$RUN_DIR"
BASE_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"

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

# ── scope and report type detection from prompt filename ─────────────────────
detect_scope() {
  local fname="${1:-}"
  # Check config priority_targets first
  if [ -f "$CONFIG_FILE" ]; then
    local targets
    targets="$(read_config_list priority_targets)"
    while IFS= read -r t; do
      [ -z "$t" ] && continue
      local slug
      slug="$(echo "$t" | tr '[:upper:]' '[:lower:]' | tr ' /' '-' | tr -cd '[:alnum:]-')"
      if echo "$fname" | grep -qi "$slug"; then
        echo "$slug"; return 0
      fi
    done <<< "$targets"
  fi
  # Generic scope detection from filename
  case "$fname" in
    *hair*salon*|*hair-salon*)  echo "hair-salon" ;;
    *booking*)                  echo "booking" ;;
    *travel*)                   echo "travel" ;;
    *marketplace*)              echo "marketplace" ;;
    *ai*receptionist*|*ai-receptionist*) echo "ai-receptionist" ;;
    *salon*memory*|*customer*memory*)   echo "salon-memory" ;;
    *auth*)                     echo "auth" ;;
    *api*)                      echo "api" ;;
    *frontend*)                 echo "frontend" ;;
    *backend*)                  echo "backend" ;;
    *)                          echo "" ;;
  esac
}

detect_report_type() {
  local fname="${1:-}"
  case "$fname" in
    *audit*|*review*) echo "audit" ;;
    *fix*|*patch*)    echo "fix" ;;
    *)                echo "audit" ;;
  esac
}

SCOPE="$(detect_scope "$TASK_FILE")"
REPORT_TYPE="$(detect_report_type "$TASK_FILE")"
ALLOWED_FILES_LIST="$RUN_DIR/allowed_files.txt"

# ── test runner detection ─────────────────────────────────────────────────────
detect_test_runner() {
  if [ -f "$CONFIG_FILE" ]; then
    local first_cmd
    first_cmd="$(read_config_list safe_validation_commands | head -1)"
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

# ── artifacts ────────────────────────────────────────────────────────────────
print_artifacts() {
  echo "Artifacts in $RUN_DIR:"
  echo "  diff.patch             git diff snapshot"
  echo "  tests.txt              test runner output"
  echo "  claude_audit.txt       Claude response"
  echo "  claude_error.txt       Claude errors (if any)"
  echo "  claude_manual_prompt.txt   prompt for manual paste"
  if [ "$REPORT_TYPE" = "fix" ]; then
    echo "  fix_report.md          fix report"
  else
    echo "  audit_report.md        audit report"
  fi
  # Print any implementer proof files that exist
  for _proof in "$RUN_DIR"/implementer_iter_*.txt; do
    [ -f "$_proof" ] && echo "  $(basename "$_proof")   implementer run proof"
  done
  if [ -s "$RUN_DIR/loop_summary.txt" ]; then
    echo
    echo "Loop prompt history:"
    cat "$RUN_DIR/loop_summary.txt"
  fi
  if [ -s "$RUN_DIR/scope_report.txt" ]; then
    echo
    cat "$RUN_DIR/scope_report.txt"
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# ── scope enforcement helpers ─────────────────────────────────────────────────

# parse_allowed_files: extract "Allowed files" bullet list from a prompt file.
# Handles all heading formats: "## Allowed files", "### Allowed files", "Allowed files:"
# Handles bullet prefixes: "- " and "* "
# Stops at next # header (bullets stop matching before header lines).
parse_allowed_files() {
  local prompt_file="${1:-}"
  [ -f "$prompt_file" ] || return
  python3 - "$prompt_file" <<'PYEOF'
import sys, re
try:
    with open(sys.argv[1]) as f:
        text = f.read()
    # Match: optional "#...# " prefix, "Allowed files" with optional colon,
    # rest of line, then optional blank lines, then one or more bullet lines.
    m = re.search(
        r'(?:#{1,6}[ \t]+)?Allowed files:?[^\n]*\n(?:[ \t]*\n)*((?:[ \t]*[-*][ \t]+\S[^\n]*\n?)+)',
        text,
        re.IGNORECASE
    )
    if m:
        for line in m.group(1).splitlines():
            line = line.strip().lstrip('-*').strip()
            if line:
                print(line)
except Exception:
    pass
PYEOF
}

# check_scope: compare changed files (vs base commit) against allowed list
# Writes ## Scope Enforcement section to report_file.
# Returns 0 if clean, 1 if violation.
check_scope() {
  local allowed_list="$1"
  local base="$2"
  local report="$3"

  # Collect all changed files: committed since base + working tree diffs + untracked new files
  local changed
  changed="$( {
    git diff --name-only "${base}" HEAD 2>/dev/null || true
    git diff --name-only HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u | grep -v '^$' )"

  {
    echo "## Scope Enforcement"
    echo "Base commit: ${base}"
    echo "Changed files:"
    if [ -n "$changed" ]; then
      echo "$changed" | sed 's/^/  /'
    else
      echo "  (none)"
    fi
  } >> "$report"

  # No allowed list — scope check skipped
  if [ ! -s "$allowed_list" ]; then
    {
      echo "Allowed files: (none specified — scope check skipped)"
      echo "Out-of-scope files: N/A"
      echo "Result: SKIP"
    } >> "$report"
    return 0
  fi

  {
    echo "Allowed files:"
    sed 's/^/  /' "$allowed_list"
  } >> "$report"

  local violations=()
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! grep -qxF "$f" "$allowed_list" 2>/dev/null; then
      violations+=("$f")
    fi
  done <<< "$changed"

  if [ "${#violations[@]}" -gt 0 ]; then
    echo "Out-of-scope files:" >> "$report"
    for f in "${violations[@]}"; do
      echo "    - $f" >> "$report"
    done
    echo "Result: FAIL" >> "$report"
    echo "SCOPE VIOLATION: the following files were changed outside the allowed list:"
    for f in "${violations[@]}"; do
      echo "  - $f"
    done
    return 1
  fi

  echo "Out-of-scope files: none" >> "$report"
  echo "Result: PASS" >> "$report"
  return 0
}

# check_no_deploy: warn if the task prompt mentions deployment
check_no_deploy() {
  local prompt_file="${1:-}"
  [ -f "$prompt_file" ] || return
  if grep -qiE 'firebase deploy|deploy.*production|deploy.*hosting|push.*firebase|npm run deploy' \
      "$prompt_file" 2>/dev/null; then
    echo "NOTE: Deployment is manual. Run firebase deploy only after user approval."
  fi
}

# ── Anthropic direct API ──────────────────────────────────────────────────────
_call_anthropic_api() {
  local prompt_text="$1" output_file="$2" error_file="$3"

  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ANTHROPIC_API_KEY is not set." | tee "$error_file"
    echo "Add to ~/.bash_profile: export ANTHROPIC_API_KEY=\"sk-ant-...\""
    return 1
  fi

  python3 - "$prompt_text" "$ANTHROPIC_API_KEY" "$output_file" "$error_file" <<'PYEOF'
import json, sys, urllib.request, urllib.error

prompt_text = sys.argv[1]
api_key     = sys.argv[2]
output_file = sys.argv[3]
error_file  = sys.argv[4]

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
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    text = data["content"][0]["text"]
    with open(output_file, "w") as f:
        f.write(text)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    with open(error_file, "w") as f:
        f.write(body)
    sys.exit(1)
except Exception as e:
    with open(error_file, "w") as f:
        f.write(str(e))
    sys.exit(1)
PYEOF
}

check_claude_ready() {
  local error_file="$RUN_DIR/claude_error.txt"
  : > "$error_file"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ANTHROPIC_API_KEY is not set." | tee "$error_file"
    return 3
  fi
  if _call_anthropic_api "Say OK" "$RUN_DIR/claude_check.txt" "$error_file"; then
    echo "Claude API ready (model: claude-sonnet-4-6)."
    return 0
  fi
  cat "$error_file"
  grep -Eiq 'authentication_error|invalid_api_key|unauthorized' "$error_file" && return 2
  echo "Claude API readiness check failed. See: $error_file"
  return 1
}

codex_supports_noninteractive() {
  command -v codex >/dev/null 2>&1 && codex exec --help >/dev/null 2>&1
}

run_codex_once() {
  local prompt_file="$1" loop_num="$2"
  if ! codex_supports_noninteractive; then
    echo "Codex non-interactive exec not available."
    echo "Run Codex manually, then rerun with --audit-only."
    return 2
  fi
  echo "== Running Codex loop $loop_num =="
  codex exec "$(cat "$prompt_file")" 2>&1 | tee "$RUN_DIR/codex_loop_${loop_num}.txt"
}

# run_implementer: invoke Codex non-interactively to edit files.
# Wrapped with a configurable timeout (default 900s, override via --timeout or $IMPLEMENTER_TIMEOUT).
# Any nonzero exit — including timeout (124), SIGTERM (143), SIGINT (130) — is a hard failure.
# Writes stdout/stderr to codex_loop_N.txt and a summary to implementer_iter_N.txt.
# Fails immediately if codex is not installed.
run_implementer() {
  local prompt_file="$1"
  local loop_num="$2"
  local proof_file="$RUN_DIR/implementer_iter_${loop_num}.txt"
  local log_file="$RUN_DIR/codex_loop_${loop_num}.txt"
  local impl_cmd="codex exec --dangerously-bypass-approvals-and-sandbox"
  local impl_timeout="$IMPLEMENTER_TIMEOUT"

  if ! command -v codex >/dev/null 2>&1; then
    echo "FINAL: FAIL"
    echo "Reason: implementer command not available. No code changes can be applied."
    exit 1
  fi

  # Detect timeout binary: macOS coreutils installs gtimeout; Linux ships timeout.
  local timeout_bin=""
  if command -v timeout >/dev/null 2>&1; then
    timeout_bin="timeout"
  elif command -v gtimeout >/dev/null 2>&1; then
    timeout_bin="gtimeout"
  fi

  echo "== Running implementer (iteration $loop_num) =="
  echo "  Command: ${timeout_bin:+$timeout_bin ${impl_timeout}s }$impl_cmd - (stdin)"
  echo "  Prompt:  $prompt_file"
  echo "  Timeout: ${impl_timeout}s${timeout_bin:+ via $timeout_bin}"
  [ -z "$timeout_bin" ] && echo "  WARNING: no timeout binary found — running without timeout guard"

  local impl_rc=0
  # Prompt via stdin avoids shell arg-length limits on large prompts.
  # DANGER: --dangerously-bypass-approvals-and-sandbox skips all sandbox and approval prompts.
  # Scope is enforced by check_scope() immediately after this step.
  if [ -n "$timeout_bin" ]; then
    # GNU timeout / gtimeout available — preferred path.
    $timeout_bin "$impl_timeout" $impl_cmd - < "$prompt_file" 2>&1 | tee "$log_file" || impl_rc=$?
  else
    # Bash-native timeout fallback: run implementer in background, watchdog kills it after
    # $impl_timeout seconds. Output is buffered to log_file and streamed after completion.
    $impl_cmd - < "$prompt_file" > "$log_file" 2>&1 &
    local cmd_pid=$!
    ( sleep "$impl_timeout" 2>/dev/null
      if kill -0 "$cmd_pid" 2>/dev/null; then
        printf '\n[ai_dev_loop: TIMEOUT — killing implementer (pid %d) after %ds]\n' \
          "$cmd_pid" "$impl_timeout" >> "$log_file"
        kill -TERM "$cmd_pid" 2>/dev/null
      fi
    ) &
    local wd_pid=$!
    wait "$cmd_pid" || impl_rc=$?
    kill "$wd_pid" 2>/dev/null || true
    wait "$wd_pid" 2>/dev/null || true
    cat "$log_file"
    # Remap SIGTERM (143) and SIGKILL (137) exits to 124 to match GNU timeout behaviour.
    case "$impl_rc" in 137|143) impl_rc=124 ;; esac
  fi

  local impl_changed
  impl_changed="$( {
    git diff --name-only "$BASE_COMMIT" 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u | grep -v '^$' )"

  {
    echo "Command: ${timeout_bin:+$timeout_bin ${impl_timeout}s }$impl_cmd - (prompt via stdin)"
    echo "Prompt file: $prompt_file"
    echo "Timeout: ${impl_timeout}s"
    echo "Exit code: $impl_rc"
    echo "Changed files after implementer step (tracked + untracked):"
    if [ -n "$impl_changed" ]; then
      echo "$impl_changed" | sed 's/^/  /'
    else
      echo "  (none)"
    fi
  } > "$proof_file"

  echo "Implementer proof: $proof_file"

  # Any nonzero exit is a hard stop — do not fall through to tests or Claude review.
  if [ "$impl_rc" -ne 0 ]; then
    case "$impl_rc" in
      124) echo "Reason: implementer timed out after ${impl_timeout}s (exit 124)" ;;
      130) echo "Reason: implementer interrupted — SIGINT (exit 130)" ;;
      143) echo "Reason: implementer terminated — SIGTERM (exit 143)" ;;
      *)   echo "Reason: implementer terminated or failed (exit $impl_rc)" ;;
    esac
    return "$impl_rc"
  fi
  return 0
}

run_gate() {
  local current_task_file="${1:-$TASK_FILE}"
  echo "== Running project test gate =="

  git diff > "$RUN_DIR/diff.patch"
  git status --short | tee "$RUN_DIR/status.txt"

  # ── Unit tests (fatal on failure) ────────────────────────────────────────
  local test_rc=0
  if TEST_CMD="$(detect_test_runner)"; then
    echo "== Running: $TEST_CMD =="
    { eval "$TEST_CMD"; } 2>&1 | tee "$RUN_DIR/tests.txt" || test_rc=$?
    [ "$test_rc" -ne 0 ] && echo "Test command exited $test_rc."
  else
    echo "(no test runner detected — SKIPPED)" | tee "$RUN_DIR/tests.txt"
  fi

  # ── Targeted scope dry run (fatal on failure) ─────────────────────────────
  local targeted_rc=0
  local targeted_output=""
  if [ -n "$SCOPE" ] && [ -f "scripts/ai/targeted_dry_run.sh" ]; then
    echo "== Running targeted_dry_run.sh $SCOPE =="
    bash scripts/ai/targeted_dry_run.sh "$SCOPE" 2>&1 | tee "$RUN_DIR/targeted_tests.txt" || targeted_rc=$?
    targeted_output="$(cat "$RUN_DIR/targeted_tests.txt" 2>/dev/null)"
    [ "$targeted_rc" -ne 0 ] && echo "Targeted dry run exited $targeted_rc."
  fi

  # ── Full system dry run (fix/patch prompts only, fatal on failure) ────────
  local full_rc=0
  local full_output=""
  if [ "$REPORT_TYPE" = "fix" ] && [ -f "scripts/ai/full_system_dry_run.sh" ]; then
    echo "== Running full_system_dry_run.sh (required for fix prompts) =="
    bash scripts/ai/full_system_dry_run.sh 2>&1 | tee "$RUN_DIR/full_system_dry_run.txt" || full_rc=$?
    full_output="$(cat "$RUN_DIR/full_system_dry_run.txt" 2>/dev/null)"
    # Treat FINAL: PASS absence as failure even if exit code 0
    if [ "$full_rc" -eq 0 ] && ! grep -q "FINAL: PASS" "$RUN_DIR/full_system_dry_run.txt" 2>/dev/null; then
      full_rc=1
    fi
    [ "$full_rc" -ne 0 ] && echo "Full system dry run did not pass."
  fi

  # ── Build Claude prompt (always — useful for manual diagnostics) ──────────
  local project_name project_type
  project_name="$(read_config_str project_name "$(basename "$(pwd)")")"
  project_type="$(read_config_str project_type "unknown")"
  local must_not_break
  must_not_break="$(read_config_list must_not_break | head -20)"
  local forbidden
  forbidden="$(read_config_list forbidden_commands | head -10)"

  local task_content=""
  [ -n "$current_task_file" ] && [ -f "$current_task_file" ] && task_content="$(cat "$current_task_file")"

  cat > "$RUN_DIR/claude_manual_prompt.txt" <<EOF
You are auditing the $project_name project as a safety reviewer.

Project type: $project_type

Your task is defined by the prompt file below. Follow it exactly.

Output exactly one verdict line FIRST (before any other content):
VERDICT: APPROVE
or
VERDICT: REQUEST_CHANGES
or
VERDICT: BLOCK

Then provide your full response (audit report, findings, fix plan, etc).

SAFETY — never:
- Deploy to production (${forbidden:-"no deploy commands"})
- Write to production database
- Expose API keys, secrets, or credentials
- Trigger real user notifications
- Push to remote git

Must-not-break flows:
${must_not_break:-"(see project documentation)"}

===== TASK PROMPT =====
${task_content:-"(no task prompt provided — audit current state)"}

===== AGENTS.md (excerpt) =====
$(head -80 AGENTS.md 2>/dev/null || echo "(AGENTS.md not found)")

===== CLAUDE.md (excerpt) =====
$(head -60 CLAUDE.md 2>/dev/null || echo "(CLAUDE.md not found)")

===== GIT STATUS =====
$(cat "$RUN_DIR/status.txt" 2>/dev/null || echo "(not found)")

===== TEST OUTPUT =====
$(cat "$RUN_DIR/tests.txt" 2>/dev/null || echo "(not found)")

===== TARGETED OUTPUT (scope: ${SCOPE:-none}) =====
${targeted_output:-"(no targeted test run)"}

===== FULL SYSTEM DRY RUN =====
${full_output:-"(not run — audit-only or full_system_dry_run.sh not present)"}

===== PATCH DIFF =====
$(cat "$RUN_DIR/diff.patch" 2>/dev/null || echo "(empty — no tracked changes)")
EOF

  echo
  echo "== Gate complete =="
  echo "  Tests:          $RUN_DIR/tests.txt"
  echo "  Claude prompt:  $RUN_DIR/claude_manual_prompt.txt"
  cp "$RUN_DIR/diff.patch" "$RUN_DIR/codex.diff" 2>/dev/null || true

  # ── Fail with specific reason (after prompt is built for diagnostics) ─────
  if [ "$test_rc" -ne 0 ]; then
    echo "Reason: test command failed"
    return 1
  fi
  if [ "$targeted_rc" -ne 0 ]; then
    echo "Reason: targeted dry run failed"
    return 1
  fi
  if [ "$full_rc" -ne 0 ]; then
    echo "Reason: full system dry run failed"
    return 1
  fi
  return 0
}

run_claude_audit() {
  local prompt="$RUN_DIR/claude_manual_prompt.txt"
  local output="$RUN_DIR/claude_audit.txt"
  local error_file="$RUN_DIR/claude_error.txt"
  : > "$output"; : > "$error_file"

  local rc=0
  check_claude_ready || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "Manual prompt ready: $prompt"
    echo "Paste into interactive Claude manually."
    return "$rc"
  fi

  echo "== Running Claude API audit (claude-sonnet-4-6) =="
  if _call_anthropic_api "$(cat "$prompt")" "$output" "$error_file"; then
    cat "$output"
    local report_file
    report_file="$RUN_DIR/$([ "$REPORT_TYPE" = "fix" ] && echo fix_report || echo audit_report).md"
    cp "$output" "$report_file"
    echo; echo "Report saved: $report_file"
  else
    echo "WARNING: Claude API call failed."
    cat "$error_file"
    echo "Manual prompt: $prompt"
    : > "$output"; return 1
  fi
}

parse_verdict() {
  local output="$RUN_DIR/claude_audit.txt"
  local verdict
  verdict="$(grep -E '^VERDICT: (APPROVE|REQUEST_CHANGES|BLOCK)$' "$output" | head -n 1 || true)"
  case "$verdict" in
    "VERDICT: APPROVE")         echo "APPROVE" ;;
    "VERDICT: REQUEST_CHANGES") echo "REQUEST_CHANGES" ;;
    "VERDICT: BLOCK")           echo "BLOCK" ;;
    *)                          echo "UNKNOWN" ;;
  esac
}

write_followup_prompt() {
  local source_task="$1"
  local iter_num="$2"
  local next_iter=$((iter_num + 1))
  local ts; ts="$(date '+%Y-%m-%d %H:%M:%S')"
  local audit_iter_file="$RUN_DIR/claude_audit_iter_${iter_num}.txt"
  local followup="$RUN_DIR/codex_followup_prompt.md"
  local followup_iter="$RUN_DIR/codex_followup_prompt_iter_${iter_num}.md"
  local tmp="${followup}.tmp"
  {
    echo "# Codex Follow-Up Prompt — Iteration ${next_iter}"
    echo "Generated from Claude audit iteration ${iter_num}"
    echo "Source audit: ${audit_iter_file}"
    echo "Generated at: ${ts}"
    echo
    echo "Address Claude review feedback for this task."
    echo
    if [ -n "$source_task" ] && [ -f "$source_task" ] && [ "$source_task" != "$followup" ]; then
      echo "Original task:"; echo '```'; cat "$source_task"; echo '```'; echo
    fi
    echo "Claude review:"; echo '```'; cat "$audit_iter_file"; echo '```'; echo
    # Propagate Allowed files into follow-up so scope enforcement works on next iteration
    if [ -s "$ALLOWED_FILES_LIST" ]; then
      echo "## Allowed files"
      echo
      while IFS= read -r _af; do
        [ -n "$_af" ] && echo "- $_af"
      done < "$ALLOWED_FILES_LIST"
      echo
    fi
    echo "Make the smallest safe changes. Do not push. Do not deploy."
  } > "$tmp"
  mv "$tmp" "$followup"
  cp "$followup" "$followup_iter"
  echo "Follow-up prompt: $followup"
  echo "Follow-up iter copy: $followup_iter"
}

commit_if_requested() {
  [ "$AUTO_COMMIT" -ne 1 ] && { echo "Auto-commit disabled."; return 0; }
  echo "== Auto-commit =="
  git add --ignore-removal -- . ':!.ai_runs'
  git commit -m "$COMMIT_MESSAGE"
  echo "Committed locally. Remote push not performed."
}

# ── main ──────────────────────────────────────────────────────────────────────
echo "== $PROJECT_NAME — AI DEV LOOP =="
echo "Run folder:  $RUN_DIR"
echo "Task file:   ${TASK_FILE:-"(none)"}"
echo "Scope:       ${SCOPE:-"(auto-detect)"}"
echo "Report type: $REPORT_TYPE"
echo "Config:      ${CONFIG_FILE} ($([ -f "$CONFIG_FILE" ] && echo "found" || echo "not found"))"
echo

git status --short | tee "$RUN_DIR/status_before.txt"

# Parse allowed files from original task prompt and save as the canonical original.
# Each loop iteration re-parses from its own current_task; if that prompt has no
# Allowed files block, the original is used as fallback.
parse_allowed_files "${TASK_FILE:-}" > "$ALLOWED_FILES_LIST" 2>/dev/null || true
cp "$ALLOWED_FILES_LIST" "$RUN_DIR/allowed_files_original.txt" 2>/dev/null || true
if [ -s "$ALLOWED_FILES_LIST" ]; then
  echo "Allowed files (from prompt):"
  sed 's/^/  /' "$ALLOWED_FILES_LIST"
  echo
fi

# Warn if prompt mentions deployment (deploy is always manual)
check_no_deploy "${TASK_FILE:-}"

if [ "$SELF_TEST" -eq 1 ]; then
  echo "== Automation Self-Test =="
  _st_fail=0
  # 1. Bash syntax check
  if bash -n "$0" 2>/dev/null; then echo "  PASS  bash -n syntax check"
  else echo "  FAIL  bash -n syntax check"; _st_fail=1; fi
  # 2. Codex available
  if command -v codex >/dev/null 2>&1; then echo "  PASS  codex available: $(codex --version 2>/dev/null || echo unknown)"
  else echo "  FAIL  codex not found — implementer will not run"; _st_fail=1; fi
  # 2b. Timeout binary
  if command -v timeout >/dev/null 2>&1; then echo "  PASS  timeout binary: timeout (default ${IMPLEMENTER_TIMEOUT}s)"
  elif command -v gtimeout >/dev/null 2>&1; then echo "  PASS  timeout binary: gtimeout (default ${IMPLEMENTER_TIMEOUT}s)"
  else echo "  PASS  timeout binary: bash-native watchdog fallback (default ${IMPLEMENTER_TIMEOUT}s)"; fi
  # 3. Test runner detectable
  if _tr="$(detect_test_runner 2>/dev/null)"; then echo "  PASS  test runner: $_tr"
  else echo "  WARN  no test runner detected (SKIPPED in gate)"; fi
  # 4. Targeted dry-run script present
  if [ -f "scripts/ai/targeted_dry_run.sh" ]; then echo "  PASS  targeted_dry_run.sh found"
  else echo "  WARN  targeted_dry_run.sh not found"; fi
  # 5. Full system dry-run script present
  if [ -f "scripts/ai/full_system_dry_run.sh" ]; then echo "  PASS  full_system_dry_run.sh found"
  else echo "  WARN  full_system_dry_run.sh not found (required for fix prompts)"; fi
  # 6. parse_allowed_files on a known prompt
  if [ -n "$TASK_FILE" ]; then
    _af_count="$(parse_allowed_files "$TASK_FILE" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$_af_count" -gt 0 ]; then echo "  PASS  parse_allowed_files: found $_af_count files in $TASK_FILE"
    else echo "  WARN  parse_allowed_files: no Allowed files block in $TASK_FILE"; fi
  fi
  echo
  echo "Manual test scenarios (verify by hand):"
  echo "  no-change guard:       run loop on fix prompt; if Codex makes no changes → FAIL 'implementer made no changes'"
  echo "  out-of-scope file:     create a file not in Allowed files → FAIL 'out-of-scope files changed'"
  echo "  untracked allowed:     create an allowed untracked file → accepted by scope check"
  echo "  untracked forbidden:   create a file not in Allowed files → FAIL 'out-of-scope files changed'"
  echo "  targeted dry-run fail: break a check in targeted_dry_run.sh → FAIL 'targeted dry run failed'"
  echo "  full_system fail:      inject a FINAL: FAIL in full_system → FAIL 'full system dry run failed'"
  if [ "$_st_fail" -eq 0 ]; then echo "FINAL: PASS"; exit 0
  else echo "FINAL: FAIL"; exit 1; fi
fi

if [ "$CHECK_CLAUDE" -eq 1 ]; then
  check_claude_ready && { print_artifacts; echo "FINAL: PASS"; exit 0; }
  rc=$?
  print_artifacts
  [ "$rc" -eq 2 ] && { echo "FINAL: FAIL_AUTH"; exit "$rc"; }
  echo "FINAL: FAIL"; exit "$rc"
fi

current_task="$TASK_FILE"
loop=1
: > "$RUN_DIR/loop_summary.txt"

while [ "$loop" -le "$MAX_LOOPS" ]; do
  echo; echo "== Loop $loop / $MAX_LOOPS =="

  # ── Preflight dirty-tree check ────────────────────────────────────────────
  # A dirty tree makes scope enforcement unreliable (can't isolate Codex changes).
  # Require --allow-dirty to proceed when uncommitted changes exist.
  if ! git diff --quiet HEAD 2>/dev/null; then
    if [ "$ALLOW_DIRTY" -eq 0 ]; then
      echo "ERROR: Working tree has uncommitted changes."
      echo "Commit or stash changes before running, or pass --allow-dirty to override."
      echo "Dirty files:"
      git status --short | head -20
      print_artifacts; echo "FINAL: FAIL"; exit 1
    fi
    echo "WARNING: --allow-dirty passed; working tree has uncommitted changes."
  fi

  echo "== Codex prompt for iteration $loop =="
  echo "$current_task"
  cp "$current_task" "$RUN_DIR/codex_prompt_iter_${loop}.md" 2>/dev/null || true

  # Identity guard: fail if this iteration's prompt is byte-for-byte identical to the previous
  if [ "$loop" -gt 1 ]; then
    prev=$((loop - 1))
    if [ -f "$RUN_DIR/codex_prompt_iter_${prev}.md" ] && [ -f "$RUN_DIR/codex_prompt_iter_${loop}.md" ]; then
      if cmp -s "$RUN_DIR/codex_prompt_iter_${prev}.md" "$RUN_DIR/codex_prompt_iter_${loop}.md"; then
        echo "ERROR: follow-up prompt did not change after failed Claude review"
        print_artifacts; echo "FINAL: FAIL"; exit 1
      fi
    fi
  fi

  # Re-parse Allowed files for this iteration's prompt.
  # write_followup_prompt injects the block so follow-up prompts carry it forward.
  # If the current prompt has no block, fall back to the saved original.
  parse_allowed_files "$current_task" > "$ALLOWED_FILES_LIST" 2>/dev/null || true
  if [ ! -s "$ALLOWED_FILES_LIST" ] && [ -s "$RUN_DIR/allowed_files_original.txt" ]; then
    cp "$RUN_DIR/allowed_files_original.txt" "$ALLOWED_FILES_LIST"
    echo "(Allowed files: using original prompt's list for iteration $loop)"
  fi
  if [ -s "$ALLOWED_FILES_LIST" ]; then
    echo "Allowed files (iteration $loop):"
    sed 's/^/  /' "$ALLOWED_FILES_LIST"
  fi

  prompt_sha="$(sha256_file "$RUN_DIR/codex_prompt_iter_${loop}.md" 2>/dev/null || echo 'n/a')"
  {
    echo "Iteration $loop prompt: $current_task"
    echo "Iteration $loop prompt sha256: $prompt_sha"
  } >> "$RUN_DIR/loop_summary.txt"

  if [ "$AUDIT_ONLY" -eq 0 ]; then
    run_implementer "$current_task" "$loop" || { print_artifacts; echo "FINAL: FAIL"; exit 2; }

    # ── No-change guard ───────────────────────────────────────────────────
    # For fix/patch prompts: the implementer must change or create at least one file.
    # Includes both tracked diffs and untracked new files (e.g. new customer-memory.js).
    if [ "$REPORT_TYPE" = "fix" ]; then
      _changed_after="$( {
        git diff --name-only "$BASE_COMMIT" 2>/dev/null || true
        git ls-files --others --exclude-standard 2>/dev/null || true
      } | sort -u | grep -v '^$' )"
      if [ -z "$_changed_after" ]; then
        echo "FINAL: FAIL"
        echo "Reason: implementer made no changes"
        print_artifacts; exit 1
      fi
    fi
  else
    echo "Audit-only mode: skipping implementer."
  fi

  if ! run_gate "$current_task"; then
    print_artifacts; echo "FINAL: FAIL"; exit 1
  fi

  # ── Scope enforcement ─────────────────────────────────────────────────────
  # For fix/patch prompts with no allowed files list: fail explicitly so the
  # loop does not proceed with unconstrained scope.
  # For prompts with an allowed list: fail if any changed file is out of scope.
  SCOPE_REPORT="$RUN_DIR/scope_report.txt"
  : > "$SCOPE_REPORT"
  if [ "$REPORT_TYPE" = "fix" ] && [ ! -s "$ALLOWED_FILES_LIST" ]; then
    echo "FINAL: FAIL"
    echo "Reason: patch prompt has no allowed files block"
    print_artifacts; exit 1
  fi
  if ! check_scope "$ALLOWED_FILES_LIST" "$BASE_COMMIT" "$SCOPE_REPORT"; then
    echo "FINAL: FAIL"
    echo "Reason: out-of-scope files changed"
    print_artifacts; exit 1
  fi

  if [ "$MANUAL_CLAUDE" -eq 1 ]; then
    echo "Manual Claude mode: prompt ready at $RUN_DIR/claude_manual_prompt.txt"
    print_artifacts; echo "FINAL: MANUAL_REVIEW_REQUIRED"; exit 1
  fi

  claude_rc=0
  run_claude_audit || claude_rc=$?
  if [ "$claude_rc" -eq 3 ]; then
    echo "AI execution: SKIPPED (ANTHROPIC_API_KEY not set)"
    echo "  To enable: export ANTHROPIC_API_KEY=\"sk-ant-...\" >> ~/.bash_profile"
    echo "  Manual prompt: $RUN_DIR/claude_manual_prompt.txt"
    print_artifacts; echo "FINAL: PASS"; exit 0
  fi
  if [ "$claude_rc" -ne 0 ]; then
    print_artifacts
    [ "$claude_rc" -eq 2 ] && { echo "FINAL: FAIL_AUTH"; exit "$claude_rc"; }
    echo "FINAL: FAIL"; exit "$claude_rc"
  fi

  # Archive this iteration's Claude audit before it can be overwritten in the next loop
  cp "$RUN_DIR/claude_audit.txt" "$RUN_DIR/claude_audit_iter_${loop}.txt" 2>/dev/null || true

  verdict="$(parse_verdict)"
  echo "Claude verdict: $verdict"
  echo "Iteration $loop Claude verdict: $verdict" >> "$RUN_DIR/loop_summary.txt"

  case "$verdict" in
    APPROVE)
      commit_if_requested
      print_artifacts
      if [ "$AUTO_COMMIT" -eq 0 ]; then
        echo "Validation passed. Review git diff, then manually stage/commit/deploy."
        echo "  Deployment is manual — run firebase deploy only after user approval."
      fi
      echo "FINAL: PASS"; exit 0
      ;;
    REQUEST_CHANGES)
      write_followup_prompt "$current_task" "$loop"
      followup_sha="$(sha256_file "$RUN_DIR/codex_followup_prompt.md" 2>/dev/null || echo 'n/a')"
      echo "Iteration $loop follow-up sha256: $followup_sha" >> "$RUN_DIR/loop_summary.txt"
      if [ "$loop" -lt "$MAX_LOOPS" ] && [ "$AUDIT_ONLY" -eq 0 ]; then
        echo "Feeding review back to Codex."
        current_task="$RUN_DIR/codex_followup_prompt.md"
        loop=$((loop + 1)); continue
      fi
      print_artifacts; echo "FINAL: FAIL"; exit 1
      ;;
    BLOCK)
      echo "Claude blocked the patch."
      write_followup_prompt "$current_task" "$loop"
      followup_sha="$(sha256_file "$RUN_DIR/codex_followup_prompt.md" 2>/dev/null || echo 'n/a')"
      echo "Iteration $loop follow-up sha256: $followup_sha" >> "$RUN_DIR/loop_summary.txt"
      print_artifacts; echo "FINAL: FAIL"; exit 1
      ;;
    *)
      echo "No machine-readable verdict found."
      echo "Expected: VERDICT: APPROVE | REQUEST_CHANGES | BLOCK"
      print_artifacts; echo "FINAL: FAIL"; exit 1
      ;;
  esac
done

echo "FINAL: FAIL"; exit 1
