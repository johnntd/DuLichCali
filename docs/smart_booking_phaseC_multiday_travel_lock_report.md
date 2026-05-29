# Smart Booking Phase C Report

Date: 2026-05-29
Status: PASS

## Scope

Prompt used: `prompts/smart_booking_phaseC_multiday_travel_lock_fix.md`

Files changed:
- `booking-conflict-guard.js`
- `tests/lib/booking-conflict-guard.js`
- `index.html`
- `travel.html`
- `airport.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`

`owner-model.js` was read but not edited.

## Per-Day Tour Expansion

Added `expandWindows(row|req)` in `booking-conflict-guard.js`.

Behavior:
- Non-tour bookings return one existing normalized window.
- Single-day tours return one existing normalized window.
- Multi-day tours expand into one window per spanned day.
- Day count is derived from `duration_days` / `durationDays` / `days`, `durationMinutes`, and the raw start-end span.
- Expanded tour windows use owner working hours from `OwnerModel.workingHoursFor(ownerId)`.
- If owner hours are missing or invalid, the guard falls back to `08:00-18:00`.
- First day starts at `max(requestedStart, workingHours.start)`.
- Middle and later days block the full working window.

Conflict evaluation now checks every request expanded window against every existing-row expanded window. A conflict exists when any pair overlaps or violates the travel buffer. The existing `time_conflict` reason and `review` disposition are preserved.

## Distance-Scaled Travel Buffer

Added `travelBufferMinutesBetween(a, b)`.

Formula:
- Resolve `lat/lng` from direct fields or nested location fields.
- Compute miles with existing `haversineMiles(a, b)`.
- Convert to minutes with conservative surface-street speed:
  - `minutes = round(miles / 30 * 60)`
- Clamp:
  - floor = maximum applicable fixed service buffer
  - cap = `120` minutes

If either booking has missing or unresolvable geo, the helper returns the fixed default floor and does not crash or hard-block on geography alone.

Overlap now uses raw appointment windows plus the pair-specific travel buffer. This catches impossible cross-town adjacency without changing same-location or missing-geo behavior.

## Stale Lock Release

Lock TTL:
- `LOCK_TTL_MS = 2 * 60 * 1000`
- `createdAt` remains an ISO string.
- Existing `toMillis()` handles ISO strings and Firestore Timestamp-like objects.

Transaction behavior:
- Fresh lock within TTL returns the existing lock-collision fallback: `time_conflict` / `review`.
- Stale lock older than TTL is overwritten and the write proceeds.
- After successful write, the lock doc is deleted inside the transaction when `tx.delete` is available.
- If cleanup is missed because a write throws, the TTL path prevents permanent slot freezing.

## Version Bumps

`booking-conflict-guard.js` was bumped from `20260529f` to `20260529g` in:
- `index.html`
- `travel.html`
- `airport.html`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`

`owner-model.js` stayed at `20260529f` because it was not edited.

## Tests Added

Extended `tests/lib/booking-conflict-guard.js` with:
- `BG-PC-01`: 3-day tour conflicts with day-2 haircut.
- `BG-PC-02`: 1-day tour does not spill into next day.
- `BG-PC-03`: far-apart haircuts are caught by travel buffer; same-point spacing confirms.
- `BG-PC-04`: missing geo returns default travel-buffer floor.
- `BG-PC-05`: stale lock is overwritten and cleaned up; fresh lock routes to review.

## Verification

Commands run:

```bash
scripts/ai/targeted_dry_run.sh booking
node --check booking-conflict-guard.js && node --check owner-model.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

Output excerpts:

```text
node tests/runner.js
ALL TESTS PASSED: 499 passed, 0 failed
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

- Single-day bookings still return one window.
- Non-tour bookings still use existing normalized windows.
- Missing geo falls back to fixed buffer.
- Existing `time_conflict` remains `review`.
- No Firestore index changes.
- No production deploy.
- No push.
- No commit.

## Remaining Risks

- Firestore transaction behavior is covered by mocked transaction tests, not live production Firestore.
- Real-world travel time can exceed haversine-based 30 mph estimates during traffic; the current cap/floor keeps behavior conservative without requiring an external maps API.

Next command:

```bash
git diff --stat
```
