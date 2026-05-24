# Mobile Barber Phase 10 — Customer Account, Booking History, and Rebooking

Date: 2026-05-24

## Summary

Phase 10 adds customer-friendly booking history, saved cut preferences, and rebooking for the Mobile Barber vendor page.

Implemented:
- Customer account panel on the single-vendor Mobile Barber page.
- Upcoming and past haircut booking history grouped by vendor and customer identity.
- Rebook flow that copies prior service/customer context but clears date and time so the request must pass the Phase 4 validation chain again.
- Saved style preference, customer notes, and optional style photo filenames.
- Vendor dashboard cut-history context with previous service, rebook source, notes, preferences, and reference photo fields.
- Firestore rules proposal in `firestore.rules` for private Mobile Barber bookings and customer profiles.
- Static and mirrored-unit tests for history filtering, past/upcoming grouping, rebooking, private-address exposure, and Firestore private-read rules.

## Files Changed

- `mobile-barber/vendor.html`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber-booking.js`
- `mobile-barber/mobile-barber-data.js`
- `mobile-barber/mobile-barber-dashboard.js`
- `mobile-barber/mobile-barber.css`
- `firestore.rules`
- `tests/lib/mobile-barber-booking.js`
- `tests/lib/mobile-barber-data-model.js`
- `tests/lib/mobile-barber-landing.js`
- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `docs/mobile_barber_phase10_customer_history_report.md`

## Commands Run

```bash
scripts/ai/targeted_dry_run.sh marketplace
scripts/ai/full_system_dry_run.sh
```

## Dry Run Result

`scripts/ai/targeted_dry_run.sh marketplace` ended:

```text
FINAL: PASS
```

`scripts/ai/full_system_dry_run.sh` ended:

```text
FINAL: PASS
```

## Privacy and Security

- Public Mobile Barber pages do not expose `customerAddress` or vendor dashboard cut-history internals.
- Customer booking history is filtered by `vendorId` and phone/account identity.
- Rebooking keeps previous notes/preferences private in the booking flow and does not publish them to catalog pages.
- Proposed local Firestore rules keep `mobileBarberBookings` reads limited to the signed-in booking owner or the involved vendor.
- Proposed local Firestore rules keep `mobileBarberCustomers` reads/updates limited to the customer owner or involved vendor.
- Anonymous unauthenticated reads of private booking/customer documents are denied by rule structure because private reads require either `request.auth.uid` ownership or `isVendorMember(resource.data.vendorId)`.
- No deployment was run.

## Remaining Risks

- Firestore security rules are only proposed locally; they still need emulator or staged project validation before deployment approval.
- Phone-only customer history can work from local fallback data, but durable Firestore history should use authenticated account ownership to avoid unsafe phone-number enumeration.
- Real browser testing is still needed for customer-account file input, rebook modal focus, and multilingual text wrapping on small devices.
- Uploaded style photos are represented as filenames in the current static flow; production upload/storage handling remains a later integration concern.

## Next Command

```bash
scripts/ai/targeted_dry_run.sh marketplace
```
