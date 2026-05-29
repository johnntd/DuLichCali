# Unified Booking Conflict Guard Report

Date: 2026-05-29

## Status

PASS for static/unit validation and dry-run gates. BLOCKED for authenticated live Firestore runtime verification because this environment does not run a signed-in browser session against production Firestore.

## Prompt

Used `prompts/unified_booking_conflict_guard.md`.

## Engine API

New shared UMD module: `booking-conflict-guard.js`

Exports:
- `BookingGuard.validateUnifiedBookingRequest(request, options)`
- `BookingGuard.guardedWrite(request, writeFn, options)`
- constants: `SERVICE_DEFAULTS`, `BLOCKING_STATUSES`, `NON_BLOCKING_STATUSES`, `SERVICE_RADIUS_MILES`

The factory declares:

```js
var root = (typeof window !== 'undefined') ? window : globalThis;
```

The browser export is `window.BookingGuard`; Node tests use `module.exports`.

## Defaults

Per-service defaults are centralized in `BookingGuard.SERVICE_DEFAULTS`:

| Service | Duration | Travel buffer |
|---|---:|---:|
| barber | 45 minutes | 20 minutes |
| ride | 90 minutes | 15 minutes |
| tour | 480 minutes | 30 minutes |

Blocking statuses:
`pending`, `pending_confirmation`, `pending_barber_confirmation`, `confirmed`, `accepted`, `in_progress`, `traveling`, `vendor_review`.

Non-blocking statuses:
`cancelled`, `rejected`, `completed`, `expired`, `no_show`.

## Conflict Sources

The guard queries only single-field equality queries with `limit(250)`:
- `mobileBarberBookings.where('vendorId', '==', vendorId)` for each owned barber vendor.
- `bookings.where('ownerId', '==', ownerId)`.
- `travel_bookings.where('ownerId', '==', ownerId)`.

No composite index is introduced.

## Atomicity Mechanism

Chosen mechanism: deterministic Firestore lock document.

`guardedWrite()` validates once, then runs a Firestore transaction against:

```text
bookingConflictLocks/{ownerId}:{YYYY-MM-DD}:{15-minute-window-start}
```

If the lock exists, the second request returns `time_conflict`. If the lock is absent, the transaction creates it and performs the caller-provided write through the same transaction when possible. This gives a pre-write re-check/lock barrier so two identical near-simultaneous requests cannot both pass in the tested path.

## Integration Points Touched

- `mobile-barber/mobile-barber-booking.js`
  - `checkBookingOverlap()` delegates to `BookingGuard._evaluate()` when available.
  - `saveBooking()` uses `BookingGuard.guardedWrite()` for owner-stamped barber bookings.
- `ride-intake.js`
  - Ride web-intake Firestore booking write is wrapped in `BookingGuard.guardedWrite()`.
- `travel-booking.js`
  - Canonical `travel_bookings` write is wrapped in `BookingGuard.guardedWrite()`.
- HTML consumers load `booking-conflict-guard.js?v=20260529a` before booking modules:
  - `index.html`
  - `airport.html`
  - `travel.html`
  - `mobile-barber/index.html`
  - `mobile-barber/vendor.html`
  - `mobile-barber/dashboard.html`

Notes:
- Existing Luxurious Nails files under `nailsalon/` were not modified.
- `driver-admin.html` was not modified.
- The broad AI write sites in `workflowEngine.js`, `chat.js`, `marketplace/marketplace.js`, and legacy homepage `script.js` were not functionally changed in this patch. They still require live-path audit/guard wrapping before claiming every booking creation path is covered end to end.

## Version String Bumps

New or changed script consumers:
- `booking-conflict-guard.js?v=20260529a`
- `mobile-barber/mobile-barber-booking.js?v=20260529a`
- `ride-intake.js?v=20260529a`
- `travel-booking.js?v=20260529a`

Also bumped homepage loader references for modules on the booking surface:
- `workflowEngine.js?v=20260529a`
- `script.js?v=20260529a`

## Test Results

`node tests/runner.js`: PASS, 474 passed, 0 failed.

The added 14 guard tests cover:
1. Barber 9:00-9:45 plus buffer blocks ride at 9:30.
2. Barber 9:00-9:45 allows ride at 10:30.
3. Ride blocks overlapping tour.
4. Tour blocks overlapping barber.
5. Cancelled/rejected/completed/expired do not block.
6. Pending/confirmed/in_progress/traveling block.
7. Same customer same-time duplicate returns `customer_duplicate`, likely.
8. Same customer different non-overlapping time remains available.
9. Phone normalization matches `+1 (408) 916-3439` to `4089163439`.
10. Lat/lng over 30 miles returns `outside_service_radius`.
11. Lat/lng within 30 miles is not radius-blocked.
12. Unknown location returns `vendor_review_required`, `withinServiceRadius: null`.
13. Suggested slots return 3-5 conflict-free windows.
14. Simulated lock race allows one write and blocks the second as `time_conflict`.

