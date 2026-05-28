# Mobile Barber — "Book this service" Manual Booking Fix

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber/`)
**Date:** 2026-05-27

## Bug

When a customer tapped **"Book this service"** on the selected-service panel, the UI incorrectly opened the AI chat assistant instead of a direct manual booking form. The three CTAs (Book / Chat / Talk) collapsed into the same destination, blocking direct booking entirely.

A secondary bug compounded it: tapping the per-card **"Select Service"** button on any service card also auto-opened the AI chat (via `promptForLocation` → `openAssistantPanel`) whenever the customer had no saved location, so in practice most customers were redirected into chat before ever seeing the Book / Chat / Talk row.

## Root Cause

`renderSelectedService()` in `mobile-barber/mobile-barber.js` (lines 1369-1382 of the pre-fix file) wired the Book button as follows:

```javascript
book.addEventListener('click', function(event) {
  event.preventDefault();
  state.selectedServiceId = service.id;
  var saved = readSavedLocation();
  var routed = saved && BOOKING && BOOKING.findVendorForAddress
    ? BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors })
    : null;
  if (routed) {
    state.routedVendor = routed;
    openAssistantPanel('general');   // ← BUG: Book opens chat panel
  } else {
    promptForLocation(service.id);    // ← BUG: that helper also opens the chat panel
  }
});
```

Plus `promptForLocation()` (line 798-800 of the pre-fix file) is a one-liner that always opens the AI panel:

```javascript
function promptForLocation(serviceId) {
  state.pendingServiceId = serviceId || '';
  openAssistantPanel('general');
}
```

So every "Book this service" tap landed in the AI chat regardless of location state. The per-card Select CTA called the same helper, compounding the problem.

### Why this happened historically

The location gate used to live above the chat panel as its own form. When the gate was removed (`2026-05-27` per the test comment in `tests/lib/mobile-barber-landing.js:160`), `promptForLocation` was rewritten as a thin shim that "delegates collection to the AI agent's ASK_ADDRESS slot fill". That decision was correct for the chat flow but turned the Book CTA into a chat redirect because the Book handler was using `promptForLocation` for its location-missing fallback. The change collapsed three flows into one.

## Fix

### Three intentionally separate handlers — `mobile-barber.js`

`renderSelectedService()` now wires three distinct handlers:

```javascript
book.addEventListener('click', function(event) {
  event.preventDefault();
  event.stopPropagation();
  state.selectedServiceId = service.id;
  openManualBookingForm(service);    // ← manual flow, no AI
});
chat.addEventListener('click', function() {
  state.selectedServiceId = service.id;
  openAssistantPanel('general');     // ← AI text
});
voice.addEventListener('click', function() {
  state.selectedServiceId = service.id;
  openVoiceAssistant();              // ← AI voice
});
```

The Book button is also an explicit `<button type="button">` with `data-action="bookSelectedService"` — no longer an `<a href>` that could trigger navigation if `event.preventDefault()` was ever lost.

### Per-card Select decoupled from chat

The per-card **Select Service** CTA no longer calls `promptForLocation`. It just selects the service, surfaces the selection panel, and smooth-scrolls it into view. Location is collected inside the manual form itself (city + ZIP fields), or by the AI agent if the customer chooses the Chat / Talk paths.

### New manual booking helpers

Three new functions in `mobile-barber.js`:

| Function | Purpose |
|----------|---------|
| `openManualBookingForm(service)` | Mounts the inline form inside `#mbManualBookingMount` and scrolls it into view |
| `renderManualBookingPanel(service)` | Builds the form DOM (phone, name, address, city, ZIP, date, time, notes, payment) |
| `submitManualBooking(service, panel)` | Validates, finds the right vendor, runs `checkAvailability` + `buildBooking` + `saveBooking({ requireDatabase: true })` |
| `manualBookingErrorMessage(key)` | Friendly error mapper for every `checkAvailability` failure key |

New `state.manualBooking` slice (`expandedServiceId`, `submitting`, `lastSubmittedServiceId`, `lastSubmissionError`, `formDraft`) keeps the form ephemeral and separate from AI state.

### Optional AI hairstyle attachment

If the customer previously picked an AI hairstyle in the preview cards above, `submitManualBooking` carries the full canonical reference onto the booking — same `selectedAiStyleId / Name / Image / Description / BarberNotes / MaintenanceLevel` shape used by the inline-from-AI-card flow. Vendor portal shows the AI hairstyle reference block on the appointment either way.

### Form fields

- Phone (`tel` input, autocomplete `tel`)
- Name (autocomplete `name`)
- Street address (autocomplete `street-address`)
- City + ZIP on one row (autocomplete `address-level2` / `postal-code`)
- Preferred date + preferred time on one row (`date` and `time` inputs)
- Optional notes (textarea)
- Payment: Cash / Zelle radios
- Submit + Cancel buttons

All inputs are 44 px+ tall to meet touch-target spec. Form prefills from saved location and last booking. The two-column rows collapse to one column at ≤ 540 px.

## i18n

26 new keys in `STRINGS` for vi / en / es. No hardcoded strings in any language. Per the project rule: every new string ships in all three languages in the same commit.

## CSS — `mobile-barber.css`

New `.mb-manual-booking*` block with:
- Gold-bordered glow card (`box-shadow: 0 18px 40px -24px rgba(245, 166, 35, .45)`)
- `mbManualBookingExpand` keyframe (220 ms ease-out fade + slide-up), gated by `prefers-reduced-motion`
- Selected-service summary chip (gold tint) so the customer always sees what they're booking above the form
- Optional AI-attached pill (green dashed) when an AI hairstyle is being included
- Sticky-feel submit row with success state replacing the form after a successful save

