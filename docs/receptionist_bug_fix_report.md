# Nail Receptionist — Bug Fix Report

Tracks all known AI conversation failures, their root causes, fixes, and current verification status.

Generated from `tests/cases/*.json`. Run `npm run test:receptionist` to verify all fixes are in place.

---

## Status model

| Status | Meaning |
|--------|---------|
| `known_bug` | Documented failure, no fix applied yet |
| `expected_fixed` | Code change was made but no automated verification exists |
| `verified_in_runner` | Fix confirmed by runner (static/unit level). See confidence notes below. |
| `verified_live` | Fix confirmed via manual end-to-end testing in production |

**Important:** `verified_in_runner` is NOT the same as `verified_live`. The runner confirms that fix instructions are present in source code and that the unit-level logic behaves correctly. It does NOT prove that Claude (the AI model) actually follows those instructions in a real conversation. Only live API testing can confirm that.

---

## Bug / Fix Index

### RX-001 — Staff switch: Helen unavailable → user asks for Tracy
- **Category:** alternate_staff
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** After showing Helen's conflict, AI repeated Helen's conflict instead of checking Tracy.
- **Root cause:** `ENTITY_EXTRACTION` staff rule said "inherit from STATE if booking_request". On "how about Tracy?", Claude kept `staff=Helen` from CURRENT BOOKING STATE.
- **Fix:** Replaced "inherit" rule with explicit override: "If customer switches staff → use new name. Do NOT inherit prior conflicting staff." Added `=== CONFLICT RESOLUTION — STAFF SWITCH ===` section.
- **Runner check:** `verify_fix_string: "Do NOT inherit prior staff"`
- **Code:** `nailsalon/receptionist.js` → `_buildPrompt` ENTITY_EXTRACTION + CONFLICT_RESOLUTION
- **Confidence gap:** Runner confirms the instruction text is present. Claude following it in production requires live API testing.

---

### RX-002 — Staff switch: Helen unavailable → user asks for "any other tech"
- **Category:** alternate_staff
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** After Helen conflict, "any other tech?" repeated Helen conflict message.
- **Root cause:** Same as RX-001. "other tech"/"anyone" should map to `staff:null`, bypassing named-staff conflict check.
- **Fix:** Same CONFLICT_RESOLUTION section; "other tech"/"anyone" → set `staff:null`.
- **Runner check:** `verify_fix_string: "CONFLICT RESOLUTION — STAFF SWITCH"`
- **Confidence gap:** `staff:null` mapping from vague phrases requires live API testing.

---

### RX-003 — Replace booking loop: "replace it" triggers same conflict message again
- **Category:** booking_replace
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** "You already have a Manicure at 2 PM. Replace it?" → user says "replace it" → SAME message shown again. Infinite loop.
- **Root cause:** Two issues combined:
  1. Prompt said "keep staff/name/phone" on "replace it" but didn't say to clear `time:null`. Claude kept `time=14:00`.
  2. `_earlyCheckReady` didn't pass `isModify:true`, so customer's own booking was NOT excluded from conflict checks. Same `customer_conflict` fired again.
- **Fix (prompt):** Explicitly tell Claude to set `time:null` on "replace it". Ask once for new time. Do NOT re-show conflict.
- **Fix (JS):** When `pendingAction=modify_booking`, pass `isModify:true` and `phone` to availability check draft in `_earlyCheckReady`.
- **Runner checks:**
  - Static: `verify_fix_string: "Set time: null (new time needed)"`
  - Unit: Availability logic test "isModify=true excludes own booking"
- **Code:** `_buildPrompt` MODIFY_RESCHEDULE + `_earlyCheckReady` block
- **Confidence gap:** Prompt fix is static-check only. JS fix is directly exercised by unit test (higher confidence).

---

### RX-004 — Cancel booking: AI refuses direct cancellation
- **Category:** booking_cancel
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** "Cancel my appointment" → "I'm not able to cancel appointments directly. Please call the salon."
- **Root cause:** Three missing pieces had to exist simultaneously:
  1. `_submitDirectBooking` didn't restore `name/phone` to `biz._bookingState` → Claude had empty STATE.
  2. No `=== CANCEL BOOKING ===` section in system prompt.
  3. `_parseEscalationType` didn't include `'cancel'` in the regex.
