# Follow-up: Conflict-guard AI/voice/manual coverage + Vietnamese voice consistency

This builds on the already-merged shared engine `booking-conflict-guard.js`
(`window.BookingGuard.validateUnifiedBookingRequest`) and its report
`docs/unified_booking_conflict_guard.md`. Two independent parts. Make the smallest
safe change for each. Do NOT rewrite the engine. Do NOT deploy, push, or commit.

---

## PART A — Route the remaining booking-creation paths through the guard

The engine is already wired into the three customer **form** submit paths
(`mobile-barber/mobile-barber-booking.js`, `ride-intake.js`, `travel-booking.js`).
**Already covered transitively — do NOT double-guard:** the mobile-barber AI, voice,
and manual flows all delegate their write to `MobileBarberBooking` (see header of
`mobile-barber/mobile-barber-agent.js`), which already calls the guard inside
`saveBooking`. Verify this is still true; if so, leave those alone.

**Find every remaining path that writes a booking WITHOUT first calling the guard**
and route it through `validateUnifiedBookingRequest`, aborting the write when
`ok === false`. Grep all write sites (`addDoc`, `.set(`, `setDoc`) to the
`bookings`, `travel_bookings`, and `mobileBarberBookings` collections. Known
candidates that may write independently of the guarded form paths:

- `workflowEngine.js` — the AI ride/airport flow and AI tour flow. If it writes a
  booking directly (rather than delegating to `RideIntake`/`travel-booking.js`),
  guard it.
- `chat.js` — if it confirms/writes a booking.
- `marketplace/marketplace.js` — if it writes a booking.
- `ride-avail.js`, `script.js` — any direct `travel_bookings`/`bookings` write.

For each guarded path:
- Build the request object (`ownerId`, `serviceType`, `vendorId`, customer identity,
  `requestedStart`/`requestedEnd` or `serviceDurationMinutes`, location fields,
  `source`). Resolve `ownerId` via the existing `OwnerModel`/`OwnerBookings` helpers.
- On `ok === false`, do NOT write. Surface the reason to the customer by pushing an
  **English-only** `[SYSTEM: <reason>]` note back through the AI so it replies in the
  customer's language. **Never** add a hardcoded localized rejection string (vi/en/es
  rule applies). Reuse the same pattern the form paths use.
- If a path cannot resolve a location, the guard returns `vendor_review_required` —
  honor it (send for review, do not silently confirm).

Do not change the engine's API or logic. Do not introduce a Firestore composite
index. If a candidate file only READS bookings (availability display) and never
writes, leave it unchanged and note that in the report.

---

## PART B — Make the mobile-barber AI agent as good as the proven nail-salon brain

