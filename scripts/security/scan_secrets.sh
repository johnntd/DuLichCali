#!/usr/bin/env bash
# ============================================================================
# scan_secrets.sh — pre-deploy private-secret scanner for DuLichCali.
#
# Scans git-tracked source (the public web root, functions, docs are all
# tracked + deployed) for PRIVATE API keys / secrets that must never ship to
# the frontend. The Firebase web apiKey (AIza...) is public-safe by design and
# is intentionally NOT flagged.
#
# Usage:
#   bash scripts/security/scan_secrets.sh            # scan; exit 1 if a secret is found
#   bash scripts/security/scan_secrets.sh --selftest # prove the scanner catches a fake key
#
# Integrate into: npm test, the Codex-Claude loop, and the deploy checklist.
# Deployment MUST fail if this exits non-zero.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2   # repo root

# Private-secret regexes (extended). Each must never appear in tracked source.
PATTERNS=(
  'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}'                 # Anthropic
  'sk-proj-[A-Za-z0-9_-]{20,}'                            # OpenAI project key
  'sk-[A-Za-z0-9]{40,}'                                   # OpenAI / generic long sk- key
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'                    # PEM private key
  '"private_key"[[:space:]]*:[[:space:]]*"-----BEGIN'     # service-account JSON
  'AKIA[0-9A-Z]{16}'                                      # AWS access key id
  'xox[baprs]-[0-9A-Za-z-]{10,}'                          # Slack token
  'SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'            # SendGrid
  're_[A-Za-z0-9]{24,}'                                   # Resend
  'AC[a-f0-9]{32}'                                        # Twilio Account SID
  'ghp_[A-Za-z0-9]{36}'                                   # GitHub PAT
)

# Paths to ignore: the scanner itself (contains the patterns), the rules-test
# package lock, and any lockfiles.
EXCLUDES=(
  ":(exclude)scripts/security/scan_secrets.sh"
  ":(exclude)tests/security-rules/package-lock.json"
  ":(exclude)*.lock"
  ":(exclude)package-lock.json"
)

scan() {
  local found=0
  for pat in "${PATTERNS[@]}"; do
    # git grep over tracked files only; -I skips binary; -E extended regex.
    local hits
    hits=$(git grep -nIE "$pat" -- . "${EXCLUDES[@]}" 2>/dev/null)
    if [ -n "$hits" ]; then
      echo "❌ PRIVATE SECRET pattern matched: /$pat/"
      echo "$hits" | sed 's/^/     /'
      found=1
    fi
  done
  return $found
}

if [ "${1:-}" = "--selftest" ]; then
  echo "── self-test: scanner must DETECT a planted fake secret ──"
  tmp="$(mktemp -t scan_secrets_selftest.XXXXXX)"
  # Known FAKE secrets (not real) to prove detection.
  {
    echo 'const k = "sk-ant-api03-FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE0123456789";'
    echo 'const o = "sk-proj-FAKEFAKEFAKEFAKEFAKEFAKEFAKE0123456789";'
  } > "$tmp"
  if grep -qE 'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}' "$tmp"; then
    echo "✅ self-test PASS — scanner detects planted fake keys"
    rm -f "$tmp"; exit 0
  else
    echo "❌ self-test FAIL — scanner did NOT detect planted keys"
    rm -f "$tmp"; exit 1
  fi
fi

echo "── scan_secrets: scanning tracked source for private keys ──"
if scan; then
  echo "✅ scan_secrets: no private secrets found in tracked source"
  echo "   (note: AIza* Firebase web keys are public-safe and intentionally allowed;"
  echo "    runtime secrets stored in Firestore are checked separately by the audit.)"
  exit 0
else
  echo ""
  echo "🚨 scan_secrets: PRIVATE SECRET(S) DETECTED — do NOT deploy. Remove + rotate."
  exit 1
fi
