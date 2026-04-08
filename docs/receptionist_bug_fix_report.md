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
