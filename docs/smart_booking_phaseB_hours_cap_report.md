# Smart Booking Phase B - Working Hours and Tour Daily Cap

Date: 2026-05-29

## Summary

Implemented Phase B owner-configurable scheduling guard rules:

- `OwnerModel.workingHoursFor(ownerId)` returns owner hours or the safe default `{ start: '08:00', end: '18:00' }`.
- `OwnerModel.tourDailyCapFor(ownerId)` returns the owner cap or the safe default `1`.
- `BookingGuard` now routes requests outside working hours to `disposition: 'review'`, `reason: 'outside_working_hours'`.
- `BookingGuard` now routes tour requests over the same-day tour cap to `disposition: 'review'`, `reason: 'tour_daily_cap'`.
- No new Firestore query or composite index was added; both checks use `OwnerModel` and the already-loaded booking rows.

## Files Changed

- `owner-model.js`
- `booking-conflict-guard.js`
- `tests/lib/booking-conflict-guard.js`
- `tests/lib/owner-account-model.js`
- `index.html`
- `travel.html`
- `airport.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `owner-dashboard.html`
- `docs/smart_booking_phaseB_hours_cap_report.md`

`owner-dashboard.html` was bumped because the required consumer discovery found it loading `owner-model.js`.

## Guard Behavior

Reason precedence remains hard checks first:

- `customer_duplicate` still wins and maps to `block`.
- `time_conflict` still wins over all soft checks and maps to `review`.
- `outside_service_radius`, `vendor_review_required`, `tour_daily_cap`, and `outside_working_hours` are soft checks and map to `review`.
- `available` maps to `confirm`.

The new checks skip safely if `OwnerModel` or the relevant helper is absent.

## Version Bumps

All discovered HTML consumers were bumped to `v=20260529f`.

`owner-model.js` consumers:

- `owner-dashboard.html`
- `index.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `travel.html`
- `airport.html`

`booking-conflict-guard.js` consumers:

- `index.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `travel.html`
- `airport.html`

## Test Output Excerpts

Commands run:

```bash
scripts/ai/targeted_dry_run.sh booking
node --check owner-model.js && node --check booking-conflict-guard.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

Key excerpts:

```text
node tests/runner.js
ALL TESTS PASSED: 494 passed, 0 failed
```

```text
BG-PB-01: outside working hours routes to review
reason: 'outside_working_hours'
```

```text
BG-PB-03: second tour on capped date routes to review
reason: 'tour_daily_cap'
```

```text
BG-PB-06: hard precedence beats soft hours and cap checks
reason: 'time_conflict'
reason: 'customer_duplicate'
```

```text
scripts/ai/targeted_dry_run.sh booking
FINAL: PASS
```

```text
scripts/ai/full_system_dry_run.sh
FINAL: PASS
```

## Do-Not-Break Verification

- Phase A disposition behavior preserved: `confirm`, `review`, and `block` mappings remain intact.
- No booking validation hard-block was added for working hours or tour cap.
- Non-tour services are unaffected by the tour cap.
- Same-customer duplicate and true time overlap still take precedence over soft checks.
- No Cloud Function changes.
- No Firestore schema, rules, index, or production data changes.
- No deploy, push, or commit performed.

## Result

PASS.

Remaining risk: this is static/local validation only. Production Firestore data shape and real customer input variation still require live QA before deploy.

Next command:

```bash
scripts/ai/full_system_dry_run.sh
```