## Commands Run

```bash
scripts/ai/targeted_dry_run.sh booking
node --check booking-conflict-guard.js
node --check mobile-barber/mobile-barber-booking.js
node --check ride-intake.js
node --check travel-booking.js
node --check tests/runner.js
node --check tests/lib/mobile-barber-landing.js
node tests/runner.js
scripts/ai/full_system_dry_run.sh
```

## Dry Run Result

`scripts/ai/full_system_dry_run.sh` ended:

```text
FINAL: PASS
```

## Remaining Risks

- Live Firestore behavior, auth-specific security rules, and browser UI rejection routing are not verified here.
- Not every AI/voice booking writer is wrapped yet. The guard is available globally, but broad AI write paths need a second scoped patch to route their booking writes through `BookingGuard.guardedWrite()`.
- Location heuristics are conservative. Unknown locations return `vendor_review_required`, which is correct per prompt but may surface as blocked submissions until the UI/AI layer maps the machine reason through the existing language channel.

## Next Command

```bash
scripts/ai/targeted_dry_run.sh ai-receptionist
```

---

## Claude Audit Follow-Up: Iteration 2

Date: 2026-05-29

Prompt used: `prompts/booking_guard_ai_paths_and_vietnamese_voice.md`.

Status:
- PASS for static/unit validation and full dry run.
- PASS for targeted dry runs: `booking`, `marketplace`, and `ai-receptionist`.
- BLOCKED for authenticated live Firestore runtime verification.
- BLOCKED for long-session LLM Vietnamese/Spanish drift verification; this requires an authenticated live mobile-barber chat/voice session.

### Claude Findings Addressed

- Removed the out-of-scope Owner Notification Center from this diff:
  - `mobile-barber/mobile-barber-dashboard.js` is no longer changed.
  - `mobile-barber/mobile-barber.css` is no longer changed.
  - `mobile-barber/dashboard.html` keeps only the required `booking-conflict-guard.js` loader and `mobile-barber-booking.js` version bump.
- `chat.js`:
  - Replaced the modified booking-finalize catch fallback that returned a hardcoded Vietnamese retry string.
  - Non-guard booking save failures now route an English `[SYSTEM: booking_error_retry]` note through `callClaude()` first.
- `workflowEngine.js`:
  - Added explicit documentation that `runGuardedBookingWrite()` guard rejections intentionally propagate with `error.guardResult` for `chat.js` to convert into an English `[SYSTEM: ...]` AI note.
- `ride-intake.js`:
  - Added visible `console.warn('[ride-intake] booking guard skipped - no ownerId resolved')` when `BookingGuard` is present but owner resolution fails.
  - Added static test coverage proving the write path calls `BookingGuard.guardedWrite()`.
- `travel-booking.js`:
  - Added `_pickupRegion || 'bayarea'` owner-resolution fallback before creating the guard request.
  - Added visible `console.warn('[travel-booking] booking guard skipped - no ownerId resolved')` when `BookingGuard` is present but owner resolution still fails.
- `mobile-barber/mobile-barber-booking.js`:
  - Added a comment clarifying that `_evaluate()` in `checkBookingOverlap()` is synchronous pre-validation only and `saveBooking()` / `guardedWrite()` remains the authoritative atomic check.
- `script.js`:
  - Removed customer-visible raw `guardResult.reason` from the homepage warning.
  - Raw guard details now go to `console.warn`; the visible form warning is generic.
- `marketplace/marketplace.js`:
  - Reconfirmed as not writing top-level `bookings`, `travel_bookings`, or `mobileBarberBookings`.
  - Static test now distinguishes vendor subcollection orders under `vendors/{id}/bookings` from guarded owner-wide booking collections.
- `scripts/ai/targeted_dry_run.sh`:
  - Fixed the `ai-receptionist` syntax-stability fallback so a browser-global `require()` failure can fall through to static parsing instead of falsely failing the scope.
  - No `nailsalon/` files were modified.

### Version String Bumps

- `index.html`
  - `ride-intake.js?v=20260529c`
  - `workflowEngine.js?v=20260529c`
  - `chat.js?v=20260529c`
  - `script.js?v=20260529c`
- `airport.html`
  - `ride-intake.js?v=20260529c`
- `travel.html`
  - `travel-booking.js?v=20260529c`
- `mobile-barber/index.html`, `mobile-barber/vendor.html`, `mobile-barber/dashboard.html`
  - `mobile-barber/mobile-barber-booking.js?v=20260529c`

### Commands Run

