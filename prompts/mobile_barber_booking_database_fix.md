# Critical Patch Prompt — Mobile Barber Booking Database Audit + Fix

## Problem
Mobile Barber pages render correctly, but customer bookings never reach Firestore. The vendor dashboard sees zero bookings, no confirmation emails are sent, and cross-device booking visibility is broken.

A pre-implementation audit (read-only) identified the root cause:

**The Firebase SDK is never loaded or initialized on any mobile-barber page.** `mobile-barber/index.html`, `mobile-barber/vendor.html`, and `mobile-barber/dashboard.html` have zero `firebase` / `firestore` / `initializeApp` references. Every other page in the project (e.g. `vendor-signup.html`, `vendor-detail.html`, `driver-login.html`, `tracking.html`, `index.html` root) loads the v9.22.0 compat SDK and calls `firebase.initializeApp(cfg)`.

Because `firebase` is undefined on these pages:
- `mobile-barber-booking.js:452` `canUseFirestore()` always returns `false`.
- `BOOKING.saveBooking()` at line 565 silently falls back to `localStorage` (`dlc_mobile_barber_bookings`).
- Customers see "booking saved" but the write never reaches the `mobileBarberBookings` collection.
- The vendor dashboard reads Firestore → empty list.
- `onEmailQueue` Cloud Function never receives a notification doc → no confirmation email.

A secondary issue: vendor, service, and availability data exist only as in-file constants in `mobile-barber-data.js` (`sampleVendors`, `sampleServices`, `sampleAvailability`). No Firestore docs have ever been written for these. The booking-create Firestore rule does **not** require the referenced vendor/service docs to exist, so this is not the immediate booking blocker — but the dashboard, vendor reads, and ride-along admin paths cannot find the vendors. A one-time seed from the constants into Firestore (idempotent merge writes) is required for the dashboard to work and for the booking model to be queryable.

The booking-create Firestore rule already permits guest writes:

```
match /mobileBarberBookings/{bookingId} {
  allow create: if isValidMobileBarberBookingCreate();   // no auth required
  ...
}
```

Required-fields gate: `vendorId, customerName, customerPhone, serviceId, serviceName, address, city, zip, requestedDate, startTime, endTime, status, source` — status must be `pending_confirmation` or `vendor_review`, source must be `customer_form | ai_chat | ai_voice`. The `buildBooking()` path already populates every one of these fields. So once Firebase is loaded, manual + AI bookings should write successfully.

---

## Objective
Make Mobile Barber booking work end-to-end for the two real vendors:
- Michael Nguyen — `michael-nguyen-oc` (Orange County)
- Tim Nguyen — `tim-nguyen-bay` (Bay Area)

Booking must succeed and persist to Firestore from:
- `/mobile-barber/vendor/michael-nguyen-oc` (manual booking modal)
- `/mobile-barber/vendor/tim-nguyen-bay` (manual booking modal)
- AI chat booking (if the agent eventually calls `saveBooking` — keep wiring untouched)
- AI voice booking (same as chat)
- Existing localStorage fallback must remain as a graceful last resort.

The vendor dashboard must read those bookings from Firestore at `/mobile-barber/dashboard?vendorId=michael-nguyen-oc` and `?vendorId=tim-nguyen-bay`.

---

## Allowed files
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-seed.js  (new file, optional; only if a shared seed helper is needed)
- firestore.indexes.json
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-data-model.js
- tests/lib/mobile-barber-booking.js
- docs/mobile_barber_booking_database_fix_report.md

Do **not** touch any file outside this list. In particular, do not modify:
- `firestore.rules` (rules already permit guest bookings — adding tighter rules is out of scope and risks breaking the path we are trying to fix)
- `functions/` (Cloud Functions already handle `onEmailQueue` for the new bookingType)
- `nailsalon/`, `hairsalon/`, `marketplace/`, `script.js`, `style.css`, `ai-engine.js`, `chat.js`, `workflowEngine.js`
- Any auth, driver, ride, food, or travel surface.

---

## Strict Rules
1. Additive, minimal patch. No UI polish.
2. Preserve the existing `localStorage` fallback path in `mobile-barber-booking.js`. If Firebase initialization fails or the device is offline, booking must still queue locally and surface a clear status to the customer.
3. Do not change Firestore rules. The existing rule already permits guest booking creates.
4. Do not change the booking write target — the collection name stays `mobileBarberBookings` as defined in `DATA.COLLECTIONS.bookings`.
5. Do not introduce any new external dependencies. Reuse Firebase v9.22.0 compat SDK already used everywhere else in the project (`firebase-app-compat.js`, `firebase-firestore-compat.js`).
6. Use the **same Firebase config object** the rest of the site uses. Reuse the existing inline `firebaseConfig` snippet pattern from `vendor-signup.html` / `driver-login.html` / `tracking.html` — do not invent a new one and do not read keys from environment.
7. Do not seed real vendor docs that overwrite live Firestore data. Use `set(doc, { merge: true })` for the seed so any existing field on a Firestore doc is preserved.
8. Mobile-first preserved. No CSS/layout regressions.
9. No hardcoded user-facing strings in any language. Add new i18n keys in en + vi + es together if needed.
10. JS version strings must be bumped in lockstep across all HTML consumers. Current floor is `?v=20260524g`; use `?v=20260524h` or higher.