## Event-flow diagram

```
Before fix:
  [Select Service] ──▶ selectService() ──▶ promptForLocation() ──▶ openAssistantPanel  ← AI chat opens
  [Book this service] ─────────────────────────────────────────▶ openAssistantPanel  ← same
  [Chat with AI]    ─────────────────────────────────────────▶ openAssistantPanel  ← same
  [Talk to AI]      ─────────────────────────────────────────▶ openVoiceAssistant

After fix:
  [Select Service] ──▶ selectService()  ── (no auto-open) ── selection panel scrolls in
  [Book this service] ──▶ openManualBookingForm() ──▶ inline manual form ──▶ submitManualBooking ──▶ Firestore
  [Chat with AI]    ──▶ openAssistantPanel('general')                 ← AI chat
  [Talk to AI]      ──▶ openVoiceAssistant()                          ← AI voice
```

## Tests

`tests/lib/mobile-barber-manual-booking.js` — 8 pinning tests, all PASS. They are now part of the runner so this can't regress without breaking the gate:

| # | Test |
|---|------|
| M1 | `renderSelectedService` wires three SEPARATE handlers (Book ⊥ Chat ⊥ Voice) |
| M2 | Per-card "Select Service" CTA does NOT auto-open the AI chat |
| M3 | `openManualBookingForm` + `renderManualBookingPanel` + `submitManualBooking` exist |
| M4 | `submitManualBooking` goes direct (`findVendorForAddress` → `checkAvailability` → `buildBooking` → `saveBooking`; NO `AGENT.handleMessage`, NO `openAssistantPanel`) |
| M5 | Manual booking attaches selected AI hairstyle if present (5 canonical fields) |
| M6 | i18n: `manualBooking*` keys present in en, vi, es (≥3 occurrences per key) |
| M7 | CSS ships manual booking panel + expand animation + reduced-motion guard |
| M8 | Hero/CTA chat/voice triggers still open AI assistants (no friendly-fire regression) |

Full system gate: **`FINAL: PASS` — 392 passed, 0 failed**.

## Cache-Bust

All touched files bumped to `?v=20260527r` across `index.html`, `dashboard.html`, `vendor.html`:
- `mobile-barber.css`
- `mobile-barber-data.js` (carry version forward; no change)
- `mobile-barber-booking.js` (carry version forward; no change)
- `mobile-barber-dashboard.js` (carry version forward; no change)
- `mobile-barber.js` (the actual change)

## Manual Smoke Test (Production)

1. Open `https://www.dulichcali21.com/mobile-barber/?lang=en` in iPhone Safari (mobile) and a desktop browser.
2. Scroll to **Services**, tap **Select Service** on any card. The selection panel surfaces with three CTAs. The AI chat **does not** open.
3. Tap **Book this service**. The manual form expands directly under the three CTAs, scrolls into view. The AI chat **does not** open.
4. Fill phone, name, address, city, ZIP, date, time. Pick Cash or Zelle. Tap **Send booking request**.
5. The form is replaced with "Booking sent. The barber will confirm shortly."
6. Open `https://www.dulichcali21.com/mobile-barber/dashboard.html?id=michael-nguyen-oc` (or `tim-nguyen-bay`). The new booking appears in the bookings list.
7. Back on the landing, tap **Chat with AI to book** — only this CTA opens the AI text panel.
8. Tap **Talk to AI to book** — only this CTA opens the AI voice panel.
9. Optional: pick an AI hairstyle in the preview cards first, then go through Book this service. The booking carries the AI hairstyle reference; vendor sees the gold AI hairstyle reference block on the appointment.

## Files Changed

```
mobile-barber/mobile-barber.js          (Book handler rewired, Select decoupled, 4 new helpers, manualBooking state)
mobile-barber/mobile-barber.css         (~210 lines of .mb-manual-booking* styles)
mobile-barber/index.html                (cache bust ?v=20260527r)
mobile-barber/dashboard.html            (cache bust ?v=20260527r)
mobile-barber/vendor.html               (cache bust ?v=20260527r)
tests/lib/mobile-barber-landing.js      (version-string asserts bumped)
tests/lib/mobile-barber-manual-booking.js (NEW — 8 pinning tests)
tests/runner.js                         (wire new test suite)
docs/mobile_barber_manual_booking_fix.md (this report)
```

## Why I Missed This Earlier

The AI inline-from-card flow tests I shipped in commit `7846cf0` exercised the AI preview cards in isolation. They never asserted the selected-service panel's three CTAs were wired to three distinct destinations. The new M1–M8 tests cover exactly that contract so it cannot regress silently again.

## Remaining Risks

- The hero "Book Now" button (`bookNow` in vi/en/es) at `index.html:44` still uses `data-action="chat"` — it labels itself "Book Now" but opens the AI chat. Out of scope for this fix (the user complaint was specifically the per-service Book CTA), but the same naming mismatch exists at the hero level. Recommended follow-up: either relabel the hero CTA to "Chat to book" (matching its behavior) or also wire it to surface the service picker / manual booking flow.
- The Hero "promo" card CTA also uses `data-action="chat"` and opens the AI panel. Same call as the hero Book Now — left unchanged because it sits in the promotion block, not the service-selection flow.
