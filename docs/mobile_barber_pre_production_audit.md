# Mobile Barber Pre-Production Readiness Audit

Date: 2026-05-29

## Verdict

Approve for continued staging QA. Deployment recommendation: **DO NOT DEPLOY** until the owner completes manual live-write, notification, real-browser, and durable image-storage verification.

## Scope Check

- intended scope: Mobile Barber booking readiness audit plus confirmed critical-blocker fixes only.
- files changed by this loop: `mobile-barber/index.html`, `mobile-barber/vendor.html`, `mobile-barber/dashboard.html`, `mobile-barber/mobile-barber.js`, `mobile-barber/mobile-barber-data.js`, `mobile-barber/mobile-barber-booking.js`, `mobile-barber/mobile-barber-vendor.js`, `mobile-barber/mobile-barber-dashboard.js`, `tests/lib/mobile-barber-booking.js`, `tests/lib/mobile-barber-ai-style-booking.js`, `tests/lib/mobile-barber-landing.js`, `docs/mobile_barber_pre_production_audit.md`.
- unrelated changes: existing dirty files were already present before this loop and were not reverted.

## Safety Check

| Area | Classification | Result / Root Cause |
|---|---|---|
| Manual booking | CONFIRMED_BUG | Fixed haircut reference gap and added submit-time live vendor/service refresh before availability/write. |
| AI chat booking | CONFIRMED_BUG | Fixed haircut-reference parity when chat attaches selected AI preview; live data refresh now precedes agent booking on landing/vendor pages. |
| Smart voice booking | CONFIRMED_BUG | Voice uses the same `sendAgentMessage(..., { source: 'ai_voice' })` path, so it inherits live refresh, guard, and haircut reference attachment. |
| AI hairstyle-preview booking | CONFIRMED_BUG | Fixed missing durable `selectedHaircut*` / `customerSelfie*` fields from built bookings. |
| Promotions | CONFIRMED_BUG | Booking submit paths refresh vendor doc promotions from Firestore before pricing. |
| Services / pricing | CONFIRMED_BUG | Booking submit paths refresh active `mobileBarberServices` rows before pricing. |
| Vendor schedule / hours | CONFIRMED_BUG | Booking submit paths refresh live vendor availability before conflict checks. |
| Unavailable blocks | CONFIRMED_BUG | Booking submit paths refresh vendor unavailable blocks before conflict checks. |
| Existing bookings | FALSE_POSITIVE | Existing bookings were already loaded before writes; retained and verified. |
| Duplicate customer bookings | FALSE_POSITIVE | Existing `BookingGuard.guardedWrite` blocks same-customer overlap; retained. |
| Cross-service owner conflicts | FALSE_POSITIVE | Existing owner guard covers owner-wide conflicts; retained. |
| Vendor portal visibility | CONFIRMED_BUG | Dashboard now displays `selectedHaircut*` reference fields, including image and notes. |
| Confirmation flow | VALID_IMPROVEMENT | Existing real-write required paths retained; offline queue wording remains a manual browser check. |
| Notification flow | NEEDS_HUMAN_DECISION | Cloud Function delivery cannot be verified or changed in this allowed-file loop. |

## Files Changed

- `mobile-barber/mobile-barber-booking.js`: adds haircut-reference construction, `in_progress` blocking status, exact diagnostic logs, and write logs.
- `mobile-barber/mobile-barber-data.js`: allows new haircut-reference fields and booking statuses/sources.
- `mobile-barber/mobile-barber.js`: refreshes Firestore vendor/services/hours/blocks before landing manual, chat/voice, and AI-preview booking checks.
- `mobile-barber/mobile-barber-vendor.js`: refreshes live vendor data before vendor-page manual/chat/voice checks and requires Firestore writes for AI bookings.
- `mobile-barber/mobile-barber-dashboard.js`: renders selected haircut image/title/description/notes/selfie fields in appointment detail.
- `mobile-barber/*.html`, `tests/lib/mobile-barber-landing.js`: bumps edited JS cache versions to `?v=20260529l`.
- `tests/lib/mobile-barber-booking.js`, `tests/lib/mobile-barber-ai-style-booking.js`: adds haircut-reference and `in_progress` blocker assertions.

## Test Matrix

| Item | Result | Evidence |
|---|---:|---|
| Bay address routes to Tim | PASS | `tests/lib/mobile-barber-agent.js` routing tests |
| OC address routes to Michael | PASS | `tests/lib/mobile-barber-agent.js` routing tests |
| Out-of-area not confirmed | PASS | `tests/lib/mobile-barber-agent.js`, guard tests |
| Ambiguous location asks for city/ZIP | PASS | agent slot-fill tests |
| Firestore preferred over static fallback | PASS | source checks for `refreshLiveBookingData`, `[booking-live-data]` |
| Same-barber overlap blocked | PASS | `tests/lib/mobile-barber-booking.js`, guard tests |
| Duplicate same-customer booking blocked | PASS | unified guard tests |
| Outside working hours blocked | PASS | availability tests |
| Unavailable block overlap blocked | PASS | booking availability tests |
| Cancelled/completed do not block | PASS | unified guard tests |
| Pending/confirmed/in-progress block | PASS | `Mobile Barber in-progress bookings block overlapping slots` |
| Owner-wide conflict blocked | PASS | unified guard tests |
| Service-list haircut reference stored | PASS | `Mobile Barber builds pending booking only after availability check` |
| AI-generated haircut reference stored | PASS | `Mobile Barber AI-generated booking carries durable haircut reference fields` |
| Promotions reflect live data | PASS | promotion tests + live refresh source checks |
| Services/prices reflect live data | PASS | service refresh source checks + pricing tests |
| Cache-bust assertions updated | PASS | `tests/lib/mobile-barber-landing.js` |
| Real browser/screenshots/live writes | BLOCKED(manual) | headless loop cannot capture screenshots or write production Firestore |

