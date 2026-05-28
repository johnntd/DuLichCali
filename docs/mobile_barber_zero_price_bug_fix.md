# Mobile Barber — Zero-Price Bug Fix

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Bug

The "Latest AI Haircut Styles" preview carousel on the Mobile Barber landing page rendered every service price as **$0**. Real prices ($40, $45, $65, $75, …) never appeared.

## Root Cause

A naming mismatch between **style templates** and **services**.

- Style templates in `SERVICE_IMAGE_TEMPLATES` use slugs as ids: `classic-haircut`, `fade-haircut`, `skin-fade`, etc.
- Services in `sampleServices` are built by `makeService(vendorId, slug, …)` which composes `id = vendorId + '-' + slug`. So Michael's Classic Haircut is `michael-nguyen-oc-classic-haircut`, not `classic-haircut`.
- `promoContentItems(services)` in `mobile-barber.js` joined templates ↔ services with `services.filter(s => s.id === tmpl.id)`. The composite id never matched the bare template id → `service === null` → `item.price = null` → `formatMoney(null)` returned `$0`.

Result: every card on the carousel showed `$0` regardless of vendor or promo. The booking flow and AI agent were unaffected because they look up services by their composite id directly — only the public-facing carousel was reading through this broken join.

Secondary issue: `formatMoney(value)` silently degrades `null / undefined / 0` to `$0`, so the bad data was rendered without any error signal that would have surfaced it in monitoring.

## Fix

### 1. Add `slug` to every service — deterministic join key

`makeService` in `mobile-barber/mobile-barber-data.js` now sets a separate `slug` field equal to the menu key:

```javascript
return Object.freeze({
  id:   vendorId + '-' + slug,   // composite for per-vendor uniqueness
  slug: slug,                     // canonical menu key — joins to SERVICE_IMAGE_TEMPLATES
  vendorId: vendorId,
  ...
});
```

`SERVICE_FIELDS` updated so the schema validator accepts the new field. No data migration required — services are rebuilt every page load from `MOBILE_BARBER_MENU`.

### 2. Update the carousel join to match on `slug`

```javascript
var service = (services || []).filter(function(s) {
  return s && (s.slug === tmpl.id || s.id === tmpl.id);  // slug first, legacy id fallback
})[0] || null;

if (!service && root.console) {
  root.console.warn('[mobile-barber] no matching service for template ' + tmpl.id +
    ' — carousel will show "Price unavailable" instead of a fake $0');
}

return {
  ...
  price: service && typeof service.price === 'number' ? service.price : null,
  ...
};
```

The legacy `id === tmpl.id` fallback stays so older callers that built services without the slug field still resolve.

### 3. New `formatServicePrice` helper — never falls back to $0

```javascript
function formatServicePrice(value) {
  var num = Number(value);
  if (!isFinite(num)) {
    console.error('[mobile-barber] missing service price', value);
    return t('priceUnavailable') || 'Price unavailable';
  }
  if (num <= 0) {
    console.error('[mobile-barber] service price <= 0 — treating as unavailable', value);
    return t('priceUnavailable') || 'Price unavailable';
  }
  return '$' + num.toFixed(0);
}
```

Applied wherever a customer-facing service price renders:
- The preview carousel (`renderPromoPreview`)
- Service cards in the services section (`renderServices`)
- The selected-service summary header (`renderSelectedService` title)
- The manual booking summary (`renderManualBookingPanel` summary chip)

`formatMoney(value)` remains for internal totals that legitimately can be `$0` (e.g. travel fee in zero-distance edge cases).

### 4. Carousel respects active vendor promos

The carousel now also runs `applyPromotionToServicePrice` per item — when a vendor has an active promo for that slug, the carousel shows:

```
$50 → $40 -20%
strike   bold   red badge
```

Mirrors what the service-card chip already does (shipped 2026-05-28 in the promo activation fix). New `.mb-promo__card-price`, `.mb-promo__card-original`, `.mb-promo__card-final`, `.mb-promo__card-pct` styling.

## i18n

`priceUnavailable` key added to en/vi/es. No hardcoded strings.

## Files Changed

