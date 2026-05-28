# Mobile Barber Vendor Promotions — Feature Report

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber/`)
**Commit:** `a1ae128 feat(mobile-barber): vendor promotions + hero spotlight + AI mention + booking discount`
**Date:** 2026-05-27

## Goal

Allow Mobile Barber vendors to create discounts/promotions from their barber portal that automatically apply to customer pricing, surface in the AI agent, and are visible on every relevant surface (vendor dashboard, AI chat, customer landing, persisted booking record).

## Scope of Work

| Layer | File | What changed |
|-------|------|--------------|
| Data model | `mobile-barber/mobile-barber-data.js` | `PROMOTION_FIELDS`, `PROMOTION_SCOPES`, `validatePromotion`, `findActivePromotionForService`, `applyPromotionToPrice`, `validateVendor` walks promos, booking fields extended |
| Pricing engine | `mobile-barber/mobile-barber-booking.js` | `calculateMobileBarberPrice` applies the active promo to the out-the-door total; `buildBooking` persists promo fields on the booking doc |
| Vendor portal | `mobile-barber/dashboard.html`, `mobile-barber/mobile-barber-dashboard.js` | Settings → Promotions accordion (full CRUD), promo chip on each booking row, enriched pricing detail (Original + Promo + Amount due) |
| AI agent | `mobile-barber/mobile-barber-agent.js` | `buildPrompt()` lists active promos; the `saved` reply prepends a "promotion applied" line in vi/en/es |
| Customer landing | `mobile-barber/mobile-barber.js`, `mobile-barber/index.html`, `mobile-barber/mobile-barber.css` | Hero spotlight (see `docs/mobile_barber_promotion_hero_spotlight.md`) |
| Tests | `tests/lib/mobile-barber-promotions.js` | 16 pure-data tests (spec scenarios 1–9 + helpers + chip + agent + hero source patterns) |

## Data Model

### Promotion shape (stored on `vendor.promotions[]`)

```
{
  id: string,                    // 'promo-<timestamp>'
  vendorId: string,
  name: string,                  // required
  description: string,
  discountPercent: number,       // 1–90
  applyToScope: 'all' | 'selected',
  appliesToServiceIds: string[], // required if scope === 'selected'
  startDate: 'YYYY-MM-DD' | '',
  endDate: 'YYYY-MM-DD' | '',
  maxRedemptions: number,        // 0 = unlimited
  currentRedemptions: number,
  active: boolean,
  promoCode: string,
  displayOnCustomerPage: boolean,
  createdAt, updatedAt
}
```

### Booking fields appended (persisted on `mobileBarberBookings/{id}`)

`promotionId`, `promotionName`, `discountPercent`, `originalPrice`, `discountedPrice`, `promoApplied`.

## Pricing Behavior

`calculateMobileBarberPrice({ vendor, service, customerAddress, now })`:

1. Compute the normal out-the-door total (base + travel + tax).
2. Call `findActivePromotionForService(vendor, service, now)` — returns the **single best-matching** active promo (highest discount; ties broken by nearest expiration).
3. If a promo matches, apply `discountPercent` to the **final total** (not just the base), so customers see the discount reflected in `totalPrice`.
4. Quote always returns `{ promoApplied, promotionId, promotionName, discountPercent, originalPrice, discountedPrice, totalPrice }`.

Gating rules inside `findActivePromotionForService`:
- `promo.active === true`
- `now >= startDate` (if set) and `now <= endDate` (if set)
- `maxRedemptions === 0` OR `currentRedemptions < maxRedemptions`
- Scope: `'all'` always matches; `'selected'` matches only if `service.id ∈ appliesToServiceIds`

## Vendor Portal CRUD

Settings → Promotions accordion in `dashboard.html`:

- Add/edit form: name, description, discount %, scope radios (all / selected), service multi-select (shown only when scope=selected), start/end dates, max redemptions (0 = unlimited), promo code (optional), display-on-customer-page toggle, active toggle.
- Validation surfaced via `showPromoError()` before write.
- Promotion list rendered as cards with toggle-active and delete actions.
- All writes go through `persistVendorPromotions()` → updates Firestore `vendors/{id}.promotions`.

**Booking row chip:** `bookingCard()` adds `<span class="mb-promo-chip">` when `booking.promoApplied`. Pricing detail now shows `Original` + `Promo (-X%)` + `Amount due` rows when applicable.

## AI Agent Mention

`buildPrompt()` (`mobile-barber-agent.js`) injects an `Active promotions:` block listing all currently-active promos. When the agent confirms a booking, the `saved` reply key prepends in the customer's language:

- EN: `Good news — {pct}% promotion applied ({name}). Original {original}, you pay {discounted}.`
- VI: `Tin vui — đã áp dụng khuyến mãi {pct}% ({name}). Giá gốc {original}, bạn trả {discounted}.`
- ES: `Buenas noticias — promoción de {pct}% aplicada ({name}). Original {original}, pagas {discounted}.`

Prepended only when `availability.price.promoApplied === true`.

## i18n

38 new keys added to vi/en/es for the dashboard (`promotionsTitle`, `promotionsAddButton`, `promoFieldName`, `promoFieldDiscount`, `promoScopeAll`, `promoScopeSelected`, `promoChipApplied`, etc.). No hardcoded strings in any of the three languages.

## Tests

`tests/lib/mobile-barber-promotions.js` — 16 tests, all passing:

| # | Test | Coverage |
|---|------|----------|
| 1 | create active promo passes `validatePromotion` | happy path |
| 1b | validatePromotion rejects discount <1 / >90 / endDate<startDate | input bounds |
| 1c | scope=selected requires `appliesToServiceIds` | scope rule |
| 2 | expired promo does not apply | date gating |
| 2b | promo before startDate does not apply | date gating |
| 3 | max redemption stops at limit | quantity gating |
| 4 | selected-service promo only applies to whitelisted services | scope filter |
| 5 | all-service promo applies to every service | scope filter |
| 5b | multiple active promos → highest discount wins | tiebreaker |
| 6 | `applyPromotionToPrice` returns correct discounted price | math |
| 6b | inactive promo returns no discount | gating |
| 6c | `calculateMobileBarberPrice` reflects promo in `totalPrice` | engine integration |
| 6d | `buildBooking` persists promo fields onto booking doc | persistence |
| 7 | vendor portal renders promo chip (source pattern) | dashboard surface |
| 8 | AI agent buildPrompt + saved reply mention promo (source pattern) | agent surface |
| 9 | landing hero spotlight collects + renders promos (source pattern) | customer surface |

Full system gate: `FINAL: PASS` — 16 promotion + 35 landing + 31 agent + 30 booking + 13 model + 9 homepage-visibility tests.

## Cache Busting

All consumers bumped to `?v=20260527p`:
- `mobile-barber-data.js`
- `mobile-barber-booking.js`
- `mobile-barber-agent.js`
- `mobile-barber-dashboard.js`
- `mobile-barber.js`
- `mobile-barber.css`

## Smoke Test (Production)

1. Open the vendor dashboard: `https://www.dulichcali21.com/mobile-barber/dashboard.html?id=michael-nguyen-oc`.
2. Settings → Promotions → "Add promotion": name `Father Day`, discount `25`, scope `all`, active on.
3. Open landing: `https://www.dulichcali21.com/mobile-barber/?vendor=michael-nguyen-oc` — confirm the hero spotlight shows `Father Day -25%`.
4. Open the AI agent on the landing, ask "How much for a classic cut?" — quote shows discounted total and the agent mentions the promotion.
5. Complete a booking — appointment row on dashboard shows the gold promo chip; pricing block shows Original / Promo / Amount due.

## Files Changed

```
mobile-barber/dashboard.html
mobile-barber/index.html
mobile-barber/mobile-barber-agent.js
mobile-barber/mobile-barber-booking.js
mobile-barber/mobile-barber-dashboard.js
mobile-barber/mobile-barber-data.js
mobile-barber/mobile-barber.css
mobile-barber/mobile-barber.js
tests/lib/mobile-barber-promotions.js   (new)
tests/lib/mobile-barber-landing.js      (version-string updates)
```

## Remaining Risks

- Promotion redemption counters are not yet auto-incremented when a booking is created. `maxRedemptions` is enforced at quote time, but `currentRedemptions` must be manually adjusted in Firestore (or via a future Cloud Function) to actually tick down. Recommended follow-up: increment in `buildBooking` write path.
- Promo code field is collected and stored but not yet enforced as a redemption requirement. Today every promo applies automatically when active and in scope. If the vendor needs code-gated promos, add a customer-input step in the AI agent flow.
- Hero spotlight intentionally rotates **all** displayable promos. If a vendor turns on many promos at once the rotation gets crowded — consider a cap (e.g., top 3 by discount) if this becomes an issue in practice.
