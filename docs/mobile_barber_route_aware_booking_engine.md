# Mobile Barber — Route-Aware Booking Engine

**Date:** 2026-06-01
**Goal:** Stop blindly accepting any open slot. Offer the *best* slots for a mobile barber's day —
factoring live schedule, live bookings, service duration, cleanup + travel buffers, travel time,
Google Maps address validation (with a safe fallback), distance, service radius, and route efficiency.
**Deploy (production `https://www.dulichcali21.com`):** Functions `createMobileBarberBookingGuarded`
(route gate) + new `validateAddressAndDistance` (Maps proxy); hosting
`mobile-barber-{booking,agent,data}.js?v=20260601c`, `mobile-barber.js?v=20260601c`.

---

## Algorithm design

Built **on top of** the existing machinery (no rebuild of availability):

- **Candidate generation** reuses `findNextAvailableSlots` → `checkWindowAvailability` (cutoff →
  weekly hours → blocks → overlap → BookingGuard). So **every scored candidate is already
  conflict-free** — the scorer only *ranks* by route quality, never re-checks conflicts.
- **`scoreMobileBarberSlot(opts)`** — pure, synchronous. Returns
  `{slot, score, reasons[], travelMinutesFromPrevious, travelMinutesToNext, gapBeforeMinutes,
  gapAfterMinutes, routeEfficiency, isRecommended}`.
- **`findBestMobileBarberSlots(opts)`** — pulls a conflict-free candidate pool (requested window
  first, then forward-fallback), scores each, drops hard-fails, sorts by score, returns the top 3–5
  each with a localized customer-friendly reason.

### Scoring model (named, tunable constants at the top of `mobile-barber-booking.js`)
Base 100, then:
- **Travel feasibility (hard):** available drive time = `gap + travelBuffer` (each window already
  reserves a generic buffer). If available < the **real** travel time → `score = -Infinity`,
  `travel_gap_insufficient`, excluded from offers (test 7). *Adding the buffer is essential — without
  it, back-to-back production slots (gap 0) would all false-fail.*
- **Travel fit:** a far neighbor (`maxTravel > 10`) → `-2·(travel-10)` capped −40 (test 6); a tight,
  sufficient adjacency (slack 0–30 min) → `+15`, `efficient_route_adjacent` (test 5).
- **Dead gap:** idle beyond travel `> 90 min` → `-0.15·idle` capped −30, `dead_gap` (test 8).
- **Service radius:** `distanceMiles > serviceRadiusMiles` (default 30) → `beyond_service_radius`,
  not recommended (test 4); else `-0.5·(miles-10)` capped −20.
- **Preference / earliest:** `-0.05·|cand-preferred|` capped −20, or `+8` earliest when no preference.
- **Address confidence:** `city_zip_only` → −10, `address_low_confidence`.
- `routeEfficiency = round(100·service / (service + travelFromPrev + travelToNext))`.
- `isRecommended = score ≥ 70 && !hardFail && distance ≤ radius && status ≠ 'invalid'`.

Travel times come from an **optional** `googleMapsTravelTimes` map (neighbor id/address → minutes);
absent entries fall back to the service `travelBuffer`, so the scorer works with or without Maps.

## Google Maps integration (server-side only)

`validateAddressAndDistance` (onCall, secret `GOOGLE_MAPS_API_KEY`) geocodes the address
(formattedAddress/lat/lng/placeId + `precise|approximate`) and measures distance/travel via Distance
Matrix. **The key is never exposed to the frontend.** When the key is missing/short/placeholder or
Maps errors, it **degrades** to a city/ZIP **centroid haversine** (×1.3 road factor) →
`addressValidationStatus:'city_zip_only'`, `routeConfidence:'low'`, `googleMapsUsed:false`. An empty
address → `invalid`. A Maps failure therefore **never blocks** booking — it only lowers confidence.
*(No real Maps key is configured yet; the secret holds a placeholder, so production runs the fallback
path today. Adding a real key via `firebase functions:secrets:set GOOGLE_MAPS_API_KEY` upgrades it
to precise geocoding + live travel times with no code change.)*

## Strict confirm gate (server-authoritative)

In `createMobileBarberBookingGuarded`, after the existing spam/conflict/intent checks and before the
write: an **unvalidated/invalid address** or **distance beyond the service radius** → `vendor_review`
(`address_unvalidated` / `beyond_service_radius`) — flagged for the barber, not hard-rejected (keeps
churn low). Window overlaps (existing `mbOverlaps`) and travel-gap infeasibility (scorer hard-fail,
slot never offered) remain the hard blocks. Booking confirmation still requires: address present,
slot conflict-free, travel buffer works, duplicate/spam pass, vendor active, service active.

