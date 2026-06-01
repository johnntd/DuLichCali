# Mobile Barber Customer Accounts, PWA, Notifications

Date: 2026-05-31

## Auth approach

- Added `mobile-barber/mobile-barber-customer.js`.
- Customer identity is phone-first. The frontend normalizes the phone number and uses Firebase email/password auth with a phone-derived private login alias: `{normalizedPhone}@mobile-barber.dulichcali21.local`.
- Firebase Auth persistence is set to `LOCAL`, so browser refresh and iOS Home Screen PWA relaunch keep the customer signed in after the first login in that storage context.
- Password requirements are enforced before signup:
  - minimum 12 characters
  - upper/lowercase
  - number
  - symbol
  - common password rejection
  - visible strength meter
- Forgot/reset password calls Firebase `sendPasswordResetEmail`. For phone-alias accounts without a real email address, delivery depends on a customer email being attached or a future support flow.
- Customer profile documents are stored in `mobileBarberCustomers/{uid}` with the requested customer fields and notification/reminder preferences.

## PWA implementation

- Added customer manifest: `mobile-barber/manifest-customer.webmanifest`.
- Added iOS Home Screen meta tags and `apple-touch-icon` to `mobile-barber/index.html`.
- Added customer icon paths:
  - `assets/icons/mobile-barber-customer-180.png`
  - `assets/icons/mobile-barber-customer-192.png`
  - `assets/icons/mobile-barber-customer-512.png`
  - `assets/icons/mobile-barber-customer-maskable-512.png`
- Updated `mobile-barber/sw.js` to cache the customer shell and route customer push clicks to `/mobile-barber?panel=notifications`.

## Notification flow

- Customer notification center:
  - bell icon
  - unread badge
  - notification list
  - mark read
  - click opens customer booking history
- In-app listener reads `customerNotifications` scoped by `customerId == uid`.
- Push enablement is user-initiated through the notification panel. Unsupported push shows the fallback message: keep the app open or check notifications in the app.
- Cloud Functions added:
  - `onMobileBarberCustomerBookingStatus`
  - `sendMobileBarberCustomerPush`
- Booking status changes create customer notification records for confirmed, needs-info/vendor-review, rejected/declined, rescheduled, cancelled, and completed states.

## Reminder design

- Added `customerReminderPreferences`.
- Customer can select 3 weeks, 4 weeks, 6 weeks, or off.
- On completed haircut, the function stores:
  - `reminderPreferenceWeeks`
  - `lastHaircutDate`
  - `nextReminderDate`
  - `preferredBarber`
  - `lastService`
- Scheduled function `checkMobileBarberCustomerReminders` creates a reminder notification when `nextReminderDate <= today`, then advances the next reminder date.

## Security rules

- `mobileBarberCustomers/{uid}` is customer-owned.
- `customerNotifications`, `customerSavedStyles`, and `customerReminderPreferences` are scoped to `customerId == request.auth.uid`.
- Customer push subscriptions live under `mobileBarberCustomers/{uid}/pushSubscriptions`.
- Mobile Barber booking reads remain owner/vendor/admin scoped.
- Customer bookings can carry `customerId`, `normalizedPhone`, and `customerProfileSnapshot`.
- Vendor-only booking status/price/payment restrictions remain intact.

## Tests run

- `scripts/ai/targeted_dry_run.sh booking` -> `FINAL: PASS`
- `node --check mobile-barber/mobile-barber-customer.js`
- `node --check mobile-barber/mobile-barber-booking.js`
- `node --check mobile-barber/mobile-barber-data.js`
- `node --check functions/index.js`
- `node tests/runner.js` -> `564 passed, 0 failed`
- `scripts/ai/full_system_dry_run.sh` -> `FINAL: PASS`

## Files changed

- `mobile-barber/index.html`
- `mobile-barber/dashboard.html`
- `mobile-barber/vendor.html`
- `mobile-barber/mobile-barber.css`
- `mobile-barber/mobile-barber-booking.js`
- `mobile-barber/mobile-barber-data.js`
- `mobile-barber/mobile-barber-customer.js`
- `mobile-barber/sw.js`
- `mobile-barber/manifest-customer.webmanifest`
- `functions/index.js`
- `firestore.rules`
- `assets/icons/mobile-barber-customer-180.png`
- `assets/icons/mobile-barber-customer-192.png`
- `assets/icons/mobile-barber-customer-512.png`
- `assets/icons/mobile-barber-customer-maskable-512.png`
- `tests/lib/mobile-barber-customer.js`
- `tests/lib/mobile-barber-landing.js`
- `tests/runner.js`
- `docs/mobile_barber_customer_accounts_pwa_notifications.md`

## Status

PASS.

Customer account, PWA manifest/iOS support, login-gated AI hairstyle previews, saved styles, customer booking linkage, notification center, push subscription path, status notifications, reminder scheduling, and Firestore scoping are implemented.

## Remaining risks

- Phone/password accounts use a Firebase email/password alias because Firebase Auth does not natively support phone-number-plus-password without a custom auth provider.
- Password reset email delivery for phone-only accounts needs a real email attached or an operator-assisted reset flow.
- Push delivery requires deployed Functions with `VAPID_PRIVATE_KEY` configured and supported iOS/Android/browser push environment.
- Static tests verify wiring and rules; live iOS Home Screen persistence and push behavior still need device QA after deploy.

## Next command

`scripts/ai/full_system_dry_run.sh`
