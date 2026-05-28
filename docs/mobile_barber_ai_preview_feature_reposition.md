# Mobile Barber — AI Hairstyle Preview Carousel Reposition

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Goal

Move the "Latest AI Haircut Styles" carousel directly under the hero so the platform's flagship visual feature (AI-generated hairstyle previews) lands in the customer's first scroll. It was previously buried below trust / services / how-matching, ~3 sections deep.

## Layout

### Before

```
1. Hero
2. Services                              (mbServices)
3. AI haircut preview / upload           (mbHomeAiPreview)
4. Trust strip
5. Latest AI Haircut Styles ← buried     (mb-promo)
6. How matching works
7. Convenience
```

### After

```
1. Hero (with rotating promo + clip slides + persistent promo ribbon)
2. Latest AI Haircut Styles ← FLAGSHIP   (mb-promo)
3. Services                              (mbServices)
4. AI haircut preview / upload           (mbHomeAiPreview)
5. Trust strip
6. How matching works
7. Convenience
```

## Why

- AI hairstyle previews are the **most unique** thing this platform offers — moving them above the fold (one scroll from the hero) shows customers immediately what makes it different.
- Visual carousels convert better than form sections — leading with a swipeable preview gallery sets the tone before asking the customer to commit to anything.
- The previous order put two text-heavy sections (services + AI upload) before the visual showcase. The new order is: **hero → see what you'll get → pick your service → upload your selfie to personalize**. That progression matches the user's mental model.

## Copy

The headline was updated to match the spec:

| | Before | After |
|---|---|---|
| **Kicker** | "Service preview" | "AI haircut previews" |
| **Headline (EN)** | "Latest AI Haircut Styles" | "See Your Next Hairstyle Before You Book" |
| **Subline (EN)** | "Swipe through fade, taper, beard trim, kids cut, business cut, senior cut, line up, and family package previews." | "AI-generated haircut previews personalized for every style — fade, taper, beard trim, kids, business, senior, line up, and family package." |
| **CTA** | "Book an in-home haircut today" | (unchanged) |

All three languages updated (vi / en / es) in the same commit.

## Visual Improvements

- **Taller cards**: card media height bumped from `8rem` to `11rem` mobile → `12rem` at 640 px → `13.5rem` at 1024 px. Card width bumped from `11.5rem` to `13rem` → `14rem` → `16rem` at the same breakpoints. Cinematic feel.
- **Premium backdrop**: section now has a gold-tinted radial gradient (`circle at 22% -10%, rgba(245,166,35,.26)`) plus a subtle sky-blue counter-glow at the bottom-right. Border switched from generic white to gold-tinted `rgba(245, 166, 35, .22)`.
- **Refined typography**: Bodoni Moda display font on the headline (`clamp(1.5rem, 5vw, 2rem)` mobile, scaling to `clamp(2rem, 3.5vw, 2.6rem)` on ≥768 px), max-width 22ch so the line wraps elegantly.
- **Hover lift**: cards now `translateY(-2px)` + gold border on hover with a deeper shadow.
- **Smoother scroll**: `scroll-behavior: smooth` added to the scroll container so programmatic + tap-on-card navigation feels fluid.
- **Better spacing**: section padding upped from `1rem` to `1.25rem` mobile / `1.6rem` at ≥768 px.

## Mobile

- Cards stay horizontal-swipeable with `scroll-snap-type: x mandatory`.
- `overscroll-behavior-x: contain` prevents the swipe from bleeding into the page scroll.
- `-webkit-overflow-scrolling: touch` for momentum on iOS Safari.
- `::-webkit-scrollbar { display: none }` keeps the rail clean.
- Card minimum width set by `flex: 0 0 13rem` so each card is fully visible at 320 px viewport (~80% of the screen).

## Constraints Honored

- Hero carousel + persistent promo ribbon → untouched.
- Service selection (`#mbServices`) → still functional, comes second instead of first.
- AI haircut preview upload flow (`#mbHomeAiPreview`) → unchanged behavior, just repositioned.
- Booking, AI booking, promotion logic, manual booking → none of those code paths touched.
- Mobile responsiveness → tested with the existing media queries; new card sizes scale cleanly.

## Tests

`tests/lib/mobile-barber-landing.js`:
- **Section-order test** updated. New expected order asserted: `heroShowcase < promo < services < aiPreview < trust < howMatching < convenience`. The comment in the test explains why `mb-promo` jumped above `mb-services` (flagship feature).
- **Headline assertion** updated to `promoTitle: 'See Your Next Hairstyle Before You Book'`.

Full system gate: **`FINAL: PASS` — 439 passed, 0 failed**.

## Files Changed

```
mobile-barber/index.html                                  (mb-promo section moved up; old position removed)
mobile-barber/mobile-barber.js                            (promoKicker / promoTitle / promoCopy updated, vi/en/es)
mobile-barber/mobile-barber.css                           (cinematic backdrop, taller cards, smoother scroll, premium type)
mobile-barber/dashboard.html                              (cache bust ?v=20260528m)
mobile-barber/vendor.html                                 (cache bust ?v=20260528m)
tests/lib/mobile-barber-landing.js                        (section-order + headline asserts updated)
docs/mobile_barber_ai_preview_feature_reposition.md       (this report)
```

## Cache-Bust

`?v=20260528l → ?v=20260528m` on all mobile-barber files.

## Manual Smoke Test

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/`.
2. Scroll past the hero → the **first** content section is **"See Your Next Hairstyle Before You Book"** — kicker "AI haircut previews" in gold, headline in Bodoni Moda, subline below, then the horizontal swipe carousel.
3. Cards are visibly taller (~50% larger than before) and have a hover lift on desktop.
4. Horizontal swipe is smooth on iPhone Safari; scroll-snap aligns each card to the left edge.
5. Each card shows its real price (or strike-through original + final price + red `-X%` badge when a promo is active).
6. Below the carousel, the services section follows, then AI preview upload, then trust, then how-matching, then convenience.

## PASS / BLOCKED

**PASS** — "See Your Next Hairstyle Before You Book" carousel renders directly under the hero. Section order updated, headline refreshed, visuals upgraded to a cinematic flagship treatment. No regressions in booking / AI booking / promotion / mobile responsiveness.

## Remaining Risks

- The carousel still uses a single image per style. A future iteration could show a short before/after toggle per card to make the AI claim more vivid.
- Headline copy is now in two languages besides English — Vietnamese and Spanish versions follow the same meaning but the marketing team may want to refine the Vietnamese phrasing.
- The taller cards consume more vertical space on mobile. If the hero showcase + promo carousel push the services section more than one scroll down, consider trimming the trust chips list under the hero.