- **Fix:** All three added: STATE restore in `_submitDirectBooking`, CANCEL BOOKING section in prompt, `cancel` added to escalation parser, and Firestore update handler in `send()`.
- **Runner check:** `verify_fix_string: "=== CANCEL BOOKING ==="`
- **Code:** `_submitDirectBooking` (STATE restore) + `_buildPrompt` CANCEL + `_parseEscalationType` + `send()` cancel handler
- **Confidence gap:** The cancel escalation chain (prompt → `[ESCALATE:cancel]` → Firestore update) has four links. Runner only checks the prompt section. Full chain requires live testing.
- **See also:** `tests/memory/booking_cancel_modify_flow.md` — five invariants that must stay intact.

---

### RX-005 — Modify booking: reschedule deletes old record instead of updating in-place
- **Category:** booking_modify
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Customer reschedules → old booking DELETED, new booking CREATED with different ID. Booking history lost.
- **Root cause:** `_submitDirectBooking` always called `.delete(oldDoc).then(.set(newDoc))`. No guard to use `.update()` when an exact booking ID was known.
- **Fix:** `isExactReschedule = !!(draft.isModify && draft.existingBookingId)`. When true: use `.update()` on same doc ID. When false: mark old bookings `rescheduled`, create new doc.
- **Runner check:** `verify_fix_string: "isExactReschedule"`
- **Code:** `_submitDirectBooking` — update-in-place vs create-new branch
- **Confidence gap:** Runner confirms the guard exists. Whether the Firestore `.update()` vs `.set()` call is correctly routed requires live testing with a real booking ID.

---

### RX-006 — Modify booking: customer's own booking falsely blocks reschedule
- **Category:** conflict_handling
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** When rescheduling, `_earlyCheckReady` ran the availability check with the customer's own booking still in the set → `customer_conflict` fired against themselves → reschedule blocked.
- **Root cause:** `_earlyCheckReady` didn't pass `isModify:true` to the availability draft. The `NailAvailabilityChecker` at line ~465 skips `customer_conflict` when `draft.isModify` is true.
- **Fix:** Same JS fix as RX-003. When `pendingAction=modify_booking`, pass `isModify:true` + `phone` in `_ed`.
- **Runner checks:**
  - Static: `verify_fix_string: "isModify:          _inModify"`
  - Unit: "customer can reschedule to slot their old booking occupied"
- **Code:** `_earlyCheckReady` block in `send()` handler

---

### RX-007 — Language consistency: English booking produces Vietnamese confirmation
- **Category:** language_consistency
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** English customer books appointment → confirmation shown in Vietnamese.
- **Root cause:** Old `EscalationEngine.create()` path read `biz._bookingState.lang` AFTER state was cleared. `lang=null` → fell back to vendor's default language (sometimes `vi`).
- **Fix:** `_submitDirectBooking` reads `draft.lang` which is captured from the BOOKING marker BEFORE state is cleared. Language is now always from the customer's conversation.
- **Runner check:** `verify_fix_string: "draft.lang"` (common string — may need strengthening)
- **Confidence gap:** This is the weakest static check. `draft.lang` appears in multiple contexts. The actual language output requires live API testing with an English conversation.

---

### RX-008 — Confirmation quality: booking confirmed with no time/price/reference
- **Category:** confirmation_quality
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Booking confirmation showed only "Your appointment request has been sent." No time, price, or reference ID.
- **Root cause:** Original `EscalationEngine.create()` wrote to `escalations` collection and showed a "pending confirmation" message — vendor had to confirm before customer saw booking details.
- **Fix:** Replaced with `_submitDirectBooking` which calls `_buildBookingPacketHtml` — a card showing service, staff, date, time, price estimate, reference ID, location, and calendar links. Shown instantly.
- **Runner check:** `verify_fix_string: "_buildBookingPacketHtml"`
- **Confidence gap:** Runner confirms the function exists. Actual card content (correct fields rendered) requires visual/snapshot testing.

---

