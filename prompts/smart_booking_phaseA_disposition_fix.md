# Phase A — Three-way booking disposition (confirm / review / block) + fix tour hard-block

## GOAL

Stop hard-rejecting ambiguous bookings. Replace the guard's binary
`ok = (reason === 'available')` model with an explicit **disposition** that all callers
react to:

| disposition | meaning | caller behavior |
|---|---|---|
| `confirm` | clean, no conflict, in service area | write booking with its normal status |
| `review`  | ambiguous (time overlap, unverifiable/edge location) | write booking with status `vendor_review` + queue for Michael; tell customer it is pending confirmation |
| `block`   | true hard conflict (same customer duplicate, invalid request) | do NOT write; show error |

This is the owner's binding decision: time conflicts and edge/unverifiable locations are
**queued for Michael**, never silently rejected. The disposition decision lives ONLY in
the guard — callers must not re-derive it.

## CONTEXT — read before editing

`booking-conflict-guard.js` (UMD `window.BookingGuard`):
- `evaluate(req, rows, options)` computes `reason` with this precedence:
  `customer_duplicate` > `time_conflict` > `outside_service_radius`
  (`withinServiceRadius === false`) > `vendor_review_required` (`resolvable === false`) >
  `available`. It returns via `finish(reason === 'available', reason, ...)`.
- `finish(ok, reason, conflicts, requested, dup, radius, ...)` builds the result object.
- `guardedWrite(req, writeFn, options)` validates, and currently `if (!result.ok) return result;`
  i.e. it ABORTS the write for every non-`available` reason. It also takes a 15-minute
  bucket lock at `bookingConflictLocks` inside a transaction before calling `writeFn`.

The tour hard-block: `travel-booking.js` (~lines 870–946) builds `guardReq` with
`city:''`, `zip:''`, a `pickupAddress`, and NO lat/lng. The guard returns
`vendor_review_required` → `ok:false` → the caller throws
`new Error('booking_guard_' + guardResult.reason)` → the catch shows
`showWizardError('Booking failed ...')`. So tours never get written.

## TASKS

### 1. `booking-conflict-guard.js` — add `disposition`
- In `finish()`, add a `disposition` field to the output, derived from `reason`:
  - `available` → `confirm`
  - `customer_duplicate`, `invalid_request` → `block`
  - `time_conflict`, `outside_service_radius`, `vendor_review_required` → `review`
  - any unknown reason → `review` (fail safe — never silently drop a booking)
- Keep `ok` for backward compatibility but define it as `disposition === 'confirm'`.
- Also expose a small pure helper `dispositionFor(reason)` on the returned module object
  and reuse it inside `finish()` (single source of truth; tests will call it directly).
- `guardedWrite`: change the early abort from `if (!result.ok) return result;` to
  `if (result.disposition === 'block') return result;`. For `confirm` and `review`,
  proceed to the lock + write path exactly as today, BUT pass the disposition info into
  the write callback so the caller can tag the doc:
  `writeFn(tx, { disposition: result.disposition, reason: result.reason })` (the existing
  non-transaction branch must pass the same object: `writeFn(null, {...})`). `writeFn`
  may ignore the argument (back-compat) — verify existing call sites still work.
- The lock-collision fallback inside `guardedWrite` currently returns
  `finish(false, 'time_conflict', ...)`. Keep it, but it must now carry
  `disposition: 'review'` (a lock collision means a near-simultaneous booking → queue for
  Michael, do not hard-reject). Confirm `dispositionFor('time_conflict')` already yields
  `review` so no special-casing is needed.

### 2. Update EVERY guard caller to the disposition model
Find them: `grep -rn "BookingGuard\|validateUnifiedBookingRequest\|guardedWrite\|booking_guard_" . --include="*.js"`.
Known call sites: `travel-booking.js`, `workflowEngine.js`, `script.js`, `ride-intake.js`,
`mobile-barber/mobile-barber-booking.js`. For each:
- Replace any `if (guardResult.ok === false) throw ...` / abort logic with a
  three-way branch on `guardResult.disposition`:
  - `block` → keep the existing error/abort behavior (do not write).
  - `review` → WRITE the booking but force its status to `vendor_review`, and store
    `reviewReason: guardResult.reason` (+ `reviewConflicts: guardResult.conflicts` where a
    field already exists for it) on the doc so Phase D can render it. Then tell the
    customer the booking is pending confirmation (see task 3).
  - `confirm` → write with the booking's normal/intended status, as today.
