# Travel Package / Travel Guide Generator — Phase 1 Design Spec

**Date:** 2026-06-28
**Surface:** Travel Concierge (`/travel-concierge`)
**Branch:** `travel-concierge`
**Status:** Approved (user decisions below) — Phase 1 implementation

## Goal
Turn the finalized itinerary into a premium, personalized **Travel Guide** — a beautiful,
mobile-first, print-to-PDF, shareable document that feels like a luxury travel agency's
itinerary. Phase 1 only; reuse existing Concierge data; do not break booking/itinerary.

## User decisions (2026-06-28)
- **Stack:** Extend existing **vanilla JS**. NO React / bundler / build step. Protect existing
  booking + itinerary functionality.
- **Data honesty:** Never fake ratings, prices, photos, tides, parking costs, or Tesla battery %.
  Real existing sources only. Unavailable → "Verify before going" + a search/directions link.
- **Tesla/EV:** Honest EV trip *helper*, not fake live Tesla. Route distance + Supercharger search
  links + suggested charge stops + activities while charging. Battery numbers ONLY as estimates
  computed from **user-entered** vehicle/range assumptions, clearly labeled.
- **Phase 1 scope:** premium Guide view from the finalized itinerary; reuse itinerary/hotel/
  restaurant/attraction/ride/media/cost/weather/share data; mobile-first; print/PDF CSS; editable
  sections only if safe with the existing data model; honest cards (attractions/beaches/restaurants/
  stay/EV/cost/family tips/booking actions); tests.
- **Deferred:** React, true PDF engine, Apple Wallet, live Tesla API, live monitoring/alerts,
  TripAdvisor ratings, tide tables, restaurant reservations, live charger availability.

## Architecture (mirrors tc-stays.js + render-in-travel-concierge.js pattern)
- **`tc-package.js` (NEW, pure, node-testable like tc-stays.js):** `root.TCPackage`
  - `estimateEvPlan({ miles, rangeMiles, startPct, reservePct })` → suggested charge stops + charge%
    (returns `null`/`unknown` when range not provided; never invents battery state).
  - `goldenHour(dateIso, lat, lng)` → real sunrise/sunset/golden-hour (astronomical math; honest).
  - `costRollup(...)` thin wrapper around the existing cost numbers.
  - honesty formatters: `verifyOrLink(value, label)` → returns the real value or a
    `{ verify:true, label }` marker so render shows "Verify before going" + link.
- **`travel-concierge.js` (extend):** `renderTravelGuide(trip)` + modular builders `pkgCover`,
  `pkgExecSummary`, `pkgDayTimeline`, `pkgStopCard`, `pkgStayCard`, `pkgRestaurantCard`,
  `pkgAttractionCard`, `pkgBeachCard`, `pkgEvHelper`, `pkgCostSummary`, `pkgFamilyTips`,
  `pkgBookingActions`, `pkgPrintButton`. New **"📖 Guide"** tab in the tab system.
  Reuse: `placeMedia` (real photos), `computeTripCosts`/`familyShares`/`computeBalances`,
  `computeTripRoute`/route legs, group profile, `trip.stays/attractions/food/transport/plan.days`,
  `createTripShareAccess`.
- **`travel-concierge.css` (extend):** `.tc-pkg__*` mobile-first (base→768→1200) + a `@media print`
  block (per-day page breaks, hide chrome/buttons) so browser Print→Save-as-PDF = clean document.

## Components / sections
1. **Cover** — trip title, date range, route chain (SJ→OC→SD…), families/travelers, hero (first
   destination's verified photo via placeMedia), weather summary (existing weather data).
2. **Executive summary** — dates, adults/children, hotel(s), transport, estimated budget
   (computeTripCosts), total driving distance (computeTripRoute, labeled source), EV/charging
   summary, reservation/task status (bookings), outstanding tasks.
3. **Daily timeline** — per day: header (date + that day's route), ordered stops. Times are the
   plan's existing suggested slots, labeled "suggested" — NEVER invented exact ETAs (respects the
   existing applyVerifiedRoute "AI must not invent ETAs" rule).
4. **Stop cards** (type-specific, all honest): stay / restaurant / attraction / beach / generic.
   Each: real photo or labeled no-photo+links, AI-researched details labeled "verify", golden-hour
   (computed), directions/map link, booking action, nearby restroom/coffee/charger as SEARCH links.
5. **EV helper** — route distance, suggested charge stops + (if user range entered) labeled charge%,
   Supercharger SEARCH links, "while charging" activities from existing food/coffee research.
6. **Cost summary** — reuse computeTripCosts + per-family balances.
7. **Family tips** — from the existing group profile (kids/teens/seniors/pets/accessibility).
8. **Booking actions** — reuse existing book/reserve/ride/directions/calendar/share links.
9. **Print button** — `window.print()`; the print CSS produces the PDF.

## Editing (point 5 — "only if safe")
The Guide does NOT reinvent editing. The Concierge already has the itinerary control engine
(drag/reorder/move/regenerate via `TripItineraryOverride`). The Guide is a present/export view with
an **"Edit in Itinerary"** link back to that engine. No new mutation of the data model → zero risk.

## Honesty enforcement (hard rule)
- Photos/ratings via `placeMedia` only (Google Places → Wikipedia → labeled no-photo + real links).
- No fabricated ratings/prices/tides/parking-cost/battery. Missing → "Verify before going" + link.
- AI-researched text labeled "AI research — verify on site".
- Distances/times/golden-hour computed + labeled; EV battery only from user range input, labeled est.

## Tests (`tests/tc-package.test.js`, pure-module like tc-stays.test.js)
- `estimateEvPlan`: stop count + charge% from miles/range; returns unknown when no range.
- `goldenHour`: known date/lat/lng → expected sunrise/sunset within tolerance.
- honesty formatters: missing value → verify marker (never an unlabeled fabricated value).
- cost rollup correctness.
- Plus `scripts/ai/full_system_dry_run.sh` → FINAL: PASS (no regression).

## Files / versions
- NEW `tc-package.js`, NEW `tests/tc-package.test.js`, NEW `package.json` `test:package` script.
- Extend `travel-concierge.js` (Guide render + tab), `travel-concierge.css` (`.tc-pkg__*` + print),
  i18n vi/en/es keys in the `T` blocks.
- Bump `?v=` in `travel-concierge.html`: add `tc-package.js`; bump `travel-concierge.js` + `.css`.

## Out of scope (Phase 1)
React, true server-side PDF engine, Apple Wallet/.pkpass, live Tesla/charger APIs, live
monitoring/rerouting/alerts, TripAdvisor ratings, tide tables, restaurant reservation management.

## Next recommended phase (Phase 2 candidates)
EV planner deepening (real charger dataset if a key is provisioned), live AI monitoring (traffic/
weather rerouting suggestions), richer per-stop detail via Google Places Details (hours/ratings)
once a real Maps key exists, Apple Wallet pass, offline-package caching via the existing SW.
