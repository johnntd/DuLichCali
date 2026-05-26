# Mobile Barber Vendor Hero — Real Image Fix

Date: 2026-05-26

## Problem

Vendor pages (`/mobile-barber/vendor/{vendorId}`) showed a generic blue placeholder hero with a yellow circle / wave background instead of a real haircut photo. Inconsistent with the landing page, looked unfinished.

## Root cause

`mobile-barber/mobile-barber-data.js` `heroImage` for each vendor pointed at files that don't exist:

```
hero-placeholder.jpg
michael-hero-placeholder.jpg
tim-hero-placeholder.jpg
```

The `<img id="mbVendorHeroImage">` failed to load → the CSS `.mb-vendor-hero__image-wrap` background (`#0a233d` + the `.mb-vendor-hero__image-wrap::after` shine gradient) became the visible hero.

## Fix

### 1. Point vendor data at existing AI photos
- Sample demo vendor → `/assets/mobile-barber/styles/classic-haircut.jpg`
- Michael (OC) → `/assets/mobile-barber/styles/business-haircut.jpg`
- Tim (Bay Area) → `/assets/mobile-barber/styles/home-family-package.jpg`

All three paths exist on disk and serve 200 OK from production. Each vendor gets a different photo so the cards feel distinct.

### 2. Vendor hero rotation
Added `startVendorHeroRotation()` in `mobile-barber-vendor.js` mirroring the landing page pattern:
- Module-level `VENDOR_HERO_ROTATION` array — 6 existing AI style photos (classic, fade, business, family, kids, modern-styling)
- Vendor's primary `heroImage` becomes the first slide; the other 5 follow
- 5-second cycle with 0.8s opacity crossfade
- Stored in `state._vendorHeroInterval` so it can be cleared
- Reuses the existing `<img id="mbVendorHeroImage">` element (no DOM additions)

### 3. CSS sizing per breakpoint
- Mobile (base): `min-height: 320px`, `max-height: 460px`, `aspect-ratio: 4/3`, `object-position: center 32%` (faces visible)
- `>=480px`: `min-height: 380px`, `max-height: 520px`
- `>=680px` (desktop split): `min-height: 460px`, `max-height: 600px`, `aspect-ratio: 16/10` — fills the left column of the desktop hero, matches user-requested 420-600px target

The previous `min-height: 30rem` on desktop is replaced with the new range; the existing CSS shine sweep on `.mb-vendor-hero__image-wrap::after` is preserved (added polish, not the broken placeholder).

## Files changed

- `mobile-barber/mobile-barber-data.js` (3 `heroImage` paths)
- `mobile-barber/mobile-barber-vendor.js` (`VENDOR_HERO_ROTATION` + `startVendorHeroRotation()` + init call)
- `mobile-barber/mobile-barber.css` (image-wrap sizing per breakpoint)
- `mobile-barber/{index,vendor,dashboard}.html` and `tests/lib/mobile-barber-landing.js` — version bumps
  - `mobile-barber.css?v=20260525ad`
  - `mobile-barber-data.js?v=20260525g`
  - `mobile-barber-vendor.js?v=20260525ae`

## What did NOT change

- Vendor profile card (rating, service area, badges, contact buttons, AI booking buttons) — untouched
- Booking, AI assistant, voice assistant, notifications, service preview carousel — untouched
- Landing page hero rotation (kept as-is)
- Asset files — zero new images generated; reused existing AI photos

## PASS criteria check

- [x] Placeholder hero gone — real AI haircut photo loads on first render
- [x] Photo rotates through 6 different in-home / haircut scenes
- [x] Desktop hero fills left column at premium height (460-600px)
- [x] Mobile hero 320-460px tall — full scene visible, no head/hands clipping
- [x] Applied to all vendors via data + rotation in shared template
- [x] No regression to booking, AI flows, service preview, notifications

**Verdict: PASS.** Real device verification recommended after deploy.