```bash
node --check booking-conflict-guard.js
node --check chat.js
node --check workflowEngine.js
node --check ride-intake.js
node --check travel-booking.js
node --check script.js
node --check mobile-barber/mobile-barber-agent.js
node --check mobile-barber/mobile-barber-booking.js
node --check tests/lib/mobile-barber-agent.js
node --check tests/lib/mobile-barber-landing.js
node --check tests/runner.js
bash -n scripts/ai/targeted_dry_run.sh
git diff --check
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/targeted_dry_run.sh marketplace
scripts/ai/targeted_dry_run.sh ai-receptionist
scripts/ai/full_system_dry_run.sh
```

### Results

- `node tests/runner.js`: PASS, 484 passed, 0 failed.
- `scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`.
- `scripts/ai/targeted_dry_run.sh marketplace`: `FINAL: PASS`.
- `scripts/ai/targeted_dry_run.sh ai-receptionist`: `FINAL: PASS`.
- `scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`.

### Remaining Risks

- Live Firestore transaction/security-rule behavior is not verified in this environment.
- LLM language-drift prevention remains runtime-only; static prompt tests pass, but long-session compliance must be checked in a live authenticated mobile-barber session.
- Homepage form rejection has no AI response loop, so it uses the existing form warning surface instead of the chat `[SYSTEM: ...]` path.

### Next Command

```bash
scripts/ai/full_system_dry_run.sh
```

Recommended next scope: wrap `workflowEngine.js`, `chat.js`, `marketplace/marketplace.js`, and legacy homepage `script.js` booking write sites with the shared guard, then run the full dry run again.

---

## Follow-up: AI/Voice/Manual Coverage + Barber AI Language Lock

Date: 2026-05-29

Prompt used: `prompts/booking_guard_ai_paths_and_vietnamese_voice.md`.

Status:
- PASS for static/unit validation and full dry run.
- BLOCKED for authenticated live Firestore runtime verification.
- BLOCKED for LLM language-drift runtime confirmation; this requires an authenticated live mobile-barber voice/chat session over a long Vietnamese conversation.

### Newly Guarded Paths

- `workflowEngine.js` airport pickup/dropoff AI workflow:
  - Wrapped the top-level `bookings` write in `runGuardedBookingWrite()`, which calls `BookingGuard.guardedWrite()`.
  - Guard request includes `ownerId`, `serviceType`, customer name/phone/email, `requestedStart`, 90-minute ride duration, 15-minute buffer, address/city, and `source: ai_chat_workflow`.
  - Guard runs before admin notification, ride notification, dispatch queue, and customer notification side effects.
- `workflowEngine.js` tour AI workflow:
  - Wrapped the top-level `bookings` tour write in `runGuardedBookingWrite()`.
  - Guard request normalizes `serviceType: tour`, uses pickup/start location, duration days * 480 minutes, 30-minute buffer, and `source: ai_chat_workflow`.
  - Guard runs before admin notification side effects.
- `workflowEngine.js` private ride AI workflow:
  - Wrapped the top-level `bookings` write in `runGuardedBookingWrite()`.
  - Guard request includes private ride owner, customer identity, pickup location, estimated duration or 90 minutes, 15-minute buffer, and `source: ai_chat_workflow`.
  - Guard runs before admin notification, ride notification, dispatch queue, and customer notification side effects.
- `script.js` legacy homepage booking form:
  - Wrapped the top-level `bookings` write in `BookingGuard.guardedWrite()` when `BookingGuard` and `ownerId` are available.
  - Guard request includes owner, service bucket, customer identity, requested start, ride/tour duration, buffer, address/city, and `source: homepage_legacy_form`.

### Confirmed No Double Guard / No Write Needed

- `mobile-barber/mobile-barber-agent.js` AI, voice, and manual paths still delegate booking creation to `MobileBarberBooking`; `MobileBarberBooking.saveBooking()` already calls `BookingGuard.guardedWrite()`. Left unchanged.
- `chat.js` does not write bookings directly; it calls `DLCWorkflow.finalize()`. Added guard-error routing only.
- `ride-avail.js` reads `bookings` for availability display and does not write bookings. Left unchanged.
- `marketplace/marketplace.js` writes food/vendor subcollection orders under `vendors/{id}/bookings`, not the owner-wide `bookings`, `travel_bookings`, or `mobileBarberBookings` guard collections. Left unchanged.
- `workflowEngine.js` nail/hair appointment writes remain outside this owner-wide guard patch because the current guard defaults/API cover `barber`, `ride`, and `tour`, and this task explicitly forbids changing Luxurious Nails behavior.

### Guard Rejection Routing

- `chat.js` now detects `error.guardResult` from `DLCWorkflow.finalize()`.
- It sends an English-only system note to the AI as `[SYSTEM: booking_guard_<reason>]`.
- The AI is responsible for replying in the customer language; the technical marker is not shown when the AI path succeeds.

