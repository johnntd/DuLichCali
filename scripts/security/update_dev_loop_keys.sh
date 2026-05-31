#!/usr/bin/env bash
# Update the dev-loop API keys (Anthropic reviewer + optional OpenAI) in your shell
# profiles WITHOUT the key ever appearing on screen, in shell history, or in any
# Claude/transcript. Run this in YOUR OWN terminal (not via the Claude `!` prefix) so
# the hidden `read -s` prompt has a real TTY.
#
#   bash scripts/security/update_dev_loop_keys.sh
#
# Notes:
#  - The Codex-Claude loop (scripts/ai/ai_dev_loop.sh) reads $ANTHROPIC_API_KEY for its
#    reviewer. That is the only key the loop strictly needs.
#  - Codex itself authenticates via ChatGPT OAuth (auth_mode=chatgpt) and does NOT use an
#    OpenAI API key, so nothing to change there. The OPENAI_API_KEY env var is refreshed
#    only as hygiene for other local tools that may read it.
#  - Each key is validated against its provider's /v1/models endpoint before being saved.
#    A key that fails the check is NOT written.
set -euo pipefail

ZSHRC="$HOME/.zshrc"
BASHP="$HOME/.bash_profile"
STAMP="$(date +%Y%m%d-%H%M%S)"

mask() { local k="$1"; printf '%s…%s (len %s)' "${k:0:7}" "${k: -4}" "${#k}"; }

update_var() {  # $1=var  $2=value  $3=file
  local name="$1" val="$2" file="$3"
  [ -f "$file" ] || return 0
  if grep -qE "^[[:space:]]*export ${name}=" "$file"; then
    cp "$file" "${file}.bak-${STAMP}"
    python3 - "$file" "$name" "$val" <<'PY'
import sys, re
fn, name, val = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(fn).read()
s = re.sub(r'(?m)^[ \t]*export ' + re.escape(name) + r'=.*$',
           'export %s="%s"' % (name, val), s)
open(fn, 'w').write(s)
PY
    echo "  updated ${name} in ${file}  (backup: ${file##*/}.bak-${STAMP})"
  else
    printf 'export %s="%s"\n' "$name" "$val" >> "$file"
    echo "  appended ${name} to ${file}"
  fi
}

echo "== Update dev-loop keys (input is hidden; nothing is echoed) =="

# --- Anthropic: REQUIRED for the loop's reviewer ---
read -rs -p "Paste NEW Anthropic key (sk-ant-...), blank to skip: " ANT; echo
if [ -n "${ANT:-}" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 https://api.anthropic.com/v1/models \
    -H "x-api-key: ${ANT}" -H "anthropic-version: 2023-06-01")"
  if [ "$code" = 200 ]; then
    echo "  Anthropic key valid ($(mask "$ANT")) ✅"
    update_var ANTHROPIC_API_KEY "$ANT" "$ZSHRC"
    update_var ANTHROPIC_API_KEY "$ANT" "$BASHP"
  else
    echo "  ❌ Anthropic key test returned HTTP ${code} — NOT saved. Re-run with the correct key."
  fi
fi

# --- OpenAI: OPTIONAL (codex uses OAuth; this is for other tools that read OPENAI_API_KEY) ---
read -rs -p "Paste NEW OpenAI key (sk-...), blank to skip: " OAI; echo
if [ -n "${OAI:-}" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 https://api.openai.com/v1/models \
    -H "Authorization: Bearer ${OAI}")"
  if [ "$code" = 200 ]; then
    echo "  OpenAI key valid ($(mask "$OAI")) ✅"
    update_var OPENAI_API_KEY "$OAI" "$ZSHRC"
  else
    echo "  ❌ OpenAI key test returned HTTP ${code} — NOT saved."
  fi
fi

echo ""
echo "Done. Open a NEW terminal (or run: source ~/.zshrc) so the dev loop sees the new keys."
echo "Verify with:  bash scripts/security/verify_dev_loop_keys.sh"