```
mobile-barber/mobile-barber-data.js       (slug field on services, SERVICE_FIELDS schema bump)
mobile-barber/mobile-barber.js            (formatServicePrice helper, promoContentItems join, all 4 price call sites switched, carousel promo-aware pricing, i18n)
mobile-barber/mobile-barber.css           (.mb-promo__card-price strikethrough + red percent badge)
mobile-barber/index.html                  (cache bust ?v=20260528b)
mobile-barber/dashboard.html              (cache bust ?v=20260528b)
mobile-barber/vendor.html                 (cache bust ?v=20260528b)
index.html                                (cache bust homepage script.js ?v=20260528b)
tests/lib/mobile-barber-zero-price.js     (NEW — 9 pinning tests)
tests/lib/mobile-barber-landing.js        (version assert bumped)
tests/runner.js                           (wire new test suite)
docs/mobile_barber_zero_price_bug_fix.md  (this report)
```

## Tests

`tests/lib/mobile-barber-zero-price.js` — **9 tests, all PASS**:

| # | Test |
|---|------|
| Z1 | Every menu service exposes a `slug` field matching its template id |
| Z2 | Every expected service slug carries the **correct** price: Classic $40, Fade $45, Skin Fade $50, Taper $45, Haircut+Beard $65, Beard Trim $25, Kids $35, Senior $35, Business $45, Buzz $30, Line Up $20, Modern Styling $55, Home Family Package $75 |
| Z3 | `promoContentItems` matches templates against `service.slug` (source pattern) with legacy id fallback |
| Z4 | `promoContentItems` returns a numeric price > 0 for every template — no nulls, no zeros |
| Z5 | `formatServicePrice` never returns `$0` for missing or zero prices; surfaces `priceUnavailable` and `console.error` |
| Z6 | Carousel + service card + selection summary all route through `formatServicePrice` |
| Z7 | Promo discount math is correct: 20% of $40 = $32 (never $0) |
| Z8 | Booking persistence still stores `originalPrice` + `discountedPrice` (no regression) |
| Z9 | `validateService` accepts the new `slug` field (schema regression guard) |

Full system gate: **`FINAL: PASS` — 426 passed, 0 failed**.

## Cache-Bust

All mobile-barber assets bumped to `?v=20260528b`. Root `script.js` also bumped (the landing test asserts it).

## Manual Smoke Test (Production)

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/`.
2. Scroll to **Latest AI Haircut Styles**. Each card now shows the correct price:
   - Classic Haircut · **$40**
   - Fade Haircut · **$45**
   - Skin Fade · **$50**
   - Taper Fade · **$45**
   - Haircut + Beard · **$65**
   - Beard Trim · **$25**
   - Kids Haircut · **$35**
   - Senior Haircut · **$35**
   - Business Style · **$45**
   - Buzz Cut · **$30**
   - Line Up · **$20**
   - Modern Styling · **$55**
   - Home Family Package · **$75**
3. Open the vendor dashboard → Settings → Promotions, add a 20% promo on all services.
4. Reload the customer landing. Each carousel card now shows the strike-through original + discounted price + red badge (e.g. `$40  $32  -20%`).
5. Tap **Select Service** on any card → the selection panel header shows the correct price (or the promo-discounted price).
6. Tap **Book this service** → the manual booking summary shows the same correct price.

## Why This Was Missed

The earlier promotion + manual booking work touched the carousel call site but only switched price computation, not the underlying join. The carousel had been silently showing `$0` since the service id was changed from bare slug to composite (`vendorId-slug`) — likely many releases ago. No test asserted the carousel's rendered price; the Z2 and Z4 tests close that gap.

## PASS / BLOCKED

**PASS** — Every paid service on the customer Mobile Barber carousel shows its real price. Promo discounts render correctly (e.g. `$40 → $32 (-20%)`). Missing prices surface `Price unavailable` + `console.error` instead of silently rendering `$0`. Booking and AI flows continue to store and reference `originalPrice` / `discountedPrice` correctly.

## Remaining Risks

- The catalog hosts service prices in `MOBILE_BARBER_MENU` (the master menu definition). If a vendor in Firestore later overrides a service price (e.g. via a custom services collection per vendor), the carousel still reads `service.price` from the static catalog. That's by design today — the carousel is meant to be a public "menu preview" not a vendor-specific quote. If per-vendor pricing diverges, we'd need to expose `vendor.servicePriceOverrides[slug]` and prefer it in `applyPromotionToServicePrice`.
- `formatServicePrice` console-errors on `price <= 0`. If a future menu legitimately includes a `Free consultation` add-on, the call site must explicitly bypass the helper (e.g. show "Free" instead of going through formatServicePrice).
