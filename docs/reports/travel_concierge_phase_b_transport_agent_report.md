# Travel Concierge — Phase B: AI Transportation Agent + DuLichCali Ride/Tour Integration

Status: IN PROGRESS. This report opens with the mandated **integration architecture note** (written
before any code change), then is filled in with data models, behavior, tests, and deployment verification.

---

## 1. Integration architecture note (read-first map)

Four read-only surveys mapped the existing systems. Findings:

### Existing ride/tour modules to REUSE (never duplicate)

| Need | Reuse | Where |
|---|---|---|
| Airport pickup / private ride booking | `RideIntake.open('pickup'|'dropoff'|'ride')` modal | `ride-intake.js` (entry `open()` L552; fields `ri_from_addr`/`ri_to_addr`/`ri_dropoff_addr`/`ri_ride_date`/`ri_ride_time`/`ri_arrival_date`/`ri_arrival_time`/`ri_{p,d,r}_{passengers,name,phone,notes}`; `buildBookingData` L1567) |
| Duplicate-booking prevention | `BookingGuard.guardedWrite(req, writeFn, {db})` | `booking-conflict-guard.js` L497 (txn + distributed lock; owner-wide overlap across `bookings`/`mobileBarberBookings`/`travel_bookings`) |
| Driver eligibility (compliance/active/expiry/region/schedule) | `checkRideServiceAvailability()` / `_queryEligibleDrivers()` | `script.js` L1591; `functions/index.js` `onRideBookingCreated` L4593, `_queryEligibleDrivers` L4645 |
| Driver notification on a ride | `onRideBookingCreated` → `dispatchQueue` → `sendDriverRidePush` | `functions/index.js` L4593/L4847; `rideNotifications` + `vendors/admin-dlc/notifications` |
| Tour / tourist-ride / day-driver booking | `travel_bookings` + `onTravelBookingCreated` dispatch (`travelDispatch.js`) | separate, REAL system — `/tour`,`/travel.html`,`travel-booking.js`; do NOT merge with ride-share |
| Distance / duration per leg | `computeTripRoute(cities[])` (Google Distance Matrix → haversine; `source: google_maps|estimated`) | `functions/index.js` L2926; frontend `computeRoute`/`verifyRoute` already wrap it |
| DLC private-ride fare | `DLCPricing.quoteRide(miles, durMins, {passengers, regionId, airport})` (vehicle tiers + Uber compare) | `pricing.js` L89 |
| Confirmation emails / in-app notifs | `DLCNotifications.queue*` | `notifications.js` (`vendors/admin-dlc/emailQueue`, idempotent) |
| Concierge agent pattern | `mkCallable` → `runConciergeResearch` → `state._cResearch.<k>` → tab render | `travel-concierge.js` L754 / L1688 / renderPlan tabs |
| Families summary for prompts | `summarizeFamiliesForTrip()` (already has travelers, stayPrefs, transportMethod, origin) | `functions/index.js` L2155 |

### Booking data collections to integrate with
- Ride-share: `bookings` (+ `rideNotifications`, `dispatchQueue`) — written via the RideIntake flow.
- Tour: `travel_bookings` (+ `travelAssignments`, `travel_drivers`/`travel_vehicles`) — written via the travel-booking flow.
- Trip storage: `groupTrips/{id}` (owner/member field-free update; `merge:true`). Transport stored on `trip.transport`.

### Missing data for transport comparison
- **No flight/bus/train live API.** → AI produces ROUGH estimates labeled "pending verification" + real search links (Google Flights / bus search). Never invented exact prices/schedules.
- **GOOGLE_MAPS_API_KEY is a placeholder** → distances are haversine **estimates** today (clearly labeled `estimated`); upgrade to `google_maps` automatically when a real key is set (no code change).

### Estimate vs live vs unavailable
- **Car/DLC-ride distance & time:** verified `google_maps` when key present, else `estimated` (haversine) — labeled per leg via `source`. Server computes these; the AI never invents them.
- **Flight/bus/train cost:** `ai_estimate` / "pending verification" + search link; `confidence: low`.
- **DLC ride:** `canBookViaDLC: true` only; the actual booking is a DRAFT handoff into the existing RideIntake flow (no auto-confirm).
- **Unavailable provider:** explicitly say so and keep an external/private-request fallback.

