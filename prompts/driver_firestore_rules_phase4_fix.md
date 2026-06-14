# Phase 4 — Firestore rules: driver isolation + owner-safe + push subscriptions, with emulator tests

Harden `firestore.rules` so a driver can read/write ONLY their assigned rides and their own push subscriptions, while **Michael's unified owner portal keeps working** (reads ride/tour bookings by `ownerId`) and **anonymous customers keep booking + tracking**. Add emulator unit tests proving all of it. This is a CRITICAL trigger area — implement EXACTLY as specified; the emulator test is the gate.

## IMPORTANT — do NOT run validation yourself
Edit ONLY the two files under "Allowed files". **Do NOT run `scripts/ai/full_system_dry_run.sh`, `npm run test:rules`, `firebase emulators:*`, or `firebase deploy`.** Your sandbox cannot bind the emulator port (`EPERM` — not a stop signal); the harness runs the emulator gate afterward. Use `node --check` only if you wish. Make the edits and end. **Do NOT deploy rules** under any circumstance.

## Verified facts (do not re-derive)
- Assigned-driver field on a ride/booking is **nested `driver.driverId`** (set by `acceptOffer` in functions/index.js), and **`driver.driverId === the driver's Firebase Auth uid`** (admin.html:2700 + driver-login.html:308 both set `driverUsers/{uid}.driverId = uid` and `drivers/{uid}`).
- Michael (owner) **is a `vendorUsers` member** (via his barber vendor), and his owner portal lists `bookings`/`travel_bookings` filtered by `ownerId` (mobile-barber/owner-bookings.js) + a legacy unfiltered `travel_bookings` compat scan. The `exists(vendorUsers/{uid})` branch (resource-independent) must keep authorizing those.
- Customers are **anonymous-authed**; current `bookings` list already requires non-anonymous, so customer list is already denied (no regression). Customer **create** and **get-by-id** (tracking) must keep working.
- Drivers write only `{status, statusUpdatedAt, statusUpdatedBy, statusHistory}` on status changes today; field-pinning must allow those + `acceptedAt/startedAt/completedAt/driverNotes` and block everything else.

## A) `firestore.rules` — add helpers (near the other helper functions at the top)
```firestore
function isAssignedDriver() {
  return request.auth != null
      && 'driver' in resource.data
      && resource.data.driver.driverId == request.auth.uid;
}
function isPortalVendorUser() {
  return request.auth != null
      && request.auth.token.firebase.sign_in_provider != 'anonymous'
      && exists(/databases/$(database)/documents/vendorUsers/$(request.auth.uid));
}
function driverUpdateFieldsOk() {
  return request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status','statusUpdatedAt','statusUpdatedBy','statusHistory',
                     'acceptedAt','startedAt','completedAt','driverNotes']);
}
```

## B) `/bookings/{doc=**}` — replace the list/update lines (keep create/get/delete behavior)
```firestore
match /bookings/{doc=**} {
  allow create: if true;
  allow get:    if request.auth != null;                       // unchanged (anon customer tracking)
  allow list:   if isAdmin() || isPortalVendorUser() || isAssignedDriver();
  allow update: if isAdmin() || isPortalVendorUser()
             || (isAssignedDriver() && driverUpdateFieldsOk());
  allow delete: if isAdmin();
}
```

## C) `/travel_bookings/{bookingId}` — mirror list/update (owner + admin only; drivers use travelAssignments)
```firestore
allow create: if true;
allow get:    if request.auth != null;
allow list:   if isAdmin() || isPortalVendorUser();
allow update: if isAdmin() || isPortalVendorUser();
allow delete: if isAdmin();
```
(Preserve any existing stricter create-validation if present; only adjust list/update to the above.)

## D) `/travelAssignments/{docId}` — scope reads to the assigned tour driver (or admin/owner)
```firestore
match /travelAssignments/{docId} {
  allow read:  if isAdmin() || isPortalVendorUser()
            || (request.auth != null && resource.data.travel_driver_id == request.auth.uid);
  allow write: if false;   // Admin SDK only
}
```

