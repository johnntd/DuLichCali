# Stay Intelligence Engine — Design Spec

**Date:** 2026-06-23
**Surface:** Travel Concierge (`/travel-concierge`)
**Branch:** `travel-concierge`
**Status:** Approved — implementing

## Problem

The Travel Concierge recommends a hotel as if it were a final answer. When the user
rejects it (too expensive, sold out, low rating, bad location, no breakfast, parking
fee, loyalty/points preference, friend recommendation) there is no graceful recovery —
they would have to rebuild the trip. Hotels must be treated as **candidates**, not
verdicts, exactly like Transport Intelligence treats transport modes.

## Goal

Build Stay Intelligence mirroring Transport Intelligence: recommend → alternatives →
user replacement → preserve itinerary → re-optimize around the chosen hotel → track
deals → vote → lock. **No itinerary rebuild required to change a hotel.**

## Approach

Mirror Transport Intelligence 1:1 and **extend** the existing Stay tab (`renderStays`,
travel-concierge.js:6731) rather than rewrite it. Clone the proven choice→persist→
re-optimize loop; reuse the already lock/pin-aware replan engine.

| Transport (template) | Stay (build) |
|---|---|
| `trip.transportChoice` | `trip.stayChoice = { '<destKey>': '<hotelKey>' }` |
| `trip.transportStatus` | `trip.stayStatus = { '<destKey>': 'planning'\|'booked' }` |
| `chooseTransport` (6893) | `chooseStay(destIdx, hotelKey)` |
| `transportChoiceTasks` (1387) | `stayChoiceTasks(tr)` |
| `legKeyOf` (6842) | `stayKeyOf(stay, hotel)` / `destKeyOf` |
| `tpPick(leg, criterion)` (6850) | `stayPick(destIdx, criterion)` |
| `applyTransportResult` (7005) | `applyStaysResult` (extend existing) |

## Decisions (locked with user 2026-06-23)

1. **Price/Deal-Watch data:** Honest AI-researched **ranges** labeled "estimate — verify
   on Booking", with real operator links for live prices. Deal Watch = periodic
   re-research flagging a lower *estimate* (not live scraping). Schema carries
   `verificationSource`-style hooks so a real price API can plug in later. **Never** show
   the spec's literal $850/$320/$180 as quotes.
2. **Re-optimize depth:** **Auto full re-optimization** — choosing/locking a hotel
   re-anchors the leg and re-times restaurants/attractions/rest/rides, preserving pinned
   + locked items.
3. **Cost engine:** estimated + actual + who-paid + per-room/per-family split +
   per-family remaining-balance. **No** pairwise settlement.
4. **Scope:** Full 12-part build, then deploy this pass (overrides the usual
   hold-until-iPhone-testing practice; mobile-barber promo WIP stashed out of the
   full-disk hosting snapshot then restored).

## Data Model (on the trip object)

```
trip.stayChoice   = { '<destKey>': '<hotelKey>' }          // one selected hotel / destination
trip.stayStatus   = { '<destKey>': 'planning'|'booked' }
trip.lockedStays  = { '<destKey>': { hotelKey, checkIn, checkOut } }
trip.dealWatch    = boolean                                 // reuse
trip.dealSnapshot['hotel:<city>:<name>'] = { cost, ts }     // reuse
trip.dealSavingsLog / trip.dealAlerts                       // reuse
trip.costLedger[]                                           // reuse + hotel entries

// per-hotel (added to existing Hotel objects in trip.stays[i].hotels[])
{ ...existing, tier:'premium'|'best_value'|'budget', chosen, locked, avoided,
  coords:{lat,lng}, perRoomCost, perFamilyCost, userEntered, fitScore,
  estimatedCost, actualCost, paidBy, split:'per_room'|'per_family', assignedFamilies[] }

// per-destination anchor (read by replan)
trip.destinations[i].selectedHotel = { name, coords, hotelKey }
```

`destKeyOf(dest, i)` = stable key `'dest:' + city + ':' + i` (mirrors `legKeyOf`).

## Components

### 1. Candidates & Tiers (Parts 1, 3)
- Research returns ≥3 hotels/area spanning **Premium / Best Value ⭐ / Budget**, each
  tagged `tier`. Client `computeStayTier(hotel, citySet)` buckets by parsed price range
  as a fallback so a tier always renders. **Never render only one hotel.**
- **Alternatives panel** under the current pick: filter chips → Best Value · Budget ·
  Closest to Attraction · Beachfront · Family Friendly · Luxury · Points Friendly · More.
  Each → `stayPick(destIdx, criterion)` (clone of `tpPick`). "Points friendly" = chain
  brand match (Marriott/Hilton/Hyatt/IHG).
