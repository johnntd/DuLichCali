#!/usr/bin/env bash
# Read-only check that the dev-loop keys in your shell profile are VALID.
# Prints only HTTP status — never the key value. Safe to run anywhere.
#
#   bash scripts/security/verify_dev_loop_keys.sh
set -uo pipefail

ok=0
eval "$(grep -m1 '^[[:space:]]*export ANTHROPIC_API_KEY=' "$HOME/.zshrc" 2>/dev/null || true)"
eval "$(grep -m1 '^[[:space:]]*export OPENAI_API_KEY=' "$HOME/.zshrc" 2>/dev/null || true)"

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://api.anthropic.com/v1/models \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" -H "anthropic-version: 2023-06-01")"
  if [ "$c" = 200 ]; then echo "Anthropic (~/.zshrc): HTTP $c ✅ VALID"; else echo "Anthropic (~/.zshrc): HTTP $c ❌"; ok=1; fi
else
  echo "Anthropic (~/.zshrc): not set ❌"; ok=1
fi

if [ -n "${OPENAI_API_KEY:-}" ]; then
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://api.openai.com/v1/models \
    -H "Authorization: Bearer ${OPENAI_API_KEY}")"
  if [ "$c" = 200 ]; then echo "OpenAI    (~/.zshrc): HTTP $c ✅ VALID"; else echo "OpenAI    (~/.zshrc): HTTP $c ⚠️  (not used by the loop)"; fi
else
  echo "OpenAI    (~/.zshrc): not set ⚠️  (not used by the loop)"
fi

# Codex (OpenAI implementer) — OAuth status, no secret
python3 - <<'PY' 2>/dev/null || echo "Codex: ~/.codex/auth.json not readable"
import json,os
d=json.load(open(os.path.expanduser('~/.codex/auth.json')))
print("Codex:    auth_mode=%s, oauth_tokens=%s ✅ (no API key needed)" % (d.get("auth_mode"), bool(d.get("tokens"))))
PY

exit $ok
