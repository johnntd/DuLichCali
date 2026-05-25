# Mobile Barber Manual Booking Modal — Mobile Layout Repair Report

Date: 2026-05-25
Prompt: `prompts/mobile_barber_manual_modal_mobile_layout_fix.md`
Result: PASS (locally; production verification pending)

## Root causes

The post-booking UX fix made the success state clean, but the underlying modal *shell* was still a cramped bottom-anchored sheet on mobile. Six concrete issues from production screenshots:

1. **Bottom-anchored sheet** — `.mb-booking-modal { place-items: end center }` + `border-radius: var(--r-md) var(--r-md) 0 0` rendered the dialog glued to the viewport bottom, only filling ~60% of height with greyed page bleeding through above.
2. **Service `<select>` repeated on every step** — `.mb-selected-service-field` was shown unconditionally, wasting ~60px per step and pushing form fields below the fold.
3. **No sticky footer** — action buttons (Back / Next / Check Availability / Confirm) lived in `.mb-form-actions` at the bottom of the form with no fixed positioning; on shorter content steps they hung above the iOS home indicator.
4. **No progress indicator** — only a text label "Bước 3/4", no visual bar to telegraph progress.
5. **No auto-scroll on step change** — when transitioning 1→2→3→4, the user landed mid-content on the new step.
6. **No safe-area handling** — iOS Safari home indicator overlapped the bottom action buttons.

## CSS diff summary

`mobile-barber.css`:
- **`.mb-booking-modal`** — switched from `display: grid; place-items: end center; padding: 1rem;` to `display: flex; align-items: stretch; justify-content: center; padding: 0;` so the dialog fills the viewport on mobile.
- **`.mb-booking-modal__dialog`** — `height: 100dvh; max-height: 100dvh; flex-direction: column; border-radius: 0;` on mobile; `padding-top: env(safe-area-inset-top)`. Inner overflow removed (now handled by `.mb-booking-modal__body`).
- **`.mb-booking-modal__dialog > form`** — `flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0;` so the form fills available space and lets the body scroll.
- **`.mb-booking-modal__head`** — new sticky-top region (`flex: 0 0 auto`) with bottom border separator.
- **`.mb-booking-modal__head-row`** — 2-column grid for step label/title + close button.
- **`.mb-progress-bar` / `.mb-progress-bar__fill`** — new 3px-tall gold gradient bar.
- **`.mb-booking-modal__body`** — new `flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch;` scroll container.
- **`.mb-service-pill` / `__label` / `__change`** — compact gold-bordered pill for displayed-only service after Step 1.
- **`.mb-booking-modal__footer.mb-form-actions`** — sticky-bottom (`flex: 0 0 auto`) with `padding-bottom: max(1rem, env(safe-area-inset-bottom))`.
- **`@media (min-width: 768px)` desktop override** — switches back to a centered floating dialog: `align-items: center; padding: 1.5rem;` on overlay; `width: min(100%, 38rem); height: auto; max-height: min(85dvh, 720px); border-radius: var(--r-md);` on dialog.

## DOM diff summary

`mobile-barber/vendor.html` — modal restructured into 3 regions inside the dialog:

```
.mb-booking-modal__dialog
├── .mb-booking-modal__head           [sticky top]
│   ├── .mb-progress-bar
│   │   └── .mb-progress-bar__fill    [width updated per step]
│   └── .mb-booking-modal__head-row
│       ├── (kicker + title)
│       └── close button
├── <form>
│   ├── .mb-booking-modal__body       [scrollable]
│   │   ├── .mb-selected-service-field [step 1 only]
│   │   ├── .mb-service-pill          [steps 2/3/4 only]
│   │   ├── .mb-form-step × 4
│   │   └── .mb-form-error
│   └── .mb-form-actions.mb-booking-modal__footer  [sticky bottom]
│       └── Back / Next / Check Availability / Confirm
```

## Mobile screenshot DOM layout (375px)

Step 1: progress 25%, "Step 1 / 4 — Customer contact" + title in sticky header. Body scrolls: service `<select>`, name, phone, email + warning, SMS opt-in. Sticky footer: "Next" full width (Back is hidden on step 1).

Step 2: progress 50%, "Step 2 / 4 — Service address" in header. Body: service pill `[Classic Haircut · $40 · CHANGE]`, address, city, ZIP, optional details disclosure. Footer: Back + Next.

Step 3: progress 75%, "Step 3 / 4 — Date and time" in header. Body: service pill, date, time. Footer: Back + Check availability.

