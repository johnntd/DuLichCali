# Mobile Barber Profit Pricing + Vendor Dashboard Fix Report

Date: 2026-05-25

## 1. Current Pricing Audit Findings

- Service price is stored on Mobile Barber service records as `price` in `mobile-barber/mobile-barber-data.js`. Vendor dashboard service editing also writes the service price through the dashboard service form.
- Travel fee was stored on vendor configuration as `baseTravelFee` and optional `travelFeeTiers` in `mobile-barber/mobile-barber-data.js`.
- Before this patch, `amountDue` was calculated in `mobile-barber/mobile-barber-booking.js` inside `buildBooking()` from `check.price.totalPrice`, falling back to `servicePrice + travelFee`.
- Booking records already saved `servicePrice`, `travelFee`, `amountDue`, `paymentMethod`, `paymentStatus`, and `zellePhone`, but did not save `totalPrice`, vehicle wear, distance metadata, or pricing explanation fields.
- The vendor dashboard read `amountDue` with fallback behavior, but appointment cards did not clearly expose the full service/travel/total breakdown.
- Manual and AI booking confirmation shared `MobileBarberBooking.checkAvailability()` and `buildBooking()`, but the AI price-only path previously used service price and vendor base travel fee directly. It now uses the shared pricing engine.

## 2. Profitability Risks Found

- Service-only pricing could underprice mobile visits when customer distance, driving time, gas, and vehicle wear are material.
- The previous calculation did not estimate vehicle wear cost, effective job time, or hourly gross against a vendor target.
- The previous quote did not flag long-distance addresses for vendor review.
- Older bookings may lack new pricing fields, so dashboard rendering needed safe normalization.

## 3. Pricing Engine Details

Implemented shared `MobileBarberBooking.calculateMobileBarberPrice()` in `mobile-barber/mobile-barber-booking.js`.

The helper accepts the requested object signature:

```js
calculateMobileBarberPrice({
  vendor,
  service,
  customerAddress,
  distanceMiles,
  travelMinutes,
  requestedDateTime
})
```

It returns `baseServicePrice`, `travelFee`, `vehicleWearCost`, `distanceAdjustment`, `peakAdjustment`, `totalPrice`, `estimatedDistanceMiles`, `estimatedTravelMinutes`, `pricingExplanation`, and `quoteType`.

Defaults are:

```js
{
  wearRatePerMile: 0.67,
  freeTravelMiles: 5,
  customQuoteMiles: 20,
  minimumMobileVisitPrice: 50,
  minimumHourlyTarget: 35
}
```

Distance tier fallback:

- 0-5 miles: $0
- 5-10 miles: $8
- 10-15 miles: $15
- 15-20 miles: $25
- 20+ miles: `vendor_review`

Vendor configuration can override pricing defaults. Existing `baseTravelFee` is preserved as a minimum travel fee so current vendor configurations keep working.

The profitability guard estimates effective job time from service duration, cleanup buffer, and travel minutes. It estimates gross hourly after vehicle wear, adds a bounded convenience adjustment when needed, and flags vendor review when the adjustment would be too large or the address exceeds normal distance.

## 4. Distance / Travel Assumptions

No real map distance or geocoding API is available in this patch. The engine uses supplied `roundTripMiles`, `distanceMiles`, or `oneWayMiles * 2` when provided. If no distance is available, it falls back to configured vendor travel fees and documents that limitation in `pricingExplanation`.

For manual bookings today, the address entry triggers a safe quote preview using configured/fallback travel behavior. If exact distance is later added, the same pricing helper can consume it without changing booking record shape.

## 5. Files Changed

- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/mobile-barber-booking.js`
- `mobile-barber/mobile-barber-data.js`
- `mobile-barber/mobile-barber-agent.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber-dashboard.js`
- `mobile-barber/mobile-barber.css`
- `tests/lib/mobile-barber-booking.js`
- `tests/lib/mobile-barber-agent.js`
- `tests/lib/mobile-barber-landing.js`
- `docs/mobile_barber_profit_pricing_vendor_dashboard_fix_report.md`

## 6. Booking Fields Added

New booking fields saved by manual and AI booking:

- `vehicleWearCost`
- `distanceAdjustment`
- `peakAdjustment`
- `totalPrice`
- `estimatedDistanceMiles`
- `estimatedTravelMinutes`
- `pricingExplanation`
- `quoteType`

Existing payment fields are preserved:

- `servicePrice`
- `travelFee`
- `amountDue`
- `paymentMethod`
- `paymentStatus`
- `zellePhone`

Default normalization for older records sets missing travel/wear/adjustment fields to `0`, `amountDue` and `totalPrice` to service price when needed, `paymentStatus` to `unpaid`, and `zellePhone` to the vendor phone.

## 7. Vendor Dashboard Improvements

- Dashboard now defaults to upcoming appointments only.
- Upcoming means appointment start time is at or after now and status is not `cancelled` or `completed`.
- Added filters: Upcoming, All, Completed, Cancelled.
- Appointment cards now show customer, service, duration, date, 12-hour time, status, address, map link where available, service price, travel fee, vehicle/travel cost, total amount due, payment method/status, Zelle phone, notes, and AI summary where present.
- Added vendor identity card sourced from loaded vendor data, including business name, barber name, service region, and Zelle phone.
- Added shared 12-hour time formatting and applied it in booking confirmation, customer review/history surfaces, AI summary, vendor notification rows, and dashboard appointment cards.

## 8. Tests Run

- `bash scripts/ai/targeted_dry_run.sh booking` — `FINAL: PASS`
- `node tests/lib/mobile-barber-booking.js` — `30 passed, 0 failed`
- `node tests/lib/mobile-barber-agent.js` — `29 passed, 0 failed`
- `node tests/lib/mobile-barber-landing.js` — exited successfully
- `node tests/runner.js` — `ALL TESTS PASSED: 356 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh` — `FINAL: PASS`
- `bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_profit_pricing_vendor_dashboard_fix.md --max-loops 3 --allow-dirty --timeout 2400` — `FINAL: FAIL`, blocked because `codex exec` could not access `/Users/johntd/.codex/sessions` due filesystem permission denial in this sandbox.

## 9. PASS / BLOCKED

Implementation validation: PASS.

The full system dry run ended `FINAL: PASS`, and the PASS criteria are implemented:

- Travel fee is included in booking quote.
- `amountDue` and `totalPrice` are saved to booking.
- Vendor dashboard shows service type, travel fee, total amount due, and payment details.
- Dashboard defaults to upcoming appointments only.
- Appointment time display uses 12-hour AM/PM formatting.
- AI and manual booking use the same pricing helper.
- Old bookings are normalized so missing pricing fields do not crash dashboard rendering.

Required `ai_dev_loop` command: BLOCKED by local Codex session directory permissions, not by product test failure.

