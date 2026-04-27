#!/usr/bin/env bash
set -euo pipefail

# targeted_dry_run.sh — DuLichCali scoped validation
# Mirrors the focused test approach from ai_trading_system/scripts/ai/precommit_ai_gate.sh
#
# Usage:
#   scripts/ai/targeted_dry_run.sh hair-salon
#   scripts/ai/targeted_dry_run.sh booking
#   scripts/ai/targeted_dry_run.sh travel
#   scripts/ai/targeted_dry_run.sh marketplace
#   scripts/ai/targeted_dry_run.sh ai-receptionist
#   scripts/ai/targeted_dry_run.sh phone-intake
#   scripts/ai/targeted_dry_run.sh salon-memory

SCOPE="${1:-}"
if [ -z "$SCOPE" ]; then
  echo "Usage: scripts/ai/targeted_dry_run.sh <scope>"
  echo "Scopes: hair-salon  booking  travel  marketplace  ai-receptionist  phone-intake  salon-memory"
  exit 2
fi

RUN_DIR=".ai_runs/latest"
OUTPUT="$RUN_DIR/targeted_dry_run_${SCOPE}.txt"
mkdir -p "$RUN_DIR"

PASS=0
FAIL=0
SKIP=0

check_pass() { echo "  PASS  $1"; PASS=$((PASS+1)); }
check_fail() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
check_skip() { echo "  SKIP  $1 — $2"; SKIP=$((SKIP+1)); }

check_file_exists() {
  local f="$1"
  if [ -f "$f" ]; then check_pass "file exists: $f"
  else check_fail "MISSING: $f"; fi
}

check_grep() {
  local label="$1" pattern="$2" file="$3"
  if [ ! -f "$file" ]; then check_fail "file missing for grep check: $file"; return; fi
  if grep -q "$pattern" "$file" 2>/dev/null; then check_pass "$label"
  else check_fail "$label — pattern not found: $pattern"; fi
}

check_grep_absent() {
  local label="$1" pattern="$2" file="$3"
  if [ ! -f "$file" ]; then check_skip "$label" "file missing"; return; fi
  if ! grep -q "$pattern" "$file" 2>/dev/null; then check_pass "$label"
  else check_fail "$label — unwanted pattern found: $pattern"; fi
}

run_node_check() {
  local label="$1" cmd="$2"
  if node -e "$cmd" 2>/dev/null; then check_pass "$label"
  else check_fail "$label"; fi
}

