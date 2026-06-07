# Ride / Airport Pickup Pricing — "$120 for 10 miles" Bug Audit & Fix

**Date:** 2026-06-07
**Reported:** Airport pickup, 3 passengers, ~10 miles → quoted **$120** (3–4× Uber for that trip).
**Status:** Root cause CONFIRMED (deterministically reproduced) · Fix APPLIED · 16/16 pricing tests pass · **Not yet deployed.**
**Method:** Traced the real quote path; ran `pricing.js` pure functions directly with the repro inputs (no guessing).

---

## TL;DR

The price was **not** computed from distance — it was a **flat minimum-fare floor**. `pricing.js` had per-vehicle floors **`dlcMin` = $100 (Tesla) / $120 (Sienna) / $140 (Van)** applied *after* the metered fare. For a 10-mile ride the metered fare is only **~$27 (Tesla)** / **~$35 (Sienna)**, so the floor dominated and forced **$100–$120**. The literal **$120** is the **Toyota Sienna floor**, hit when a Sienna is selected — i.e. **4 passengers in SoCal** or **3 passengers in the Bay Area** (Sienna-only fleet).

Fix: lowered the floors to competitive minimums ($25/$35/$55), added an explicit **once-per-trip airport fee** ($5, never per-passenger), and exposed a **shared-ride price**. A 10-mile / 3-passenger airport pickup now quotes **$35** (SoCal) / **$45** (Bay Area).

---

## 1. Exact files & functions involved

| File | Function / line | Role |
|---|---|---|
| `ride-intake.js` | `_updatePrice()` → `DLCPricing.quoteRide(...)` (lines ~1297, 1302, 1311) | The airport/ride intake form's quote call. Single quote source for the modal. |
| `pricing.js` | **`quoteRide()`** (line ~90) | **The engine that produced $120.** Metered fare + floor. |
| `pricing.js` | `VEHICLE_RATE_CARDS` (line ~339) | Holds the offending **`dlcMin`** floors (100/120/140). |
| `pricing.js` | `getVehicle()` (line ~347) | Passenger → vehicle tier (drives which floor applies). |
| `pricing.js` | `transferCost()` (line ~389) | **Second engine** used by AI chat (`chat.js`, `workflowEngine.js`) + booking wizard (`script.js`). Had the *same* flat floors (140/120/100). |
| `ride-booking.js` | `DLCRide.resolveVehicle()` / `CAPACITY_MAP` | Capacity authority (Tesla maxPassengers **3**, 4→Sienna). Confirms the tier split is intentional. |
| `ride-intake.js` | save path (line ~1499 `bookings/{id}`; `estimatedPrice: _quote.dlcPrice` line ~1614) | Persists the **same** `_quote.dlcPrice` it displays → quote == saved by construction. |

## 2. Exact formula producing $120

In `quoteRide()` (before fix):
```
uberRaw   = base + bookingFee + totalMiles*perMile + durMins*perMin
uberEst   = max(uberRaw, minFare)
dlcRaw    = uberEst * (1 - 0.20)                 // 20% below Uber
dlcPrice  = ceil( max(dlcRaw, dlcMin) / 5 ) * 5  // ← dlcMin floor dominates short rides
```
For 10 mi / Toyota Sienna (`base 4, bookingFee 3.5, perMile 3.0, perMin 0.4, dlcMin 120`), ~17 min:
```
uberRaw  = 4 + 3.5 + 10*3.0 + 17*0.4 = 44.30
dlcRaw   = 44.30 * 0.80               = 35.44
dlcPrice = ceil( max(35.44, 120)/5 )*5 = ceil(120/5)*5 = $120   ← the floor, not the meter
```
**Deterministic reproduction (ran the real `pricing.js`):**

