# Ride / Airport Pricing Competitiveness Audit — DuLichCali

**Date:** 2026-06-06
**Type:** Read-only audit + recommendations (NO pricing changes implemented)
**Method:** Extracted the actual pricing engine from code; modeled 2026 Uber/Lyft fares (sourced); built a 13-route distance/toll table; built a CA unit-economics cost model. All competitor numbers are **2026 estimates** (modeled from public aggregator rate cards, not official Uber/Lyft rate cards) — directionally reliable, not binding quotes.

> **GO / NO-GO: 🔴 NO-GO on current pricing.** DuLichCali is **uncompetitive on all 13 audited routes** (≈26%–420% above off-peak UberX) and **indefensibly overpriced on short rides** (SJC, SNA: 4–5× Uber) because a **flat $100/$120/$140 minimum fare** is applied regardless of distance, and **the Bay Area offers only the 7-seat Sienna** so solo riders pay minivan rates. Paradoxically, the *longest* run (Irvine→LAX) is priced slightly **below** DuLichCali's own deadhead-adjusted cost. The fix is structural (graduated minimums, a Bay-Area sedan tier, a real shared-ride discount, recalibrated rates), plus leaning on the genuine non-price advantage: **fixed, no-surge pricing** that beats Uber at peak.

---

## 1. Current pricing model (from code)

**Engine:** `pricing.js` (`quoteRide()` lines 90–114; `transferCost()` 389–415), vehicle tiers `pricing.js:65–74` + `ride-booking.js:35–75`, regions `regions.js`.

**Ride/airport fare formula:**
```
uberRaw  = base + bookingFee + miles·perMile + minutes·perMin
uberEst  = max(uberRaw, vehicle.minFare)
dlcRaw   = uberEst × (1 − 0.20)            # flat 20% “discount”
dlcPrice = ceil( max(dlcRaw, dlcMin) / 5 ) × 5   # floor + round up to $5
```

**Rate cards (`pricing.js:339–345`)** — note these are DuLichCali's *internal* "Uber-equivalent" estimate, **not** real Uber rates:

| Vehicle | base | $/mi | $/min | booking | minFare | **dlcMin floor** | Capacity |
|---|---|---|---|---|---|---|---|
| Tesla Model Y (sedan) | $3.00 | $2.30 | $0.30 | $2.50 | $25 | **$100** | 1–3 |
| Toyota Sienna | $4.00 | $3.00 | $0.40 | $3.50 | $35 | **$120** | 4–7 |
| Mercedes Van | $6.00 | $3.80 | $0.55 | $5.00 | $60 | **$140** | 8–12 |

**Key structural facts (the root causes):**
- **Flat distance-blind minimum:** `dlcMin` = $100/$120/$140. A 6-mile ride and a 40-mile ride both floor at the same price.
- **Bay Area = Sienna only** (`regions.js`): a solo Bay rider is charged 7-seat rates → **$120 floor on every Bay airport run**, even 6-mile San Jose→SJC.
- **Inflated baseline:** the engine's "Uber" per-mile ($2.30 sedan) is ~2× real Orange County UberX ($1.05/mi), so the "20% off" yields a number still well above market.
- **No shared-ride pricing exists at all** (grep: zero pool/split logic). Booking for 2 costs the same as 1.
- **No dynamic pricing:** no peak/off-peak, surge, senior, loyalty, or return-trip logic (`UBER_DISCOUNT=0.20` is constant).
- **Tolls are not added** to the ride fare by the engine.
- Travel-package OC departures carry a 1.45× surcharge (`travel-packages.js:49–52`) — separate from rides.

---

## 2. Uber / Lyft comparison (2026 off-peak estimates)