---

## Required Changes

### 1. Load and initialize the Firebase SDK on all three mobile-barber pages
In `mobile-barber/index.html`, `mobile-barber/vendor.html`, and `mobile-barber/dashboard.html`:

- Add **above** the existing mobile-barber script tags:
  ```html
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  ```
- Add an inline init block matching the pattern in `vendor-signup.html`:
  ```html
  <script>
    var firebaseConfig = { /* same fields the rest of the site uses */ };
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
  </script>
  ```
- Reuse the exact config object already present in the project (locate it by searching for `apiKey` / `projectId: 'dulichcali-booking-calendar'` in the existing HTML files). Do **not** retype or guess — copy the object verbatim.
- The init block must run **before** any mobile-barber script that calls `firebase.firestore()`.

### 2. Idempotent Firestore seed for vendors / services / availability
The customer pages already render from `DATA.sampleVendors` / `DATA.sampleServices` / `DATA.sampleAvailability`. The dashboard, however, expects Firestore docs to exist for the vendor whose `?vendorId=` is passed.

Add a small, idempotent seed pass that runs once on dashboard mount (and optionally once on a vendor page mount, gated by a flag so customers don’t re-trigger writes on every page view).

- New helper in `mobile-barber/mobile-barber-data.js` (or a new `mobile-barber-seed.js` if cleaner) — keep ES5-compatible:
  ```js
  function seedFirestoreFromSamples(db) {
    // Writes each sampleVendors[i] to mobileBarberVendors/{id} with { merge: true }
    // Writes each sampleServices[i] to mobileBarberServices/{id} with { merge: true }
    // Writes each sampleAvailability[i] to mobileBarberAvailability/{id} with { merge: true }
    // Returns a Promise that resolves when all writes are done.
    // Strip Object.freeze before write (Firestore requires plain objects).
  }
  ```
- In `mobile-barber/mobile-barber-dashboard.js`, on init, after Firebase is confirmed available, call `seedFirestoreFromSamples(db).catch(noop)` exactly once per page load, before reading bookings. Skip the seed if a session-local flag (e.g. `sessionStorage.setItem('dlc_mb_seeded', '1')`) is already set.
- Optionally do the same on `mobile-barber/mobile-barber-vendor.js` init so the first real customer visit warms the data. Same session flag guards repeats.
- **Do not** include any `geminiKey` / `openaiKey` field in the seed payload. Those fields are admin-controlled and must not be overwritten or seeded as empty.

### 3. Verify and surface booking write success
In `mobile-barber/mobile-barber-booking.js`:

- `saveBooking(booking)` currently calls `.set(booking)` and returns a Promise. Confirm the existing return shape is `{ saved: true, source: 'firestore' | 'local' }` (or similar — inspect the file). If the function does not currently distinguish source, extend it to return `{ saved: true, source: 'firestore' }` on Firestore success and `{ saved: true, source: 'local' }` on localStorage fallback.
- `mobile-barber/mobile-barber-vendor.js` already calls `BOOKING.saveBooking(built.booking).then(function(result){...})`. Inspect that handler and ensure it surfaces an honest status to the customer:
  - On Firestore success: existing success copy is fine.
  - On localStorage fallback: surface a friendly i18n message (new key in en + vi + es) such as “Your request was queued on this device while we reconnect. The barber will see it once you’re online.” Do not pretend the booking is fully confirmed.
- No change to the booking schema. No change to status values. No change to source values.

### 4. Firestore composite index for customer history queries
`mobile-barber-booking.js` runs `where('vendorId', '==', X).where('customerPhone', '==', Y)` and `where('vendorId', '==', X).where('customerUid', '==', Y)`. Both are composite queries that require declared indexes.

In `firestore.indexes.json`, add the two composite indexes if not already present:
- `mobileBarberBookings`: `vendorId ASC, customerPhone ASC`
- `mobileBarberBookings`: `vendorId ASC, customerUid ASC`

If the file already contains them, do nothing and note this in the report.

### 5. Cache-bust
Bump every JS file you actually touch from `?v=20260524g` to `?v=20260524h` (or the next free letter on today’s date) across `index.html`, `vendor.html`, `dashboard.html`. Do not bump `firebase-app-compat.js` / `firebase-firestore-compat.js` (they are external CDN URLs). Update version assertions in `tests/lib/mobile-barber-landing.js` accordingly.

