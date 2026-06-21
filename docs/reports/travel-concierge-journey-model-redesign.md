# Travel Concierge — Multi-Stop Journey Model Redesign (Architecture Audit + P0–P5 Plan)

Date: 2026-06-21 · Status: **DESIGN — not implemented** (awaiting approval per "Do NOT implement immediately")

## Goal
Replace the `Origin → Destination → Return` assumption with an explicit, user-defined
multi-stop **Journey** of `TripSegment[]`. The user defines WHERE + WHEN (per stop);
the AI optimizes transport/hotels/activities WITHIN those constraints and never reorders
or overrides the user's stops.

---

## 1. Architecture Audit — current state

| Concern | Today | Verdict |
|---|---|---|
| Stops | `trip.destinations[]` ordered, each `{ id, order, city, startDate, endDate, hotel, notes, hoursToSpend, hotelPrefs[], role }` (`newDestination` L2414) | **Reuse** — already ordered + has date fields |
| Dates | Single free-text `trip.dateRange` → `parseTripDates()` → flat `dateList` → **skeleton AI assigns each date to a destination** (`day.destinationIndex`) | **Invert** — segments must drive dates |
| Nights per stop | Not explicit. Implied by `role` (`overnight_destination`) + AI split | **Add** `nights` / `overnightStay` |
| Day → stop mapping | AI-decided in `generateTripSkeleton`; known GOTCHA: skeleton re-indexes / injects departureCity → prompt must "echo exact input" | **Make deterministic** from segment dates |
| Transport | Global per-leg AI research: `researchTransport` → `trip.transport[]` (`{fromCity,toCity,legType,options[]}`), user picks mode → `trip.transportChoice[legKey]` (`legKeyOf` L5223) | **Reuse engine**, drive from per-segment prefs |
| Transport provider | No per-segment `preferredProvider` (e.g. "Xe Đò Hoàng", "Michael") | **Add** |
| Transfer within arrival (OC→SD via Michael) | `TransportConnectionPlan` + `connectionPlanCard` (L5548) exist | **Reuse**, drive from segment |
| Destination intelligence | Per-destination agents already exist: stays, food, attractions, events, stopovers, tours, hidden-gems (`runConciergeResearch` L2711) | **Reuse as-is** |
| User modification | Segment add/delete/reorder already in `destinationsEditor` (L2518); activity move/skip/replace/lock/add in itinerary control engine; voting + re-optimize exist | **Reuse**, extend to dates/nights/transport |
| Booking attach | DLC ride handoff keyed by `legKey`: `requestDlcInquiry` (L5295) + `reconcileRideResult` → Bookings/Costs/Transport/notes | **Reuse**, re-key by segment |
| Create UI | `renderCreate` (L2566): Origin + city-only `destinationsEditor` + one global `dateRange` + AI-defaults | **Replace** with Journey Builder |

**Bottom line:** ~70% of the machinery exists. This is an *extension + inversion*, not a rewrite.
The central change is **who owns the calendar**: today the AI splits one date range; in the
new model each segment owns its own arrival/departure, the trip date range is *derived*, and the
day→segment assignment becomes deterministic.

---

## P0 — Architecture changes (core model + control flow)

