# Mobile Barber — Notification Badge Count + Double-Booking Fix

**Date:** 2026-05-31
**Blockers:** (1) no unread notification badge count; (2) overlapping bookings still possible.

---

## BLOCKER 1 — Notification badge count missing

### Root cause
The bell, unread badge, drawer, and `addNotification` were all gated on `state.ownerMode`
— which is only `true` for a **multi-business owner** (`OwnerModel.ownerHasMultipleBusinesses`).
A single vendor (or any non-multi-business owner) hit `addNotification → return null`,
`renderNotificationDrawer → bell.hidden = true; return`, and `openNotificationDrawer → return`.
So the popup (not owner-gated) appeared, but **no count, no bell, no drawer** ever showed.

### Fix
Decoupled the notification/badge system from `ownerMode` with a scope helper:
- `notifyScopeId()` = `state.ownerId || state.vendorId` (owner for multi-business, else the vendor).
- `notificationsActive()` = `!!notifyScopeId()` (true for **every** vendor).

Swapped the `ownerMode` gates in `addNotification`, `renderNotificationDrawer`,
`openNotificationDrawer`, `persistOwnerNotifications`, the init load, and the storage key
(`…_<scopeId>`) to use `notificationsActive()` / `notifyScopeId()`. Result:
1. Every new unread booking increments the count. ✅ (`addNotification` dedupes by booking key — no double count)
2. Count shows on the **bell button + red/gold badge** in the dashboard header (mobile + PWA). ✅
3. Persists after refresh (localStorage `dlc_mobile_barber_owner_notifications_<scopeId>`). ✅
4. Opening the drawer does **not** auto-clear. ✅ (no mark-read on open)
5. Mark read decrements; 6. Mark all read clears. ✅ (`markNotificationRead` / `markAllNotificationsRead`)
7. Dedupe (`notificationDedupeKey`) prevents double-count. ✅
8. Owner portal includes barber/ride/tour (owner subscription). ✅
9. Scoped to `ownerId`/`vendorId` → Tim & Michael never see each other's counts. ✅

**Log added:** `[notification-count] { scopeId, ownerId, vendorId, totalNotifications, unreadCount, renderedBadgeCount }` on each badge render.

---

## BLOCKER 2 — Double booking still possible

### Root cause (two parts)
1. **Anonymous customers bypass the guard entirely.** The public booking flow signs in
   **anonymously**; Firestore rules deny anon the booking reads the conflict guard needs, so
   `persistBooking` routes anon writers to the **plain direct-write path** (`…doc(id).set(booking)`)
   — *no conflict check at all*.
2. **The guard only flagged, never blocked.** `dispositionFor('time_conflict')` returned
   `'review'`, so even the authenticated path wrote the overlapping booking as `vendor_review`;
   and the server trigger `onMobileBarberBookingCreated` *elevated to vendor_review* rather than
   blocking. So overlaps were always **created**.

### Fix — guard enforced in the server write path (race-safe), for every entry point
The trigger fires on **every** new `mobileBarberBookings/{id}` regardless of source
(manual / AI chat / voice / promo / AI-hairstyle), and now:
- Sweeps owner-wide across `mobileBarberBookings`, `bookings`, `travel_bookings` (Admin SDK).
- On a **true time overlap** with a blocking-status booking, **auto-declines the LATER booking**
  (`status: 'declined'`, `declineReason: 'time_conflict'`, `conflictBookingId`), deciding the
  winner by Firestore `createTime` — the **earliest booking stands**, every later overlapping one
  declines itself. This is race-safe (two simultaneous writes → exactly one declines), needs no
  client change, and never deletes the doc.
- `declined` added to `MB_NON_BLOCKING` (server) and `NON_BLOCKING_STATUSES` (client guard) so a
  declined booking never blocks or cascades.

Belt-and-suspenders for the **authenticated** vendor path: `dispositionFor('time_conflict')`
now returns `'block'`, so `guardedWrite` refuses to write an overlap pre-commit (returns the block
result, no booking). `outside_service_radius` / `vendor_review_required` / `tour_daily_cap` /
`outside_working_hours` stay `review` (unchanged).

**Blocking statuses** (count as a conflict): pending, pending_confirmation,
pending_barber_confirmation, confirmed, accepted, in_progress, traveling, vendor_review.
**Non-blocking:** cancelled, rejected, declined, completed, expired, no_show.

**Logs added (server):**
- `[booking-conflict-guard] { source, vendorId, ownerId, requestedStart, requestedEnd, existingBookingsChecked, conflictsFound, result }`
- `[booking-write-blocked] { bookingId, reason: 'time_conflict', conflicts[], conflictWith }`

---

## Files changed
| File | Change |
|---|---|
| `mobile-barber/mobile-barber-dashboard.js` | badge/notifications decoupled from ownerMode (scope = vendorId/ownerId) + `[notification-count]` log |
| `functions/index.js` | `onMobileBarberBookingCreated` → race-safe **auto-decline** of later overlap (+ logs); `declined` added to `MB_NON_BLOCKING` |
| `booking-conflict-guard.js` | `dispositionFor('time_conflict')` → `block`; `declined` added to non-blocking |
| `*.html` (6) | `booking-conflict-guard.js?v=20260531a`; dashboard.js `?v=20260531c` |
| `tests/runner.js`, `tests/lib/booking-conflict-guard.js`, `tests/lib/mobile-barber-landing.js` | guard tests updated to new block/auto-decline behavior |

## Tests
`node tests/runner.js` → **546 / 546 pass** (incl. updated guard tests: overlap → block; server → auto-decline; lock prevents simultaneous writes; duplicates block; non-blocking statuses don't block).

## Production verification steps
1. **Badge:** open Michael's portal; create a booking while watching → bell shows **1**; another → **2**; refresh → still **2**; mark one read → **1**; mark all read → hidden. Console: `[notification-count]`.
2. **Double-booking:** book Tim today 5:00 PM (stands). Book Tim again 5:00 PM, or 5:15 PM for a 45-min service → the **later** one ends up `status: declined`, `declineReason: time_conflict` (Firestore + Functions log `[booking-write-blocked]`). A truly-clear time after duration+buffer is allowed. Repeat for Michael.
3. Function logs: `firebase functions:log --only onMobileBarberBookingCreated` → `[booking-conflict-guard]` / `[booking-write-blocked]`.

## PASS / BLOCKED
- **Badge count:** ✅ works for any vendor, scoped, persists.
- **Double-booking:** ✅ blocked in the real write flow — the later overlap is auto-declined server-side (all sources), and the authenticated path hard-blocks pre-write. Verify on-device with the test above.