### RX-009 — Booking close: "is it done?" restarts the booking flow
- **Category:** conversation_closing
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** After booking packet shown, customer asks "is it done?" → AI re-enters booking collection flow asking for service/date/time.
- **Root cause:** After `_submitDirectBooking`, `biz._bookingState` has `date=null, time=null` (cleared before the call). `_buildBookingStateContext` showed these as "not yet specified" → Claude interpreted the booking as INCOMPLETE.
- **Fix (state context):** When `biz._lastBookingId` is set AND name/phone present AND date/time null, append: `BOOKING STATUS: CONFIRMED (ref: DLC-XXXX). Appointment is fully booked. Do NOT ask for date/time again.`
- **Fix (confirmation text):** Changed to: `"...is confirmed and booked. You're all set — no further action needed."`
- **Runner check:** `verify_fix_string: "BOOKING STATUS: CONFIRMED"`
- **Code:** `_buildBookingStateContext` + `_buildConfirmedNatural`
- **Confidence gap:** Runner confirms the signal is in the state context builder. Whether Claude reads and uses it correctly requires live API testing.

---

### RX-010 — Stale hours: admin schedule change not reflected for up to 10 minutes
- **Category:** stale_data
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Admin changes Helen's hours to OFF → AI still says "Helen works Tuesday from 10 AM to 6 PM" for up to 10 minutes.
- **Root cause:** `biz._dataFetchedAt` caches Firestore fetches for 600,000ms (10 min). No push/invalidate mechanism from admin to receptionist.
- **Fix:** `_fetchLiveBizData()` is called when `Date.now() - biz._dataFetchedAt > 600000`. This limits the stale window to 10 minutes. **Known limitation: the 10-minute window is accepted behavior.**
- **Runner check:** `verify_fix_string: "_fetchLiveBizData"`
- **Future improvement:** Firestore `onSnapshot` listener on staff/hours collection would give real-time updates without the stale window.

---

### RX-011 — In-session reschedule creates duplicate booking
- **Category:** booking_modify
- **Status:** verified_live
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Customer books appointment A, then says "change it to Wednesday 3pm" in the same session. A NEW booking doc was created instead of updating the original. Old booking remained `confirmed`. Vendor saw two confirmed bookings for the same customer.
- **Root cause:** `_earlyCheckReady` block had a branch for when name+phone are already in STATE (added in RX-003 fix). That branch set `biz._bookingState.pendingAction = 'booking_offer'`, overwriting `'modify_booking'`. On the `[BOOKING:]` turn, all three `isModify` conditions failed: `stateUpdate.pendingAction` was `null` (Claude cleared `booking_offer` per PENDING ACTION rule), `_prevPendingAction` was `'booking_offer'` not `'modify_booking'`, `existingBookingId` was `null`. `isModify = false` → `_genBookingId()` → new doc created.
- **Fix:** Added `if (!_inModify)` guard in both branches of `_earlyCheckReady` before setting `pendingAction = 'booking_offer'`. Reschedules preserve `'modify_booking'` so the flag survives to the `[BOOKING:]` turn.
- **Runner check:** `verify_fix_string: "RX-011: do NOT overwrite 'modify_booking'"`
- **Live verification:** `tests/live/rx011-reschedule-live-verify.js` — 12/12 passed. Confirmed: same doc ID preserved after reschedule, no duplicate created, conflict detection intact, pre-fix path confirmed `isModify=false` (the bug).
- **Code:** `_earlyCheckReady` block in `send()` — both `if (_ecs.name && _ecs.phone)` and `else` branches

---

### RX-012 — Conflict message never mentions other available technicians
- **Category:** conflict_handling
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Customer asks for Helen at 2pm. Helen is booked. AI says "Helen is booked — closest times are 1pm, 3pm." Never mentions that Tracy or Lisa are free at 2pm. Customer misses the option of same-time, different-technician.
- **Root cause:** `NailAvailabilityChecker.check()` computed `altSlots` (alternative times for the same staff) but never computed `altStaff` (other staff free at the requested time). `_buildMsg` for `'conflict'` only surfaced `altSlots`.
- **Fix:** Added `altStaff` computation inside the `hasConflict` block in `check()`. Iterates `biz.staff`, skips the conflicted staff and inactive members, checks each member's shift for the date, checks existing bookings for overlap. Zero extra Firestore queries (reuses already-loaded `existing` array). `_buildMsg` appended `staffSuffix` to all three conflict message branches (en/es/vi). `tests/lib/avail-logic.js` updated to mirror the production logic.
- **Runner checks:**
  - Layer 1: `verify_fix_string: "RX-012: find other staff who ARE available"`
  - Layer 3: "conflict result includes altStaff — Tracy and/or Lisa available when Helen booked at 14:00" + "altStaff excludes conflicted staff" + "altStaff empty when all busy"