### Mobile-Barber AI Brain Prompt Change

Updated `_buildAIBrainPrompt(state, ctx, lang)` in `mobile-barber/mobile-barber-agent.js` only:
- First line is now a strong `LANGUAGE LOCK` naming `English`, `Tiếng Việt`, or `Español`.
- Last line restates the same `FINAL LANGUAGE LOCK`.
- Added `=== LANGUAGE ===`, `=== VIETNAMESE OUTPUT RULES ===`, and `=== SPANISH OUTPUT RULES ===` sections adapted from the nail brain pattern.
- Removed unfenced English visible-response examples from the marker section; examples are now data-only `[STATE:{...}]` markers.
- Added `=== AVAILABILITY AND CONFLICT GUARD — CRITICAL RULE ===`, explicitly telling the AI that `BookingGuard`/backend validation owns availability, duplicate risk, service area, and owner-wide conflicts.
- Preserved `[STATE:{...}]`, `_parseStateMarker()`, and `_stripMarkers()` behavior.

### Returning-Customer Lookup Parity

Verified parity already exists:
- `MobileBarberBooking.lookupReturningCustomer()` performs phone-first lookup against local records, customer records, then booking records.
- `MobileBarberAgent.handleMessageAsync()` calls `customerLookupProvider()`, then sends `customer_lookup_hit`, `customer_lookup_miss`, or `customer_lookup_error` through the AI brain as `[SYSTEM: ...]`.
- Found-record paths greet/offer saved address through `foundCustomer` / `foundCustomerNoAddress`; not-found paths ask for the booking name. No runtime change was needed.

### Version String Bumps

- `index.html`
  - `workflowEngine.js?v=20260529b`
  - `chat.js?v=20260529b`
  - `script.js?v=20260529b`
- `mobile-barber/index.html`
  - `mobile-barber-agent.js?v=20260529b`
- `mobile-barber/vendor.html`
  - `mobile-barber-agent.js?v=20260529b`

Checked `git log --all -G "20260529b" -- '*.html'`; no prior deployed use was found.

### Tests Added/Extended

- `tests/runner.js`
  - Static coverage for guarded `workflowEngine.js` airport, tour, and private ride writes.
  - Static coverage for `chat.js` guard rejection → English `[SYSTEM: ...]` AI path.
  - Static coverage for legacy homepage `script.js` guarded write.
- `tests/lib/mobile-barber-agent.js`
  - Vietnamese prompt must have strong language lock at first and last line.
  - Spanish prompt must have strong language lock at first and last line.
  - English prompt still works.
  - Prompt must not include the old unfenced English visible-response example.
- `tests/lib/mobile-barber-landing.js`
  - Updated script-version assertions to `20260529b`.

### Commands Run

```bash
scripts/ai/targeted_dry_run.sh booking
scripts/ai/targeted_dry_run.sh ai-receptionist
scripts/ai/targeted_dry_run.sh marketplace
node --check workflowEngine.js
node --check chat.js
node --check script.js
node --check mobile-barber/mobile-barber-agent.js
node --check tests/lib/mobile-barber-agent.js
node --check tests/lib/mobile-barber-landing.js
node --check tests/runner.js
node tests/runner.js
scripts/ai/full_system_dry_run.sh
```

### Results

- `scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`
- `scripts/ai/targeted_dry_run.sh marketplace`: `FINAL: PASS`
- `scripts/ai/targeted_dry_run.sh ai-receptionist`: baseline `FINAL: FAIL` before edits due to a `nailsalon/receptionist.js` syntax-stability check; `nailsalon/` files were not touched per constraint.
- `node tests/runner.js`: PASS, 481 passed, 0 failed.
- `scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`

### Remaining Risks

- Live Firestore transaction/security-rule behavior is not verified in this environment.
- LLM long-session Vietnamese/Spanish drift cannot be honestly marked PASS without live authenticated runtime testing.
- Legacy homepage `script.js` has no AI reply loop; guard rejection is shown in its existing form warning path, while AI workflow rejection goes through `[SYSTEM: ...]`.
- Guard owner resolution must produce an `ownerId`; if a future service/region has no owner mapping, the guard cannot enforce owner-wide conflicts for that path until the mapping exists.

### Next Command

```bash
scripts/ai/targeted_dry_run.sh ai-receptionist
```

### Final Iteration 2 Validation Update

After fixing the `ai-receptionist` dry-run syntax fallback in `scripts/ai/targeted_dry_run.sh`, the final validation state is:

- `scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`
- `scripts/ai/targeted_dry_run.sh marketplace`: `FINAL: PASS`
- `scripts/ai/targeted_dry_run.sh ai-receptionist`: `FINAL: PASS`
- `node tests/runner.js`: PASS, 484 passed, 0 failed
- `scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`