## Booking snapshot

`buildBooking` persists address fields `{formattedAddress, lat, lng, placeId,
addressValidationStatus, distanceMiles, routeConfidence}` and
`routeOptimizationSnapshot {selectedSlotScore, selectedSlotReasons, travelFromPreviousMinutes,
travelToNextMinutes, gapBeforeMinutes, gapAfterMinutes, addressValidationStatus, distanceMiles,
googleMapsUsed}` — read from `input.routeContext`, all safe defaults. New field names were added to
the `BOOKING_FIELDS` whitelist + `validateBooking` (otherwise the strict `hasOnlyKnownFields` check
rejects every booking — the top regression risk, landed in the same change).

## All three channels use the one engine

- **AI chat:** `_offerFlexibleSlots` → `findBestMobileBarberSlots`; the offer lists each slot with a
  **localized reason** (`reasonAdjacent/Earliest/LessEfficient/Far/Address/Open` in vi/en/es); the
  picked slot's metrics flow into `routeContext` → snapshot.
- **Voice:** delegates to the same chat controller (`controller.sendMessage(..., {source:'ai_voice'})`)
  — identical engine, no separate path.
- **Manual form:** validates the address up-front (best-effort proxy → `routeContext`); on an
  unavailable time it surfaces the **best route-aware alternates** instead of dead-ending.

## Files changed
`mobile-barber/mobile-barber-booking.js` (scorer + findBest + `validateAddressAndDistance` wrapper +
snapshot), `mobile-barber-agent.js` (ranked offers + reasons + `routeContext` + forward `ctx.now`),
`mobile-barber.js` (manual route-aware + alternates), `mobile-barber-data.js` (whitelist + validators),
`functions/index.js` (Maps proxy + secret + guard gate), the 3 HTML consumers (`?v=20260601c`),
`tests/lib/mobile-barber-booking.js` (13 tests + date-stable fixtures), `tests/live/mb-route-aware-verify.js`,
+ test-window/version-pin updates in `mobile-barber-{landing,manual-booking,ai-style-booking}.js`.

## Tests run
- **Dry-run gate** `scripts/ai/full_system_dry_run.sh` → **FINAL: PASS — 597 passed, 0 failed**
  (includes the 13 route tests + the rules emulator step 12/12).
- **13 spec tests** (`tests/lib/mobile-barber-booking.js`): 1 all-day→3–5 sorted; 2 conflict→
  conflict-free alternates; 3 invalid→not recommended; 4 >30mi→flagged + guard `vendor_review`;
  5 nearby→adjacent ranks top; 6 far→downgraded; 7 gap-too-short→hard fail/excluded; 8 dead-gap→
  lower score; 9 manual uses engine; 10 AI chat ranked + reasons; 11 voice parity; 12 snapshot
  written + validates; 13 Maps fallback builds + scores via travelBuffer.
- **Live (deployed)** `tests/live/mb-route-aware-verify.js` → **6/6**: proxy responds; Maps-
  unavailable→`city_zip_only` (googleMapsUsed=false); centroid distance computed; empty→`invalid`;
  unvalidated→`vendor_review`/`address_unvalidated`; 50mi→`vendor_review`/`beyond_service_radius`.

## Limitations
- **No real Maps key yet** — production runs the city/ZIP centroid fallback (low confidence). Set
  `GOOGLE_MAPS_API_KEY` to enable precise geocoding + live travel times (no code change).
- Single vendor timezone assumed (PT). The exposed Firebase web key in the HTML is unchanged this
  pass (referrer-restricted; authoritative validation is server-side) — key hardening is a follow-up.
- Travel-time batching (`buildTravelTimesMap`, P1) not yet wired; the scorer uses the `travelBuffer`
  fallback in production until the per-pair map is computed up-front.

## Verdict
**PASS** — the booking engine now offers intelligent, route-aware, live-database time slots (scored
by travel/gap/cluster/distance/preference with customer-friendly reasons) across AI chat, voice, and
manual, instead of blindly accepting any open time; addresses are validated (Maps or safe fallback);
the server gate enforces address-validated + within-radius (→ vendor_review) and the snapshot is
persisted. 597/597 + 12/12 rules + 6/6 live, deployed to production.