- **Code:** `NailAvailabilityChecker.check()` hasConflict block + `_buildMsg` conflict key + `tests/lib/avail-logic.js`
- **Confidence gap:** Runner confirms altStaff is computed and included. Whether Claude surfaces it naturally in conversation requires live API testing.

---

### RX-013 — AI ends turns passively — no next step or leading question
- **Category:** conversation_closing
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** After answering hours, price, staff availability, or conflict result, AI ends with a bare statement. No question, no offer. Customer must re-initiate. Conversation stalls.
- **Root cause:** No prompt instruction required every response to close with a forward-leading question or offer. Claude defaulted to informational completeness over conversational momentum.
- **Fix:** Added `=== RESPONSE QUALITY — ALWAYS LEAD ===` section to `_buildPrompt` (after `YOUR RULES`). Specifies required closing patterns per intent (conflict → "Which time works?", hours → "Would you like to book?", etc.) and explicitly lists forbidden passive endings ("Let me know if you need anything", "Feel free to ask", bare statements).
- **Runner check:** `verify_fix_string: "RESPONSE QUALITY — ALWAYS LEAD"`
- **Code:** `_buildPrompt()` — new section between `YOUR RULES` and `INTENT CLASSIFICATION`
- **Confidence gap:** Prompt-level fix. Claude following it requires live API testing against multiple intent types.

---

### RX-014 — Cross-session cancel: AI can't cancel booking from a previous browser session
- **Category:** booking_cancel
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Customer booked in session A, closes browser, returns in session B, says "cancel my appointment". `biz._lastBookingId` and `biz._bookingState.phone` are both gone (sessionStorage cleared). Cancel handler silently did nothing. Additionally, cancel used `status==='confirmed'` only, missing `in_progress`; and cancelled ALL phone-matching bookings instead of just the most recent.
- **Root cause:** Cancel flow depended entirely on same-session state. Prompt already asked for phone cross-session, but JS used raw `snap.docs.forEach` cancel logic (all matches, wrong status filter).
- **Fix:** Cancel handler now queries `customerPhone` (primary) + `phone` legacy field (fallback). Filters for `confirmed|in_progress`. Sorts desc by `createdAt`, cancels ONLY `active[0]` (most recent). Named `_cancelByPhone` logic refactored into shared `_lookupActiveBookingByPhone()` utility (Phase 3).
- **Runner check:** `verify_fix_string: "_lookupActiveBookingByPhone"` + `"|| s === 'in_progress'"`
- **Code:** `nailsalon/receptionist.js` → cancel handler in `send()` ESCALATE:cancel block
- **Confidence gap:** Runner confirms phone query path and in_progress filter. Firestore index on `customerPhone` required. Live testing needed to confirm correct booking is cancelled.

---

### RX-015 — Cross-session modify: services missing from rescheduled booking
- **Category:** booking_modify
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Customer books in session A, returns in session B, says "reschedule". State is empty. Prompt didn't distinguish same-session (carry state) from cross-session (ask for phone first). Claude asked for date/time without knowing what service to reschedule. Final booking had `services=[]` — empty appointment.
- **Root cause:** Modify flow assumed session-persistent state. No lookup-by-phone path existed. Prompt had no cross-session instruction.
- **Fix:** Three changes: (1) Prompt MODIFY section updated with SAME-SESSION vs CROSS-SESSION distinction. (2) New `_xsBookingLookup()`: queries Firestore by phone, finds most recent active booking, pre-populates `biz._bookingState.services/staff/name/existingBookingId`, injects "Found your appointment" message. (3) Trigger in `send()` else block: fires when `pendingAction=modify_booking AND phone newly set AND services=[]`.
- **Runner checks:** `verify_fix_string: "_xsBookingLookup"` + `"CROSS-SESSION: If services/name/phone are NOT in CURRENT BOOKING STATE"`
- **Code:** `nailsalon/receptionist.js` → `_xsBookingLookup()` + `_buildPrompt()` MODIFY section + `send()` else block
- **Confidence gap:** Runner confirms function exists and prompt instruction present. Live testing required for: Firestore lookup timing, pre-populated state used in final booking, correct services in packet.

---

