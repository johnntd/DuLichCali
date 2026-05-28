# Mobile Barber — Landing Section Reorder + Hero Promo Showcase

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Goal

Pull the "Animated mobile barber promos" content out of its low-priority position and merge it into the hero as a rotating showcase, then move "Mobile Haircut Convenience" toward the end of the page as supporting information.

## What Changed

### Before

```
Hero (static booking CTAs only)
How matching works
AI haircut preview
Trust strip
Latest AI Haircut Styles carousel
Mobile Haircut Convenience    ← too early, took too much space
Animated mobile barber promos ← buried lower, redundant with hero
Services
```

### After

```
Hero (with auto-rotating promo showcase strip inside)
  • default Mobile Barber hero card
  • Fade at home (video clip + headline + CTA)
  • Family haircut stop (video clip + headline + CTA)
  • Hotel-ready grooming (video clip + headline + CTA)
  • Active vendor promotion (one slide per active promo)
Services (mbServices)
AI haircut preview (mbHomeAiPreview — has Book CTAs per card)
Trust strip
Latest AI Haircut Styles carousel
How matching works
Mobile Haircut Convenience (compact, 2-column on desktop)
```

The standalone "Animated mobile barber promos" section is gone; its promo clip cards now live in the hero showcase strip.

## Implementation

### `index.html`

- New `<div class="mb-hero__showcase" id="mbHeroShowcase" aria-live="polite">` inside the hero section, directly under the trust chips.
- Removed `<section class="mb-section mb-promo-clips">`.
- Reordered sections to match the spec.
- Section markup is otherwise untouched — booking CTAs, AI preview, promo carousel, trust strip, how-matching, and convenience all keep their existing renderers.

### `mobile-barber.js`

- New `renderHeroShowcase()`:
  - Builds slides for the 3 hardcoded promo clips (Fade / Family / Hotel) plus one slide per active vendor promo from `collectActiveCustomerPromos()`.
  - Each slide carries a large visual (video or promo gradient background), headline, short copy, and a CTA button that opens the AI assistant.
  - Auto-rotates every 5 s when there's more than one slide. Suppresses rotation otherwise.
  - Uses CSS class toggles for the fade transition; respects `prefers-reduced-motion`.
- Removed `renderPromoClips()` (the old lower-page renderer).
- Wired into `setLang()` (so the showcase rebuilds when language changes), into the Firestore promo load `.then(...)` (so live promos surface immediately), and into the `subscribeVendorPromos` snapshot listener (so promo enable/disable updates the showcase within ~1 s without a reload).
- `window._mbRenderHeroShowcase` exposed for tests + manual triggering.

### i18n (`STRINGS`)

Removed: `promoClipsKicker`, `promoClipsTitle`, `promoClipsCopy` (vi / en / es).
Added: `heroShowcaseFadeTitle`, `heroShowcaseFadeCopy`, `heroShowcaseFadeCta`, `heroShowcaseFamilyTitle`, `heroShowcaseFamilyCopy`, `heroShowcaseFamilyCta`, `heroShowcaseHotelTitle`, `heroShowcaseHotelCopy`, `heroShowcaseHotelCta` — all three languages, in the same commit. No hardcoded strings.

### `mobile-barber.css`

- New `.mb-hero__showcase` + `.mb-hero-showcase-card` + `__media` / `__body` / `__cta` / `__badge` styles.
  - Mobile: `min-height: 9.5rem`, gradient overlay, sticky CTA, 44 px+ touch target.
  - `@media (min-width: 768px)` and `1024px` bump the min-height and pad the copy so the desktop layout feels premium.
  - `prefers-reduced-motion: reduce` disables the opacity transition.
- Removed `.mb-promo-clips__track`, `.mb-promo-clip-card`, `.mb-promo-clip-card__pulse`, `.mb-promo-clip-card--video` styles (lower section gone).
- Convenience grid tightened: `1fr` on mobile, `1fr 1fr` on `min-width: 768px`. Cards reduced to `min-height: 2.75rem` and `padding: .65rem .8rem` (was 3.25 rem / .85 rem) so the section is compact rather than full-width giant rows.

## Constraints Honored

- Book Now / Chat AI / Talk AI CTAs in the hero body are untouched — still wired to `openAssistantPanel('general')` / `openVoiceAssistant()`.
- Manual booking, AI hairstyle booking, promotion system, service carousel, language switcher, AI preview consent flow — all unchanged.
- Vendor portal, Firestore wiring, and the runtime promo overlay all unchanged.
- Active promotions still **become** showcase slides (the showcase prepends them after the 3 hardcoded promo clips so promos are visible at the top of the rotation).
- Mobile-first: showcase + convenience both stack into a single column on mobile and split into 2-column / wider layout on `≥768px` and `≥1024px`.

## Tests

`tests/lib/mobile-barber-landing.js` updated with two new tests:

| Test | Assertion |
|------|-----------|
| `landing has hero showcase + convenience; promo-clips lower section removed` | Asserts `mbBeforeAfterGallery` and `mbPromoClips` are absent; `mbHeroShowcase` + `renderHeroShowcase` + the three `heroShowcase*` i18n keys + `.mb-hero__showcase` / `.mb-hero-showcase-card` CSS all present. |
| `Section order` | Reads `index.html` once, finds each section's HTML position, asserts `hero showcase < services < AI preview < trust < Latest AI Haircut Styles < How Matching < Convenience`. |

Full system gate: **`FINAL: PASS` — 439 passed, 0 failed**.

## Cache-Bust

`?v=20260528f` → `?v=20260528g` on every mobile-barber HTML file + the landing test assertion.

## Manual Smoke Test (Production)

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/` in a private window.
2. **Hero showcase strip** appears under the trust chips. Cycles through Fade → Family → Hotel cards every 5 s. Each card has a video, headline, short copy, and a primary CTA.
3. If a vendor has an active promo (e.g. Michael 30%), the showcase rotation adds that promo as another slide with a red `🔥 30% OFF` badge.
4. Scroll down — section order matches the spec: Services → AI preview → Trust → Latest AI Haircut Styles → How Matching Works → Convenience.
5. Convenience now shows two cards per row on desktop (≥768 px) instead of one giant row.
6. Toggle a promo in the vendor dashboard — the showcase strip updates within ~1 s without a page reload (`onSnapshot` re-renders).

## PASS / BLOCKED

**PASS** — Promo clips moved into the hero showcase, convenience moved to the end of the page, lower promo-clips section removed, section order matches the spec.

## Remaining Risks

- Showcase auto-rotate is hardcoded at 5 s. If you want a different cadence per slide type (clips faster than promo slides, for example), expose an option or per-slide override.
- The hero showcase strip's `min-height: 9.5rem` on mobile is fixed. If a longer copy line wraps to 3 lines and the gradient cuts the CTA, bump `min-height` instead of clipping.
- Promo slides reuse `openAssistantPanel('general')` as their CTA. A future enhancement could prefill the chat with the promo id so the AI mentions it explicitly on first message.
