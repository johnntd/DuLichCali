# Mobile Barber — Mobile Hero Pro-UX Redesign Report

Date: 2026-05-26

## Problem (per user brief)

- Hero image too short and cropped
- Language buttons take too much top space
- Headline / copy / buttons too large, consuming first screen
- Service area gate starts too early and dominates layout
- Talk/Chat buttons stacked awkwardly
- Page feels compressed instead of premium

## Approach

Mobile-only (< 680px) surgical CSS adjustments. Desktop rules untouched.

## Changes

### Language buttons (`.mb-language`)
- Sticky top, but floats further right with tighter margin (`.4rem` top / safe-area-inset)
- Pill shape (`border-radius: 999px`), smaller min-height (`1.9rem` vs `2.25rem`)
- Smaller font, less letter weight visually
- Restored to original size at ≥680px

### Hero photo (`.mb-hero__media`)
- Mobile min-height bumped from `22dvh` (~185px) to **340px**, max `420px`
- ≥480px: `380-460px`
- Hero photo now the primary visual anchor on the first screen
- The dynamic-viewport unit dependency removed for mobile so Safari URL bar resize doesn't shrink it mid-scroll
- `.mb-hero` adds `min-height: 100svh` mobile only — uses small-viewport unit to avoid the iOS Safari `100vh` overflow bug

### Hero title (`.mb-hero__title`)
- Mobile font dropped from `2.1rem` to **`1.65rem`**, line-height `1.05`
- `max-width: 20ch` (was 18) so it wraps to 2 lines comfortably
- ≥480: `2.6rem`, ≥680: original `3.35rem`

### Hero copy (`.mb-hero__copy`)
- Mobile font dropped to `--text-xs`, line-height `1.35`
- **`-webkit-line-clamp: 2`** to enforce 2-line max on mobile
- Full text restored at ≥480px

### CTA layout (`.mb-hero__actions`)
- Default (under 380px): single column stack — Book Now / Chat / Talk
- ≥380px: **Book Now full-width on top row, Chat + Talk 50/50 on second row**
- Min-height 48px on primary, 44px on secondary (WCAG touch target)
- ≥680px: original single-column

### Service area gate (`#mbLocationGate`)
- Pushed visually down with `margin-top` and lighter background
- Mobile hides the kicker and the descriptive copy paragraph — keeps only the H2 + the two fields + the Find My Barber button
- Compact padding (`.75rem .85rem`)
- Full chrome restored at ≥680px

### Glass overlay (kept from previous patch)
- Still a small "Verified Barber" pill in the bottom-left corner of the hero photo
- Doesn't darken the photo or steal visual space

### Hero gap
- `.mb-hero` gap dropped from `1.4rem` to `.85rem` on mobile so the photo and title sit closer
- Restored to `1.4rem` at ≥680px

## Files changed

- `mobile-barber/mobile-barber.css`
- `mobile-barber/index.html`, `vendor.html`, `dashboard.html`, `tests/lib/mobile-barber-landing.js` (version bump to `?v=20260525ac`)

## What did NOT change

- Desktop layout (≥680px and ≥1024px polished previously stays exactly the same)
- Booking, AI booking, voice booking flows
- Language switching logic
- Service area finder behavior (input remains accessible; only the header chrome collapses on mobile)
- Hero photo asset (still rotates through `/assets/mobile-barber/styles/*.jpg`)

## Above-the-fold composition on iPhone 390×844 (after)

```
[sticky lang pill row, top-right, ~30px]
[hero photo, 340px tall, rounded, verified-barber corner pill]
[kicker]
[title 2 lines, 1.65rem]
[2-line copy clamp]
[Book Now full-width 48px]
[Chat | Talk 50/50, 44px each]
[location gate compact card peeking in]
```

Hero photo is the dominant element on first screen. No giant form, no oversized headline, no awkward 3-stack of buttons.

## Tests

`node tests/runner.js` → 357 passed, 0 failed.

## PASS criteria check

- [x] Hero image larger and less cropped (340-420px vs 22-28dvh)
- [x] Language buttons compact, top-right, smaller
- [x] Headline smaller and tighter
- [x] Intro copy clamped to 2 lines
- [x] CTA layout: Book Now full-width + Chat/Talk row
- [x] Service area gate pushed down, header chrome collapsed
- [x] Safari `100vh` avoided (`100svh` used)
- [x] Desktop layout untouched

**Verdict: PASS.** Real device verification still recommended after deploy.
