# Travel Concierge — Deal Intelligence + Best Experience Audit

**Date:** 2026-06-22 · **Mode:** read-only audit (no code changed, nothing deployed) · evidence-verified in code + UI.

---

## 0. HEADLINE — the "Booking failed" bug is a P0 that the research-layer audit didn't see

The screenshots ("Booking failed. Please call (408) 916-3439") are **not** a research/UI gap — they're a **Firestore-rules gap in the booking submit path**, and they mean the most important acceptance test actually **FAILS**: *Michael's ride cannot be booked from the app.*

**Definitive root cause (verified):**
1. Ride submit calls `BookingGuard.guardedWrite` (ride-intake.js:1535) because the booking resolves `ownerId='michael-nguyen'`.
2. For any disposition other than a hard block, `guardedWrite` runs a **Firestore transaction** that writes a lock doc to the **`bookingConflictLocks`** collection (booking-conflict-guard.js:511–521; `COLLECTIONS.locks`).
3. **There is no rule for `bookingConflictLocks`** → it falls through to the **deny-all** fallback `match /{document=**} { allow read, write: if false }` (firestore.rules:715). The transaction is **DENIED**.
4. `guardedWrite` has **no `.catch`** around `runTransaction`, so it rejects → ride-intake's `.catch(onError)` fires → **"Booking failed"**. (The booking doc is written *inside* the same transaction, so it isn't created either.)

**On your "outside the service area" hypothesis — you were close, and the logic IS worth fixing, but it's not the hard failure:** the radius check (`radiusDecision`, SERVICE_RADIUS_MILES=30) → `outside_service_radius`/`vendor_review_required` maps to disposition **`'review'`**, *not* `'block'` (`dispositionFor`, booking-conflict-guard.js:86–91). A 'review' does **not** show "Booking failed" — it would create a `vendor_review` booking. But because you're booking from the Bay Area with no coords, the radius is *unresolvable* → `'review'` → which still routes through the **same denied transaction** → fail. So the service-area path *triggers* it, but the actual stopper is the `bookingConflictLocks` rule gap — and it affects **every** customer ride booking (in-area `'confirm'` hits the same transaction), not just out-of-area ones.

**Why my earlier fix didn't fix it:** I made the *notification/dispatch* fan-out best-effort — but the **guard runs before the fan-out and is fatal**. I fixed the wrong write.

**Required fix (P0, two parts):**
- **Add a Firestore rule for `bookingConflictLocks`** (transient, low-sensitivity lock docs): `allow read, write: if true;` (mirrors `bookings create: if true`) — or `if request.auth != null` *only if* auth is guaranteed before the guard (it currently is not). → needs `firebase deploy --only firestore:rules`.
- **Make the guarded write non-fatal in ride-intake**: if `guardedWrite` throws, fall back to a plain `db.collection('bookings').doc(id).set(data)` (allowed by `create: if true`) so the booking is always created (conflict-detection degrades to server/admin). → frontend, defense-in-depth.
- Also fix the radius logic so a **valid out-of-area advance booking** (Bay Area customer, OC→SD ride) isn't pointlessly forced to `vendor_review` when coords are absent.

---

## 0b. Your dependency point — "complete Bus Hoang first so the system knows the arrival time to give Michael"

**Partly built (V6), one real gap.** The V6 dependency graph already (a) orders **transport-leg-1 (Bus Hoang) before the dependent ride (Michael)**, (b) marks Michael **blocked** until the prior leg is booked (`⚠ Waiting on an earlier step`), and (c) the Next-Action card surfaces Bus Hoang first. **Missing:** the **data hand-off** — when you book/confirm Bus Hoang with its **arrival date/time**, that arrival should auto-prefill Michael's pickup date/time (today the ride handoff prefills route but not a computed pickup time derived from the bus arrival). **Add:** capture `arrivalDate/arrivalTime` on the Bus Hoang task → flow it into the Michael ride draft's pickup time + show "pickup after bus arrival." (Roadmap P1 below.)

---

## A. Capability Matrix (condensed; full per-row evidence in the workflow output)