1. **Promote `destinations[]` to the Segment model (extend, don't fork).** Keep the
   `trip.destinations[]` storage key (huge blast radius otherwise — plan `destinationIndex`,
   legDays, roles, hotelStatus, placeOverrides, costs all key off it). Expose `trip.segments`
   as an **alias/getter** over the same array so new code reads naturally.
2. **New canonical segment fields** (additive):
   `arrivalDate`, `departureDate` (canonical; `startDate`/`endDate` kept as aliases for back-compat),
   `nights` (derived from dates, editable), `overnightStay` (bool), `transportPreference`
   (`bus|private_ride|flight|car|train|any`), `preferredProvider` (free text, e.g. "Xe Đò Hoàng",
   "Michael / DuLichCali"), `notes`. `transportPreference`/`preferredProvider` describe the
   **inbound leg** to that segment.
3. **Invert date ownership.** `deriveDateRange(trip)` computes `trip.dateRange` from
   `min(arrivalDate) … max(departureDate)`. `dateRange` becomes a derived display string, not the
   source of truth. (Free-text `dateRange` still accepted for legacy/quick entry → back-filled to
   segment dates.)
4. **Deterministic day→segment mapping.** New pure `buildSegmentDayPlan(trip)` expands each
   segment's `[arrivalDate, departureDate]` into concrete day stubs with a fixed `destinationIndex`
   + `date` + travel/return flags — **before** any AI call. The AI no longer decides which date
   belongs to which stop; it only fills each day's *content* within fixed boundaries.
5. **Constraint contract for the AI:** "segment order, stop set, and per-stop dates are LOCKED;
   optimize only within." Encoded both in the deterministic stubs (hard guarantee) and in the
   prompts (soft instruction). Removes the existing re-index/drop GOTCHA by construction.

## P1 — Firestore changes

1. **No rules change required.** Segments live inside the existing `groupTrips/{tripId}` doc; the
   own-only / member / share rules already cover them. (Confirm in the rules-test run.)
2. **Schema (doc-shape) additions only**, all optional + back-compat:
   `groupTrips/{id}.destinations[]` gains `arrivalDate, departureDate, nights, overnightStay,
   transportPreference, preferredProvider`. `transportChoice` / `bookings[]` gain a `segmentId`
   back-reference so a booking survives reorder/rename (today they key by `legKey` = city pair +
   index, which breaks on reorder).
3. **Migration-safe reads:** `normalizeDestinations()` back-fills the new fields from existing
   `startDate/endDate/role` so old trips load unchanged.
4. Add segment/journey cases to `tests/rules/firestore-rules.test.js` only if any new subdoc is
   introduced (current plan: none → just re-run the 113-case suite as regression).

## P2 — UI changes (Journey Builder)

1. **Replace** the create screen's `Origin + city-list + single dateRange` with a **Journey
   Builder**: `Home (origin)` → `Segment 1 … Segment N` → implicit `Return`.
2. **Segment card** (mobile-first, 3-field-max progressive disclosure per the customer-form rule):
   - Primary: destination city · arrival date · departure date (nights auto-computed + editable).
   - Collapsed "Transport & details (optional)": `transportPreference` chips, `preferredProvider`
     input, `overnightStay` toggle, notes.
   - Controls already present in `destinationRow`: reorder ↑↓, remove ×, add.
3. **Journey summary strip:** "2 nights San Diego · 1 night Orange County · home Jul 4" derived
   live from segments (the "desired outcome" readout).
4. **Inter-segment transport row** between cards ("San Jose → Orange County via Xe Đò Hoàng"),
   editable, showing the chosen/awaiting provider.
5. i18n vi/en/es for every new label; mobile 375 + tablet 768 + desktop 1200; reduced-motion.
6. Keep a **"Quick entry"** affordance (paste a single date range) that expands into segments, so
   the V2 simplicity isn't lost for single-stop trips.

## P3 — AI planner changes

1. **`generateTripSkeleton` loses date-assignment authority.** It receives the deterministic
   `buildSegmentDayPlan` stubs and only proposes a per-day *theme/title* + `hotelSuggestion` per
   segment. Stops/dates/order are passed as immutable.
2. **`generateLegDays`** already takes per-leg `startDate/endDate/role/hotelNeeded` + `daySpecs` —
   feed it the deterministic per-segment stubs (no structural change, just the new source).
3. **Transport agents honor segment prefs.** `researchTransport` / `researchTransportStrategies` /
   `connectionPlanCard` receive each segment's `transportPreference` + `preferredProvider` as
   constraints; AI researches real schedules/times/buffers/luggage **within** the user's choice
   (e.g. user said "private ride / Michael" → AI plans the Michael leg + transfer + buffers, does
   not substitute a bus). No hardcoded schedules — existing grounded research + Maps route legs;
   everything stays `*_pending_verification`.
4. **Destination intelligence per segment** (stays / eat / do / events / hidden gems / stopovers) —
   already runs per destination via `runConciergeResearch`; now scoped by `nights` (e.g. 2-night SD
   gets a fuller plan than 1-night OC). No new agents; pass segment context.
5. **Re-optimize after votes** (existing `optimizeRebuild`) re-runs within the locked segment
   boundaries.

## P4 — Booking integration changes

1. **Key bookings/transport by `segmentId`** (stable) in addition to `legKey` (positional), so a
   ride stays attached after reorder/rename.
2. **DLC ride round-trip** (just shipped) extended: `requestDlcInquiry` carries `segmentId`;
   `reconcileRideResult` attaches the confirmed ride to the segment → marks segment transport
   booked, updates Costs, notifications, Bookings tab, returns to the trip. (Reuses the existing
   handoff; only the key changes.)
3. Per-segment booking status surfaced on the segment card + Journey summary.

## P5 — Migration strategy

1. **Forward-compatible normalize.** `normalizeDestinations()` back-fills `arrivalDate/
   departureDate/nights/overnightStay` from existing `startDate/endDate/role` (or, if only a global
   `dateRange` exists, runs the *old* AI split once and writes the result back as explicit segment
   dates — a one-time upgrade per trip on first open).
2. **No destructive migration / no batch job.** Old trips render via the legacy path until first
   edit; on save they're written in the new shape. `_demo`/sample trips updated to include segment
   dates.
3. **Feature parity gate:** single-stop trips must behave exactly as today (one segment, dates =
   dateRange). Multi-stop is the additive capability.
4. **Version bump** `?v=` on every deploy; staged behind the existing branch + iPhone-test hold.

---

## Incremental rollout (each step: build → unit tests → rules/regression → gate FINAL:PASS → deploy → verify prod)

- **Step A (P0+P1 model):** segment fields + `deriveDateRange` + `buildSegmentDayPlan` +
  `normalizeDestinations` back-fill. Pure-logic unit tests; no UI yet. Old trips unchanged.
- **Step B (P2 Journey Builder UI):** new create screen + segment cards + summary strip + i18n.
  DOM-shim tests at 375/768/1280.
- **Step C (P3 planner):** deterministic stubs into skeleton/legDays; transport agents honor
  segment prefs. Live-call verification (SJ→OC→SD→OC→SJ scenario).
- **Step D (P4 booking):** segmentId keying + ride handoff re-key + per-segment status.
- **Step E (P5 migration + samples + regression sweep):** legacy upgrade-on-open, sample trips,
  full gate, deploy.

## Risks / call-outs
- This **reverses V2 Phase A** ("radically simplified intake — AI determines roles/dates"). The
  Journey Builder reintroduces explicit per-stop dates by design; "Quick entry" preserves the
  simple path for single-stop trips.
- Booking re-key from `legKey`→`segmentId` must keep existing (already-deployed) ride handoff
  working — covered by the `tc_ridehandoff` suite + a new segment-key test.
- No hardcoded schedules/prices/providers anywhere — all via existing grounded research + Maps;
  labeled `pending_verification`. (`GOOGLE_MAPS_API_KEY` server key is a placeholder → routes/times
  degrade to labeled estimates, unchanged.)
