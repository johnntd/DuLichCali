# Unified Owner Notification Center — Phase 2

**Owner portal:** `mobile-barber/dashboard.html` + `mobile-barber/mobile-barber-dashboard.js`  
**Date:** 2026-05-29  
**Status:** Static validation PASS after Iteration 2; authenticated live popup/sound/drawer runtime BLOCKED

## Actual Final State

This phase closes the two gaps that were missing from the previous document. It does not change booking creation, conflict validation, Cloud Functions, Firestore rules, Luxurious Nails, or driver admin.

### Pre-existing machinery reused

- `showBookingAlert(booking)` for the 45s popup, View/Dismiss actions, and native `Notification`.
- `handleBookingAlert(booking, changeType)` plus `markBookingNotified` / `shouldAlertForBooking` for initial-snapshot seeding and dedupe.
- `playBookingChime()`, `unlockSoundAlerts()`, `state.soundReady`, `state.soundBlocked`, and the existing sound controls.
- Owner mode detection through `OwnerModel.resolveOwnerId`, `ownerHasMultipleBusinesses`, `OwnerBookings.load`, and `OwnerBookings.barberVendorIdsFor`.
- Existing owner-only service filter bar and `viewBooking(id)`.

### Gap 1 built: multi-source owner listener

`subscribeBookingAlerts()` now preserves the original single-service vendor branch. For owner mode only, it attaches one listener per source:

| Source | Query | Notes |
|---|---|---|
| `mobileBarberBookings` | `where('vendorId', '==', ownedBarberVendorId).limit(25)` per owned barber id | bucketed as `barber` |
| `bookings` | `where('ownerId', '==', state.ownerId).limit(25)` | normalized to `ride` or `tour` with `OwnerModel.serviceBucket()` |
| `travel_bookings` | `where('ownerId', '==', state.ownerId).limit(25)` | bucketed as `tour` |

Owner alert queries use single equality plus `limit` only. No owner alert listener adds `orderBy`, so these listeners do not require Firestore composite indexes.

Each listener owns its own initial-snapshot flag. Initial docs are marked notified silently; only later matching `added` / alert-status changes can produce popup, chime, and inbox entries. List refresh is debounced at about 250ms across sources.

Iteration 2 explicitly passes a bucket hint into owner listener normalization (`barber`, `ride_tour`, `travel_tour`). This prevents a `DATA.COLLECTIONS.bookings === 'bookings'` collision from routing owner ride/tour docs through barber normalization.

### Gap 2 built: owner-only bell and persisted drawer inbox

Owner mode now gets:

- Hero bell: `mbNotifBell` with unread badge `mbNotifBadge`.
- Drawer: `mbNotifDrawer`, `mbNotifTabs`, and `mbNotifList`.
- Actions: close, filter All/Barber/Ride/Tour, mark all read, click item to mark read and open the booking row.
- First bell tap calls `unlockSoundAlerts()` when sound is not ready.
- Local persisted inbox under `dlc_mobile_barber_owner_notifications_<ownerId>`, capped at 120 entries.

Entry shape:

```js
{
  id,               // serviceType + ':' + bookingId
  ownerId,
  serviceType,      // barber | ride | tour
  bookingId,
  sourceCollection,
  title,
  message,          // values only: customer • service • date • time • status
  status,
  read,
  createdAt
}
```

The same `serviceType + ':' + bookingId` key is used for owner `notifiedBookingIds` and inbox `id`, preventing duplicate owner inbox rows across reloads.

## Files Changed

- `mobile-barber/mobile-barber-dashboard.js`
  - Owner listener branch, per-listener initial seeding, explicit bucket-hint normalization, debounced refresh, owner notification model, drawer render/actions, owner-only compact alert message, i18n keys, beforeunload listener guard.
- `mobile-barber/dashboard.html`
  - Bell markup, drawer markup, version bumps.
- `mobile-barber/mobile-barber.css`
  - Bell, badge, drawer, tabs, item, mobile bottom-sheet and desktop side-panel styles.
- `mobile-barber/index.html`
  - Shared CSS version bump.
- `mobile-barber/vendor.html`
  - Shared CSS version bump.
- `tests/lib/mobile-barber-landing.js`
  - Static expectations for new versions, owner notification center structure, owner bucket hints, owner vs single-vendor dedupe shape, inbox cap, and beforeunload guard.
- `docs/unified_owner_notifications_phase2.md`
  - This actual-state report.

## Version String Bumps

- `mobile-barber/mobile-barber-dashboard.js`: `20260528s` -> `20260529d` in `mobile-barber/dashboard.html`.
- `mobile-barber/mobile-barber.css`: dashboard `20260528p`, index/vendor `20260528q` -> `20260529d` in all three consumers.
- Verified via `git log --all` grep that no `mobile-barber-dashboard.js?v=20260529d` or `mobile-barber.css?v=20260529d` entry existed before this patch.
- Iteration 2 did not introduce a new asset reference; the active references remain `20260529d`.

## Do-Not-Break Verification

- Single-service vendor path: the original non-owner listener remains the `DATA.COLLECTIONS.bookings` + `vendorId` listener with `orderBy('createdAt')`, `limit(25)`, and limit-only fallback. No bell/inbox is shown when `state.ownerMode` is false.
- Booking creation paths: untouched.
- Booking conflict guard: untouched.
- AI receptionist and voice mode: untouched.
- Firestore schema/rules: untouched.
- Driver admin and Luxurious Nails: untouched.
- Owner listeners are read-only and scoped to owned barber vendor ids or `ownerId`.
- Owner listener normalization is disambiguated by bucket hint, not collection-name equality alone.
- `filterAll`, `filterBarber`, `filterRide`, `filterTour`, `svcBarber`, `svcPrivateRide`, and `svcTour` are present in en/vi/es i18n tables.

## Commands Run

- `scripts/ai/targeted_dry_run.sh booking` -> `FINAL: PASS`.
- `node --check mobile-barber/mobile-barber-dashboard.js` -> PASS.
- `node tests/runner.js` -> `484 passed, 0 failed`.
- `scripts/ai/full_system_dry_run.sh` -> `FINAL: PASS`.
- Iteration 2 rerun: `node --check mobile-barber/mobile-barber-dashboard.js` -> PASS.
- Iteration 2 rerun: `node tests/runner.js` -> `484 passed, 0 failed`.
- Iteration 2 rerun: `scripts/ai/targeted_dry_run.sh booking` -> `FINAL: PASS`.
- Iteration 2 rerun: `scripts/ai/full_system_dry_run.sh` -> `FINAL: PASS`.
- `grep -rn "mobile-barber-dashboard.js" . --include="*.html"` -> sole consumer is `mobile-barber/dashboard.html` at `v=20260529d`.
- `grep -rn "mobile-barber.css" mobile-barber --include="*.html"` -> dashboard/index/vendor all at `v=20260529d`.
- Browser layout attempt with `webapp-testing` was BLOCKED by sandbox permissions: local server bind returned `PermissionError: Operation not permitted`, and headless Chromium exited with a Mach port permission error.

## PASS / BLOCKED

**Static and dry-run status:** PASS.  
**Interactive runtime status:** BLOCKED until an authenticated owner Firebase session can create live barber, ride, and tour bookings and observe popup, sound, badge, drawer persistence, and click-through behavior in the real dashboard.

Next live verification command/flow: log in as the Michael owner account, open `mobile-barber/dashboard.html`, tap the bell once to unlock sound, create one booking from each source in another session, and confirm popup/chime/badge/drawer behavior.
