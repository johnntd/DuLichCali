#!/usr/bin/env bash
# Firestore security-rules unit tests, run against the local Firestore emulator.
#
# The Firestore emulator requires JDK 11+. The system default `java` may be 8, so
# we prefer Homebrew's openjdk@17 when present (override with JAVA_HOME).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Pick a JDK 11+ for the emulator.
if [ -z "${JAVA_HOME:-}" ]; then
  for cand in /opt/homebrew/opt/openjdk@17 /opt/homebrew/opt/openjdk /usr/local/opt/openjdk@17; do
    if [ -x "$cand/bin/java" ]; then JAVA_HOME="$cand"; break; fi
  done
fi
if [ -n "${JAVA_HOME:-}" ]; then
  export JAVA_HOME
  export PATH="$JAVA_HOME/bin:$PATH"
fi
echo "Using java: $(java -version 2>&1 | head -1)"

# A demo-* project id needs no credentials in the emulator.
export GCLOUD_PROJECT="${GCLOUD_PROJECT:-demo-dulichcali}"

exec firebase emulators:exec --only firestore --project "$GCLOUD_PROJECT" \
  "node tests/rules/firestore-rules.test.js"
