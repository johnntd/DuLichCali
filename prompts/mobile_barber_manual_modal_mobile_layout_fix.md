# Mobile Barber Manual Booking Modal — Mobile Layout Repair

The 4-step manual booking flow is logically correct and the post-success card replaces the form cleanly, but the modal **shell** itself is broken on mobile (375px iPhone Safari). User reports "information is not properly displayed, can't see much."

Concrete symptoms from production screenshots:

1. Modal is a bottom-anchored sheet (`place-items: end center`) taking ~60% of the viewport. The greyed page behind it is still visible and adds noise. The dialog feels cramped.
2. The Service dropdown is shown at the top of EVERY step (Step 1, 2, 3, 4), wasting vertical space — it's redundant once the customer has chosen a service. Pushes form fields and action buttons below the fold.
3. On Step 3 the error message ("Giờ này không còn trống") plus action buttons get pushed against the bottom edge of the viewport. iOS Safari's home indicator bar overlaps.
4. No visible progress indicator beyond "BƯỚC 3/4" text — customer can't tell at a glance how close they are to done.
5. Modal does not auto-scroll to top when stepping between 1→2→3→4, so the new step's header is invisible until the customer manually scrolls.
6. Header "Yêu cầu cắt tóc tại nhà" + close button + step label all stack vertically, eating ~110px before any field is shown.

Fix the layout so the modal is comfortable to use on a 375px iPhone in Safari without sacrificing desktop appearance.

---

## Required fix

### 1. Full-screen modal on mobile, sheet on desktop

Under 768px:
- `.mb-booking-modal__dialog` becomes full viewport: `width: 100%; max-height: 100dvh; height: 100dvh; border-radius: 0;`
- `.mb-booking-modal { place-items: stretch; padding: 0; }`
- Internal scroll container handles overflow
- Respect iOS safe areas: `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);`

At 768px+:
- Keep the current centered/bottom sheet — but switch to `place-items: center center` so it floats with breathing room, not glued to the bottom
- Cap at `width: min(100%, 38rem)` and `max-height: min(85dvh, 720px)` with internal scroll

### 2. Sticky header + sticky footer inside the dialog

The dialog body should be structured as three regions:

```
┌─────────────────────────────┐
│ STICKY HEADER               │ ← step label + title + close + progress bar
├─────────────────────────────┤
│                             │
│ SCROLLABLE BODY             │ ← form fields for current step
│                             │
├─────────────────────────────┤
│ STICKY FOOTER               │ ← Back / Continue / Confirm action buttons
└─────────────────────────────┘
```

Header and footer pinned with `position: sticky` (or flex layout with body as `flex: 1 1 auto; overflow: auto`). Action buttons should never be hidden behind iOS safe area or off-screen.

### 3. Thin progress bar in header

Replace the standalone "BƯỚC 3 / 4 — NGÀY VÀ GIỜ" label with a 2-line header:

```
[━━━━━━━━━━━──────────]  ← 75% filled progress bar (3 of 4)
Step 3 of 4 — Date & time     [×]
Yêu cầu cắt tóc tại nhà
```

Progress bar height ~3px, gold fill on grey track. Updates as steps advance.

### 4. Hide the Service dropdown after Step 1

The service is selected before the modal opens (the customer clicked a service card) and shown on Step 1 for confirmation. On Steps 2, 3, and 4:

- Hide the `<select>` Service dropdown
- Show a compact pill instead: `[Classic Haircut · $40]` (read-only, with a small "change" link that jumps back to Step 1 if needed)

This frees ~60px of vertical space per step.

### 5. Auto-scroll to top on step change

When the user clicks Continue or Back, the modal body must `scrollTo({ top: 0, behavior: 'smooth' })` so the new step's header is visible.

### 6. Confirmation card uses the same shell

When `state.manualSuccess` is true, the confirmation card replaces the body. The same sticky header (showing 100% progress and "Confirmed") + sticky footer (Done / New booking) pattern applies — no full-screen overlay redesign needed.

### 7. iOS safe-area handling

Wherever the modal touches the bottom of the viewport:

```css
padding-bottom: max(1rem, env(safe-area-inset-bottom));
```

so the home indicator bar never overlaps the Continue/Confirm button.

---

## Allowed files

- mobile-barber/mobile-barber.css
- mobile-barber/vendor.html (if structural DOM changes are needed for sticky header/footer)
- mobile-barber/index.html (same)
- mobile-barber/mobile-barber-vendor.js (auto-scroll on step change, hide service dropdown after step 1, progress bar update)
- tests/lib/mobile-barber-landing.js
- docs/mobile_barber_manual_modal_mobile_layout_fix_report.md

Do NOT touch:
- Booking write logic in `mobile-barber-booking.js`
- Notification logic in `notifications.js`
- Agent / voice / AI booking paths
- Anything outside `mobile-barber/` and the test file

## Required tests

1. At 375px viewport, the modal occupies full viewport with no page bleeding through above or below
2. At 1280px, the modal is centered (not stuck to bottom) with breathing room
3. The progress bar element exists, has the correct ARIA attributes (`role="progressbar"`, `aria-valuenow`), and updates per step
4. Service `<select>` is hidden on Steps 2/3/4 and a compact `mb-service-pill` is shown instead, with a working "change" link back to Step 1
5. `scrollTo` is called on the body container when Continue / Back fires
6. Confirmation success state uses the same sticky-header layout (progress shows 100%)
7. vi/en/es coverage for the new "Step X of 4" / "Change" / "Confirmed" strings
8. No regression in 343 existing tests
9. Sticky footer never sits under safe-area-inset-bottom on a viewport with `env(safe-area-inset-bottom)` > 0 (mock via assertion that the footer padding-bottom uses the env() value)

## Required diagnostic logs

```
[mobile-barber-manual-booking] step, scrollReset, progressPct, servicePillVisible, modalLayout ("mobile" | "desktop")
```

## Required report

`docs/mobile_barber_manual_modal_mobile_layout_fix_report.md`

Must include:

- Root cause for each of the 6 mobile UX symptoms above
- CSS diff summary (which selectors changed)
- DOM diff summary (which new elements were added)
- Mobile screenshot DOM layout (text description of what's visible at 375px in each of the 4 steps + success state)
- Desktop screenshot DOM layout (same)
- vi/en/es key additions
- Tests passing summary
- Production verification steps
- PASS / BLOCKED

## Version string bumps

- `mobile-barber-vendor.js` next safe: `v=20260525j`
- `mobile-barber.css` does not have a version string in HTML — Firebase will refresh on hosting deploy because the file hash changes (but verify in DevTools after deploy)

## PASS criteria

- Modal occupies full viewport on 375px iPhone Safari, with sticky header + footer, scrollable body
- Service dropdown hidden on Steps 2/3/4 with read-only pill alternative
- Progress bar renders and updates
- Action buttons always above iOS safe-area-inset-bottom
- Auto-scroll to top on every step change
- Confirmation card uses same shell
- 343+ tests pass
- vi/en/es coverage complete
- Desktop layout unchanged in spirit (centered, ~600px wide, with breathing room — not bottom-glued anymore)

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_manual_modal_mobile_layout_fix.md --max-loops 3 --allow-dirty --timeout 1800
```
