# Mobile Barber — Hero Promo Cleanup (one integrated promo surface)

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Problem

After the last two patches landed back-to-back, the hero ended up showing **two competing promo widgets**:

1. **Standalone floating spotlight card** (`#mbHeroPromo`) at the top of the hero body — shipped first in the "promotion activation fix".
2. **Hero showcase strip** (`#mbHeroShowcase`) with promo + clip slides under the trust chips — shipped in the section-reorder patch.

Both surfaces rendered the same promotion content with different visual treatments, plus the clip slides under them, plus the headline CTAs above. Result: the hero felt fragmented, cluttered, and unprofessional — competing CTAs, stacked floating widgets, no clear visual hierarchy.

## Fix — one integrated promo surface, premium hierarchy

ONLY the showcase strip survives. Promotions are now the **lead slides** in that single rotation. The floating spotlight card is gone.

### Hero hierarchy (after)

```
┌─ HERO ─────────────────────────────────────────────────────────────┐
│  background photo + glass card overlay (untouched)                 │
│                                                                    │
│  HERO BODY                                                         │
│  ├─ kicker                                                         │
│  ├─ headline                                                       │
│  ├─ subheadline                                                    │
│  ├─ primary + ghost + voice CTAs                                   │
│  ├─ trust chips                                                    │
│  └─ HERO SHOWCASE  ◀── ONE integrated rotating slide carousel      │
│       • Active promo #1     ── leads when present                  │
│       • Active promo #2     ── leads when present                  │
│       • Fade at home        ── clip slide                          │
│       • Family stop         ── clip slide                          │
│       • Hotel-ready         ── clip slide                          │
│       (auto-rotates every 5s, one visible at a time)               │
└────────────────────────────────────────────────────────────────────┘
```

The Apple/Airbnb principle: one primary visual hierarchy in the hero, no duplicate widgets, premium spacing.

## Changes

### `mobile-barber/index.html`

- Removed `<aside class="mb-hero__promo" id="mbHeroPromo" hidden aria-live="polite"></aside>` from the hero body.

### `mobile-barber/mobile-barber.js`

- Removed: `_heroPromoCardHtml(promo, idx)` helper.
- Removed: `renderHeroPromoSpotlight()` and the `_heroPromoRotateTimer`.
- Removed: `window._mbRenderHeroPromoSpotlight` export.
- Removed: all five `renderHeroPromoSpotlight()` callers (`init()`, the Firestore loader `.then`, the `subscribeVendorPromos` snapshot, `setLang()`, and `renderPromotionHero()`). Each was replaced by `renderHeroShowcase()` so the single surface stays in sync.
- `renderHeroShowcase()` reordered: **active vendor promos are now pushed BEFORE the 3 hardcoded clip slides** so they lead the rotation. Each promo slide carries:
  - `🔥 X% OFF` gold gradient badge (replaces the small floating badge)
  - Promo name as the slide title
  - Promo description as the body copy
  - Optional meta line: vendor barber name + `Through {endDate}` if set
  - Premium gold-tinted gradient background (radial gold + cinematic navy)
  - Single CTA → `Book this discount`

### `mobile-barber/mobile-barber.css`

- Deleted the entire `.mb-hero__promo*` block (`.mb-hero__promo`, `__card`, `__badge`, `__title`, `__meta`, `__desc`, `__cta`, `--visible` modifier, and the `mbHeroPromoIn` keyframe). Replaced with a one-line comment pointing future readers at the showcase.
- New `.mb-hero-showcase-card__meta` (small caption between copy and CTA).
- New `.mb-hero-showcase-card--promo .mb-hero-showcase-card__media` — promo slide gets a cinematic gradient (radial gold + navy linear) plus a gold inner ring and a gold-gradient badge so it stands apart from the video clip slides **without becoming a separate widget**.

### Tests

`tests/lib/mobile-barber-promotion-activation.js` — P1 updated to assert `renderHeroShowcase()` is the hero re-render hook AND that `renderHeroPromoSpotlight()` stays removed.

`tests/lib/mobile-barber-promotions.js` — test #9 inverted: now asserts `renderHeroShowcase` + `id="mbHeroShowcase"` are present AND `renderHeroPromoSpotlight` + `id="mbHeroPromo"` stay removed. Regression guard so the duplicate widget cannot reappear without breaking the gate.

Full system gate: **`FINAL: PASS` — 439 passed, 0 failed**.

## Visual Hierarchy Explanation

| Element | Job | Visual weight |
|---|---|---|
| Hero photo backdrop + glass card | Brand presence, place-setting | Largest |
| Headline + subheadline | Value proposition | Large display type |
| 3 CTAs (Book / Chat / Talk) | Primary actions | Bold primary button + ghost + icon |
| Trust chips | Credibility signals | Small pill row |
| Hero showcase rotation | Live promo + featured services | Single 16:9 card, one slide at a time, large CTA |

Every surface has one job and one visual weight. Promos no longer compete with the CTAs above them — they live inside the showcase as cinematic slides and rotate at 5 s intervals, so the eye returns to them naturally rather than fighting two static promo cards.

## Why the Duplicate Was Removed

- **Two widgets = two CTAs in the same scroll position**. Customers don't know which to tap.
- **Stacked floating cards** broke the hero's vertical rhythm — the headline and CTAs lost emphasis.
- **Same content rendered twice** in different visual languages diluted brand trust ("which one is the real offer?").
- The user explicitly asked for ONE primary promo area, Apple/Airbnb/Uber style, no random floating cards. The showcase IS that one area; the spotlight was the redundant one.

## Cache-Bust

`?v=20260528g` → `?v=20260528h` across all mobile-barber files + the landing test assertion.

## Manual Smoke Test (Production)

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/` in a private window.
2. Hero shows: backdrop photo + glass card + headline + 3 CTAs + trust chips + **one** rotating showcase strip. No second floating promo card anywhere.
3. With Michael's 30% promo active, the showcase **opens** with the promo slide (`🔥 30% OFF` gold badge, gold-tinted cinematic gradient, "Book this discount" CTA, "Through May 31" meta line).
4. After 5 s the rotation advances to Fade → Family → Hotel clips.
5. With Michael's promo OFF, the showcase rotates through just the 3 clip slides.
6. On mobile, the showcase is one full-width card with a 44 px+ CTA. No clutter.
7. Existing Book / Chat / Talk CTAs in the hero still open manual form / AI chat / AI voice respectively (no behavior change).

## PASS / BLOCKED

**PASS** — hero contains exactly one professional integrated promotion presentation. The floating spotlight card and any duplicate promo widget are gone. Promos lead the showcase rotation when active; clips fill the rest. Pinned by two regression-guard tests so this can't recur.

## Remaining Risks

- The showcase auto-rotates at a fixed 5 s. If a promo slide's copy is long it may feel rushed — consider per-slide duration overrides later.
- I kept the unused `heroPromoBadge / heroPromoSelectedServices / heroPromoAllServices / heroPromoFrom / heroPromoSpotsLeft` i18n keys in `STRINGS` since trimming them is a side quest with no functional impact. Safe to remove in a future cleanup.
