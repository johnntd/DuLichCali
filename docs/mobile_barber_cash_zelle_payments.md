# Mobile Barber Cash + Zelle Payments

Date: 2026-05-27

## Data model changes

- Added vendor payment settings fields to `VENDOR_FIELDS`: `cashEnabled`, `zelleEnabled`, `zellePhone`, `zelleEmail`, `zelleQrUrl`.
- Seed vendors now default `cashEnabled` and `zelleEnabled` to `true` and mirror their phone/email into Zelle settings.
- Added `payment_requested` to booking payment status validation and normalization, keeping `pending` and `waived` for backwards compatibility.
- New customer-created bookings default to `paymentMethod: 'cash'` unless the customer selects or says Zelle.

## Customer flow

- The mobile barber chat panel now includes a preferred payment method selector with Cash selected by default.
- The AI booking session merges that selector into the booking draft before save.
- The chat agent also recognizes explicit Cash/Zelle language and persists `paymentMethod` as `cash` or `zelle`.
- Existing vendor-page manual booking defaults to Cash and stores vendor `zellePhone` when available.

## Vendor portal changes

- Appointment detail now renders colored payment method and payment status chips.
- Supported status chips:
  - `unpaid`: yellow
  - `payment_requested`: orange
  - `paid`: green
- Zelle bookings show a `Request Zelle Payment` action. It sets `paymentStatus = 'payment_requested'` and expands the Zelle payment panel.
- Existing payment actions still support marking bookings paid or unpaid.
- Settings now includes a `Payments` accordion with:
  - Cash enabled
  - Zelle enabled
  - Zelle phone
  - Zelle email
  - Zelle QR upload

## Zelle info display

- Zelle display priority is QR, then phone, then email.
- QR images use the existing `MobileBarberAIPreview.compressImage()` helper and are stored as vendor document data URLs.
- The same Zelle panel pattern appears in the vendor appointment detail and in the customer chat confirmation transcript after a Zelle booking is saved.
- Screenshots were not captured in this cycle; validation was static/unit/dry-run only.

## Booking status flow

`UNPAID -> PAYMENT REQUESTED -> PAID`

- New bookings start as `unpaid`.
- Vendor `Request Zelle Payment` sets `payment_requested`.
- Vendor `Mark paid` sets `paid`.
- Vendor `Mark unpaid` returns the booking to `unpaid`.

## Test results

- Pre-change targeted dry run: `scripts/ai/targeted_dry_run.sh marketplace` -> `FINAL: PASS`.
- Syntax checks: `node --check` on all mobile-barber modules touched plus voice/AI preview modules -> PASS.
- `node tests/lib/mobile-barber-data-model.js` -> 13 passed, 0 failed.
- `node tests/lib/mobile-barber-booking.js` -> 30 passed, 0 failed.
- `node tests/lib/mobile-barber-agent.js` -> 31 passed, 0 failed.
- `node tests/runner.js` -> 360 passed, 0 failed.
- `scripts/ai/full_system_dry_run.sh` -> `FINAL: PASS`.

## Production deploy confirmation

- Not run. Production deploy requires explicit approval.
- `firebase deploy --only hosting`: not executed.
- Curled production version strings: not executed.

## Remaining risks

- Firestore rules were verified to allow mobile barber booking creation and vendor/member updates, but live Firestore writes were not performed.
- QR upload was implemented through browser APIs and covered by syntax/static checks; it still needs a real browser upload check on mobile and desktop.
- Customer-facing Zelle panel appears after a successful chat save; there is no standalone public booking lookup screen in this cycle.