**Competitor parameters used** (sourced; per `uber-lyft-rates`): Bay UberX `$2.20 + $1.75/mi + $0.42/min + $3.10`; Bay Lyft `$3.50 + $1.55/mi + $0.32/min + $3.55`; OC UberX `$1.10 + $1.05/mi + $0.34/min + $3.40`; OC Lyft `$3.20 + $1.18/mi + $0.26/min + $3.05`. Airport fees: SFO $5.17, OAK $3.15, SJC $2.80, LAX $4 (CTA curb rising toward $12), SNA $3. Surge/Prime-Time typically **1.3–1.6× at rush, 2–3× at peaks** (applies to Uber/Lyft only, never to DuLichCali's fixed price).

**Route table — DuLichCali vs off-peak UberX/Lyft, plus DuLichCali's own deadhead-adjusted cost floor:**

| Route | mi / min | Veh (DLC) | **DLC price** | UberX | Lyft | DLC cost floor* | DLC vs UberX |
|---|---|---|---|---|---|---|---|
| **Bay Area** | | | | | | | |
| San Jose → SFO | 35 / 40 | Sienna | **$120** | ~$89 | ~$79 | ~$97 | +35% |
| San Jose → OAK | 35 / 40 | Sienna | **$120** | ~$87 | ~$77 | ~$97 | +38% |
| San Jose → SJC | 6 / 10 | Sienna | **$120** | ~$23 | ~$22 | ~$26 | **+420%** |
| Fremont → SFO | 30 / 35 | Sienna | **$120**† | ~$86† | ~$78† | ~$104† | +40% |
| Sunnyvale → SFO | 30 / 35 | Sienna | **$120** | ~$78 | ~$70 | ~$88 | +54% |
| Cupertino → SFO | 33 / 38 | Sienna | **$120** | ~$84 | ~$75 | ~$93 | +43% |
| Milpitas → SFO | 38 / 42 | Sienna | **$120** | ~$95 | ~$84 | ~$101 | +26% |
| **Orange County** | | | | | | | |
| Westminster → LAX | 33 / 38 | Sedan | **$100** | ~$56 | ~$59 | ~$81 | +79% |
| Garden Grove → LAX | 33 / 38 | Sedan | **$100** | ~$56 | ~$59 | ~$81 | +79% |
| Irvine → LAX | 43 / 50 | Sedan | **$100** | ~$71 | — | **~$104** | +41% **(below cost)** |
| Anaheim → LAX | 30 / 35 | Sedan | **$100** | ~$52 | ~$55 | ~$75 | +92% |
| Westminster → SNA | 11 / 16 | Sedan | **$100** | ~$25 | ~$27 | ~$35 | **+300%** |
| Garden Grove → SNA | 13 / 18 | Sedan | **$100** | ~$27 | ~$29 | ~$38 | **+270%** |

\* **Cost floor** = deadhead-adjusted minimum profitable fare (empty return doubles miles+time; +15 min airport wait; sedan $0.54/mi, Sienna ~$0.70/mi; driver $30/hr net). †Fremont→SFO incurs a ~$8.50 bridge toll each way; DuLichCali's fare excludes tolls, Uber passes them through.

**Reading the table:**
- DuLichCali is **above UberX on every route**, off-peak.
- **Short rides are the disaster:** San Jose→SJC and the SNA runs are **4–5× Uber** while DuLichCali's own cost is only ~$26–38. The flat floor is indefensible here.
- **Long airport runs** ($100–$120) are close to DuLichCali's *true* cost (~$80–104) thanks to deadhead — so they aren't "greedy," but they're still 26–90% over Uber and need a value story.
- **Irvine→LAX at $100 is slightly below its ~$104 cost floor** — the one genuinely *under*-priced route.

---

## 3. Shared-ride analysis

**Finding: there is no shared-ride product.** Two unrelated passengers cannot split a fare; a 2-passenger booking simply pays the full private fare ($100/$120). That is why "shared rides look too expensive" — there is no per-person saving at all.

**Recommended shared-ride model** (each rider pays a fraction of the private fare):

| Sharers | Each pays | Total collected | Driver vs private | Each rider saves |
|---|---|---|---|---|
| 2 | **65%** of private | 130% | **+30%** | **−35%** |
| 3 | **50%** | 150% | +50% | −50% |
| 4 | **42%** | 168% | +68% | −58% |

- **Recommended default discount: 35%** off private for the first co-rider (your example: private **$50 → shared $32–$35** each, not $48).
- **Min discount 30%, max 50%** (cap so the per-seat price never drops below the marginal cost of the extra stop/seat).
- Driver always nets **more** than a private trip (shared total > private), the customer saves a meaningful amount, and the per-seat price lands **below UberX** for medium/long routes — the one segment where DuLichCali can win on price.

---

## 4. Profitability analysis

**Model:** `min_fare = (loaded+deadhead miles)·(fuel+wear $/mi) + tolls(both crossings) + (loaded+deadhead+wait hours)·$30/hr`. Inputs (sourced): CA fuel ~$4.80/gal; all-in sedan **$0.54/mi**, minivan **$0.70/mi**, van **$0.84/mi**; Bay bridge **$8.50** each crossing; +15 min airport wait; one-way airport trips pay once but drive the route twice (deadhead).

- **Worked floor:** 40 mi / 50 min one-way sedan airport run, one bridge each way, +15 min wait → **≈$118 breakeven**; **~$101 with no toll**; **~$59 if a paid back-haul eliminates the deadhead** (deadhead is the single biggest cost lever).
- **Routes that lose money at current prices:** **Irvine→LAX ($100 vs ~$104 cost)** — marginal loss. All other long routes are at/just above cost.
- **Routes printing the most margin:** the short ones (SJC, SNA) — $100/$120 charged against ~$26–38 cost — but that "margin" is theoretical because **no customer will pay 4–5× Uber for a 10-minute ride**, so it converts to zero bookings, not profit.
- **Uber/Lyft are frequently below DuLichCali's cost** on these routes — they survive on driver back-hauls (no deadhead), volume, and subsidized economics DuLichCali cannot replicate. **DuLichCali should not chase Uber to the bottom**; it should price to its own cost + a value premium.

---

## 5. Recommended pricing (replace the flat floor)

**(a) Distance-graduated minimum fare** (kills the short-ride blowout, keeps long-run profitability):

| Trip distance | Recommended sedan min | Sienna min | Van min |
|---|---|---|---|
| < 15 mi (e.g. SJC, SNA) | **$45** | $55 | $70 |
| 15–30 mi | **$65** | $80 | $95 |
| 30+ mi airport | **$90** | $105 | $125 |

**(b) Recalibrate the rate card** to real market + a transparent value premium, instead of "20% off an inflated number." Target **list ≈ off-peak UberX × ~1.15–1.25** on long routes (justified by value), and **never below the deadhead cost floor**.

**(c) Group pricing** (DuLichCali's strength — UberXL is expensive):

| Party | Vehicle | Position vs Uber |
|---|---|---|
| 1 | sedan | premium; sell on no-surge + scheduling |
| 2 | sedan (small +$5–10) | competitive |
| 3–4 | Sienna | **at/below UberXL** — win |
| 5–7 | Sienna | **well below 2× UberX** — strong win |
| 8–12 | Van | only realistic single-vehicle option — strong |

**(d) Add a Bay-Area sedan tier** so solo Bay riders aren't charged Sienna rates.

**(e) Indicative re-priced examples:** SJ→SJC **$120 → $45**; Westminster→SNA **$100 → $45**; SJ→SFO **$120 → ~$100** (graduated long-run min + Bay sedan); Westminster→LAX **$100 → ~$90**; Irvine→LAX **$100 → $105** (raise to cover cost).

---

## 6. Routes that are OVERPRICED (fix first)
1. San Jose → SJC (**+420%**, $120 vs ~$23)
2. Westminster → SNA (**+300%**)
3. Garden Grove → SNA (**+270%**)
4. Anaheim → LAX (+92%)
5. Westminster / Garden Grove → LAX (+79%)
6. All Bay→SFO/OAK (+26–54%, Sienna-only floor)

## 7. Routes that are UNDERPRICED (raise to cover cost)
1. **Irvine → LAX** — $100 vs ~$104 deadhead-adjusted cost (marginal loss; raise to ~$105–115).
2. Any 40+ mi run priced at the $100 sedan floor approaches/breaches cost once a toll + deadhead apply — verify per route.

---

## 8. Customer value proposition (why choose DuLichCali over Uber?)

DuLichCali **cannot win on price** vs off-peak UberX for solo short rides — and shouldn't try. Its defensible advantages:
- **Fixed, no-surge price** — the strongest lever. At rush hour Uber San Jose→SFO at 1.5× ≈ **$134 > DuLichCali $120**, and at 2× ≈ $178. **Market DuLichCali against *peak* Uber, not off-peak.** A guaranteed fare during surge is a real, quantifiable saving.
- **Vietnamese-speaking drivers** — decisive for the core community; not available on Uber.
- **Advance scheduling + reliability** for flights (Uber scheduling is best-effort, can fail at 4am).
- **Airport meet-and-greet / known driver**, larger vehicles for luggage and groups.
- **Shared-ride savings** (once implemented) — per-seat below UberX on medium/long routes.

If a route's price stays above Uber, the justification must be explicit (no-surge guarantee + language + scheduling). Where none of these apply (a solo midday 10-mile hop), DuLichCali should be priced near cost (~$45), not $100.

---

## 9. Recommended changes (recommend-only; do NOT implement yet)
1. **Replace the flat `dlcMin`** with the distance-graduated minimum (§5a). *(Highest impact.)*
2. **Add a Bay-Area sedan tier**; stop charging solo riders Sienna rates.
3. **Recalibrate the rate card** to real 2026 market + transparent value premium; price never below the deadhead cost floor.
4. **Implement a real shared-ride discount** (35% default; 30–50% band) — §3.
5. **Raise Irvine→LAX** (and any sub-cost long run) to cover deadhead cost.
6. **Engine capabilities to add** (pricing engine review): peak/off-peak factor, **fixed-price-vs-surge comparison shown to the customer**, shared-ride optimizer, return-trip discount, senior + frequent-rider discounts, per-route cost floor + toll pass-through.
7. **Re-position marketing** around the no-surge guarantee, Vietnamese drivers, scheduling, and group value.

## 10. GO / NO-GO
**🔴 NO-GO on current pricing.** It is uncompetitive on every audited route, indefensible on short rides, loses margin on the longest, and offers no shared-ride value. **Do not rely on price as a differentiator until the structural fixes (§5/§9) ship.** Interim: lean entirely on non-price value (fixed/no-surge, language, scheduling, groups) and quote against *peak* Uber.

---

### Appendix — assumptions & confidence
- Competitor rates are **2026 estimates** from public aggregators (RideWise) + airport-authority fee pages, modeled with standard product multipliers; Comfort/XL and OC deltas are **medium** confidence; UberX/Lyft-standard and SFO/SNA fees **medium-high**. Pull live app/API quotes before changing production prices.
- Distances/times from Travelmath/FasTrak anchors + interpolation (±3–5 mi; peak ranges vary with incidents).
- Cost model: AAA 2025-anchored wear + commercial uplift, EIA/MTC 2026 fuel/toll, $30/hr net driver target. The **deadhead** and **commercial-insurance $/mi** assumptions drive most variance — set per-route before finalizing.
- All DuLichCali prices computed directly from the engine constants in `pricing.js` as of this commit.
