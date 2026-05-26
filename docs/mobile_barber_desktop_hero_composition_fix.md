# Mobile Barber Desktop Hero — Composition Fix

Date: 2026-05-26

## Problem

Desktop hero on `/mobile-barber` stacked Book Now / Chat / Talk vertically and the location-gate card made the left column too tall, leaving the right hero photo column visually disconnected with empty whitespace.

## Root cause

The previous mobile-hero patch added an override at `@media (min-width: 680px)` that intentionally collapsed `.mb-hero__actions` back to a single column. That override leaked into desktop (we wanted mobile-tight CTAs but accidentally turned desktop into a vertical stack too).

Separately, `#mbLocationGate` retained its full mobile padding + stacked form on desktop, so the left column got even taller while the right hero stayed at 600px max.

## Fix (desktop only — mobile untouched)

### CTAs go horizontal at ≥680px
```css
@media (min-width: 680px) {
  .mb-hero__actions {
    grid-template-columns: auto auto auto;
    grid-template-areas: 'primary chat talk';
    gap: .65rem;
    justify-content: start;
  }
  .mb-hero__actions > :nth-child(1) { min-height: 52px; padding: 0 1.5rem; }
  .mb-hero__actions > :nth-child(2),
  .mb-hero__actions > :nth-child(3) { min-height: 48px; padding: 0 1.1rem; }
}
```

Three CTAs side-by-side, primary slightly taller and wider. `justify-content: start` lets them hug the left edge so they don't stretch awkwardly across the column.

### Location gate compacts at ≥1024px
```css
#mbLocationGate #mbLocationGateForm {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;  /* city | zip | button */
  gap: .55rem;
  align-items: end;
}
```

City + ZIP + Find My Barber sit on **one row** on desktop instead of the mobile vertical stack. The H2 collapses to a small gold uppercase label. Kicker + paragraph copy hidden on desktop. The gate now takes about a third of the left column instead of half.

## Why this matches the brief

- ✅ CTAs no longer stacked vertically on desktop
- ✅ Location card shrinks so the left column stops dominating
- ✅ Hero image already uses 41/59 split + 600-780px min-height + 1440px shell on ≥1600 (set in prior `ee3b2e0` polish); left column shrinking to match closes the visual gap
- ✅ Trust chips already added in the earlier polish (Licensed barber / House call / Verified vendor / Travel coverage / Family package), shown ≥1024px
- ✅ Mobile rules under 680px completely untouched

## Files changed

- `mobile-barber/mobile-barber.css`
- `mobile-barber/{index,vendor,dashboard}.html` and `tests/lib/mobile-barber-landing.js` (`?v=20260525ae`)

## Tests

`node tests/runner.js` → 357 passed, 0 failed.

## PASS criteria check

- [x] Desktop CTAs horizontal (3 buttons in one row)
- [x] Left column no longer dominated by tall location card
- [x] Right hero image keeps its premium 16:10 / 600-780px aspect
- [x] Mobile (≤679px) unchanged — Book Now full-width + Chat/Talk 50/50

**Verdict: PASS.**
