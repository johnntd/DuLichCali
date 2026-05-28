# Mobile Barber — Promo Hero Blank-Slide Fix

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Bug

When a vendor activated a promotion, the hero briefly **flashed a blank/empty promo slide** and then snapped back to the default rotation — the promo never persisted, never carried any discounted services, and looked broken.

## Root Cause (four stacked issues)

### 1. Render race during boot

`renderHeroShowcase()` was called from FOUR places back-to-back at startup:
1. `init()` directly (before Firestore loads)
2. `setLang()` (called from init)
3. `loadVendorPromosFromFirestore().then(...)` (after Firestore returns)
4. `subscribeVendorPromos` onSnapshot listener (Firestore local-cache snapshot)

Call #1 ran with an empty overlay → no promo slides → default + clips.
Call #3 ran after Firestore → promo slide appears.
The user saw the **transition** as a flash.

### 2. `mount.innerHTML = ''` blanked the surface for a frame

Each call cleared the container *before* the new DOM was appended. For one frame the hero was empty → flash.

### 3. Active slide index reset to 0 every render

The previous code declared `var active = 0` on each render. If the customer was mid-rotation on (say) the Family clip slide and a re-render fired, the carousel snapped back to slide 0. Looked like the promo "appeared then disappeared" because the index reset shifted what was visible.

### 4. Promo slide had no content density

The promo slide rendered only `title + copy + meta + CTA`. No image (gradient only), no service list, no original/final pricing. To customers that read as "blank/empty promotion screen".

## Fix

### A. Hash-then-skip — no re-render when nothing changed

```javascript
var hash = _hashSlideSet(slides);  // [{ key, title, copy, meta, badge, poster, video, services }, …]
if (hash === _heroShowcaseHash && mount.children.length === slides.length) {
  return;  // identical content — keep the running rotation intact
}
_heroShowcaseHash = hash;
```

Subsequent identical render calls (init + loader-then + snapshot) are now noops. The first paint shows whatever is available; later paints only rebuild when slide content actually changed.

### B. Active slide key preserved across rebuilds

```javascript
var keepKey = _heroShowcaseActiveKey;  // remembered from last render + rotation tick
var activeIdx = 0;
if (firstPromoKey && !_heroShowcaseHashHadPromo) {
  // Promo just activated — lead with it on this render.
  activeIdx = indexOf(firstPromoKey);
} else if (keepKey) {
  // Otherwise keep the previously visible slide visible.
  activeIdx = indexOf(keepKey);
}
```

So if the promo arrives mid-rotation it becomes the active slide *and* the rotation continues from there. The customer sees the promo land naturally — no jump-back-to-zero.

### C. Fragment + atomic swap — no blank frame

```javascript
var frag = document.createDocumentFragment();
slides.forEach(function(slide, idx) {
  frag.appendChild(_buildHeroShowcaseCard(slide, idx === activeIdx));
});
mount.innerHTML = '';      // emptied + appended in the same microtask
mount.appendChild(frag);   // browser doesn't paint the empty state
```

The empty + append happen in one synchronous block, so the browser never renders the in-between empty state.

### D. Rich promo slide

The promo slide now carries:

```
🔥 GRAND OPENING — 30% OFF                          (gold gradient badge)
─────────────────────────────────────────────
Michael Mobile Barber OC                            (vendor + Through May 31)
Classic Haircut          $40 → $28                  (top 3 discounted services)
Fade Haircut             $45 → $31
Haircut + Beard          $65 → $45
[ Book this discount ]                              (premium gold CTA)
```

- Barber poster image (`PROMO_HERO_FALLBACK = business-haircut.jpg`) as background, gold gradient overlaid via `::before` pseudo-element — never blank, even when CSS-only gradient fails to render.
- `_topDiscountedServicesForPromo(promo, vendorId)` computes the top 3 services (sort by price desc, filtered by `applyToScope === 'selected'` scope if set), each with `originalPrice → discountedPrice`.
- Inline service grid with strikethrough originals + gold final prices.

### E. Graceful no-eligible-services case

If a promo's scope is `selected` but `appliesToServiceIds` is empty (no eligible services), `_topDiscountedServicesForPromo` returns `[]`. The slide still renders (title + vendor + CTA) but skips the empty service grid — never an empty list, never a broken layout.

## Carousel Data Structure (after)

