# Mobile Barber — Smart Duplicate / Spam Intent Guard

**Date:** 2026-05-31
**Scope:** all booking paths (manual, AI chat, voice, promotion, service-card/AI-style)
**Goal:** never silently create a suspicious duplicate same-day haircut for the same person; verify intent (self-reschedule vs family member) first; rate-limit spam.

---

## Root cause

The guarded create (`createMobileBarberBookingGuarded`) only checked **time overlap** — it blocked two bookings competing for the same slot, but it had **no notion of the same customer**. So one person could submit a second haircut the same day at a *different* time (duplicate submit, confusion, spam) and it was written silently. There was also no rate limit.

Because the customer flow is anonymous (Firestore rules block reading other bookings client-side), this **must** be enforced server-side (Admin SDK). All five booking paths already funnel through one writer — `BOOKING.saveBooking → guardedCreateViaCallable → createMobileBarberBookingGuarded` — so enforcing in the callable covers every path against *silent* duplicates; the frontend then drives the intent conversation/modal.

---

## Guard design (server-authoritative)

`createMobileBarberBookingGuarded` (functions/index.js) now, in order:

1. **Identity** — normalize the request's phone (last-10) + email. Same customer = same normalized phone **or** email (`mbSameCustomer`). It scans the owner's bookings across `mobileBarberBookings` / `bookings` / `travel_bookings`, capturing each active booking's customer identity, window, service and date.
2. **Spam / abuse** — block (`TOO_MANY_REQUESTS`) when the same customer has **≥5** bookings in 24h (any status, incl. cancelled), or **≥3** active same-day haircuts and this is *not* a verified family booking.
3. **Exact / overlapping (same customer)** — `DUPLICATE_EXACT` (same start) or `CUSTOMER_OVERLAP` (overlapping window). Hard block — a barber can't do two haircuts at once, and a family member can't occupy an overlapping slot either.
4. **Generic time overlap (different customer)** — unchanged `time_conflict` (the double-booking guard) with suggested free times.
5. **Same-day, non-overlapping haircut (same customer)** — `SAME_DAY_DUPLICATE_NEEDS_INTENT` unless intent is already verified. Carries the `existing` booking(s) so the UI can name the time. Risk reasons: `within_4h`, `multiple_same_day`, `same_service_same_day`.
6. **Cleared** — write, **or**:
   - `self_reschedule` + `linkedExistingBookingId` → **move the existing booking in place** (no second doc) → `OK_RESCHEDULED`.
   - verified `family_member` + `familyMemberName` → write with `bookingFor='family_member'` → `OK_FAMILY_MEMBER` (a verified family booking that pushes the same-day count to ≥3 is allowed but routed to `vendor_review`, not silently piled up).
   - otherwise → normal write (`bookingFor='self'`).

Every decision logs `[duplicate-intent-check] { customerPhone, requestedStart, existingActiveBookings, sameDayHaircuts, recent24h, riskScore, riskReasons, result }`. Stored on the booking: `duplicateRiskScore`, `duplicateRiskReasons`, `bookingFor`, `duplicateIntentVerified`, `duplicateIntentType`, `familyMemberName`, `familyMemberAgeGroup`, `primaryCustomerPhone`, `primaryCustomerName`.

**Active vs ignored statuses** match the spec — active: pending / pending_confirmation / pending_barber_confirmation / vendor_review / confirmed / accepted / in_progress; ignored (`MB_NON_BLOCKING`): cancelled / rejected / declined / completed / expired / no_show.

### Backend response codes
`DUPLICATE_EXACT` · `CUSTOMER_OVERLAP` · `time_conflict` · `SAME_DAY_DUPLICATE_NEEDS_INTENT` · `TOO_MANY_REQUESTS` · `OK_RESCHEDULED` · `OK_FAMILY_MEMBER` · `OK`.

---

## Frontend changes (no silent success)

