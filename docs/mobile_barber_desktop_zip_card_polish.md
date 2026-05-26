# Mobile Barber — Desktop ZIP Card Polish

Date: 2026-05-26

## Scope

Desktop only (`@media (min-width: 769px)`). Mobile (<769px) untouched.

## Problems

- ZIP input rendered too wide / awkwardly placed
- Find My Barber and Change Location buttons didn't match each other (different heights / radii / font sizes / paddings) — looked like two separate widgets glued together
- Card spacing and alignment felt unfinished
- Form read like a generic form dumped into the hero instead of part of the design system

## Fix

Rewrote the `@media (min-width: 769px)` block for `#mbLocationGate` from grid-based to flex-based with three deliberate constraints:

### 1. Compact ZIP input
- `.mb-field` width fixed at `8.5rem`
- Input height `2.6rem`, padding `0 .8rem`, font `var(--text-sm)`, radius `var(--r-sm)`
- Field label downsized to `var(--text-xs)` muted color so the input is the visual anchor

### 2. Buttons share the same design system
- Both `Find My Barber` and `Change location` now identical:
  - `height: 2.6rem` (matches the ZIP input)
  - `padding: 0 1.2rem`
  - `border-radius: var(--r-sm)`
  - `font-size: var(--text-sm)`, `font-weight: 700`
  - `letter-spacing: .02em`
- Primary keeps its gold treatment via base `.mb-button--primary`
- Secondary keeps its ghost treatment via base `.mb-button--ghost`
- Both render at the same baseline so they line up cleanly with the input

### 3. One-row, balanced layout
```
[ZIP input 8.5rem] [Find My Barber] ............... [Change location]
```
- `.mb-form-actions` is flex with `margin-left: auto` on Change location so it hugs the right edge of the card
- All controls share `align-items: flex-end` so labels + inputs + buttons line up
- Card padding lifted to `1rem 1.1rem` and lighter background `rgba(255,255,255,.04)` for premium feel

### 4. Section header
- H2 reduced to compact gold uppercase label (no big heading, no kicker, no paragraph copy)
- Subtitle and kicker hidden on desktop — the input + buttons carry the meaning

## Files changed

- `mobile-barber/mobile-barber.css`
- `mobile-barber/{index,vendor,dashboard}.html` and `tests/lib/mobile-barber-landing.js` (`?v=20260525ai`)

## What did NOT change

- Mobile layout under 769px — every prior mobile rule untouched
- Hidden city field rule — still uses `:first-of-type` to remove the city wrapper from layout
- JS ZIP-only routing logic, `ZIP_TO_CITY` map, `routeByLocation()` — all unchanged
- Booking, AI/voice booking, language switching, vendor cards, hero rotation

## Tests

`node tests/runner.js` → 357 passed, 0 failed.

## PASS criteria check

- [x] ZIP input is compact (8.5rem) and aligned with buttons
- [x] Both buttons share height, radius, padding, typography, font weight
- [x] Card padding and background read as premium, not a form drop-in
- [x] Mobile (<769px) layout untouched

**Verdict: PASS.**