- For callers that use `guardedWrite`, set the status inside their `writeFn` based on the
  `{ disposition }` argument now passed in.
- **`travel-booking.js` specifically:** this is the headline fix. After the change, a tour
  with no resolvable geo must be WRITTEN as `vendor_review` (not throw). Also pass any
  real lat/lng the wizard already has (if the booking doc carries coordinates, forward them
  as `lat`/`lng` on `guardReq`); if none exist, leave them out — the guard will route to
  `review`, which is now correct, not fatal.

### 3. Customer-facing "pending review" message (RULE #2 — no hardcoded strings)
When disposition is `review`, the customer must be told the booking is received and pending
confirmation — in their own language. Do NOT hardcode vi/en/es text. Use the path each
caller already uses:
- AI/chat callers (workflowEngine, script.js, mobile-barber AI): push an English-only
  system note into the AI history, e.g.
  `[SYSTEM: booking_pending_review reason=<reason>; tell the customer their booking was
  received and is pending confirmation by the provider, in the customer's language]`, then
  let the AI respond. Never write the user-facing sentence directly.
- Form/wizard callers (travel-booking.js wizard, ride-intake.js): if a `t(key)`/translation
  table exists in that module, add a `bookingPendingReview` key with vi+en+es and show it on
  the success screen; if no table exists in that module, add the three entries to the
  nearest existing i18n table it already imports. The success UI must show a *pending*
  state, not a hard error and not a false "confirmed".

### 4. Tests
Extend the existing booking guard test (find via `grep -rln "BookingGuard\|booking-conflict-guard" tests`):
- `dispositionFor` maps each reason to the correct bucket (confirm/review/block).
- A request that overlaps an existing blocking booking → `disposition: 'review'` (NOT block).
- A request with no resolvable geo (`city:''`,`zip:''`, no lat/lng, has pickupAddress) →
  `disposition: 'review'`.
- A same-customer duplicate (same phone, overlapping, same service) → `disposition: 'block'`.
- A clean request → `disposition: 'confirm'`.
- `guardedWrite` writes (calls writeFn) for `review`, and does NOT call writeFn for `block`.

## Allowed files
- `booking-conflict-guard.js`
- `travel-booking.js`
- `workflowEngine.js`
- `script.js`
- `ride-intake.js`
- `mobile-barber/mobile-barber-booking.js`
- `index.html`
- `travel.html`
- `airport.html`
- `driver-admin.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `tests/lib/booking-conflict-guard.js`
- `tests/lib/owner-account-model.js`
- `docs/smart_booking_phaseA_disposition_report.md`

## DO NOT BREAK
- Single-service vendor / single-service booking flows must behave identically when
  disposition is `confirm` (the common case).
- Do NOT change Firestore rules, Cloud Functions, or any other-service WRITE path.
- Guard queries stay single-equality + `.limit()` — no new composite index.
- `customer_duplicate` and `invalid_request` MUST stay hard `block` (no accidental
  duplicate bookings).

## RULES
- No hardcoded user-facing strings in any language (see task 3).
- Bump `?v=` for every edited `.js` in every HTML consumer (grep to find them); verify the
  new version string is unused via `git log --all`. Floor: `20260529e` or higher.
- No deploy, no push, no commit.

## VERIFICATION
```bash
node --check booking-conflict-guard.js
node --check travel-booking.js && node --check workflowEngine.js && node --check script.js
node --check ride-intake.js && node --check mobile-barber/mobile-barber-booking.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

## REPORT
Write `docs/smart_booking_phaseA_disposition_report.md`: what changed (guard + each caller),
exact `?v=` bumps, test results with output excerpts, do-not-break verification, and an
honest PASS/BLOCKED (live authenticated Firestore booking of a real tour to confirm the
`vendor_review` write end-to-end is BLOCKED in this sandbox — say so).