- **Budget warning** chip when a hotel's parsed nightly midpoint exceeds the family's
  per-night allocation (computed from the family's own stated budget — not a market price).

### 2. Replacement (Parts 2, 4)
- **[Too expensive]** → max-nightly input → re-research **only that city's** hotels with
  a `maxNightly` cap; itinerary/attractions/transport/restaurants untouched.
- **[Enter your own hotel]** → `researchUserPlace` (functions:2557) pulls real
  Google/Wikipedia rating + distances → `scoreHotelFit(trip, dest, place)` → **Excellent /
  Good / Poor** → "Use this hotel" → `chooseStay` + re-optimize.

### 3. Choose / Lock / Re-optimize (Parts 5, 6) — CORE
`chooseStay(destIdx, hotelKey)`:
1. set `selectedHotel` + coords; persist (`saveTrip`)
2. cost delta vs prior → `dealSavingsLog`
3. anchor `trip.destinations[i].hotel`/`selectedHotel`
4. `regenerateLeg(destIdx)` (4823) — re-times restaurants/attractions/rest, preserving
   pinned + locked
5. `verifyRoute(tr)` (4025) re-run with hotel coords on arrival/departure legs
6. re-anchor Michael/DLC ride pickup & dropoff to hotel coords via ride-task prefill.
   **If a ride is already booked → flag for re-confirm; never silently mutate a booked
   ride.** `reconcileRideResult`/`syncRideBookings` stay untouched.
7. `stayChoiceTasks(tr)` re-derive hotel booking tasks
8. re-render

**Lock** 🔒 → `trip.lockedStays[destKey]` + feed replan graph as a pin so future replans
never replace it (preserve hotel + check-in/out dates).

### 4. Tasks (Part 9)
Per-destination chain via `TCDepGraph`/`deriveTripTasks` (1410): **Research → Choose →
Book → Confirm → Track cost → Complete**, dependency-ordered (Choose blocked-by Research,
etc.). `nextAction`/`naCard` surface them automatically. `hotel_book` = P0.

### 5. Cost (Part 10)
`estimatedCost` (nights × range midpoint), `actualCost` (user-entered post-booking),
`paidBy`, per-room/per-family `split` (rooms = ceil(travelers/4)), `assignedFamilies`,
→ ledger entries on confirm (mirror ride ledger pattern 7222); per-family remaining
balance via existing `computeBalances`. No pairwise settlement.

### 6. Deal Watch (Part 7) + Voting (Part 8)
- Deal Watch: re-research compares new estimate to snapshot; drop ≥ $25 **and** ≥10%
  (`_dealThreshold.isMeaningfulDrop`) → alert "Updated research shows ~$X/night lower —
  verify on Booking. Switch?" **Never auto-switches.** Labeled research-based.
- Voting: reuse `voteRow`/`consensusFor`; add `pickStayWinner` ranking by vote weight +
  fit → "Group's pick: X" banner + "Make this the pick" (no auto-select).

### 7. UI (Part 11) — Stay tab sections (like Transport)
Current Pick → Tiers row → Alternatives → Deals → Votes → Locked Hotels → Cost Summary →
Booking Status. New `.tc-stayintel__*` CSS: mobile-first base + `@media 768px` + `@media
1200px`. All new strings in **vi/en/es** same commit.

### 8. Honesty (hard rule)
Prices = ranges + "estimate — verify on Booking", never literal quotes. Photos/ratings
only via existing `placeMedia` (Google Places → Wikipedia → labeled no-photo). Deal
alerts labeled "updated research, pending verification."

## Acceptance Test (Part 12)
SJ→OC→SD→OC→SJ; del Coronado (Premium) → **Too expensive / $250** → re-research SD ≤$250
→ 3 ranged options → select Hilton Garden Inn → `chooseStay` → lock → `regenerateLeg`
re-times SD restaurants + Michael rides + costs, trip preserved.
**PASS = hotel changed without rebuilding the itinerary.**

## Files / Versions / Deploy
- `travel-concierge.js` (bulk), `tc-tasks.js`, `tc-depgraph.js`, `functions/index.js`
  (`researchTripStays` extensions + `scoreHotelFit`/`pickStayWinner`),
  `travel-concierge.css`, vi/en/es i18n, new `tests/tc-stays.test.js`.
- Bump `?v=` in `travel-concierge.html` (only consumer):
  `travel-concierge.js` `20260622t`→`20260623a`, `tc-tasks.js` `20260622n`→`20260623a`,
  `tc-depgraph.js` `20260622k`→`20260623a`. (Verified: current = highest ever.)
- Gate: `scripts/ai/full_system_dry_run.sh` must end `FINAL: PASS`.
- Deploy: commit on `travel-concierge` → `firebase deploy --only hosting` (stash
  `assets/mobile-barber/clips/dulichcali-promo-preview.*` + uncommitted
  `mobile-barber/mobile-barber.js` out of the snapshot, then restore) → verify
  `https://www.dulichcali21.com`.

## Out of scope
Pairwise inter-family settlement; live hotel-price API; realtime onSnapshot voting
(refresh-to-see retained); Airbnb specific-listing data (areas only).
