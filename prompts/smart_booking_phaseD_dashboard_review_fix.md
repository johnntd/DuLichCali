# Phase D — Owner dashboard review queue (Approve / Reschedule / Decline)

## GOAL

Phases A–C make ambiguous bookings land as `status: vendor_review` with a `reviewReason`.
This phase gives Michael the dashboard surface to act on them: see WHY each booking needs
review, then **Approve**, **Reschedule**, or **Decline** it. Without this, `vendor_review`
bookings would pile up invisibly.

Depends on Phases A–C.

## CONTEXT — read before editing

Owner portal: `mobile-barber/dashboard.html` + `mobile-barber/mobile-barber-dashboard.js`.
Reuse — do NOT rebuild:
- The owner booking list render (`renderBookings`) and `viewBooking(id)`.
- The owner notification center / bell + drawer (already shipped) and its i18n table — add
  new keys to that SAME table (the dashboard's `t(key)` lookup with vi/en/es).
- The owner service-type filter bar.
- The unified guard (`window.BookingGuard`) — re-run it on Approve/Reschedule to re-validate.
- `OwnerModel` / `OwnerBookings` for owner scoping; existing Firestore update helpers the
  dashboard already uses to write booking status (find them; do not invent a new write path).

A `vendor_review` booking carries `reviewReason` (e.g. `time_conflict`, `outside_service_radius`,
`vendor_review_required`, `tour_daily_cap`, `outside_working_hours`) and may carry
`reviewConflicts`.

## TASKS

### 1. Surface the review queue
- In the owner booking list, visually flag rows with `status === 'vendor_review'` (a badge /
  accent) and show a human-readable, translated reason derived from `reviewReason`
  (map each reason code → a `t(key)`; add vi+en+es for every code listed above).
- Add a filter/section so Michael can see "Needs review" bookings grouped/first. Reuse the
  existing filter-bar pattern rather than a new control if practical.

### 2. Three actions per `vendor_review` booking
- **Approve:** re-run `BookingGuard.validateUnifiedBookingRequest` for that booking; if it
  now comes back `confirm` (or Michael overrides a `review`), set status to `confirmed`
  (use the normal confirmed status this dashboard already uses) and clear `reviewReason`.
  If it still hard-`block`s (duplicate), tell Michael it can't be approved (translated).
- **Reschedule:** let Michael pick a new date/time (reuse any existing reschedule UI/flow in
  the dashboard or barber booking module — `grep` for existing reschedule logic before
  building new). On submit, re-run the guard for the new window; write the new time and set
  status to `confirmed` if `confirm`, else keep `vendor_review` with the updated reason.
- **Decline:** set status to a non-blocking status the guard already treats as non-blocking
  (e.g. `rejected` — confirm it's in the guard's `NON_BLOCKING_STATUSES`) and store an
  optional decline reason. Declined bookings must stop blocking the timeline.
- All three actions are owner-scoped writes to the booking's own collection
  (`mobileBarberBookings` / `bookings` / `travel_bookings` per `sourceCollection`). Do NOT
  touch other owners' data; do NOT add a Cloud Function.

### 3. i18n (RULE #2 — mandatory)
Every new label — section title, the three action buttons, each reason code, confirm/decline
prompts, success/failure toasts — goes through the dashboard's `t(key)` table with vi + en +
es added in the SAME change. No literal user-facing string in any language anywhere in the
DOM or JS.

### 4. Tests
Extend the dashboard's static test (`tests/lib/mobile-barber-landing.js` or the existing
dashboard test — grep to confirm):
- New i18n keys (action buttons, reason codes) exist in en + vi + es.
- The review-queue markup ids/handlers exist in `dashboard.html` / the JS.
- Reason-code → label mapping covers all codes from Phases A–C.
- (Live Approve/Reschedule/Decline against real Firestore is BLOCKED — assert structure, not
  runtime.)

## Allowed files
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.css
- mobile-barber/index.html
- mobile-barber/vendor.html
- tests/lib/mobile-barber-landing.js
- docs/smart_booking_phaseD_dashboard_review_report.md

## DO NOT BREAK
- Single-service vendor dashboards: NO review queue shown (this is owner-mode only, mirror
  how the bell/drawer are owner-gated).
- The existing notification center, booking list, filter bar, and booking creation paths.
- Approve/Reschedule MUST go back through the guard — never write `confirmed` without
  re-validation (no bypassing the conflict check).
- Mobile-first: the review actions and any reschedule UI must work at 375px AND 1280px.
- Do not touch Luxurious Nails, driver-admin compliance, or Cloud Functions.

## RULES
- No hardcoded user-facing strings in any language — all via the dashboard `t(key)` table
  (vi+en+es together).
- Bump `?v=` for `mobile-barber-dashboard.js` and `mobile-barber.css` (if edited) in every
  HTML consumer (`mobile-barber/dashboard.html`, `mobile-barber/index.html`,
  `mobile-barber/vendor.html` — grep to confirm). New string unused per `git log --all`;
  floor `20260529e`+.
- No deploy, no push, no commit.

## VERIFICATION
```bash
node --check mobile-barber/mobile-barber-dashboard.js
node tests/runner.js
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh
```

## REPORT
Write `docs/smart_booking_phaseD_dashboard_review_report.md`: the review-queue UI, the three
actions + guard re-validation, i18n keys added (vi/en/es), exact `?v=` bumps, test output
excerpts, do-not-break verification, and an honest PASS/BLOCKED — interactive
Approve/Reschedule/Decline against an authenticated owner Firestore session is BLOCKED in
this sandbox; static structure + tests are PASS.