### RX-016 — State machine: malformed Claude STATE fields corrupt booking flow silently
- **Category:** stale_data
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Claude occasionally emitted malformed STATE fields: `"date":"April 15"` (not ISO), `"time":"2 PM"` (not HH:MM), `"services":"Gel Manicure"` (not array), `"lang":"en-US"` (not en/vi/es), `"pendingAction":"reschedule"` (unknown). `_mergeState()` accepted all values blindly, corrupting downstream booking logic.
- **Root cause:** `_mergeState()` did `Object.keys(update).forEach(k => state[k] = update[k])` with zero validation.
- **Fix:** Per-field validation in `_mergeState()`: date must be `YYYY-MM-DD` and not in the past; time must be `H:MM`/`HH:MM`; phone must have 7+ digits (stored as digits-only); services must be an array of non-empty strings; lang must be in `_VALID_LANGS` (`{en,vi,es}`); pendingAction must be in `_VALID_PENDING` (`{booking_offer,modify_booking}`); name must have ≥1 letter. Invalid fields: console.warn + skip. `null` always accepted (clears field). `tests/lib/state-parser.js` updated to mirror this logic.
- **Runner checks:** Layer 1: `_VALID_LANGS`; Layer 2: 12 field-validation unit tests.
- **Code:** `nailsalon/receptionist.js` → `_mergeState()` + `_VALID_LANGS` / `_VALID_PENDING` maps
- **Confidence gap:** Runner fully verifies validation logic (mirrored unit tests). Live testing required to confirm Claude doesn't emit dates that pass format but are semantically wrong.

---

### RX-017 — Tool/lookup hardening: shared utility, ID shortcut, free-staff query (Phase 3)
- **Category:** booking_modify
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** (1) Cancel handler and `_xsBookingLookup()` duplicated the `customerPhone → active bookings` Firestore lookup with no shared abstraction. (2) Modify submission always did an extra Firestore round-trip even when `_xsBookingLookup()` had already found the booking ID. (3) No reusable function for "which staff are free at this date/time?" — required ad-hoc loops.
- **Root cause:** No shared phone→booking utility; modify submission lacked shortcut; no pure free-staff computation.
- **Fix:** (1) `_lookupActiveBookingByPhone(db, vid, phone)`: queries `customerPhone` then `phone` fallback, returns `Promise<docs[]>` sorted desc by `createdAt`. Cancel handler and `_xsBookingLookup()` both use it. (2) Modify submission: checks `confirmedDraft.existingBookingId` (from STATE via `_xsBookingLookup`) then `biz._lastBookingId` before doing any Firestore lookup — skips round-trip when ID is already known. (3) `_findFreeStaff(biz, date, timeStr, durationMins, existing)`: pure function, no Firestore, reuses `_getStaffShift()` + `_overlaps()`, returns names of working conflict-free staff.
- **Runner checks:** `verify_fix_string: "_lookupActiveBookingByPhone"` + `"_findFreeStaff"` + `"skip the Firestore round-trip"`
- **Code:** `nailsalon/receptionist.js` → `_lookupActiveBookingByPhone()`, `_findFreeStaff()`, modify submission block, cancel handler
- **Confidence gap:** Shared utility correctness requires live Firestore testing. `_findFreeStaff` is pure — fully testable with fixtures.

---

### RX-018 — Response quality validator: lang mismatch, incomplete booking, passive endings (Phase 4)
- **Category:** stale_data
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** Three silent quality failures: (1) Claude replied in wrong language — no detection. (2) Claude fired `[ESCALATE:appointment]` with `services=[]` — booking proceeded with no service name. (3) Claude ended mid-booking turns with bare statements — no follow-up question.
- **Root cause:** No JS-side quality check on Claude's response. All issues were prompt-only; if Claude deviated, there was no JS fallback.
- **Fix:** `_validateResponseQuality(biz, clean, escalationType, lang)` called in `callClaude()` step 6. Three checks: (1) Language: `_detectLang(clean)` vs `lang` — `console.warn` on non-English mismatch (warn-only). (2) Booking completeness: on `ESCALATE:appointment`, if `services=[]` → `suppressEscalate=true` → caller sets `escalationType=null` (booking not attempted). (3) Passive ending: no `?` in mid-booking response → `console.warn` (warn-only).
- **Runner check:** `verify_fix_string: "_validateResponseQuality"` + `"suppressEscalate"`
- **Code:** `nailsalon/receptionist.js` → `_validateResponseQuality()` + `callClaude()` step 6
- **Confidence gap:** Language detection depends on `AIEngine.detectLang()`. Suppress behavior requires live testing with Claude emitting `services=[]` escalation.