| Capability | Status | Evidence | Priority |
|---|---|---|---|
| Airfare search SJC/SFO/OAK → SAN/SNA/LGB/LAX, airline-specific | **PARTIAL** | generic city Google-Flights query, not airport-pair (index.js:3995) | P1 |
| Cheapest/fastest/best-family flight framing + timestamp + source | YES | index.js:3996–4005; tc UI 6787 | — |
| No fake flight prices (est. ranges + search links) | YES | index.js:3998 '(est.)'; grounded prompt | — |
| Transport comparison (Hoang/flight/car/Michael/Greyhound/FlixBus/Amtrak) | YES | tcBuildTransportLegs index.js:3944 (5+ modes) | — |
| User-required transport preserved, not overridden | YES | index.js:4081–4092 lockedByUser; UI tprec_userlocked | — |
| Alternatives shown without overriding | YES | tc 7060 chosen-first + Compare-all | — |
| Multiple hotels/Airbnb per city + price/rating/location/parking/family | YES | researchTripStays index.js:2511; stayCard | — |
| Hotel category spread (value/family/beach/budget/luxury) + links, no fake availability | YES | CATS index.js:2499; StayLinkProvider | — |
| Official ticket pages + book-early warning + tasks tracked | YES | ticketedAttractionBookings; warnBookSoon | — |
| **Theme-park/attraction DEAL hunting (multi-day, family bundles, early-bird)** | **PARTIAL** | only incidental via researchTripBookings; no dedicated agent | P1 |
| Best-time-to-book + due dates + urgent prioritization | YES | dueDate + TCDepGraph priorityScore/warnings | — |
| Deal-watch monitoring + web-push + never auto-changes plan | YES | monitorDealWatchTrips index.js:4220 | — |
| **Deal SAVINGS reflected in Costs after a switch** | **PARTIAL/FAIL** | chooseTransport doesn't recompute costs (tc 6741) | P0 |
| Per-family cost / who-paid / who-owes / split | YES | computeTripCosts/computeBalances; per-MEMBER WIP | — |
| Best-experience engine (beaches/parks/tours/events/food/hidden gems) + media/YouTube/reviews/official | YES | researchTripAttractions/Restaurants/Events; learnMoreSection/TCMedia | — |
| Dependency graph knows booking order | YES | tc-depgraph.js + buildDepNodes (V6) | — |
| User override / lock / add own place / AI fits choice | YES | lockedLegs; placeOverrides/addedPlaces; researchUserPlace | — |
| **Customer can actually BOOK the Michael ride** | **FAIL** | bookingConflictLocks deny-all → guard txn rejects (see §0) | **P0** |
| **Bus-arrival → Michael-pickup data hand-off** | **PARTIAL** | order/block exists; arrival time not propagated (see §0b) | P1 |

---

## B. Root Cause — why it doesn't yet *feel* like a real AI travel agent

It's genuinely a solid **honest research → organize → remind assistant** for this trip (locked-transport, dependency graph, cost tracking, notification-only deal-watch all verified working). Two things hold back the "real agent" feel:
1. **The honesty boundary is architectural, not a bug:** there is **no live pricing/availability API** for flights/hotels/tickets, and `GOOGLE_MAPS_API_KEY` is a placeholder — so every number is an "(est.)/pending verification" range and every link is a *search* link, never a live quote or a one-tap purchase. That's correct given "no fake data," but it reads as "research helper," not "agent that books."
2. **It can't actually close a booking** — the very thing that would make it feel like an agent (book Michael) is broken by the rules gap in §0.

---

## C. Deal-Intelligence Gap — what's used vs missing

- **Used (verified):** Gemini Google-Search grounding (fares/hotels/tickets/events/restaurants/tours → estimate ranges, real operator URLs); deterministic search links (`tc-media.js`, isSafeUrl-validated); hardcoded **verified** Xe Đò Hoàng data (xedohoang.com + 3 phones); StayLink/BookingLink providers; real-photo-only media; opt-in deal-watch monitor + web-push.
- **Missing:** any **live price/availability API**; **airport-pair** flight comparison; a **ticket-deal agent** (multi-day/family/early-bird); a **side-by-side** deal-comparison view; **weather**; a real Maps key; **assisted booking/checkout**.

