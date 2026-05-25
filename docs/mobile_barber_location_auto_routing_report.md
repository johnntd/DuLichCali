# Mobile Barber Location Auto-Routing Report

## Files changed

- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `mobile-barber/dashboard.html` - version-string-only bump for modified `mobile-barber-booking.js`
- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber-booking.js`
- `firestore.rules`
- `tests/lib/mobile-barber-landing.js`
- `tests/lib/mobile-barber-booking.js`
- `docs/mobile_barber_location_auto_routing_report.md`

## Address gate placement

The landing page now has an above-the-fold address gate inside the hero body:

- City input: `#mbLocationCity`
- ZIP input: `#mbLocationZip`
- Submit button: `Find My Barber`
- Change-location control: `data-action="changeLocation"`
- Waitlist fallback: `#mbWaitlistForm`

Service card selection routes through this same gate when no valid saved location exists.

## localStorage schema and expiry

Key: `mb_customer_location`

```json
{ "city": "San Jose", "zip": "95121", "savedAt": 1730000000000 }
```

Expiry: 30 days (`30 * 24 * 60 * 60 * 1000` ms). Expired values are removed. The landing gate and vendor manual booking Step 2 both read this value. The landing "Change location" control clears it.

## Routing decision flow

1. Customer submits city/ZIP on `/mobile-barber/`.
2. `mobile-barber.js` calls `BOOKING.findVendorForAddress({ city, zip }, { vendors: DATA.sampleVendors })`.
3. Covered city:
   - Saves `mb_customer_location`.
   - Redirects to `/mobile-barber/vendor/{matchedId}?city=...&zip=...&from=landing`.
   - Carries `serviceId` when the flow started from a service card or `?serviceId=...`.
4. Uncovered city:
   - Does not navigate.
   - Shows waitlist email capture.

Routing proof:

- `San Jose => tim-nguyen-bay`
- `Westminster => michael-nguyen-oc`
- `Boston => null`

## Vendor auto-switch timing

On vendor manual booking Step 2, `checkAddressVendorMatch()` still renders the amber switch banner. If another vendor serves the entered city, it now starts a 2-second timer:

- Visible countdown copy is shown.
- `persistDraftForSwitch()` runs before redirect.
- Redirect target includes `?carryDraft=1`.
- Any modal input, generic modal click, or `Stay` button cancels the timer.
- Manual `Switch to {vendor}` remains as fallback.

## Waitlist Firestore schema and rule

Collection: `mobileBarberWaitlist`

```js
{
  email,
  city,
  zip,
  createdAt,
  source: 'landing_no_match'
}
```

Rule added:

- `allow create` when `email` and `city` are non-empty strings.
- `allow read, update, delete: if false`.

## Tests run

- `bash scripts/ai/targeted_dry_run.sh booking` - `FINAL: PASS`
- `bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_location_auto_routing.md --max-loops 3 --allow-dirty --timeout 1800` - blocked by nested Codex session permission before implementation
- `node --check mobile-barber/mobile-barber.js` - pass
- `node --check mobile-barber/mobile-barber-vendor.js` - pass
- `node --check mobile-barber/mobile-barber-booking.js` - pass
- `node tests/runner.js` - `352 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh` - `FINAL: PASS`

## vi/en/es coverage proof

Landing address gate strings exist in `en`, `vi`, and `es`:

- `locationGateTitle`
- `findMyBarber`
- `changeLocation`
- `noServiceArea`
- `waitlistSaved`

Vendor auto-switch strings exist in `en`, `vi`, and `es`:

- `vendorSwitchCountdown`
- `vendorSwitchStay`

## Result

PASS

Remaining risk: waitlist writes were validated statically and through rules/tests only. No production Firestore write was performed.