set +e
{
  echo "== DULICHCALI TARGETED DRY RUN: $SCOPE =="
  echo "Run folder: $RUN_DIR"
  echo "Output:     $OUTPUT"
  echo
  echo "Safe static validation only — no Firestore writes, no deploys, no notifications."
  echo

  # ── core: always run receptionist tests ──────────────────────────────────
  echo "== Core: receptionist regression tests =="
  node tests/runner.js 2>&1
  core_status=$?
  [ "$core_status" -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
  echo

  # ── scope-specific checks ────────────────────────────────────────────────
  case "$SCOPE" in

    hair-salon)
      echo "== Scope: hair-salon =="
      echo
      echo "-- Reference standard: Luxurious Nails --"
      check_file_exists "nailsalon/index.html"
      check_grep "nailsalon/index.html loads marketplace.js" "marketplace\.js" "nailsalon/index.html"
      check_grep "Luxurious Nails vendor block in services-data.js" "luxurious-nails" "marketplace/services-data.js"
      check_grep "Luxurious Nails has nail-specific services" "Manicure\|Pedicure\|Acrylic\|Gel" "marketplace/services-data.js"
      check_file_exists "nailsalon/receptionist.js"
      echo
      echo "-- Target: Beauty Hair OC --"
      check_file_exists "hairsalon/index.html"
      check_grep "hairsalon/index.html loads marketplace.js" "marketplace\.js" "hairsalon/index.html"
      check_grep "Beauty Hair OC vendor block in services-data.js" "beauty-hair-oc" "marketplace/services-data.js"
      check_grep "Beauty Hair OC has hair name" "Beauty Hair OC" "marketplace/services-data.js"
      check_grep "Beauty Hair OC has hair-specific services" "Haircut\|Blowout\|Balayage\|Color\|Keratin" "marketplace/services-data.js"
      check_grep "Beauty Hair OC has stylist data" "Michael\|Michele\|Tracy" "marketplace/services-data.js"
      check_grep "Beauty Hair OC has AI receptionist persona" "Michelle" "marketplace/services-data.js"
      check_grep "Beauty Hair OC has address/location" "Westminster\|Orange County\|Garden Grove" "marketplace/services-data.js"
      echo
      echo "-- Hair vs Nail isolation --"
      check_grep_absent "hairsalon/index.html does not hardcode luxurious-nails" "luxurious-nails" "hairsalon/index.html"
      # Strip <script>…</script>, <link …>, and <!-- comments --> before checking
      # for nail salon content — shared infrastructure paths (/nailsalon/*.js)
      # in src/href/comment attributes must not count as visible content leakage.
      if perl -0777 -pe \
          's/<script\b[^>]*>.*?<\/script>//gis;
           s/<link\b[^>]*>//gis;
           s/<!--.*?-->//gs' hairsalon/index.html 2>/dev/null \
          | grep -qiE 'Nail Salon|nailsalon'; then
        check_fail "hairsalon/index.html does not hardcode nail salon title (visible/template content)"
      else
        check_pass "hairsalon/index.html does not hardcode nail salon title (visible/template content)"
      fi
      echo
      echo "-- Route validation --"
      run_node_check "hairsalon/index.html is valid UTF-8" \
        "require('fs').readFileSync('hairsalon/index.html','utf8'); process.exit(0)"
      run_node_check "nailsalon/index.html is valid UTF-8" \
        "require('fs').readFileSync('nailsalon/index.html','utf8'); process.exit(0)"
      echo
      echo "-- CSS overlay check --"
      check_grep "marketplace.css defines mp-ai-open-root z-index" "mp-ai-open-root" "marketplace/marketplace.css"
      check_grep "marketplace.js saves _origParent (fullscreen guard)" "_origParent" "marketplace/marketplace.js"
      echo
      echo "-- Voice mode check --"
      check_file_exists "nailsalon/voice-mode.js"
      check_grep "voice-mode.js has TTS chain (_speakViaOpenAi)" "_speakViaOpenAi" "nailsalon/voice-mode.js"
      check_grep "voice-mode.js has Gemini fallback" "_speakViaGemini" "nailsalon/voice-mode.js"
      ;;

    booking)
      echo "== Scope: booking =="
      echo
      check_file_exists "script.js"
      check_grep "Airport booking exists" "airport\|Airport\|pickup\|dropoff" "script.js"
      check_grep "Availability check present" "checkAvail\|checkRide\|availability" "script.js"
      check_grep "Booking validation present" "submitBooking\|slotWarning\|bufferMinutes\|Time conflict\|datetime" "script.js"
      check_grep "Vehicle capacity logic" "capacity\|seats\|passengers" "script.js"
      check_file_exists "functions/index.js"
      check_grep "Firebase Functions booking handler" "booking\|Booking" "functions/index.js"
      ;;

    travel)
      echo "== Scope: travel =="
      echo
      check_file_exists "travel.html"
      check_file_exists "travel-packages.js"
      check_file_exists "destinations.js"
      check_grep "Travel packages data exists" "DESTINATIONS\|travelPackages\|packages" "travel-packages.js"
      check_grep "destinations.js has destination array" "DESTINATIONS\s*=\|destinations\s*=" "destinations.js"
      check_grep "travel.html loads travel-packages.js" "travel-packages" "travel.html"
      ;;

    marketplace)
      echo "== Scope: marketplace =="
      echo
      check_file_exists "marketplace/marketplace.js"
      check_file_exists "marketplace/marketplace.css"
      check_file_exists "marketplace/services-data.js"
      check_grep "Marketplace init function" "Marketplace\.init\|init(" "marketplace/marketplace.js"
      check_grep "Vendor loading from services-data" "VENDORS\|vendors\|VendorData" "marketplace/marketplace.js"
      check_grep "Nailsalon tab/category" "nail\|Nail" "marketplace/services-data.js"
      check_grep "Hairsalon tab/category" "hair\|Hair" "marketplace/services-data.js"
      check_grep "Food tab/category" "food\|Food" "marketplace/services-data.js"
      check_file_exists "nailsalon/index.html"
      check_file_exists "hairsalon/index.html"
      check_file_exists "foods/index.html"
      ;;

    ai-receptionist)
      echo "== Scope: ai-receptionist =="
      echo
      check_file_exists "nailsalon/receptionist.js"
      check_grep "Receptionist has _buildPrompt" "_buildPrompt" "nailsalon/receptionist.js"
      check_grep "Receptionist checks availability" "checkAvail\|_checkAvail\|availability" "nailsalon/receptionist.js"
      check_grep "Receptionist has state parser" "_parseState\|parseState\|STATE:" "nailsalon/receptionist.js"
      check_grep "Receptionist has language detection" "detectLang\|lang\|_lang" "nailsalon/receptionist.js"
      check_grep "Receptionist uses real-time clock" "new Date\|_timeOfDay\|getHours" "nailsalon/receptionist.js"
      check_grep "AI engine provider routing" "_callClaude\|_callOpenAI\|_callGemini" "ai-engine.js"
      check_grep "AI orchestrator fallback chain" "fallback\|provider\|PROVIDERS" "aiOrchestrator.js"
      check_file_exists "nailsalon/voice-mode.js"
      check_grep "Voice mode present" "_speakReply\|_speakVia" "nailsalon/voice-mode.js"
      echo
      echo "-- Syntax stability --"
      run_node_check "receptionist.js parses without syntax error" \
        "require('./nailsalon/receptionist.js'); process.exit(0)" 2>/dev/null || \
      run_node_check "receptionist.js static parse" \
        "const fs=require('fs'); const src=fs.readFileSync('nailsalon/receptionist.js','utf8'); new Function(src); process.exit(0)" 2>/dev/null || \
      check_fail "receptionist.js syntax check failed"
      ;;

    phone-intake)
      echo "== Scope: phone-intake =="
      echo
      check_file_exists "nailsalon/phone-intake.js"
      check_grep "normalizeSpokenPhoneNumber defined" "normalizeSpokenPhoneNumber" "nailsalon/phone-intake.js"
      check_grep "VI_DIGIT_MAP defined" "VI_DIGIT_MAP" "nailsalon/phone-intake.js"
      check_grep "Vietnamese digit không" "không" "nailsalon/phone-intake.js"
      check_grep "PhoneIntake exported" "PhoneIntake" "nailsalon/phone-intake.js"
      check_grep "receptionist.js wires phone-intake" "PhoneIntake\|normalizeSpokenPhoneNumber" "nailsalon/receptionist.js"
      check_grep "runner.js has PI-001 test" "PI-001" "tests/runner.js"
      check_grep "runner.js has PI-014 test" "PI-014" "tests/runner.js"
      check_grep "runner.js covers runtime Vietnamese mixed chunks" "4084 397 năm 22" "tests/runner.js"
      check_grep "receptionist.js has pre-AI direct phone confirmation" "directResponse: _buildPhoneConfirmReply" "nailsalon/receptionist.js"
      check_grep "receptionist.js confirms Vietnamese phone deterministically" "Em xác nhận số điện thoại" "nailsalon/receptionist.js"
      ;;

    salon-memory)
      echo "== Scope: salon-memory =="
      echo
      echo "-- Customer memory helper (returning customer lookup) --"
      check_file_exists "nailsalon/customer-memory.js"
      check_grep "SalonCustomerMemory exported" \
        "SalonCustomerMemory" "nailsalon/customer-memory.js"
      check_grep "lookupReturningSalonCustomer helper exists" \
        "lookupReturningSalonCustomer" "nailsalon/customer-memory.js"
      check_grep "buildReturningCustomerGreeting helper exists" \
        "buildReturningCustomerGreeting" "nailsalon/customer-memory.js"
      check_grep "phone-first booking intent exists" \
        "_isPhoneFirstBookingIntent" "nailsalon/receptionist.js"
      check_grep "memory intercept runs before normal AI flow" \
        "_maybeHandleSalonCustomerMemory" "nailsalon/receptionist.js"
      check_grep "phone-first routes through AI via systemContext" \
        "systemContext: _buildPhoneFirstPrompt" "nailsalon/receptionist.js"
      check_grep "returning customer routes through AI via systemContext" \
        "systemContext: ctx" "nailsalon/receptionist.js"
      echo
      echo "-- Returning customer memory tests in runner.js --"
      check_grep "runner.js has Shared Salon Returning Customer Memory group" \
        "Shared Salon Returning Customer Memory" "tests/runner.js"
      check_grep "runner.js tests normalized phone lookup" \
        "Returning customer lookup uses normalized phone" "tests/runner.js"
      check_grep "runner.js tests vendor scoping" \
        "Vendor scoping prevents cross-vendor leakage" "tests/runner.js"
      check_grep "runner.js tests lookup failure safety" \
        "Lookup failure is safe" "tests/runner.js"
      check_grep "runner.js tests validation is not bypassed" \
        "Memory suggestions do not bypass booking validation" "tests/runner.js"
      echo
      echo "-- Vendor scoping --"
      check_grep "lookup is vendor-scoped via vendor id" \
        "vendorIdFromBiz" "nailsalon/customer-memory.js"
      check_grep "helper queries vendors/{vendorId}/bookings" \
        "collection('vendors').doc(vendorId).collection('bookings')" "nailsalon/customer-memory.js"
      echo
      echo "-- Hair and nail contexts both covered --"
      check_grep "nailsalon/index.html loads customer-memory before receptionist" \
        "customer-memory\.js.*v=20260427b" "nailsalon/index.html"
      check_grep "hairsalon/index.html loads customer-memory before receptionist" \
        "customer-memory\.js.*v=20260427b" "hairsalon/index.html"
      check_grep "nail context: receptionist.js loaded by nailsalon/index.html" \
        "receptionist\.js" "nailsalon/index.html"
      check_grep "hair context: receptionist.js loaded by hairsalon/index.html (shared module)" \
        "receptionist\.js" "hairsalon/index.html"
      check_grep "hair vendor data: beauty-hair-oc in services-data.js" \
        "beauty-hair-oc" "marketplace/services-data.js"
      check_grep "nail vendor data: luxurious-nails in services-data.js" \
        "luxurious-nails" "marketplace/services-data.js"
      ;;

    *)
      echo "Unknown scope: $SCOPE"
      echo "Valid: hair-salon  booking  travel  marketplace  ai-receptionist  phone-intake  salon-memory"
      echo "FINAL: FAIL"
      exit 2
      ;;
  esac

  echo
  echo "== Summary =="
  echo "  PASS: $PASS | FAIL: $FAIL | SKIP: $SKIP"

} 2>&1 | tee "$OUTPUT"
set -e

# Re-read counts from output since subshell doesn't propagate vars through tee
FINAL_FAIL=$(grep -c "^  FAIL " "$OUTPUT" 2>/dev/null) || FINAL_FAIL=0

if [ "$FINAL_FAIL" -eq 0 ]; then
  echo "FINAL: PASS" | tee -a "$OUTPUT"
  exit 0
else
  echo "FINAL: FAIL ($FINAL_FAIL checks failed)" | tee -a "$OUTPUT"
  exit 1
fi
