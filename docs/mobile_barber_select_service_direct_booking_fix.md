# Mobile Barber — Select Service → Direct Booking Fix

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Date:** 2026-05-28

## Bug

Tapping **Select Service** on a service card surfaced a separate selection panel with **three competing CTAs** (Book this service / Chat with AI to book / Talk to AI to book). The customer had to make a second choice before any booking form appeared — unnecessary friction since they had just chosen a service.

## Root Cause

`renderServices()` per-card "Select Service" click handler ran:

```javascript
cta.addEventListener('click', function() {
  selectService(service);
  var sel = document.getElementById('mbServiceSelection');
  if (sel && sel.scrollIntoView) {
    sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
```

`selectService` → `renderSelectedService(service)` → built a panel with the three CTAs and a hidden `#mbManualBookingMount` div. The form only mounted after the customer clicked "Book this service" — a second tap to do something they had already implied.

## Fix

### 1. Select Service opens the form immediately

```javascript
cta.addEventListener('click', function() {
  selectService(service);
  openManualBookingForm(service);   // ← form mounts on the SAME tap
});
```

### 2. `renderSelectedService` simplified to a summary chip

The Book/Chat/Talk three-button row is gone. The selected-service panel now renders just the service name + price summary, with the manual form mount immediately underneath.

```javascript
function renderSelectedService(service) {
  // Just a summary line + the form mount underneath.
  var text  = el('div', 'mb-service-selection__text');
  var label = el('span'); label.textContent = t('selectedServiceLabel');
  var title = el('strong');
  title.textContent = serviceCopy(service, 'name') + ' · ' + formatServicePrice(service.price);
  text.appendChild(label);
  text.appendChild(title);
  panel.appendChild(text);

  var manualMount = el('div', 'mb-manual-booking-mount');
  manualMount.id = 'mbManualBookingMount';
  manualMount.hidden = true;          // openManualBookingForm flips this on
  panel.appendChild(manualMount);
}
```

### 3. AI options kept as a secondary "Need help?" footer inside the form

So Chat/Talk AI still exist — just demoted from required-choice to optional escape hatch.

```html
─────────────────────────────────────────────────
Need help?  [Chat with AI to book]  [Talk to AI to book]
─────────────────────────────────────────────────
```

Rendered by `renderManualBookingPanel`:

```javascript
var help = el('div', 'mb-manual-booking__help');
help.appendChild(helpLabel /* Need help? */);
help.appendChild(chatBtn   /* → openAssistantPanel('general') */);
help.appendChild(voiceBtn  /* → openVoiceAssistant()          */);
panel.appendChild(help);
```

Dashed top border, muted label, small ghost buttons — quiet visual weight so the form's submit button stays the primary action.

### 4. Customer-visible flow

| Step | Before | After |
|------|--------|-------|
| Tap a service card | Surfaces selection panel with summary + 3 CTAs | Surfaces summary + manual form |
| Tap "Book this service" | Manual form expands | (skipped — already showing) |
| Fill name/phone/address/date/time | yes | yes |
| Submit | yes | yes |

Friction reduced from **2 taps + 1 decision** to **1 tap**, no decision.

## i18n

Added `manualBookingHelpLabel` to vi / en / es:
- en: `Need help?`
- vi: `Cần trợ giúp?`
- es: `¿Necesita ayuda?`

Existing `chatThisService` / `talkThisService` keys are reused for the secondary buttons (same labels, different visual treatment).

## Files Changed

```
mobile-barber/mobile-barber.js                                   (per-card Select handler opens form;
                                                                  renderSelectedService simplified;
                                                                  manual form gets Need-help footer;
                                                                  new manualBookingHelpLabel i18n)
mobile-barber/mobile-barber.css                                  (.mb-manual-booking__help styles)
mobile-barber/index.html / dashboard.html / vendor.html          (cache bust ?v=20260528n)
tests/lib/mobile-barber-manual-booking.js                        (M1 inverted to assert NO 3-button row,
                                                                  M2 asserts openManualBookingForm called,
                                                                  M2b new — Need-help footer present)
tests/lib/mobile-barber-landing.js                               (voiceSelectedService data-action assert removed
                                                                  with a comment explaining the relocation)
docs/mobile_barber_select_service_direct_booking_fix.md          (this report)
```

## Tests

Full system gate: **`FINAL: PASS` — 440 passed, 0 failed**.

Updated manual-booking suite (`tests/lib/mobile-barber-manual-booking.js`):

| # | Test |
|---|------|
| M1 | `renderSelectedService` renders summary only — no `bookThisService` / `chatThisService` / `talkThisService` 3-button row. `manualMount` still created. |
| M2 | Per-card "Select Service" handler calls `openManualBookingForm(service)` directly. No `openAssistantPanel` / `promptForLocation` redirects. |
| M2b | Manual booking form has the `.mb-manual-booking__help` footer with `openAssistantPanel` and `openVoiceAssistant` wired, `manualBookingHelpLabel` i18n key present in all 3 languages. |

The previous M3–M8 tests (submit pipeline, AI hairstyle attachment, no-blank-state, hero/voice CTA wiring) are unchanged and still pass.

## Cache-Bust

`?v=20260528m → ?v=20260528n` across mobile-barber HTML files + landing test.

## Constraints Honored

- Manual booking submit path: untouched (`findVendorForAddress → checkAvailability → buildBooking → saveBooking`).
- AI booking + voice booking: still fully functional via the Need-help footer + hero CTAs + persistent promo ribbon.
- Service pricing + promo pricing: unchanged.
- Selected AI hairstyle booking: still attaches when submitting the manual form (`state.aiPreview.selectedStyleId` is read in `submitManualBooking`).
- Mobile layout: form already responsive; the Need-help footer wraps to one button per row on narrow screens.
- Vendor routing: form still uses `findVendorForAddress` from the customer's typed address.

## Manual Smoke Test

1. Hard-refresh `https://www.dulichcali21.com/mobile-barber/`.
2. Scroll to **Services**, tap **Select Service** on any service card.
3. The selection panel appears with just the service name + price; the manual booking form is **already expanded** beneath it. No intermediate "Book this service / Chat / Talk" three-button row.
4. The first form field (phone) is focused; on mobile the page smooth-scrolls so the form is in the thumb zone.
5. Scroll to the bottom of the form. Under the Submit + Cancel buttons there's a `Need help?` row with two small ghost buttons: **Chat with AI to book** and **Talk to AI to book**.
6. Tap **Chat with AI to book** → AI chat panel opens. Tap **Talk to AI to book** → voice assistant opens.
7. Fill phone / name / address / city / ZIP / date / time / payment → tap **Send booking request** → booking saves to Firestore + shows success state.
8. Switch services mid-form: tap **Select Service** on a different card → form re-mounts with the new service summary at the top.

## PASS / BLOCKED

**PASS** — tapping **Select Service** immediately opens the appointment booking form for that service. AI options remain accessible as secondary "Need help?" links inside the form footer. No regressions in booking pipeline, vendor routing, promo pricing, AI hairstyle attachment, mobile layout, or any of the other flows.

## Remaining Risks

- The `selectedServiceLabel` text ("Selected service") + service-name title appears above the form, but on very narrow viewports the form's own header ("Book this service") repeats the gesture. If that feels redundant after live testing, the selection-panel summary could collapse into the form's header instead of being a separate strip.
- The Need-help footer uses ghost buttons. If usage shows customers want the AI booking quickly, consider promoting the chat button to a soft-primary or adding a quick-chat icon in the form header.
