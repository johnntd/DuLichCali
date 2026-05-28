# Mobile Barber — Promotion Activation Fix

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Bug

A vendor would enable a promotion from the dashboard, but the customer-facing Mobile Barber page never showed or applied it. Same blind spot affected manual booking quotes, AI booking responses, and the homepage hero spotlight.

## Root Cause

**The vendor dashboard wrote promotions to Firestore; the customer landing only ever read them from a static in-memory catalog.**

- `mobile-barber/mobile-barber-dashboard.js:2351` — vendor save path:
  ```javascript
  root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId)
    .set({ promotions: state.vendor.promotions || [], updatedAt: state.vendor.updatedAt }, { merge: true })
  ```
- `mobile-barber/mobile-barber.js:2807` — customer landing read:
  ```javascript
  function collectActiveCustomerPromos() {
    var vendors = (DATA && DATA.sampleVendors) ? DATA.sampleVendors : []; // ← static catalog only
    ...
  }
  ```

`DATA.sampleVendors` is the in-memory mobile-barber catalog from `mobile-barber-data.js`. It carries every base vendor field (name, hours, service area, etc.) but **no `promotions` array unless one is hand-coded into the file**. Promotions saved by the vendor at runtime never reached this object, so:

- The hero spotlight always stayed hidden (no promos found).
- The per-service price chips never showed a discount.
- `calculateMobileBarberPrice` returned the un-discounted total (it reads `vendor.promotions` via `findActivePromotionForService`, and that was always `undefined`).
- The AI agent's `buildPrompt` had nothing to mention.
- The booking record never received `promoApplied / promotionId / promotionName / discountPercent / originalPrice / discountedPrice`.

Everything downstream was correctly written — the contract was correct end-to-end *if* the vendor object carried promotions. The only thing missing was the bridge.

## Fix

### 1. Firestore → static-catalog bridge (`mobile-barber/mobile-barber.js`)

Three new helpers wired into `init()`:

```javascript
function _mbVendorIds() { /* every mobile-barber vendor id in DATA.sampleVendors */ }

function _applyVendorPromosPatch(vendorId, promos) {
  // Walks DATA.sampleVendors and sets vendors[i].promotions = promos.slice()
}

function loadVendorPromosFromFirestore() {
  // Promise.all over _mbVendorIds(): fetches firestore vendors/{id} once,
  // copies the .promotions array onto the matching DATA.sampleVendors entry.
}

function subscribeVendorPromos() {
  // onSnapshot listener per vendor doc — live-updates DATA.sampleVendors
  // when the vendor flips a promo in the dashboard, and re-renders both
  // the hero spotlight and the service-card price chips.
}
```

Boot sequence in `init()`:
```javascript
loadVendorPromosFromFirestore()
  .then(() => { renderHeroPromoSpotlight(); renderServices(); })
  .then(() => subscribeVendorPromos());
```

So the moment the customer lands, the page does a one-shot read; from that point on a live snapshot keeps the page in sync with the vendor dashboard — no manual refresh required.

### 2. Canonical helper surface (spec-promised API)

Added and exported on `window`:

| Helper | Purpose |
|--------|---------|
| `getActiveMobileBarberPromotions({ vendorId, serviceId, now })` | All eligible active promos, filtered by optional vendorId/serviceId |
| `getBestPromotionForService(service, promotions?)` | Highest-discount promo that matches the service (uses pool from above if omitted) |
| `applyPromotionToServicePrice(service, promotions?)` | Returns `{ promotion, originalPrice, discountedPrice, discountPercent, promoApplied }` |
| `renderPromotionHero(promotions?)` | Re-renders the hero spotlight (forces a specific list when given) |

All four are thin wrappers around the existing `DATA` module (`findActivePromotionForService`, `applyPromotionToPrice`) so the source of truth doesn't fork.

### 3. Promo-aware price chip on service cards

`renderServices()` now checks every service against `applyPromotionToServicePrice(service)`. When `promoApplied === true` the card swaps the plain price chip for a richer one:

```
Price: $50  $40  -20%
       ↑    ↑    ↑
   strike  bold  red badge
```

Implemented via a new `.mb-chip--promo` modifier in `mobile-barber.css` with strikethrough on the original and a red percent pill. Touch targets unchanged; layout collapses cleanly on mobile.

### 4. Live re-render on snapshot change

`subscribeVendorPromos()` diffs the in-memory promotions array against the incoming snapshot. On any change it triggers `renderHeroPromoSpotlight()` + `renderServices()` — so when a vendor toggles a promo from any device, the customer landing reflects it within ~1s without a reload.

## What This Did NOT Need to Change

- `mobile-barber-data.js`: `findActivePromotionForService`, `applyPromotionToPrice`, `validatePromotion`, `BOOKING_FIELDS`, `validateBooking` — all still correct. Already handle date range, max redemptions, scope rules.
- `mobile-barber-booking.js`: `calculateMobileBarberPrice` and `buildBooking` — both already read `vendor.promotions` and persist the promo fields. Just needed `vendor.promotions` to be populated. Now it is.
- `mobile-barber-agent.js`: `buildPrompt()` already lists active promos; `saved` reply already has the "Good news — X% promotion applied" line in vi/en/es.
- `mobile-barber-dashboard.js`: the vendor portal CRUD, the appointment-row promo chip, and the enriched pricing detail are unchanged.

The only thing missing was the data bridge. Everything downstream lit up the moment the bridge was in place.

## Files Changed