### Handoff design (no auto-confirm, no duplication)
Transport tab "Request DuLichCali Ride / Airport Pickup" → builds a draft from trip data → `sessionStorage['dlc_ride_prefill']` → navigates to `/airport`. `ride-intake.js` gets one additive public `openWithPrefill(draft)` + a boot consumer that opens the existing modal prefilled. The user reviews and submits through the **existing** flow (guard + notifications + dispatch). Tour/day-driver requests link to the existing `/tour` booking page.

---

## 2. Data model changes
- `trip.transport` = array of normalized legs (mirrors `trip.stays`/`trip.food`; persisted on `groupTrips/{id}` via `saveTrip`, field-free owner/member update — no rules change). Each leg:
  `{ fromCity, toCity, legType(outbound|inter|return), dayHint(transit|activity|half), driveDistanceText, driveDurationText, driveSource(google_maps|estimated|unknown), mapLink, recommendedMode, recommendationReason, options[] }`.
- Each option: `{ mode(personal_car|rental_car|flight|bus|train|dlc_ride), provider, status(verified|estimated|unknown), distanceText, durationText, totalCostRange, perTravelerCost, luggageSuitability, childSuitability, seniorSuitability, accessibilityNote, pros[], cons[], bookingLink, mapLink, confidence, canBookViaDLC, affectsItinerary, source(google_maps|estimated|ai_estimate), verifiedAt }`.
- `trip.transportSource` (overall maps source), `trip.transportChoice[legKey] = mode` (user's per-leg pick). Selecting an outbound mode sets each family's `transport.method` (drives the return-day plan + `summarizeFamiliesForTrip`).
- No new Firestore collection. Ride handoff reuses `bookings` via the existing RideIntake flow; tour links to the existing `travel_bookings` flow.

## 3. Transport recommendation behavior
- New callable **`researchTripTransport`** builds the major-leg path `origin → dest1 → … → destN → origin` (collapsing repeats), computes authoritative per-leg drive distance/time via the shared `tcComputeRouteLegs` helper, then Gemini (grounded) compares viable modes per leg and recommends a best-fit with a transparent, group-specific `recommendationReason` (cites travelers/kids/seniors/luggage/budget/pace/distance) and a `dayHint` (transit/activity/half). It does **not** assume car is best — modes are included only when viable; a `dlc_ride` option is offered for airport/local legs where a private driver helps.
- Auto-runs after "Plan my trip" via `runConciergeResearch` (`state._cResearch.transport`); also a manual "Compare transport (AI)" button on the tab.

## 4. Estimate vs verified behavior
- **Car / rental / DLC-ride distance + time:** authoritative from the route helper — `status: verified` when `GOOGLE_MAPS_API_KEY` is real (`source: google_maps`), else `status: estimated` (`source: estimated`, haversine ×1.12). The AI never invents these; the server re-stamps the drive options from the computed values.
- **Flight / bus / train:** AI rough estimates — `status: estimated`, cost ranges suffixed "(est.)", `confidence: low`, always a real search/booking link (Google Flights / search). Never exact live prices, schedules, seats, or confirmations.
- UI labels every option: ✓ Verified / ≈ Estimate / ? Confirm live.
- **Current production reality:** `GOOGLE_MAPS_API_KEY` is a placeholder → all drive legs render as labeled **estimates**; they upgrade to "verified" automatically when a real key is set (no code change).

## 5. Ride/tour booking handoff behavior
- "Request DuLichCali Ride" (on any `dlc_ride` option) builds a DRAFT from trip data (tripId, leg ref, pickup=fromCity, dropoff=toCity, passengers=Σ travelers, kids/seniors in notes) → `sessionStorage['dlc_ride_prefill']` → navigates to `/airport`.
- `ride-intake.js` gains an additive `RideIntake.openWithPrefill(draft)` + a boot consumer that opens the **existing** ride modal prefilled. The user reviews and submits through the normal flow: `BookingGuard.guardedWrite` (duplicate prevention) → `bookings` + `rideNotifications` + `dispatchQueue` → `onRideBookingCreated` → `sendDriverRidePush`. **No booking is auto-created** (status `dispatching`/`vendor_review` → admin/driver confirm).
- Tour/day-driver requests link to the separate, real `/tour` booking system (not duplicated).

## 6. UI changes
- New **Transport tab** ("🧭 How you'll get there") right after Itinerary. Per-leg cards: legType + route + dayHint badges, verified drive distance/time + source tag, "💡 Why AI recommends this", choose-by chips (Recommended / Lowest cost / Fastest / Most comfortable / Private ride), chosen option highlighted + "Compare options" expander, per-option status/cost/suitability/pros/cons + booking link or "Request DuLichCali Ride". A dedicated **🏁 Return journey (final day)** card. Mobile-first CSS (`tc-tpleg`/`tc-tpopt` + 768/1200 breakpoints). All strings vi/en/es.
- Selecting an option that affects arrival/return timing opens the existing itinerary **replan** options (Keep / Re-optimize / Reset) on the affected day — drag/drop edits preserved.

## 7. Tests run and results
- `/tmp/tc_transport.js` — **29/29** (renders legs/options/return card; does NOT default to car when flight is recommended; choose-by-criterion picks correct option; choice persists + sets family method + flags itinerary replan; DLC draft handoff stashes prefill + navigates to /airport + writes NO booking; estimate labels shown; DLC option only when present; vi/es no-throw).
- Existing concierge smokes green: V2 intake **23/23**, itinerary-control **38/38**, render **17/17**.
- `node --check` on travel-concierge.js, functions/index.js, ride-intake.js — OK. Control-byte scan: 0.
- i18n: **618 keys ×3, 0 parity gaps**.
- `targeted_dry_run.sh booking` (ride regression) — **FINAL: PASS**. `full_system_dry_run.sh` — **FINAL: PASS** (73 rules cases). Travel scope — PASS. Mobile Barber: untouched, no regression.

## 8. Deployment verification
- Functions: `researchTripTransport` (created), `computeTripRoute` (updated to shared helper). Hosting deployed with mobile-barber WIP excluded (stash-deploy-pop).
- Production `www.dulichcali21.com`: serves `travel-concierge.js/.css?v=20260620z` + `ride-intake.js?v=20260620a`; deployed JS contains `renderTransport`/`researchTripTransport`/`requestDlcRide`; `ride-intake.js` contains `openWithPrefill`/`dlc_ride_prefill`; `researchTripTransport` callable returns HTTP 200; mobile-barber.js = 221662 (committed, WIP excluded).
- Held from `git push` (per session rule) until iPhone testing.

## 9. Known limitations
- `GOOGLE_MAPS_API_KEY` placeholder → drive distances are labeled estimates (not live). Set a real key to upgrade to verified, no code change.
- No flight/bus/train live data source exists → those are AI estimates + search links ("pending verification"). Honest by design.
- The transport-agent server callable isn't unit-tested in Node (needs Gemini); the frontend rendering/logic + handoff are fully tested with a fixture.
- DLC private-ride fare isn't shown on the concierge card (pricing.js lives in the ride flow) — the exact fare appears in the RideIntake handoff. The card shows verified distance/time + "fare shown on request".
- Itinerary re-timing on transport change reuses the existing day-level replan (Keep/Re-optimize/Reset) rather than a bespoke transport re-timer.

## 10. Remaining work for Phase I (Social Media Agent)
- Reuse the existing AI Social Media Agent to generate, from a completed trip: Facebook reels / TikTok videos / vacation albums / photo highlights / memory videos, with Amazon Photos storage support.
- Integration points already in place: `trip.plan` (itinerary), `trip.transport`, `trip.stays`/`food`, real Google Places/Wikipedia photos (`placePhotos`), and per-family/group data. A `generateTripSocialKit` callable + a "Share / Memories" tab would mirror the agent pattern (mkCallable → tab). No fabricated media — only user/real photos + AI captions/edits.

