# Phase B — Configurable working hours + 1-tour/day cap (→ review, not reject)

## GOAL

Teach the guard two owner-configurable scheduling constraints so Michael's day stays sane:
1. **Working hours** — bookings requested outside Michael's working hours route to `review`.
2. **Tour daily cap** — Michael can run at most N tours/day (default **1**); a second tour
   on the same day routes to `review`.

Per the owner's binding decision, BOTH violations are **`review`** (queued for Michael),
never hard `block`. This phase depends on Phase A's disposition model already being merged.

## CONTEXT — read before editing

- `owner-model.js` defines `window.OwnerModel` (also `module.exports` for Node). It already
  has `findOwner(ownerId)`, `serviceBucket(...)`, and owner records carry fields like
  `homeRegion`. This is where per-owner config belongs.
- `booking-conflict-guard.js` `evaluate()` builds `reason` with a fixed precedence and
  `finish()` now (after Phase A) derives `disposition` from `reason` via `dispositionFor`.
- The guard already loads the owner's same-day bookings (`loadOwnerBookings` / the `rows`
  passed to `evaluate`), so the tour-count check needs no new query.

## TASKS

### 1. `owner-model.js` — add config (with safe defaults)
- Add per-owner scheduling config, read through a helper so callers/guard don't poke raw fields:
  - `OwnerModel.workingHoursFor(ownerId)` → `{ start: 'HH:MM', end: 'HH:MM' }`,
    default `{ start: '08:00', end: '18:00' }` when the owner record has none.
  - `OwnerModel.tourDailyCapFor(ownerId)` → integer, default `1`.
- Source values from the owner record when present (e.g. `owner.workingHours`,
  `owner.tourDailyCap`); otherwise return the defaults. Do NOT hardcode Michael's id —
  this must work for any owner.
- Export the helpers in both the browser (`window.OwnerModel`) and Node (`module.exports`)
  surfaces, matching the file's existing UMD pattern.

### 2. `booking-conflict-guard.js` — two new checks → `review`
- Add two new reasons and place them in `evaluate()`'s precedence **below the hard/blocking
  reasons but above `available`**, i.e. after `customer_duplicate` and `time_conflict`,
  alongside the other soft reasons:
  - `outside_working_hours` — the requested window (use `requested.rawStart`/`rawEnd`) falls
    outside `OwnerModel.workingHoursFor(req.ownerId)`. Guard against OwnerModel being absent
    (Node tests may stub it) — if no config is resolvable, skip this check (do not crash).
  - `tour_daily_cap` — only when `serviceType === 'tour'`: count existing blocking tour
    bookings (`isBlockingStatus` + normalized serviceType `tour`) in `rows` on the SAME
    calendar date as the request; if that count `>= OwnerModel.tourDailyCapFor(req.ownerId)`,
    set this reason. (The request itself is not yet in `rows`, so `>=` cap is correct.)
- Both new reasons MUST map to `disposition: 'review'` via `dispositionFor` (extend the
  map from Phase A). Never `block`.
- Precedence sanity: a same-customer duplicate or a true time overlap must still win over
  these (those are higher priority). Order in `evaluate`:
  `customer_duplicate` > `time_conflict` > `outside_service_radius` > `vendor_review_required`
  > `tour_daily_cap` > `outside_working_hours` > `available`
  (exact ordering among the soft reasons is fine as long as all soft ones are `review` and
  the two hard ones stay first).
- Keep everything composite-index-free — these checks use only already-loaded `rows` and
  the owner config; no new Firestore query.

### 3. Tests
Extend `tests/lib/booking-conflict-guard.js` (and stub `OwnerModel` config as needed):
- A booking at 06:00 when hours are 08:00–18:00 → `disposition: 'review'`,
  `reason: 'outside_working_hours'`.
- A booking inside hours with no other issue → `confirm`.
- A 2nd tour on a date that already has 1 blocking tour (cap = 1) → `review`,
  `reason: 'tour_daily_cap'`.
- A 1st tour on an empty date → `confirm`.
- Cap respects config: with `tourDailyCapFor` stubbed to 2, the 2nd tour → `confirm`, 3rd → `review`.
- A real time overlap still beats the soft checks (→ stays `review` via `time_conflict`, and
  a same-customer duplicate still → `block`).

## Allowed files
- `owner-model.js`
- `booking-conflict-guard.js`
- `index.html`
- `travel.html`
- `airport.html`
- `script.js`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `tests/lib/booking-conflict-guard.js`
- `tests/lib/owner-account-model.js`
- `docs/smart_booking_phaseB_hours_cap_report.md`

(Note: `owner-model.js` and `booking-conflict-guard.js` are browser-loaded — bump `?v=` in
every HTML file that loads each. Discover them with
`grep -rn "owner-model.js" . --include="*.html"` and
`grep -rn "booking-conflict-guard.js" . --include="*.html"`; add any missing consumer to the
edit set and bump it.)

## DO NOT BREAK
- Phase A disposition behavior (confirm/review/block) and the tour write fix.
- Owners with no config must get the defaults (08:00–18:00, cap 1) — never crash, never
  hard-block.
- Non-tour services are unaffected by the tour cap.
- No new composite index; no other-service write path touched; no Cloud Function changes.

## RULES
- No hardcoded user-facing strings. (No new customer copy is required here — these reasons
  reuse Phase A's `review` "pending confirmation" path. If you surface a reason label
  anywhere user-visible, add vi+en+es.)
- Bump `?v=` for every edited `.js` in every HTML consumer; new string unused per
  `git log --all`; floor `20260529e`+.
- No deploy, no push, no commit.

## VERIFICATION
```bash
node --check owner-model.js && node --check booking-conflict-guard.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

## REPORT
Write `docs/smart_booking_phaseB_hours_cap_report.md`: config helpers + defaults, the two
new guard reasons and their `review` mapping, exact `?v=` bumps, test output excerpts,
do-not-break verification, PASS/BLOCKED.