---

## Tests to add

### `tests/lib/mobile-barber-landing.js`
- Assert all three HTML files (`index.html`, `vendor.html`, `dashboard.html`) load `firebase-app-compat.js` and `firebase-firestore-compat.js`.
- Assert all three contain `firebase.initializeApp(`.
- Assert the load order: Firebase compat scripts must appear **before** the first `/mobile-barber/mobile-barber-*.js` script in the page.
- Updated cache-bust assertions for the bumped files.

### `tests/lib/mobile-barber-data-model.js`
- New test: `seedFirestoreFromSamples` (or whatever the new exported helper is named) exists and is a function.
- New test: when passed a stub `db` with a chainable `collection().doc().set(doc, { merge: true })` mock, the helper writes one record per sample vendor, per sample service, and per sample availability row, with merge enabled.

### `tests/lib/mobile-barber-booking.js`
- New test: `saveBooking` resolves with `{ saved: true, source: 'firestore' }` when the stub Firebase write resolves.
- New test: `saveBooking` resolves with `{ saved: true, source: 'local' }` when `canUseFirestore()` returns false.
- All existing booking tests must keep passing.

---

## Verification

After implementation:

1. `bash scripts/ai/full_system_dry_run.sh` — must end `FINAL: PASS`. Test count should be ≥314 (we are adding tests, not removing).
2. `node tests/lib/mobile-barber-booking.js` — 0 failed.
3. `node tests/lib/mobile-barber-data-model.js` — 0 failed.
4. `python3 -m http.server 8080` from the repo root, then in a headless browser (Playwright):
   - Load `http://localhost:8080/mobile-barber/vendor.html?id=michael-nguyen-oc&lang=en`.
   - Confirm `typeof firebase` is `'object'`, `firebase.apps.length > 0`, and `typeof firebase.firestore` is `'function'`.
   - Open the manual booking modal, fill the three steps with synthetic data, submit. Confirm no `console.error`. Confirm the resolved status from `saveBooking` is `{ source: 'firestore' }` (read via a probe injected by the Playwright script).
   - The actual document write to production Firestore should **not** be triggered from the test — instead, stub `firebase.firestore` with a mock that records calls and assert the call signature.
5. Manual smoke after deploy (record in the report): open `/mobile-barber/vendor/michael-nguyen-oc` on production, complete the booking form with throwaway data, then check Firebase Console → Firestore → `mobileBarberBookings` for the new doc. Delete the synthetic doc after verification.

---

## Required Output Report
Create `docs/mobile_barber_booking_database_fix_report.md` with:

1. Files changed (full list)
2. Confirmed root cause and how each change addresses it
3. Firebase config object reused (which existing file it was copied from — do **not** include the actual config values in the report)
4. Booking save source matrix: Firestore vs localStorage fallback behavior
5. Seed pass behavior: idempotency, session flag, what was written
6. New Firestore indexes added (or noted as already present)
7. All dry runs run + their final status
8. Playwright booking-write smoke test result
9. Production manual smoke test result (or BLOCKED if you cannot run it)
10. Risks
11. PASS / BLOCKED

---

## PASS Criteria
- Firebase SDK loads and initializes on all three mobile-barber pages.
- `mobile-barber-booking.js saveBooking()` writes to Firestore when `firebase.firestore()` is available, returns `{ saved: true, source: 'firestore' }`, and falls back to localStorage with `{ saved: true, source: 'local' }` when not.
- Seed pass populates `mobileBarberVendors/{id}`, `mobileBarberServices/{id}`, `mobileBarberAvailability/{id}` for the demo + Michael + Tim records, idempotently.
- Composite indexes for `mobileBarberBookings (vendorId, customerPhone)` and `(vendorId, customerUid)` are declared in `firestore.indexes.json`.
- All listed allowed files (or a subset) are the only files modified.
- All dry runs end `FINAL: PASS`; test count ≥ 314; new tests for save-source and seed are present and passing.
- The fix report exists and ends with PASS.

If any of the above is not achievable safely, stop, write the report with BLOCKED, and explain exactly which step is blocked and why.

---

## Out of scope (deferred)
- Polishing the booking modal UI.
- Replacing in-file sample data with pure Firestore reads on the customer landing/vendor pages. The customer pages keep falling back to constants if Firestore is offline; this is intentional resilience.
- Cloud Function changes (the `onEmailQueue` branch for `bookingType === 'mobile_barber'` was added in commit 409e544 and is already deployed).
- Auth-gated booking (current rule deliberately allows guest writes).
- Vendor key (Gemini/OpenAI) seeding — admin-controlled, not part of this patch.