| Path | Where | Behavior on `SAME_DAY_DUPLICATE_NEEDS_INTENT` |
|---|---|---|
| **booking layer** | `mobile-barber-booking.js` `guardedCreateViaCallable` | maps codes → structured errors: `duplicateIntent` (existing + reasons), `bookingConflict` (exact/overlap/time), `bookingSpam`. `applyDuplicateIntent(booking, decision)` stamps family/reschedule fields for the re-submit. |
| **AI chat** | `mobile-barber.js` `sendAgentMessage` + `resolveDuplicateIntent` | stashes the attempt on the session, asks: *"I see you already have a haircut today at {time}. Did you mean to change that appointment, or is this for someone else in your family?"* Next turn = the answer → reschedule / ask family name → book / cancel. |
| **voice** | same controller (`sendMessage = sendAgentMessage`) | identical conversational flow; the question is spoken, the next transcript is the answer. |
| **manual** | `mobile-barber.js` `submitManualBooking` → `showDuplicateIntentModal` | modal: **Change my existing appointment** / **Book for a family member** (reveals name input) / **Cancel this request**. |
| **service-card / AI-style** | `submitInlineStyleBooking` | same modal. |

All intent strings are multilingual (vi / en / es) — added to the `STRINGS` tables (`dupIntentQuestion`, `dupAskFamilyName`, `dupRescheduled`, `dupFamilyBooked`, `dupCancelled`, `dupUnclear`, `dupSpam`, `dupModal*`, `dupBtn*`). No path shows "booked/confirmed" until the guarded write returns success.

### AI chat behavior
- ❌ never "Great, booked again!"
- ✅ asks intent on a same-day duplicate; on "for me" offers a **reschedule** (moves the existing booking, no duplicate); on "family member" asks **who**, then books `bookingFor=family_member`; on "mistake/cancel" creates nothing.

---

## Tests

- **Dry run:** `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` (**557 passed, 0 failed**), incl. 5 new client-contract tests (intent-needed → no write; exact/overlap → hard conflict; spam → blocked; verified family → accepted; self-reschedule → linked id, no second write).
- **Live (deployed callable):** `tests/live/mb-duplicate-intent-verify.js` covers same-customer exact-block, overlap-block, same-day-needs-intent (+ carries existing), verified-family-accept, self-reschedule (moves existing, no second booking), and 4th-same-day spam block.
- **Double-booking regression:** `tests/live/mb-frontend-guarded-create-verify.js` updated to use a *different* customer for the time_conflict case (so it still proves the pure double-booking block; same-customer cases moved to the new live test).

### 13-scenario coverage
| # | Scenario | Enforced by | Status |
|---|---|---|---|
| 1 | Same exact time → blocked | backend `DUPLICATE_EXACT` | ✅ |
| 2 | Overlapping time → blocked | backend `CUSTOMER_OVERLAP` | ✅ |
| 3 | Same day, 2h apart → asks intent | backend `SAME_DAY_DUPLICATE_NEEDS_INTENT` | ✅ |
| 4 | "same person" → reschedule, no dup | `self_reschedule` → `OK_RESCHEDULED` | ✅ |
| 5 | "for my son" → ask name, family booking | `OK_FAMILY_MEMBER` | ✅ |
| 6 | unclear answer → no booking | controller `dupUnclear` (no save) | ✅ |
| 7 | manual duplicate → modal | `showDuplicateIntentModal` | ✅ |
| 8 | AI chat duplicate → asks intent | `resolveDuplicateIntent` | ✅ |
| 9 | voice duplicate → asks intent | shared controller | ✅ |
| 10 | rapid double-submit → one booking | deterministic id idempotency | ✅ |
| 11 | >3 same-day same phone → blocked/review | `TOO_MANY_REQUESTS` / vendor_review | ✅ |
| 12 | Tim + Michael routing still works | untouched routing | ✅ (dry run) |
| 13 | legit family package still works | verified-family intent flow | ✅ |

---

## Verdict
**PASS** — the system no longer silently creates suspicious duplicate same-day haircut bookings for the same person on any path. Same-customer exact/overlap is hard-blocked; same-day duplicates require verified intent (reschedule or named family member) before a write; spam is rate-limited; all enforced server-side and surfaced as a guided conversation/modal on the frontend.

## Remaining risks
- Same-customer matching is phone-OR-email (low false positive); a customer using two different phones for self + family would not be linked (acceptable — both are then legitimate-looking).
- The pre-write check is read-then-write (not a transaction); the `onMobileBarberBookingCreated` trigger remains the race net for truly simultaneous writes.
- `>5 attempts/24h` counts owner-scoped same-customer bookings (incl. cancelled); a very large family (6+ same-day) hits the cap and must be added by the barber.

## Verify on prod (post-deploy)
`node tests/live/mb-duplicate-intent-verify.js` and `node tests/live/mb-frontend-guarded-create-verify.js`.
