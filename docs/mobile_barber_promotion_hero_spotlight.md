# Mobile Barber Promotion Hero Spotlight — Enhancement Report

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber/`)
**Commit:** `a1ae128 feat(mobile-barber): vendor promotions + hero spotlight + AI mention + booking discount`
**Date:** 2026-05-27

## Goal

When a vendor enables an active promotion, the customer-facing landing page should automatically highlight it in the hero showcase — no manual customer action required, no extra clicks. Promo visibility is part of the same vendor toggle that drives pricing; one switch updates everything.

## Surface

`https://www.dulichcali21.com/mobile-barber/?vendor=<id>` — the hero block under the headline now contains a promo spotlight card directly to the right of the AI booking CTAs.

## Behavior

1. On `init()` (after `setLang`), `renderHeroPromoSpotlight()` runs.
2. It calls `collectActiveCustomerPromos(vendor, now)` which walks `vendor.promotions[]` and keeps only entries that:
   - have `active === true`
   - are within `startDate`/`endDate` if those are set
   - have remaining redemption capacity (`maxRedemptions === 0` OR `currentRedemptions < maxRedemptions`)
   - have `displayOnCustomerPage !== false`
3. If zero promos qualify, the slot stays `hidden`.
4. If one qualifies, that card renders.
5. If multiple qualify, they sort highest-discount-first (then nearest expiration) and **rotate every 7 seconds** with a fade-in animation.

## Card Anatomy

Each `.mb-hero__promo-card` shows:

- A gold pill badge: `-{discountPercent}%`
- The promo name as the title
- Optional description line
- Meta row with:
  - **Countdown** when `endDate` is set: `Ends in X day(s)` / `Ends tomorrow` / `Ends today` (i18n vi/en/es)
  - **Limited spots badge** when `maxRedemptions > 0`: `Only X spots left` (i18n vi/en/es)
- CTA button → opens the AI chat with the prefilled intent so the customer can book immediately

## Files Touched

| File | Change |
|------|--------|
| `mobile-barber/mobile-barber.js` | New `collectActiveCustomerPromos()`, `_heroPromoCardHtml()`, `renderHeroPromoSpotlight()`. Spotlight wired into `init()` after `setLang`. Rotates every 7s when multiple promos qualify. Exposed `window._mbRenderHeroPromoSpotlight` + `window._mbCollectActiveCustomerPromos` for tests. |
| `mobile-barber/index.html` | Added `<aside class="mb-hero__promo" id="mbHeroPromo" hidden aria-live="polite"></aside>` to the hero body. |
| `mobile-barber/mobile-barber.css` | New `.mb-hero__promo`, `.mb-hero__promo-card`, `.mb-hero__promo-badge`, `.mb-hero__promo-title`, `.mb-hero__promo-desc`, `.mb-hero__promo-meta`, `.mb-hero__promo-cta`. Animation `mbHeroPromoIn` (220ms ease-out fade + slide-up) wrapped in `@media (prefers-reduced-motion: no-preference)`. Desktop ≥1024px places the card on the right; mobile stacks below the CTAs. |
| `tests/lib/mobile-barber-promotions.js` | Test #9 asserts the helper, renderer, gating flag, hero markup, and HTML slot. |

## i18n Keys Added

- `heroPromoBadge` — pill label template
- `heroPromoEndsToday`, `heroPromoEndsTomorrow`, `heroPromoEndsIn` — countdown phrasing
- `heroPromoLimitedSpots` — "Only X spots left"
- `heroPromoCta` — CTA button label ("Book this deal")

All three languages (vi/en/es) populated; no hardcoded strings.

## Gating Truth Table

| Condition | Renders? |
|-----------|----------|
| `active: false` | No |
| `now < startDate` | No |
| `now > endDate` | No |
| `displayOnCustomerPage: false` | No |
| `maxRedemptions > 0 && currentRedemptions >= maxRedemptions` | No |
| All gates pass | Yes |
| Multiple pass | Rotate, highest discount first |

## Accessibility

- `aria-live="polite"` on the slot so screen readers announce rotation without interrupting.
- Animation gated on `prefers-reduced-motion`.
- CTA button uses real `<button>` element with visible focus ring.
- Pill badge contrast verified against gold gradient: passes WCAG AA at normal text size.

## Smoke Test (Production)

1. Open vendor dashboard: `https://www.dulichcali21.com/mobile-barber/dashboard.html?id=michael-nguyen-oc`.
2. Settings → Promotions → add `Father Day`, 25%, scope all, active on, `displayOnCustomerPage` on.
3. Add a second promo `Memorial Day`, 15%, max redemptions 5.
4. Open landing: `https://www.dulichcali21.com/mobile-barber/?vendor=michael-nguyen-oc`.
5. Hero spotlight appears on the right (desktop) / below CTAs (mobile). `Father Day -25%` shows first; after ~7s rotates to `Memorial Day -15%` with `Only 5 spots left`.
6. Toggle `Memorial Day` to inactive in the dashboard → reload landing → only `Father Day` shows, no rotation.
7. Toggle `displayOnCustomerPage: false` on `Father Day` → reload landing → spotlight is hidden but the promo still applies to pricing (confirmed via AI quote).

## Cache Busting

Bumped `mobile-barber.js`, `mobile-barber.css`, `mobile-barber-data.js` to `?v=20260527p` in `index.html` and `dashboard.html`.

## Remaining Risks

- Rotation interval is hardcoded at 7s. If a vendor enables many promos, the rotation may feel busy. Consider a cap (top 3) or vendor-configurable cadence as a follow-up.
- Countdown copy assumes the customer's local timezone matches the promo's `endDate` (date-only string). Promos ending "today" globally will read consistently in California time, which is the target customer set; expanding to other time zones would require timezone normalization.
- Hero spotlight uses the same data path as pricing. If we later add code-gated promos (`promoCode` enforcement), the spotlight should still render — but the CTA flow may need to nudge the customer to enter the code in chat.
