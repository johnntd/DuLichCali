# Mobile Barber Booking Database Fix Report

## 1. Files changed

- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/mobile-barber-data.js`
- `mobile-barber/mobile-barber-booking.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber-dashboard.js`
- `firestore.indexes.json`
- `tests/lib/mobile-barber-landing.js`
- `tests/lib/mobile-barber-data-model.js`
- `tests/lib/mobile-barber-booking.js`
- `docs/mobile_barber_booking_database_fix_report.md`

## 2. Confirmed root cause and fix

Confirmed root cause: the Mobile Barber HTML pages did not load Firebase compat SDKs or initialize Firebase before Mobile Barber runtime scripts. `MobileBarberBooking.saveBooking()` therefore always treated Firestore as unavailable and wrote to `localStorage`.

Changes made:

- Added Firebase v9.22.0 compat app and Firestore scripts to `mobile-barber/index.html`, `mobile-barber/vendor.html`, and `mobile-barber/dashboard.html`.
- Added inline Firebase initialization before Mobile Barber local scripts on all three pages.
- Updated `saveBooking()` to return `source: 'firestore'` on Firestore success and `source: 'local'` on local fallback.
- Preserved and strengthened local fallback: if Firestore is unavailable or the Firestore write rejects, the booking is queued in `dlc_mobile_barber_bookings`.
- Updated customer-facing summary behavior so local fallback is shown as queued on this device, not as a fully online submission.
- Updated dashboard booking loading to read `mobileBarberBookings` from Firestore first, with localStorage fallback.

## 3. Firebase config reused

The config object was copied from the existing inline pattern in `vendor-signup.html`. Actual config values are intentionally omitted from this report.

## 4. Booking save source matrix

| Condition | Save target | Return shape | Customer copy | Notifications |
|---|---|---|---|---|
| Firebase initialized and Firestore `.set()` resolves | `mobileBarberBookings/{booking.id}` | `{ saved: true, source: 'firestore', method: 'firestore', booking }` | Existing sent/saved copy | Queued |
| Firebase missing, uninitialized, or Firestore `.set()` rejects | `localStorage` key `dlc_mobile_barber_bookings` | `{ saved: true, source: 'local', method: 'local', booking }` | New queued-on-device i18n copy | Not queued |

## 5. Seed pass behavior

- Added `MobileBarberData.seedFirestoreFromSamples(db)`.
- The helper writes sample vendors, services, and availability into:
  - `mobileBarberVendors/{id}`
  - `mobileBarberServices/{id}`
  - `mobileBarberAvailability/{id}`
- Every write uses `{ merge: true }`.
- Frozen sample objects are converted into plain JSON objects before writing.
- `geminiKey` and `openaiKey` are explicitly stripped from seed payloads.
- Dashboard init calls the seed helper once per page session after Firebase is available and before reading bookings.
- Session flag: `sessionStorage.dlc_mb_seeded = '1'`.

## 6. Firestore indexes

Added composite indexes:

- `mobileBarberBookings`: `vendorId ASC`, `customerPhone ASC`
- `mobileBarberBookings`: `vendorId ASC`, `customerUid ASC`

## 7. Dry runs and tests

- `bash scripts/ai/targeted_dry_run.sh booking`
  - Result: `FINAL: PASS`
- `node tests/lib/mobile-barber-booking.js`
  - Result: `21 passed, 0 failed`
- `node tests/lib/mobile-barber-data-model.js`
  - Result: `12 passed, 0 failed`
- `node tests/runner.js`
  - Result: `319 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh`
  - Result: `FINAL: PASS`
  - Test count: `319`

## 8. Playwright booking-write smoke test

BLOCKED.

Reasons:

- `require('playwright')` fails in this workspace; Playwright is not installed.
- Starting the required local HTTP server is blocked by the sandbox. Both `python3 -m http.server 8080` and `python3 -m http.server 18080 --bind 127.0.0.1` failed with `PermissionError: [Errno 1] Operation not permitted`.
- No production Firestore write was attempted.

Static/runtime-equivalent coverage added instead:

- HTML tests assert all three Mobile Barber pages load Firebase app compat and Firestore compat.
- HTML tests assert all three pages call `firebase.initializeApp(`.
- HTML tests assert Firebase loading and initialization appear before the first `/mobile-barber/mobile-barber-*.js` runtime script.
- Unit tests assert `saveBooking()` returns Firestore and local source markers with stubbed Firebase/localStorage paths.

## 9. Production manual smoke test

BLOCKED.

No production deploy was requested or approved, and this patch must not write test bookings to production Firestore from validation. The production manual smoke remains the next post-deploy verification step.

## 10. Risks

- The browser booking modal flow could not be exercised with Playwright in this sandbox.
- The production Firestore write path is verified by static load-order tests and stubbed unit tests, but not by a live Firestore write.
- Dashboard seed writes are intentionally idempotent and merge-only, but they still write sample vendor/service/availability documents when the dashboard is opened with Firebase available.

## 11. Status

BLOCKED