---

### RX-019 — Hybrid AI router: OpenAI for booking-critical, Gemini for informational (Phase 5)
- **Category:** stale_data
- **Status:** verified_in_runner
- **Filed:** 2026-04-08 · **Fixed:** 2026-04-08
- **Failing behavior:** All AI turns used Claude regardless of turn type. No way to route booking-critical turns to a more reliable structured model or route low-stakes informational turns to a faster/cheaper model.
- **Root cause:** `AIEngine.call()` was a single Claude adapter with no routing. No OpenAI or Gemini adapters existed.
- **Fix:** Extended `ai-engine.js` with three components: (1) `_callOpenAI()`: Bearer auth, system prompt as role:system, response normalised to `{content:[{text}]}`. (2) `_callGemini()`: Gemini 1.5 REST, `assistant→model` role, `system_instruction`, response normalised. (3) `_resolveProvider(intent, altKeys)`: `_HIGH_RISK_INTENTS` (`booking_request`, `modify_booking`, `booking_offer`) → OpenAI when key available; informational → Gemini; default → Claude. `call()` accepts `opts.intent`/`opts.altKeys`; reads `dlc_openai_key`/`dlc_gemini_key` from localStorage; falls back to Claude on provider failure. `receptionist.js` passes `{intent: _routeIntent}` to `AIEngine.call()`.
- **Runner checks:** `verify_fix_string: "_callOpenAI"` + `"_HIGH_RISK_INTENTS"` (ai-engine.js); `"_routeIntent"` (receptionist.js)
- **Code:** `ai-engine.js` → `_callOpenAI()`, `_callGemini()`, `_resolveProvider()`, updated `call()`. `nailsalon/receptionist.js` → `AIEngine.call()` opts param.
- **Confidence gap:** Keys required in localStorage. Live testing needed to confirm all three providers emit valid STATE markers and parse correctly.

---

### RX-020 — Customer conflict check back-to-back false positive traps booking in loop
- **Category:** conflict_resolution
- **Status:** verified_in_runner
- **Filed:** 2026-04-09 · **Fixed:** 2026-04-09
- **Failing behavior:** After the customer has an existing appointment at 3:15 PM (ends 4:15 PM), the system correctly detects a conflict at 3:00 PM and asks "replace it, keep it, or pick a different time?" User chooses "different time." AI correctly resolves that 4:15 PM is the next available slot and proposes it. System re-fires the `customer_conflict` message — because the inline overlap condition used `>=` on the right boundary (`aEnd >= reqStart`), and the existing appointment ends exactly at 4:15 PM (`aEnd === reqStart = 975`). Every attempt to book at 4:15 PM re-triggers the same false conflict. User is permanently trapped in the loop.
- **Root cause:** The customer conflict overlap check (line ~586) used an inline condition `aStart < reqEndMins && (aStart + aDur) >= reqStartMins` instead of `_overlaps()`. `_overlaps(aStart, aEnd, bStart, bEnd)` is defined as `aStart < bEnd && aEnd > bStart` — strict `>` on the right boundary, correctly allowing back-to-back (aEnd === reqStart). The staff conflict check has always used `_overlaps()`. The customer conflict check had a divergent inline condition with `>=`. The comment claimed this was intentional ("to catch exact back-to-back") but it was wrong — back-to-back appointments are legitimate for a customer.
- **Fix:** Replaced inline `(aStart + aDur) >= reqStartMins` with `_overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur)` in the customer conflict loop body. No other changes. Comment updated. Back-to-back is now allowed; genuine overlaps (aEnd > reqStart) are still caught.
- **Runner check:** `assertContains(src, '_overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur)')`
- **Code:** `nailsalon/receptionist.js` → `NailAvailabilityChecker.check()` customer conflict check
- **Confidence gap:** Runner verifies the fix string is present. Live testing needed to confirm 4:15 PM booking completes in production with real Firestore appointment data.

---