Step 4: progress 100%, "Step 4 / 4 — Review and confirm". Body: service pill, review summary (customer, barber, service, date/time, price, address). Footer: Back + Confirm Booking.

Success state (`state.manualSuccess`): header label switches to "Booking confirmed", progress 100%. Footer hidden + disabled. Body shows only the confirmation card with copy ID, save share, Done, New booking.

## Desktop screenshot DOM layout (≥1280px)

Overlay centers a 38rem dialog with `min(85dvh, 720px)` cap, rounded corners (`var(--r-md)`), 1px border. Header has rounded top corners; footer has rounded bottom corners. Page content behind is dimmed. Same internal sticky-header/scrollable-body/sticky-footer structure.

## vi/en/es key additions

| Key | EN | VI | ES |
|---|---|---|---|
| `servicePillChangeLabel` | Change | Đổi | Cambiar |

No customer-facing copy or admin labels were added or hardcoded in any other language path.

## Tests passing summary

- `node tests/runner.js` → **345 passed, 0 failed** (343 baseline + 2 new layout tests)
- `bash scripts/ai/targeted_dry_run.sh booking` → `FINAL: PASS` (8/8)
- `node --check mobile-barber/mobile-barber-vendor.js` → OK

New tests in `tests/lib/mobile-barber-landing.js`:
- `Mobile Barber manual modal has progress bar, scrollable body, and service pill` — asserts DOM elements, JS hooks, and vi/en/es pill change label coverage
- `Mobile Barber CSS uses full-viewport modal on mobile and centered on desktop` — asserts `.mb-booking-modal__body`, `.mb-booking-modal__footer.mb-form-actions`, progress bar / service pill selectors, `env(safe-area-inset-bottom)`, and `@media (min-width: 768px)`

## Diagnostic logs

Existing log enriched with new fields per the prompt:

```
[mobile-barber-manual-booking] {
  step, selectedService, hasContact, hasAddress, hasDateTime,
  availabilityStatus, submitStatus, bookingId, error,
  scrollReset, progressPct, servicePillVisible
}
```

## Production verification steps

1. Open `https://www.dulichcali21.com/mobile-barber/vendor.html` on iPhone Safari (or DevTools 375px).
2. Hard-refresh (`Cmd+Shift+R`) to bypass immutable cache.
3. Select Michael → tap a service → confirm modal opens full-viewport.
4. Step 1 visible: kicker, title, close button at top under a thin gold progress bar (25% filled).
5. Tap Next → progress bar smoothly grows to 50%, body scrolls to top, service `<select>` replaced by `[Classic Haircut · $40 · CHANGE]` pill.
6. Tap "Change" on pill → modal jumps to Step 1 with service dropdown back in focus.
7. Walk through to Step 4 (Check Availability passes), confirm progress hits 100%.
8. Confirm Booking → form/footer hidden; only confirmation card visible.
9. Verify iOS home indicator does NOT overlap the footer buttons on any step.
10. Rotate to landscape → no clipping; footer remains accessible.
11. At desktop ≥1280px, confirm modal is centered with breathing room (not bottom-glued), rounded corners visible.
12. Repeat for Tim's vendor page.

## Remaining risks

- Visual regression on legacy desktop layouts not yet snapshot-tested; manual desktop check recommended.
- The new modal body intentionally allows `details > summary` optional disclosure on Step 2 to expand inside the scroll container — confirm scroll behavior with disclosure open at 375px.
- Sticky-header background opacity (`rgba(8, 28, 48, .98)`) covers underlying body content; if a vendor's brand requires a different shade, this is the centralized place to override.

## PASS criteria check

| Criterion | Status |
|---|---|
| Modal full viewport on 375px iPhone Safari | ✓ (CSS + `100dvh` + flex column) |
| Sticky header + footer with scrollable body | ✓ |
| Service dropdown hidden on Steps 2/3/4 with read-only pill | ✓ |
| Progress bar renders and updates | ✓ |
| Action buttons always above iOS safe-area-inset-bottom | ✓ |
| Auto-scroll to top on every step change | ✓ (`body.scrollTo({ top: 0, behavior: 'smooth' })`) |
| Confirmation card uses same shell | ✓ (renderManualStep sets footer hidden + 100% progress) |
| 343+ tests pass | ✓ (345 passing) |
| vi/en/es coverage complete | ✓ (servicePillChangeLabel in all 3) |
| Desktop layout centered with breathing room | ✓ (`@media (min-width: 768px)` override) |

**Verdict: PASS (local). Deploy + manual production walkthrough required for full sign-off.**