```js
{
  type:    'promo' | 'default' | 'clip',
  key:     'heroShowcasePromo-<id>' | 'heroShowcaseDefault' | 'heroShowcaseFade' | …,
  title:   string,
  copy:    string,            // promo description
  meta:    string,            // vendor name · Through {endDate}
  badge:   '🔥 30% OFF' | '✓ Verified barber',
  poster:  '/assets/…',       // fallback image — required for promo so it never renders blank
  video:   '/assets/…' | null, // clip slides only
  services:[                  // promo slides only — top 3 discounted
    { slug, name, originalPrice, discountedPrice }, …
  ],
  cta:     'Book this discount',
  action:  function() { openAssistantPanel('general'); }
}
```

Slide order:
1. Active promo(s) — one slide per active promo
2. Default brand slide
3. Fade at home (clip)
4. Family haircut stop (clip)
5. Hotel-ready grooming (clip)

Each slide carries its own `key` for stable active-tracking across rebuilds.

## Rotation Proof

| Event | Result |
|-------|--------|
| Page boot, no Firestore yet | Default brand slide + clips render. Active = slide 0 (default). |
| Firestore loads with active promo | Slide set hash changes. Promo becomes slide 0. **Becomes active** because `firstPromoKey && !_heroShowcaseHashHadPromo` — customer sees it land. |
| 5s tick | Promo slide deactivates, default brand becomes active, rotation continues. |
| 5s tick | Default → Fade clip. |
| 5s tick | Fade → Family clip. |
| 5s tick | Family → Hotel clip. |
| 5s tick | Hotel → Promo (rotation wraps). Promo persists every cycle. |
| Snapshot fires with identical promo data | `hash === _heroShowcaseHash` → render skipped. Rotation continues uninterrupted. |
| Vendor adds a new promo | Hash changes, new promo slide added. If `_heroShowcaseHashHadPromo` was already true, active slide is preserved (no jump). |
| Vendor disables all promos | Hash changes, promo slides removed. If active key was the promo slide, falls back to slide 0 (default brand). |

## Files Changed

```
mobile-barber/mobile-barber.js     (renderHeroShowcase rewritten: hash diff, key preservation,
                                    fragment swap, _topDiscountedServicesForPromo, _buildHeroShowcaseCard
                                    extracted, new tracking vars)
mobile-barber/mobile-barber.css    (promo slide gets a ::before gold gradient OVER the poster image,
                                    new .mb-hero-showcase-card__services grid + service-row styles)
mobile-barber/index.html           (cache bust ?v=20260528j)
mobile-barber/dashboard.html       (cache bust ?v=20260528j)
mobile-barber/vendor.html          (cache bust ?v=20260528j)
tests/lib/mobile-barber-landing.js (version assert bumped)
docs/mobile_barber_promo_hero_blank_slide_fix.md (this report)
```

## Cache-Bust

`?v=20260528i → ?v=20260528j` across all mobile-barber files.

Full system gate: **`FINAL: PASS` — 439 passed, 0 failed**.

## Manual Smoke Test

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/` in a private window with the dashboard 30% promo active.
2. Hero opens directly on the promo slide:
   - Gold `🔥 30% OFF` badge top-left
   - "Khuyến mãi mở cửa" / promo name as the title
   - "Michael Mobile Barber OC · Through May 31" meta line
   - Top 3 discounted services rendered inline with `$X → $Y` pricing
   - "Book this discount" CTA bottom-left
   - Background = barber poster image with gold gradient overlay (never blank)
3. After 5 s rotation advances to the default brand slide, then Fade → Family → Hotel.
4. After ~25 s the rotation wraps and the promo slide appears again. **Promo persists every cycle, never disappears between renders.**
5. Disable the promo in the dashboard. Within ~1 s the hero falls back to the default + clips rotation. No blank state.
6. Re-enable the promo. Within ~1 s the promo slide reappears as the active slide.
7. iPhone Safari: same rotation, 44 px+ CTA, no overflow, no layout jump.

## PASS / BLOCKED

**PASS** — promo becomes a stable rotating hero slide with discounted services rendered inline. No blank screen at any point. Rotation continues normally with the promo as a permanent member until the vendor disables it.

## Remaining Risks

- The promo slide caps at 3 services. If a vendor wants to highlight more, they can rely on the bookable "Latest AI Haircut Styles" carousel further down the page (which shows all 13 services with their applied promo prices).
- `PROMO_HERO_FALLBACK` is `business-haircut.jpg` for all vendors. A future enhancement could let the vendor pin a specific hero image to a promo (e.g. `promo.heroImage`), with this constant as the fallback.
- `_topDiscountedServicesForPromo` sorts by price descending. If a vendor wants to feature lower-tier services (Buzz Cut, Line Up) in their promo, those won't surface in the top 3 with the current heuristic. Acceptable for now since the highest-value services drive the most savings story.