| Scenario | Vehicle selected | Metered (pre-floor) | **Quoted (old)** |
|---|---|---|---|
| 10mi · 1–3 pax (SoCal) | Tesla Model Y | ~$27 | **$100** (Tesla floor) |
| 10mi · 4–5 pax (SoCal) | Toyota Sienna | ~$35 | **$120** (Sienna floor) |
| 10mi · 3 pax (Bay Area) | Toyota Sienna | ~$35 | **$120** (Sienna floor) |
| 20mi · 3 pax (SoCal) | Tesla Model Y | ~$49 | **$100** (Tesla floor) |

## 3. Is $120 hardcoded?
**Yes.** `VEHICLE_RATE_CARDS['Toyota Sienna'].dlcMin = 120` (and `'Tesla Model Y'.dlcMin = 100`, `'Mercedes Van'.dlcMin = 140`) in `pricing.js`. Mirrored in `transferCost()`: `minFare = isVan ? 140 : isSienna ? 120 : 100`.

## 4. Does passenger count multiply incorrectly?
**No** — the engine does **not** multiply fare by passengers. It selects a vehicle tier and prices once. Confirmed: 1 pax and 3 pax both quote the same (same Tesla). The only passenger effect is the **vehicle bump** (4th passenger → Sienna), which raised the *floor* from $100→$120. With the new floors that bump is a modest +$10, not a multiple.

## 5. Is the airport minimum too high?
**Yes — this was the core problem.** The `dlcMin` floors *were* the de-facto airport minimum and sat at $100–$140 — 3–4× the metered price of a short ride. (Matches the prior finding in `docs/ride_pricing_competitiveness_audit.md` and `memory: ride pricing NO-GO`.)

## 6. Is the shared-ride discount missing?
**Yes (before fix).** No shared/pool option existed anywhere in the engine — only a single private fare. Added now (§9).

## 7. Is distance/time calculation wrong?
**No.** `ride-intake.js` feeds real Google Routes miles + duration into `quoteRide`; the metered math is correct. The floor simply **overrode** the correct metered value for short trips.

## 8. Do 3 passengers trigger XL/premium incorrectly?
**Not incorrectly, but it's the trigger of the literal $120.** In SoCal, 3 pax → Tesla (correct). In the Bay Area (Sienna-only fleet) 3 pax → Sienna, and in SoCal 4 pax → Sienna — and the Sienna's $120 floor is what surfaced. The vehicle tiering itself matches the capacity authority `DLCRide` (Tesla maxPassengers 3; 4+ → Sienna), so **the tiering was left unchanged** — changing it (e.g. "1–4 in a Tesla") would desync the quote from actual dispatch/capacity. The fix targets the floor, not the tiering.

## 9. Recommended competitive pricing fix — APPLIED

Implemented in `pricing.js`, matching the requested model `baseFare + distanceRate*miles + timeRate*minutes + airportFee`, shared = private × factor:

- **Lowered floors** (`dlcMin`): Tesla **$25** (was 100), Sienna **$35** (was 120), Van **$55** (was 140). Mirror floors in `transferCost()` lowered to 25/35/55.
- **Airport fee, once per trip:** `AIRPORT_FEE = $5`, added a single time for `airport` trips (pickup/dropoff), **never per passenger**. `ride-intake.js` passes `airport: (_type==='pickup'||_type==='dropoff')`; generic `ride` pays no airport fee.
- **Shared ride:** `SHARED_DISCOUNT_FACTOR = 0.6`; `quoteRide` now returns `sharedPrice` (private × 0.6, own lower floor). Engine-ready; wiring a Private/Shared toggle into the UI is a recommended follow-up.
- Passenger count still selects a vehicle (never multiplies); tiering unchanged (aligned with `DLCRide`).

**After fix (airport pickup):**

| Scenario | Vehicle | Uber est | **DLC private** | DLC shared | Was |
|---|---|---|---|---|---|
| 10mi · 1 pax | Tesla | $34 | **$35** | $20 | $100 |
| 10mi · 3 pax (SoCal) | Tesla | $34 | **$35** | $20 | $100 |
| 10mi · 3 pax (Bay Area) | Sienna | $44 | **$45** | $25 | **$120** |
| 10mi · 4 pax | Sienna | $44 | **$45** | $25 | $120 |
| 10mi · 5 pax | Sienna | $44 | **$45** | $25 | $120 |
| 20mi · 3 pax | Tesla | $62 | **$55** | $35 | $100 |