## E) NEW `/drivers/{driverId}/pushSubscriptions/{subId}` (the Phase 3 dependency)
```firestore
match /drivers/{driverId}/pushSubscriptions/{subId} {
  allow read, write: if request.auth != null && request.auth.uid == driverId;
}
```

## F) Emulator tests — EXTEND `tests/rules/firestore-rules.test.js`
Add a new test block (reuse the existing `allowed()`/`denied()` helpers and `testEnv`). Seed with rules disabled:
- `vendorUsers/michael-uid` = `{ vendorId:'michael-nguyen-oc' }` (owner) — already a vendorUsers member.
- `driverUsers/driverA` = `{ driverId:'driverA' }`, `driverUsers/driverB` = `{ driverId:'driverB' }`.
- `bookings/rideA` = `{ driver:{driverId:'driverA'}, ownerId:'michael-nguyen', status:'assigned', paymentStatus:'unpaid' }`.
- `bookings/rideB` = `{ driver:{driverId:'driverB'}, ownerId:'michael-nguyen', status:'assigned' }`.
- `travel_bookings/tourA` = `{ ownerId:'michael-nguyen', status:'confirmed' }`.
- `travelAssignments/taA` = `{ travel_driver_id:'driverA' }`, `travelAssignments/taB` = `{ travel_driver_id:'driverB' }`.

Contexts: `driverA = authenticatedContext('driverA')`, `driverB = authenticatedContext('driverB')`, `michael = authenticatedContext('michael-uid')`, `anon = unauthenticatedContext()` (or anonymous).

Assert (use `query`/`where` from `firebase/firestore` — import what you need):
- **Driver isolation (list):** driverA `bookings.where('driver.driverId','==','driverA')` → **ALLOW**; driverA `bookings` (no where) → **DENY**; driverA `bookings.where('driver.driverId','==','driverB')` → **DENY**.
- **Driver update field-pinning:** driverA `update(bookings/rideA, {status:'on_the_way', statusUpdatedAt:...})` → **ALLOW**; driverA `update(bookings/rideA, {paymentStatus:'paid'})` → **DENY**; driverA `update(bookings/rideA, {'driver.driverId':'x'})` or `{ownerId:'x'}` → **DENY**; driverA `update(bookings/rideB, {status:'on_the_way'})` (not assigned to A) → **DENY**.
- **Owner (Michael) preserved:** michael `bookings.where('ownerId','==','michael-nguyen')` → **ALLOW**; michael `travel_bookings.where('ownerId','==','michael-nguyen')` → **ALLOW**; michael `travel_bookings` unfiltered (compat scan) → **ALLOW**.
- **Customer:** anon `setDoc(bookings/new1, {...})` → **ALLOW** (create); anon `getDoc(bookings/rideA)` → **ALLOW** (tracking); anon `bookings.where(...)`/list → **DENY**.
- **travelAssignments:** driverA `read(travelAssignments/taA)` → **ALLOW**; driverA `read(travelAssignments/taB)` → **DENY**; michael read taA → **ALLOW**.
- **pushSubscriptions:** driverA `setDoc(drivers/driverA/pushSubscriptions/s1, {...})` → **ALLOW**; driverA `setDoc(drivers/driverB/pushSubscriptions/s1, {...})` → **DENY**.

Keep the existing Mobile Barber rules tests intact and passing.

## Constraints
- Edit ONLY `firestore.rules` and `tests/rules/firestore-rules.test.js`.
- Do not weaken any existing rule (mobileBarberBookings, drivers/{id}, vendorUsers, etc.). Only add the helpers + the blocks above.
- No deploy.

## Acceptance
- `node --check tests/rules/firestore-rules.test.js` passes.
- The harness runs `npm run test:rules` (emulator) → ALL cases (existing Mobile Barber + new driver/owner/customer) must PASS.
- `scripts/ai/full_system_dry_run.sh` ends `FINAL: PASS`.

## Allowed files
- firestore.rules
- tests/rules/firestore-rules.test.js
