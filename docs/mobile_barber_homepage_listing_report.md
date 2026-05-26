# Mobile Barber Homepage Listing Report

Date: 2026-05-26

## 1. Homepage Vendor Card Renderer

- Mount point: `index.html` -> `#hpFeatured` / `#hpVendorCards`
- Renderer: `script.js` -> `renderHomepageVendors(regionId)`
- Card builder: `script.js` -> `buildVendorCardHtml(biz)`
- Fallback renderer: `script.js` -> `renderAllHomepageVendors()`

## 2. Data Source

Homepage vendor cards are data-driven.

- Primary path: Firestore `vendors` query in `renderHomepageVendors()`
- Static display fallback: `window.MARKETPLACE.businesses` from `marketplace/services-data.js`
- Prompt constraint conflict: `marketplace/*` was explicitly forbidden for this task, so Mobile Barber was added through a homepage-scoped data array in `script.js`: `HOMEPAGE_MARKETPLACE_ENTRIES`

## 3. What Was Added

Added one Mobile Barber marketplace-panel entry:

- Label/name: `Mobile Barber`
- Subtitle: `In-home haircuts. We come to you.`
- CTA: `Book Mobile Barber`
- Link: `https://www.dulichcali21.com/mobile-barber`
- Image: `/assets/mobile-barber/styles/classic-haircut.jpg`

Render proof:

- `renderHomepageVendors()` now merges `_withHomepageMarketplaceEntries(vendors, regionId)` before slicing and rendering.
- `buildVendorCardHtml()` now renders cards as links and supports optional `ctaText`.
- Existing food / nails / hair card paths remain unchanged through `_CAT_PATHS`.
- Homepage keeps the documented 3 panels: Airport & Ride, Marketplace, Tour & Travel.

## 4. Files Changed

- `index.html`
- `script.js`
- `style.css`
- `tests/lib/mobile-barber-landing.js`
- `docs/mobile_barber_homepage_listing_report.md`

## 5. Mobile 375px Layout Proof

Static proof:

- Existing mobile card sizing remains: `.hp-vendor-card { flex: 0 0 calc(72% - .5rem); max-width: 260px; }`
- Card image remains fixed-height with `background-size: cover`.
- CTA uses `.hp-vendor-card__cta` with `min-height: 30px`, compact text sizing, and no wrapping.
- Homepage CSS and JS cache strings were bumped to `20260526a`.

Runtime visual proof:

- Not captured in this sandbox. Playwright/Puppeteer are not installed, and the available toolset does not expose a local browser session.

## 6. Existing Vendor Link Smoke Check

Static checks:

- Food remains routed through `_CAT_PATHS.food -> foods/`
- Nails remains routed through `_CAT_PATHS.nails -> nailsalon/`
- Hair remains routed through `_CAT_PATHS.hair -> hairsalon/`
- Airport & Ride panel markup in `index.html` remains unchanged.
- Tour & Travel panel markup in `index.html` remains unchanged.

Automated checks:

- `node -c script.js` -> pass
- `node tests/runner.js` -> 357 passed, 0 failed
- `bash scripts/ai/targeted_dry_run.sh marketplace` -> `FINAL: PASS`
- `bash scripts/ai/full_system_dry_run.sh` -> `FINAL: PASS`

Requested loop:

- `bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_homepage_listing.md --max-loops 3 --allow-dirty --timeout 1800` -> `FINAL: FAIL`
- Cause: nested `codex exec` could not create a session because `/Users/johntd/.codex/sessions` is not writable in this sandbox (`Operation not permitted`).

## 7. Status

BLOCKED for the requested `ai_dev_loop` automation because the nested Codex session cannot start in this sandbox.

Patch validation itself passed the targeted marketplace dry run and the full system dry run.