## D. Data-Source Strategy (safe, honesty-preserving)

| Category | Recommended |
|---|---|
| Flights | Now: airport-pair Google Flights search links + grounded est. Later: Duffel/Amadeus (live quote ONLY when live-sourced) |
| Hotels | Now: Booking/Expedia/Hotels.com/Airbnb search links + grounded est. Later: Booking/Hotelbeds API |
| Tickets | Official park pages + a `researchTicketDeals` grounded agent (multi-day/family/early-bird) — links + book-by, no fake prices |
| Events | Now: grounded + search. Later: Ticketmaster Discovery (factual dates/links) |
| Restaurants | Google/Yelp/Tripadvisor search + grounded (already solid) |
| Weather | Open-Meteo / NWS (free, no key) → packing + indoor/outdoor nudges |
| Maps/distance | Replace placeholder `GOOGLE_MAPS_API_KEY`; keep haversine fallback labeled |
| Xe Đò Hoàng | Keep hardcoded verified operator data (real page + phones) |
| DuLichCali rides | The existing RideIntake handoff — once §0 is fixed |

## E. Implementation Roadmap

**P0 (now):**
- Fix the **booking failure** (§0): `bookingConflictLocks` rule + non-fatal guarded write + radius-review for valid out-of-area bookings.
- Propagate **deal-switch savings into Costs** (recompute on Switch; log "Deal savings" ledger entry).
- Guard deal-watch against estimate jitter (alert only on >10%/>$25 drops).

**P1 (deal search & comparison):**
- **Airport-pair** flight comparison (SJC/SFO/OAK → SAN/SNA/LGB) cheapest/fastest/best-family.
- **`researchTicketDeals`** agent (multi-day/family/early-bird).
- **Side-by-side** per-leg deal-comparison view.
- **Bus-arrival → Michael-pickup** data hand-off (§0b).
- Finish **per-member** assignment + cost (WIP checkpointed).

**P2 (deal-watch notifications):** extend watch to hotels + ticket pages; richer was→now→save copy; **weather** agent; real Maps key.

**P3 (advanced booking assistant):** live-pricing APIs behind the existing `{flight/bus/train:{low,high,url}}` contract (flip label only for live numbers); assisted booking/affiliate handoff with confirmation capture; Ticketmaster event inventory.

## F. Acceptance Tests — SJ→OC→SD→OC→SJ, Jul 1–4, family/moderate, Bus Hoang + Michael

| Expectation | Result | Evidence |
|---|---|---|
| Bus Hoang (SJ→OC) preserved as locked leg | **PASS** | index.js:4082 lockedByUser; UI tprec_userlocked |
| Michael (OC→SD, SD→OC) preserved in plan | **PASS** | index.js:4107; honored in itinerary prompt |
| Flight alternatives shown without overriding | **PARTIAL** | shown, but generic (not airport-pair) |
| Hotel deals: multiple + category spread, no fake prices | **PASS** | researchTripStays; stayCard |
| Ticket deals: official + book-early (+ discount hunting) | **PARTIAL** | official + warn YES; deal-hunting NO |
| Best booking order + single next action | **PASS** | tc-depgraph.js next-action |
| Costs tracked + deal savings reflected | **PARTIAL** | per-family YES; switch-savings NOT propagated |
| Tasks prioritized with due dates | **PASS** | priorityScore + dueDate |
| No fake prices / no fake schedules | **PASS** | est.-only + grounded + verified operators |
| **Michael ride can actually be BOOKED** | **FAIL** | bookingConflictLocks deny-all (§0) — the practical blocker |

**Verdict:** A correct, honest **research/organize/remind** assistant — but **not yet a booking agent**, and right now it **can't complete the Michael booking** (P0 §0). Fixing §0 + the deal-switch cost propagation are the immediate must-dos; airport-pair flights + ticket-deal agent + the bus→ride arrival hand-off are what start making it *feel* like a real agent.
