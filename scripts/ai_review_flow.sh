#!/usr/bin/env bash
# ai_review_flow.sh — DuLichCali Codex → Claude review workflow launcher
#
# Usage: ./scripts/ai_review_flow.sh <branch-or-pr-name>
#
# Creates timestamped review files from templates and captures current git diff.
# Does NOT auto-post to GitHub. Trigger Codex manually with @codex review on the PR.

set -e

BRANCH="${1}"
if [[ -z "${BRANCH}" ]]; then
  echo "Usage: ./scripts/ai_review_flow.sh <branch-or-pr-name>"
  exit 1
fi

DATE="$(date +%Y-%m-%d)"
ROOT="$(git rev-parse --show-toplevel)"
REVIEWS="${ROOT}/ai_reviews"
RUN_DIR="${REVIEWS}/codex_reviews/${DATE}_${BRANCH}"

mkdir -p "${RUN_DIR}"
mkdir -p "${REVIEWS}/claude_audits"
mkdir -p "${REVIEWS}/fix_reports"
mkdir -p "${REVIEWS}/regression_logs"

CODEX_FILE="${REVIEWS}/codex_reviews/${DATE}_${BRANCH}_codex.md"
AUDIT_FILE="${REVIEWS}/claude_audits/${DATE}_${BRANCH}_claude_audit.md"
FIX_FILE="${REVIEWS}/fix_reports/${DATE}_${BRANCH}_fix_report.md"
DIFF_FILE="${REVIEWS}/regression_logs/${DATE}_${BRANCH}_diff.patch"
REG_FILE="${REVIEWS}/regression_logs/${DATE}_${BRANCH}_regression.txt"

echo "=== DuLichCali AI Review Flow ==="
echo "Branch / PR: ${BRANCH}"
echo "Date:        ${DATE}"
echo ""

# --- Capture git diff ---
echo "Capturing git diff..."
git diff main...HEAD > "${DIFF_FILE}" 2>/dev/null || git diff > "${DIFF_FILE}"
DIFF_LINES=$(wc -l < "${DIFF_FILE}" | tr -d ' ')
echo "  Diff saved: ${DIFF_FILE} (${DIFF_LINES} lines)"
echo ""

# --- Create codex review file (stub for human to fill in) ---
if [[ ! -f "${CODEX_FILE}" ]]; then
  cat > "${CODEX_FILE}" << STUB
# Codex Review — ${BRANCH}

Date: ${DATE}
Source: GitHub PR comment (paste Codex output below after triggering @codex review)

---

## Codex Output

[Paste Codex review findings here]

---

## Notes

[Add any context about the PR scope or known risk areas]
STUB
  echo "Created: ${CODEX_FILE}"
else
  echo "Exists:  ${CODEX_FILE} (skipped)"
fi

# --- Create Claude audit file from template ---
if [[ ! -f "${AUDIT_FILE}" ]]; then
  sed "s|Branch / PR:|Branch / PR: ${BRANCH}|; s|Date:|Date: ${DATE}|" \
    "${REVIEWS}/templates/claude_audit_template.md" > "${AUDIT_FILE}"
  echo "Created: ${AUDIT_FILE}"
else
  echo "Exists:  ${AUDIT_FILE} (skipped)"
fi

# --- Create fix report file from template ---
if [[ ! -f "${FIX_FILE}" ]]; then
  sed "s|Branch / PR:|Branch / PR: ${BRANCH}|; s|Date:|Date: ${DATE}|; s|YYYY-MM-DD_<branch>|${DATE}_${BRANCH}|g" \
    "${REVIEWS}/templates/fix_report_template.md" > "${FIX_FILE}"
  echo "Created: ${FIX_FILE}"
else
  echo "Exists:  ${FIX_FILE} (skipped)"
fi

# --- Create regression log stub ---
if [[ ! -f "${REG_FILE}" ]]; then
  echo "# Regression Log — ${BRANCH} — ${DATE}" > "${REG_FILE}"
  echo "" >> "${REG_FILE}"
  echo "## npm run test:receptionist" >> "${REG_FILE}"
  echo "" >> "${REG_FILE}"
  echo "(paste output here)" >> "${REG_FILE}"
  echo "Created: ${REG_FILE}"
else
  echo "Exists:  ${REG_FILE} (skipped)"
fi

# --- Run safe automated checks ---
echo ""
echo "=== Running automated checks ==="
cd "${ROOT}"

# Receptionist unit tests (always safe to run)
echo ""
echo "-- npm run test:receptionist --"
npm run test:receptionist 2>&1 | tee -a "${REG_FILE}" && echo "PASS: test:receptionist" || echo "FAIL: test:receptionist (see ${REG_FILE})"

echo ""
echo "=== Review workflow ready ==="
echo ""
echo "Next steps:"
echo "  1. Open your GitHub PR."
echo "  2. Paste the content of: ai_reviews/templates/codex_review_request.md"
echo "  3. Type: @codex review"
echo "  4. Wait for Codex to post review findings."
echo "  5. Copy Codex findings into: ${CODEX_FILE}"
echo "  6. Open: ${AUDIT_FILE} and classify each finding."
echo "  7. Fix only CONFIRMED_BUG items."
echo "  8. Record results in: ${FIX_FILE}"
echo ""
echo "Files:"
echo "  Diff:    ${DIFF_FILE}"
echo "  Codex:   ${CODEX_FILE}"
echo "  Audit:   ${AUDIT_FILE}"
echo "  Fix:     ${FIX_FILE}"
echo "  Reglog:  ${REG_FILE}"