## Competitive check (10-mile ride)
Reasonable UberX/UberXL for 10 mi in CA ≈ **$25–$40**. New DLC private = **$35 (Tesla) / $45 (Sienna)** — at/near market (not 2–3× higher); shared = **$20–$25** (cheaper than UberX), satisfying "near UberX for private, cheaper for shared."

## Tests — `tests/pricing.test.js` (`npm run test:pricing`)
Loads the real `pricing.js` and asserts all requested cases. **16 passed, 0 failed:**
1. 10mi/1 pax competitive · 2. 10mi/3 pax ≠ $120/$100 · 2b. Bay-Area 3 pax ≠ $120 · 3. 10mi/4 pax (Sienna) · 4. 10mi/5 pax · 5. 20mi/3 pax distance-scaled · 6. shared < private · 7. pax does not multiply (1==3; 3 not tripled; 4 modest) · 8. no short ride forced to $120 · 9. airport fee once (equal for 1 vs 3 pax; absent on non-airport) · 10. saved `estimatedPrice` == displayed `_quote.dlcPrice` (static contract) · 11. `transferCost` (AI/wizard) also competitive.

## Files changed
- `pricing.js` — floors, airport fee, shared price, `transferCost`/`estimateTransfer` alignment.
- `ride-intake.js` — pass `airport` flag to `quoteRide`.
- `tests/pricing.test.js` — new harness. `package.json` — `test:pricing` script.
- Cache-busting `?v=` bumped to `20260607a` in `index.html` (pricing.js, ride-intake.js, destinations.js, workflowEngine.js, script.js), `airport.html` + `travel.html` (pricing.js, ride-intake.js).

### Post-review straggler fixes (found by adversarial review — 4 surfaces still showing old prices)
An adversarial 3-agent review (math + missed-surfaces + regression) confirmed the core engine is correct, and caught **other surfaces that still emitted the old floors**. All fixed:
- `workflowEngine.js:1139` — AI ride-estimate **fallback** floor `150/120/100` → `55/35/25`.
- `script.js:881` — booking-wizard `fallbackTransfer()` floor `120/100` → `35/25`.
- `destinations.js:597-598` — home-screen QUICK_ESTIMATES airport pickup/dropoff teaser `'từ $100'` → `'từ $35'`.
- `destinations.js:655` — AI system-context `'Starting from $100'` → `'Starting from $35'`.

*(Pre-existing, NOT changed: the `detail`/AI vehicle descriptions say "Tesla (≤3) / Mercedes Van (≥4)" and omit the Sienna 4–7 tier — a cosmetic doc inconsistency unrelated to the price bug; flagged for a future copy pass.)*

## Verification
- `npm run test:pricing` → **16 passed, 0 failed**.
- `node --check` on all 5 edited JS files → clean.
- `scripts/ai/full_system_dry_run.sh` → **FINAL: PASS** (incl. 36-case Firestore rules emulator suite).
- Adversarial review: math = PASS, regression = PASS, missed-surfaces = CONCERNS → all 4 concerns now resolved.

## Not broken (verified by scope)
Ride booking, driver assignment, airport flow (same quote/save shape; `dlcPrice` unchanged key), Michael owner portal (untouched), active/inactive driver filtering (untouched), existing saved bookings (stored prices not recomputed). Vehicle tiering unchanged → dispatch/capacity stays consistent.

## Recommended follow-ups
- Add a **Private / Shared** toggle in `ride-intake.js` to surface `sharedPrice`.
- Revisit `memory: ride pricing NO-GO` — short rides are now competitive; re-evaluate launch posture.
- Consider luggage-based surcharge (the engine has the hook; not auto-applied).