### RX-021 — Stale booking state contamination — new booking request inherits previous confirmed time
- **Category:** stale_data
- **Status:** verified_in_runner
- **Filed:** 2026-04-09 · **Fixed:** 2026-04-09
- **Failing behavior:** After a booking completes (e.g., Pedicure/Helen/4:15 PM), the customer starts a new turn and says "book me at 3PM with Helen." The AI immediately books Pedicure/Helen/4:15 PM instead of 3:00 PM. The system reuses stale name/phone from the prior booking and never asks for contact info. The wrong time is written to Firestore.
- **Root cause:** Three compounding issues: (1) `_submitDirectBooking` restores name/phone/services/staff to `biz._bookingState` after booking (required invariant for cancel/modify). (2) `_buildBookingStateContext` emits `BOOKING STATUS: CONFIRMED` while `_lastBookingId && !s.date && !s.time` — indefinitely after any booking. (3) When Claude sees CONFIRMED signal on the next turn, it sets `pendingAction=modify_booking`. With `isModify=true`, the ESCALATE path assigns `existingBookingId = biz._lastBookingId` and calls `_submitDirectBooking` directly, skipping contact-info collection and inheriting the stale 4:15 PM time from the prior ESCALATE STATE.
- **Fix (five-part):** (1) `_submitDirectBooking` stores `biz._lastConfirmedDate`/`biz._lastConfirmedTime`. (2) CONFIRMED signal now includes the confirmed slot and explicitly instructs Claude not to reuse it for new requests. (3) `biz._prevPendingAction` captured before the Claude API call for async callback access. (4) isModify detection gains a stale-time guard: when `modify_booking` came only from this turn's STATE (not prior turn, no `existingBookingId`, no cross-session lookup) AND `bookingData.time === biz._lastConfirmedTime`, `isModify` is cleared. Same guard in early-check path. (5) `_mergeState` clears `_lastBookingId`/`_lastConfirmedTime`/`_lastConfirmedDate` when a fresh `booking_request` with a different time arrives.
- **Guard safety:** Multi-turn reschedule (`_isModFromPrev=true`) bypasses guard. Cross-session reschedule (`_xsLookupDone=true`) bypasses guard. One-turn reschedule to a different time (times differ) bypasses guard. Only the exact stale pattern (same time, only this-turn STATE signal, no prior context) is cleared.
- **Runner checks:** 5 checks — `biz._lastConfirmedTime`, `biz._lastConfirmedDate`, `biz._lastBookingId     = null`, `do NOT reuse the confirmed slot`, `_isModFromState && !_isModFromPrev && !_isModFromId && !biz._xsLookupDone`
- **Code:** `nailsalon/receptionist.js` → `_submitDirectBooking`, `_buildBookingStateContext`, `_handleMessage` (isModify block + prevPendingAction), `send()` early-check, `_mergeState`
- **Confidence gap:** Runner verifies all five guard strings present. Live testing needed to confirm a same-session reschedule immediately after a confirmation correctly routes as `modify_booking` without being incorrectly blocked by the stale-time guard.

---

## What the runner verifies vs does not verify

| Claim | Verified? | How |
|-------|-----------|-----|
| Fix instruction is present in receptionist.js source | ✅ Yes | Static grep (Layer 1) |
| STATE/BOOKING/ESCALATE parsing works correctly | ✅ Yes | Mirrored unit tests (Layer 2) |
| Availability algorithm handles conflicts correctly | ✅ Yes | Mirrored unit + fixture tests (Layer 3) |
| Case files are properly structured | ✅ Yes | Structural validation (Layer 4) |
| Claude follows the prompt instructions | ❌ No | Requires live API test |
| Booking packet renders correct fields | ❌ No | Requires visual/snapshot test |
| Full cancel/modify chain works end-to-end | ❌ No | Requires live API test |
| Correct behavior on real customer input variation | ❌ No | Requires live API test |
| Regression-free after Claude model updates | ❌ No | Requires live API test |
| Firestore query results match mock fixture behavior | ❌ No | Requires live integration test |

---

## How to add a future bug

See `tests/README.md` for the step-by-step workflow.

Quick summary:
1. Create `tests/cases/NNN-short-name.json` with `"status": "known_bug"`, document the failure.
2. Fix the code.
3. Add `verify_fix_string`, set `"status": "verified_in_runner"`.
4. Run `npm run test:receptionist` — must pass.
5. After live verification: update `"status": "verified_live"`.