The operator's directive: the **nail-salon receptionist brain** (`nailsalon/receptionist.js`,
the `LilyReceptionist`) has worked reliably — it never double-books and it looks up
prior booking records. Its AI quality (including staying in the customer's language)
is the bar. **Consult that brain and port its proven patterns into the mobile-barber
AI agent.** Do NOT literally invoke `LilyReceptionist` for barber (it is coupled to
salon data/staff), and you MUST NOT modify `nailsalon/receptionist.js` or any
`nailsalon/` file — Luxurious Nails behavior must stay byte-for-byte unchanged. Use the
nail brain strictly as the **reference source** of proven prompt patterns.

### Confirmed root cause of the Vietnamese drift (verified — do not re-litigate)
- The mobile-barber TTS engine language is fixed correctly at session open and never
  downgrades vi→en (`mobile-barber/mobile-barber-voice.js`). Leave the TTS provider
  chain and language-lock there UNCHANGED (respect voice-mode invariants).
- The deterministic `reply(lang, key)` templates in `mobile-barber/mobile-barber-agent.js`
  are fully translated in en/vi/es — not the leak.
- **The leak is `_buildAIBrainPrompt(state, ctx, lang)` in
  `mobile-barber/mobile-barber-agent.js` (around lines 662–733).** It is almost entirely
  English with English few-shot examples and only a single weak language directive,
  so over a 20-turn history the model drifts to English once a turn routes through the
  AI brain. The nail brain does NOT have this problem because of the proven prompt
  sections below.

### What to port FROM the nail brain (reference: `_buildPrompt` in `nailsalon/receptionist.js`, roughly lines 1183–1990)
Study these three sections and reproduce equivalents inside the mobile-barber agent's
`_buildAIBrainPrompt`, adapted to barber data (services, no staff/no salon menu):

1. **`=== LANGUAGE ===` section** (~line 1403): "Detect the customer language and respond
   ENTIRELY in that same language. Never mix languages. Match the customer completely."
   Place a strong language directive as the FIRST line AND restate at the LAST line of
   the barber prompt. Build the language name from `lang` (vi → Tiếng Việt, es → Español,
   en → English). State explicitly: instructions/examples below are English for the
   model's reference only — customer-facing text must be in the customer's language.
2. **`=== VIETNAMESE OUTPUT RULES ===` section** (~line 1411, RULE V1–V5) and the Spanish
   equivalent: port concrete anti-drift rules — no English fragments inside Vietnamese
   sentences; Vietnamese time phrasing and connectors; `[STATE:{...}]` markers keep
   service ids/data in English but conversational text stays in the customer language.
   These concrete rules (not a single line) are what stop the drift.
3. **`=== AVAILABILITY — CRITICAL RULE ===` section** (~line 1627): "The SYSTEM validates
   real-time slot availability automatically — you do not and cannot do it yourself.
   Your job: collect service, date, time. The system checks the slot silently. NEVER
   claim a booking is confirmed — only the system confirms." Port this so the barber AI
   defers double-booking prevention to the conflict guard (Part A / `BookingGuard`) and
   relays `[SYSTEM: ...]` backend results rephrased in the customer's language. This is
   how the nail brain avoids double-booking via the AI while keeping language correct.

### Also align booking-record lookup with the nail brain's proven behavior
The nail brain looks up prior bookings by phone (`_lookupActiveBookingByPhone`,
`_xsBookingLookup`, `_buildFoundBookingMsg` / `_buildNoBookingFoundMsg`). The mobile
barber agent already has `lookupReturningCustomer` / `customerLookupStatus`
(`mobile-barber/mobile-barber-booking.js` + agent). Verify the barber AI path actually
surfaces a found prior record to the customer (phone-first lookup, then greet returning
customer / offer saved address) the way the nail brain does, and that a "not found"
path is handled. If parity already exists, state that; if a gap exists, close it
minimally — do not rebuild what already works.

### Constraints
- Do NOT break the STATE/marker protocol or `_parseStateMarker`/`_stripMarkers` — keep
  marker emission rules intact (`[STATE:{...}]` stays literal).
- Keep replies short/warm. Lock `es` equally; do not regress English.
- This is logic shared by mobile + desktop and must behave identically on both.
- NO hardcoded user-facing strings — the prompt sections teach the AI; runtime
  customer text comes from the AI in the customer's language.

---

## Mandatory rules (CLAUDE.md — non-negotiable)
- Mobile-first; identical behavior at 375px and 1280px; same code path both.
- NO hardcoded user-facing strings in any language. Rejection reasons go through the
  AI via English `[SYSTEM: ...]`; any internal/admin string uses the existing
  translation-key tables (vi+en+es together).
- Any `.js`/`.css` you edit or add: bump its `?v=` in EVERY HTML consumer to a string
  never used before (verify via `grep -rn` across `*.html` and `git log --all`). Note
  the prior mobile-barber high-water marks and go higher (date ≥ today, letter suffix).
- Booking + voice TTS are critical trigger areas: read current code first, smallest
  safe change, do not weaken any existing availability/compliance/language gate.
- Run `scripts/ai/full_system_dry_run.sh` and ensure **FINAL: PASS**, and `node --check`
  every edited/new `.js`, and `node tests/runner.js`. Add/extend tests:
  - guard called on each newly-guarded write path (static assertion is acceptable
    where runtime needs live Firestore);
  - `_buildAIBrainPrompt('vi')` output contains a strong Vietnamese-only directive at
    the start AND end and does not present English example replies unfenced;
  - same for `es`; English still works.

## Do NOT break / do NOT touch
- Luxurious Nails (`nailsalon/`) behavior. `driver-admin.html` + compliance gates.
- TTS provider order / session language-lock in `mobile-barber-voice.js`.
- The already-guarded form + `MobileBarberBooking` paths (no double-guard).
- Vendor data isolation; valid (no-conflict) bookings must still be created as before.
- No deploy, no push, no commit. No Firestore composite-index requirement.

## Report
Append/extend `docs/unified_booking_conflict_guard.md` (or a clearly-named new doc):
every newly-guarded path (and any read-only path confirmed not to need guarding), the
exact `_buildAIBrainPrompt` change, version-string bumps, test results, and an honest
PASS/BLOCKED status (LLM language-drift fix can only be runtime-confirmed in an
authenticated live session — mark that BLOCKED, do not claim it PASS).
