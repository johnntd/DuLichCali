# Phase C — Multi-day tour blocking + haversine travel buffer + stale-lock release

## GOAL

Three correctness upgrades to the guard so the shared timeline reflects reality:
1. **Multi-day tours** block each day they span, not just one continuous block on day 1.
2. **Travel buffer** between two bookings at different locations scales with real distance
   (haversine), so Michael isn't booked across town with no transit time.
3. **Stale locks** at `bookingConflictLocks` are released, so a crashed/abandoned booking
   attempt can't permanently freeze a 15-minute slot.

Depends on Phases A and B.

## CONTEXT — read before editing

- `bookingWindow(row)` and `normalizeWindow(req)` produce `{ start, end, rawStart, rawEnd,
  bufferMinutes, durationMinutes }`. `overlaps(a,b)` is `a.start < b.end && b.start < a.end`.
- A multi-day tour today is encoded as a single window of `duration_days * 480` minutes
  (`travel-booking.js` and `workflowEngine.js`/`script.js` compute `days*480`). That makes
  it ONE ~multi-day-long continuous block — technically blocks the range but is wrong about
  *which hours* each day, and overstates overlap. We want per-day working-window blocks.
- `haversineMiles(a,b)` already exists in the guard. `SERVICE_DEFAULTS[*].travelBufferMinutes`
  is a fixed buffer added to the END of a window.
- `guardedWrite` writes a lock doc at `COLLECTIONS.locks` (`bookingConflictLocks`) with
  `{ ownerId, serviceType, start, end, createdAt }` and **never deletes it**.

## TASKS

### 1. Multi-day tour → per-day windows
- Add a helper `expandWindows(row|req)` in the guard that, for a `tour` whose duration spans
  more than one calendar day (derive day count from `duration_days`/`durationMinutes`/the
  raw start–end span), returns an ARRAY of per-day windows. Each day's window covers that
  day's working hours (reuse `OwnerModel.workingHoursFor(ownerId)` from Phase B; default
  08:00–18:00) on every date in the span (first day from the requested start time; middle
  and last days the full working window — keep it simple and conservative: block the full
  working window on every spanned day).
- Single-day bookings (and all non-tours) return a one-element array → no behavior change.
- In `evaluate()`, when checking conflicts, compare the request's expanded windows against
  each existing row's expanded windows; a time conflict exists if ANY request-day window
  overlaps ANY existing-row-day window. Keep the existing `time_conflict` → `review`
  disposition (Phase A). Do not change the suggested-slots logic beyond what's needed.

### 2. Distance-scaled travel buffer
- Add `travelBufferMinutesBetween(a, b)` to the guard: given two bookings/points with
  resolvable lat/lng, compute `haversineMiles` and convert to minutes using a conservative
  average speed (e.g. 30 mph surface streets → `minutes = round(miles / 30 * 60)`), clamped
  to a sane range (floor = the service's default `travelBufferMinutes`, cap e.g. 120 min).
- When evaluating overlap between the requested booking and an adjacent existing booking
  that are at *different* resolvable locations, extend the effective buffer between them to
  `max(defaultBuffer, travelBufferMinutesBetween(...))` before the overlap test, so two
  far-apart appointments that are technically non-overlapping by clock time but impossible
  to travel between are caught as `time_conflict` (→ `review`).
- If either location is unresolvable (no lat/lng), fall back to the existing fixed buffer —
  never crash, never hard-block on missing geo.

### 3. Stale-lock release
- Give locks a TTL. When `guardedWrite` reads the lock doc in its transaction, treat a lock
  whose `createdAt` is older than a threshold (e.g. **2 minutes**) as stale: overwrite it
  and proceed (this is the normal path for an abandoned attempt). Only a *fresh* lock
  (within TTL) causes the lock-collision fallback (`disposition: 'review'` per Phase A).
- After a successful write, delete the lock doc (`tx.delete(ref)` inside the transaction, or
  best-effort delete in the non-transaction branch) so it doesn't linger. If the write
  throws, the lock should not persist beyond its TTL — the TTL check above guarantees this
  even if cleanup is missed.
- Keep `createdAt` as an ISO string (existing format) and compare with `Date.now()`; tolerate
  Firestore Timestamp objects via the existing `toMillis()` helper.

### 4. Tests
Extend `tests/lib/booking-conflict-guard.js`:
- A 3-day tour conflicts with a haircut on day 2 of the span → `time_conflict` / `review`.
- A 1-day tour vs a non-overlapping next-day booking → `confirm` (no false multi-day spill).
- Two haircuts 40 min apart but 25 miles apart (≈50 min travel) → caught as `time_conflict`;
  the same two 25+ min apart but co-located (no geo / same point) → `confirm`.
- `travelBufferMinutesBetween` returns the default floor when geo is missing.
- Stale lock (createdAt 5 min ago) is overwritten → write proceeds; fresh lock (10 s ago) →
  lock-collision fallback with `disposition: 'review'`.

## Allowed files
- booking-conflict-guard.js
- owner-model.js
- index.html
- travel.html
- airport.html
- mobile-barber/index.html
- mobile-barber/dashboard.html
- mobile-barber/vendor.html
- tests/lib/booking-conflict-guard.js
- docs/smart_booking_phaseC_multiday_travel_lock_report.md

## DO NOT BREAK
- Single-day, single-location bookings must behave exactly as after Phase B.
- No new Firestore composite index; lock logic stays inside the existing transaction shape.
- Missing/unresolvable geo must degrade gracefully to the fixed buffer (no crash, no
  hard-block) — consistent with the owner's "edge locations → review" decision.
- Do not touch other-service write paths or Cloud Functions.

## RULES
- No hardcoded user-facing strings (this phase is logic-only; if any reason label surfaces
  to users, add vi+en+es).
- Bump `?v=` for `booking-conflict-guard.js` (and `owner-model.js` if edited) in every HTML
  consumer; new string unused per `git log --all`; floor `20260529e`+.
- No deploy, no push, no commit.

## VERIFICATION
```bash
node --check booking-conflict-guard.js && node --check owner-model.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

## REPORT
Write `docs/smart_booking_phaseC_multiday_travel_lock_report.md`: the per-day expansion
model, the distance→minutes formula + clamps, the lock TTL + cleanup, exact `?v=` bumps,
test output excerpts, do-not-break verification, PASS/BLOCKED.
