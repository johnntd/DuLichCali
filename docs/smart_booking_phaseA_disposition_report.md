# Smart Booking Phase A Disposition Report

Date: 2026-05-29

## Result

PASS for static/unit/dry-run validation.

BLOCKED for live authenticated Firestore end-to-end confirmation of a real tour write as `vendor_review`: this sandbox does not have authenticated production Firestore access and must not write real booking/customer data during validation.

## Prompt

Used `prompts/smart_booking_phaseA_disposition_fix.md` as the source of truth.

## What Changed

### Guard

- `booking-conflict-guard.js`
  - Added exported pure helper `dispositionFor(reason)`.
  - Added `disposition` to every guard result.
  - Re-defined `ok` as backward-compatible `disposition === 'confirm'`.
  - Mapped:
    - `available` -> `confirm`
    - `customer_duplicate`, `invalid_request` -> `block`
    - `time_conflict`, `outside_service_radius`, `vendor_review_required`, unknown reasons -> `review`
  - Changed `guardedWrite()` to abort only on `block`.
  - `confirm` and `review` now continue through the lock/write path.
  - `writeFn` receives guard metadata: `{ disposition, reason, conflicts }`.
  - Lock collision still returns `time_conflict`, now with `disposition: 'review'`.

### Callers

- `travel-booking.js`
  - `review` writes the tour as `status: 'vendor_review'`.
  - Stores `reviewReason` and `reviewConflicts`.
  - No longer throws for `vendor_review_required`, fixing the no-geo tour hard-block.
  - Forwards `lat`/`lng` if present on the booking doc; otherwise leaves them absent so the guard routes to `review`.
  - Added `bookingPendingReviewTitle` / `bookingPendingReview` i18n keys for en/vi/es and uses them on the success screen.

- `workflowEngine.js`
  - Shared wrapper now throws only on `block`.
  - AI airport ride, tour, and private ride write callbacks set `vendor_review` for `review`.
  - Stores `reviewReason` and `reviewConflicts` on review bookings.
  - Ride dispatch state uses the persisted booking status and review reason so the existing chat response path presents a pending-confirmation state.

- `script.js`
  - Legacy homepage guarded write now branches on `disposition`.
  - `review` writes `vendor_review` with review metadata.
  - Added en/vi/es UI strings for pending review and blocked submission.
  - Legacy local time-overlap precheck no longer hard-aborts; it marks the booking for review.

- `ride-intake.js`
  - Guarded write now aborts only on `block`.
  - `review` writes `vendor_review` with review metadata.
  - Added en/vi/es pending-review success title/message and shows pending state instead of confirmed copy.

- `mobile-barber/mobile-barber-booking.js`
  - Guarded save now aborts only on `block`.
  - `review` writes `vendor_review` with review metadata.
  - `vendor_review` now remains a real lifecycle status instead of normalizing back to `pending_barber_confirmation`.
  - Synchronous guard precheck blocks only `block`, allowing time conflicts to proceed to vendor review.

### Tests

- `tests/runner.js`
  - Added disposition mapping coverage.
  - Added explicit `review` assertions for time conflict and unresolvable location.
  - Added `block` assertion for same-customer duplicate.
  - Added `guardedWrite` coverage proving `review` calls `writeFn` and `block` does not.

- `tests/lib/mobile-barber-booking.js`
  - Updated status normalization expectation so `vendor_review` persists.

- `tests/lib/mobile-barber-landing.js`
  - Updated static version expectations to `20260529e`.

## Version Bumps

Verified `20260529e` was unused in git history before applying.

- `index.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `ride-intake.js?v=20260529e`
  - `workflowEngine.js?v=20260529e`
  - `script.js?v=20260529e`

- `travel.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `travel-booking.js?v=20260529e`

- `airport.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `ride-intake.js?v=20260529e`

- `mobile-barber/index.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `mobile-barber-booking.js?v=20260529e`

- `mobile-barber/dashboard.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `mobile-barber-booking.js?v=20260529e`

- `mobile-barber/vendor.html`
  - `booking-conflict-guard.js?v=20260529e`
  - `mobile-barber-booking.js?v=20260529e`

## Verification

Baseline before patch:

```text
scripts/ai/targeted_dry_run.sh booking
FINAL: PASS
```

Syntax:

```text
node --check booking-conflict-guard.js
node --check travel-booking.js
node --check workflowEngine.js
node --check script.js
node --check ride-intake.js
node --check mobile-barber/mobile-barber-booking.js
All exited 0.
```

Tests:

```text
node tests/runner.js
ALL TESTS PASSED: 486 passed, 0 failed
```

Targeted dry run:

```text
scripts/ai/targeted_dry_run.sh booking
PASS: 8 | FAIL: 0 | SKIP: 0
FINAL: PASS
```

Full dry run:

```text
scripts/ai/full_system_dry_run.sh
ALL TESTS PASSED: 486 passed, 0 failed
PASS: 1 | FAIL: 0 | SKIP: 1
FINAL: PASS
```

## Do-Not-Break Verification

- Confirm/common path remains `disposition: 'confirm'` and writes the caller's normal status.
- `customer_duplicate` and `invalid_request` remain hard `block` and do not call `writeFn`.
- Time conflict, outside radius, and unresolvable/edge locations now queue for vendor review.
- Guard queries were not changed; no new Firestore composite index requirement was introduced.
- Firestore rules, Cloud Functions, deployment config, and notification delivery infrastructure were not changed.
- No deploy, push, commit, real notification, or production Firestore write was run.

## Remaining Risks

- Live authenticated Firestore behavior for a real tour `vendor_review` write remains unverified by design in this sandbox.
- Chat copy for AI workflow bookings still depends on the existing chat response layer after `workflowEngine` returns status/review metadata; live model behavior is not guaranteed by static tests.

## Next Command

```bash
git diff --stat
```