```
mobile-barber/mobile-barber.js                      (Firestore bridge + 4 canonical helpers + promo-aware service card)
mobile-barber/mobile-barber.css                     (.mb-chip--promo strikethrough + red percent badge)
mobile-barber/index.html                            (cache bust ?v=20260528a)
mobile-barber/dashboard.html                        (cache bust ?v=20260528a)
mobile-barber/vendor.html                           (cache bust ?v=20260528a)
tests/lib/mobile-barber-promotion-activation.js     (NEW — 10 pinning tests)
tests/lib/mobile-barber-landing.js                  (version-string assertions bumped)
tests/runner.js                                     (wire new test suite)
docs/mobile_barber_promotion_activation_fix.md      (this report)
```

## Tests

`tests/lib/mobile-barber-promotion-activation.js` — **10 tests, all PASS**:

| # | Test |
|---|------|
| P1 | Landing bridges Firestore `vendor.promotions` into `DATA.sampleVendors` (init() wires loadVendorPromosFromFirestore + subscribeVendorPromos + re-renders) |
| P2 | Canonical helper surface promised in the spec is exported on `window` (4 helpers) |
| P3 | Service card renders promo-aware price chip when a promo applies (label, original, final, pct) |
| P4 | CSS ships promo chip styling + strikethrough original price + percent badge |
| P5 | `getBestPromotionForService` picks highest discount among matching scopes |
| P6 | Pricing engine + AI agent still read `vendor.promotions` (regression guard) |
| P7 | Vendor dashboard still persists promotions to Firestore (regression guard) |
| P8 | `findActivePromotionForService` respects every eligibility rule (active, expired, max redemptions) |
| P9 | `buildBooking` carries `promoApplied / promotionName / discountPercent / originalPrice / discountedPrice / totalPrice` |
| P10 | Vendor portal promo chip rendering pattern intact (`mb-promo-chip`, gated on `booking.promoApplied`) |

Full system gate: **`FINAL: PASS` — 417 passed, 0 failed**.

## Promo Data Flow (after fix)

```
Vendor dashboard               Firestore                  Customer landing
─────────────────             ─────────                  ────────────────
addPromotionFromForm()  ───▶  vendors/{id}.promotions   ◀──── loadVendorPromosFromFirestore()
                                       │                         │
                                       └── onSnapshot ───────▶ subscribeVendorPromos()
                                                                  │
                                                                  ├── renderHeroPromoSpotlight()  (hero card)
                                                                  ├── renderServices()             (price chip)
                                                                  ├── calculateMobileBarberPrice() (booking quote)
                                                                  ├── AGENT.buildPrompt()          (AI mention)
                                                                  └── buildBooking()               (persist promo)
```

## Cache-Bust

All mobile-barber JS + CSS files bumped to `?v=20260528a` across `index.html`, `dashboard.html`, `vendor.html`. Tests updated.

## Manual Smoke Test (Production)

1. Open `https://www.dulichcali21.com/mobile-barber/dashboard.html?id=michael-nguyen-oc` and log in as Michael.
2. Settings → Promotions → Add: `Spring 20`, discount `20`, scope `All services`, active on, display on customer page on.
3. In a separate tab open `https://www.dulichcali21.com/mobile-barber/`.
4. **Within ~1 second** the hero spotlight should show `🔥 20% OFF · Spring 20`.
5. Scroll to the Services section — every service card shows `Price: $50 $40 -20%` (strikethrough original + bold final + red percent badge).
6. Tap **Select Service** on any card, then **Book this service**. Fill the inline form, submit. The booking saves with `promoApplied: true, discountPercent: 20, promotionName: "Spring 20"`.
7. Tap **Chat with AI to book** and ask "how much for a classic cut?" — the AI quote mentions: *"Good news — 20% promotion applied (Spring 20). Original $50, you pay $40."*
8. Back in the vendor dashboard, expand the new booking — the appointment row shows the gold "PROMO APPLIED" chip and the pricing detail shows Original / Promo / Amount due.
9. In the dashboard toggle the promo off — within ~1s the customer tab's hero spotlight disappears and the service-card price chips revert to plain. No reload needed.

## Why This Was Missed

The promotion feature shipped on 2026-05-27 had end-to-end tests for the data model, pricing engine, vendor portal, and AI agent — but every test injected a vendor object with `promotions` already populated. **No test confirmed that the customer landing actually reads vendor.promotions from Firestore.** The data layer was correct in isolation but the integration was never asserted. The new P1 test (landing bridges Firestore vendor.promotions into DATA.sampleVendors) closes that gap so this exact regression can't recur.

## PASS / BLOCKED

**PASS** — Enabling a vendor promotion now automatically displays and applies it on the customer Mobile Barber page (hero spotlight, service card prices, manual booking, AI booking, persisted booking record, vendor appointment view). Live snapshot listener propagates dashboard changes to the customer landing within ~1s without a reload.

## Remaining Risks

- `subscribeVendorPromos` opens one `onSnapshot` per mobile-barber vendor. Today there are two (`michael-nguyen-oc`, `tim-nguyen-bay`). If we add many more, consider a single collection-level listener with `where('providerType', '==', 'mobile-barber')`.
- The Firestore read path falls open silently if Firebase is unavailable — the page still works but no promos surface. This matches the existing behaviour for other Firestore reads on the landing; no change needed unless we want a visible "promotions temporarily unavailable" note.
- `currentRedemptions` is not yet auto-incremented when a booking is created (called out in the original promotion report). The eligibility check at quote time still enforces `maxRedemptions`, but to actually tick the counter down on a real booking, add an `update({ ['promotions.' + idx + '.currentRedemptions']: increment(1) })` in `BOOKING.saveBooking` — recommended for a follow-up.