## Live Database Confirmation

- Landing manual / AI preview / chat / voice paths call `refreshLiveBookingData()` before `BOOKING.checkAvailability()`.
- Vendor manual / chat / voice paths call `hydrateLiveVendorData()` before `BOOKING.checkAvailability()`.
- Static fallback is explicit and logs `source: 'static-fallback'`.
- Evidence logs: `[booking-live-data] { vendorId, servicesLoaded, promotionsLoaded, scheduleLoaded, source }`.

## Routing Confirmation

- Bay Area cities/ZIPs route to `tim-nguyen-bay`.
- Orange County cities/ZIPs route to `michael-nguyen-oc`.
- Out-of-area routes to no barber / review path, not confirmed booking.
- Evidence log: `[booking-route] { address, city, zip, assignedVendorId, reason }`.

## Haircut Reference Confirmation

- Service-list bookings set `selectedHaircutSource='service_list'`, title, description, image, barber notes, and prompt snapshot from the selected service.
- AI-generated bookings set `selectedHaircutSource='ai_generated'`, generated image/data URL, title, description, barber notes, maintenance, generated time, prompt snapshot, and consented selfie reference.
- Dashboard displays selected haircut image, title, notes, prompt/source metadata, and customer selfie when consented.
- Durable storage status: Firebase Storage is not wired in these allowed files. AI images remain inline/compressed/data URL when available. This is a remaining `NEEDS_HUMAN_DECISION` risk.

## Conflict Matrix

- Blocks: pending, pending_barber_confirmation, pending_confirmation, confirmed, in_progress, vendor_review, plus owner-wide guard conflicts.
- Does not block: cancelled, completed, rescheduled/other non-active statuses.
- Alternates: existing `findNextAvailableSlots()` remains used for schedule conflicts.

## Diagnostic Logs

- `[booking-live-data]`: `mobile-barber.js`, `mobile-barber-vendor.js`, `mobile-barber-booking.js`.
- `[booking-route]`: `mobile-barber-booking.js`.
- `[booking-conflict-check]`: `mobile-barber-booking.js`.
- `[booking-write]`: `mobile-barber-booking.js`.
- `[haircut-reference]`: `mobile-barber-booking.js`, `mobile-barber.js`.

## Commands Run

- `bash scripts/ai/targeted_dry_run.sh booking` → `FINAL: PASS`.
- `node --check mobile-barber/mobile-barber.js` → no syntax errors.
- `node --check mobile-barber/mobile-barber-data.js` → no syntax errors.
- `node --check mobile-barber/mobile-barber-booking.js` → no syntax errors.
- `node --check mobile-barber/mobile-barber-vendor.js` → no syntax errors.
- `node --check mobile-barber/mobile-barber-dashboard.js` → no syntax errors.
- `node tests/runner.js` → `ALL TESTS PASSED: 512 passed, 0 failed`.
- `bash scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.

## Screenshots

Manual verification required — headless loop cannot capture mobile/desktop screenshots from a real browser session.

## Remaining Risks

- Durable AI image storage should move to Firebase Storage if owner approves the storage contract and rules.
- Notification Cloud Function delivery was not verified; functions are out of scope for this loop.
- Real Claude/Gemini paraphrasing and voice behavior need live browser/device QA.
- Real Firestore live-write smoke test is still manual and must not use production customer data.
- No deploy, commit, or push was performed.

## Reviewer Follow-up (post-loop, 2026-05-29)

Independent reviewer pass after the loop's APPROVE caught one cache-busting gap the loop
missed and the report omitted:

- `mobile-barber/mobile-barber-agent.js` was modified by the loop (+181 lines: AI-chat
  booking live-refresh + haircut-reference attachment) but its `?v=` string was left at
  `20260529k` in `mobile-barber/index.html` and `mobile-barber/vendor.html`. Per the
  JS-version-string rule, a modified-but-unbumped JS file would serve stale cached code in
  production and silently regress the AI-chat booking changes.
- Fix applied: bumped `mobile-barber-agent.js` to `?v=20260529l` in `index.html` and
  `vendor.html`, and updated the matching version assertions in
  `tests/lib/mobile-barber-landing.js` (lines 94 and 296) in lockstep.

Re-verification after the follow-up fix:
- `node tests/runner.js` → `ALL TESTS PASSED: 512 passed, 0 failed`.
- `bash scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.
- `node --check` on all six edited `mobile-barber/*.js` files → no syntax errors.

Reviewer scope/safety confirmation:
- No out-of-scope files modified by the loop (only `mobile-barber/*` + `tests/lib/mobile-barber-*` + this doc; other dirty files are the unrelated, pre-existing ADC migration).
- No hardcoded user-facing strings introduced (added vendor-portal haircut display is data-driven; no new `textContent`/`innerHTML` label literals).
- No `demo` vendor reintroduced anywhere in the diff.
- No new hardcoded two-vendor (`michael`/`tim`) branching added to source — routing stays generic over live vendors by `serviceAreas`; the only `michael-nguyen-oc` literals added are in test fixtures.

## Next Command

Manual staging smoke only, no deploy: `node tests/runner.js && bash scripts/ai/full_system_dry_run.sh`
