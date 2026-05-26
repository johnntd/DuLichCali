# Mobile Barber Gallery — Truthful Style-Preview Fix

Date: 2026-05-26

## Problem

The Mobile Barber landing gallery showed AI-generated "before / after" haircut pairs. Identity drift inside each pair was unreliable:

- different children in before vs after (kids haircut)
- different age / ethnicity / gender / face
- different lighting / background
- pairs that read as misleading rather than transformations of the same person

The previous fix attempted image-to-image edit (Gemini 3.1 Flash Image Preview) with explicit identity-lock instructions. That reduced drift but did not eliminate it. The model is not reliable enough to truthfully claim "same person".

## Decision

Switched from option A (image-to-image identity-locked pairs) to option B (single-image style preview cards). Less ambition, fully truthful, no misleading claims.

## What changed

### `mobile-barber/mobile-barber.js`

- Renamed and rewrote `renderBeforeAfterGallery()` → `renderStylePreviewGallery()`
- New renderer:
  - reads from canonical `DATA.listStyleTemplates()` (no per-vendor portfolio rows)
  - renders one **single image** per category card (no before, no after, no crossfade video)
  - keeps the existing `mb-portfolio-card mb-portfolio-card--ai-sample` outer class for layout continuity
  - new inner element `.mb-style-preview-card__media` is a single 4:3 background-image tile with the AI Preview badge in the top-left corner
  - card title is now `{Style Name} — Style Preview` (vi: `— Mẫu Kiểu Tóc`, es: `— Vista de Estilo`)
  - description always uses `t('aiPreviewDisclosure')` so every card reads: *"Sample AI-generated style preview. Real barber portfolio coming soon."*
- Removed reads of `beforeImageUrl`, `afterImageUrl`, `image.clipUrl`, and the `Before/After` literal labels from the gallery code path
- Caller (`setLang`) updated to call the new function

### i18n string overhaul (vi / en / es)

| Key | EN | VI | ES |
|---|---|---|---|
| `beforeAfterKicker` | Style previews | Mẫu kiểu tóc | Estilos de muestra |
| `beforeAfterTitle` | AI-generated mobile barber style previews | Mẫu kiểu tóc thợ cắt tại nhà do AI tạo | Estilos de barbero móvil generados por AI |
| `beforeAfterCopy` | Curated AI previews of mobile barber styles. Real barber portfolio photos coming soon. | Mẫu kiểu tóc thợ cắt tại nhà do AI tạo. Hình thật của thợ sẽ được cập nhật sau. | Vistas previas curadas de estilos de barbero móvil. Las fotos reales del portafolio del barbero estarán disponibles pronto. |
| `stylePreviewSuffix` (new) | Style Preview | Mẫu Kiểu Tóc | Vista de Estilo |

The HTML data-i18n keys (`beforeAfterKicker`, `beforeAfterTitle`, `beforeAfterCopy`) are preserved — only the copy they render changed. The kicker / title / copy no longer say "before / after". 

### CSS

- Added `.mb-style-preview-card__media` — single 4:3 background-image tile, dark fallback color, smart background-position to keep faces visible

### Tests

- `tests/lib/mobile-barber-landing.js`:
  - asserts the renderer is now `renderStylePreviewGallery`
  - asserts the gallery code path does NOT reference `beforeImageUrl`, `afterImageUrl`, or `['Before', 'before'`
  - asserts the new `mb-style-preview-card` class is used
  - asserts the new `stylePreviewSuffix` string exists in all three languages
- 357 tests pass, 0 failed

## What did NOT change

- Vendor data layer (`mobile-barber-data.js`) and `buildAIPortfolioForVendor()` still write `beforeImageUrl` / `afterImageUrl` / `clipUrl` fields. **They are now unused by the public landing gallery** but kept intact so the vendor-portal portfolio renderer (which still uses them with explicit "AI preview" framing) is not broken. Future cleanup can drop them once the vendor portal also migrates off.
- The 40 generated portfolio JPGs on disk are kept (still referenced by the vendor portfolio renderer in `mobile-barber-vendor.js`). They no longer appear on the customer-facing landing in any before/after framing.
- The 20 crossfade `.mp4` clips under `assets/mobile-barber/clips/` are kept but no longer used by the landing renderer.
- Booking, AI booking, voice booking, service cards, vendor cards, dashboard — all unchanged.

## Vendors covered

The gallery sources from `DATA.listStyleTemplates()` which is global to all mobile barber vendors. Michael, Tim, and any future vendor automatically inherit the new style-preview gallery. No vendor-specific code path remains.

## PASS criteria check

- [x] No misleading before/after pairs remain on the landing page
- [x] No "before / after" copy in section heading
- [x] Every card clearly labeled "Sample AI-generated style preview. Real barber portfolio coming soon."
- [x] Single image per card, AI Preview badge visible
- [x] Service cards, booking, vendor page layout unchanged
- [x] vi / en / es coverage complete
- [x] 357 tests pass

**Verdict: PASS.**
