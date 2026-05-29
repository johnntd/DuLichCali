# Michael Unified Owner Portal — Audit & Design

**Status:** PHASE 1 IMPLEMENTED — see §15 (Implementation Report) for what shipped
**Date:** 2026-05-28
**Owner of record:** Michael Nguyen (`ownerId: michael-nguyen`)
**Primary portal:** `mobile-barber/dashboard.html` (extended in place — not replaced)

---

## 1. Goal & Scope (locked with user)

Michael owns three businesses. He should run all of them from ONE portal — his existing
mobile-barber dashboard — seeing and fully managing barber, ride/airport, and tour bookings.

**In scope (Phase 1):**
- `ownerId` as the canonical ownership model, stamped on all NEW bookings (Option C).
- Extend `mobile-barber/dashboard.html` in place: keep current layout, counters, filters,
  expandable rows, status chips, and actions. Add `All / Barber / Ride / Tour` service-type filters.
- Load Michael's bookings from all three sources and normalize into the existing appointment list.
- Full actions on all three types (accept/confirm, reject/cancel, reschedule, in-progress, complete,
  contact customer, view details, map link) — reusing existing APIs / status rules, never bypassing
  backend dispatch logic.
- `driver-admin.html` stays fully functional for future independent drivers.
- `owner-dashboard.html` becomes a thin landing/redirect into the unified portal.

**Explicitly deferred (Phase 2):**
- Unified notification center (barber + ride + tour alerts in one feed). Documented in §11.

**Non-negotiable invariants:**
- Customer-facing booking flows (ride, airport, tour, barber) must remain unchanged.
- Ride dispatch lifecycle (`rideNotifications` → `dispatchQueue` → Cloud Functions) must not break.
- `driver-admin.html` must NOT be deleted or converted to a redirect.

---

## 2. Booking-source audit

| Service | Collection | Created by | Initial status | Owner/assignment field today | `serviceType` value today |
|---|---|---|---|---|---|
| Mobile barber | `mobileBarberBookings` | `mobile-barber/mobile-barber-booking.js` `buildBooking()` (customer) + dashboard manual | `pending_barber_confirmation` / `pending_confirmation` | `vendorId` | — (implied barber) |
| Ride / airport | `bookings` (top-level) | **(a)** `ride-intake.js` `buildBookingData()` modal; **(b)** `workflowEngine.js` AI chat ride/airport flow | `dispatching` (or `pending_confirm` on conflict) | `driverId` (pre-assigned, optional) / `assignedDriverId` | `private_ride` \| `pickup` \| `dropoff` |
| Tour | `travel_bookings` | `travel-booking.js` (wizard) | `pending` | none | — (`type`/`booking_mode` = group \| private) |

### Verified creation points (file:line)
- Barber (customer): `mobile-barber/mobile-barber-booking.js` `buildBooking()` (~684–776), write at ~1008
  `firestore().collection(DATA.COLLECTIONS.bookings).doc(booking.id).set(booking)`.
  (`DATA.COLLECTIONS.bookings` = `mobileBarberBookings`.)
- Ride/airport modal: `ride-intake.js` `buildBookingData()` 1512–1595 (base obj at 1544, `status:'dispatching'`),
  write at 1471 `db.collection('bookings').doc(bookingId).set(data)`; then `rideNotifications` (1481) + `dispatchQueue` (1500).
- Ride/airport AI chat: `workflowEngine.js` ~2690–2740 — writes `rideNotifications` (status `'new'`, 2705) + `dispatchQueue` (2722). The `bookings` doc write is in the same flow above these lines (to be pinpointed precisely at implementation time).
- Tour: `travel-booking.js` `bookingDoc` 825–863 (`status:'pending'`, 860), write at 864
  `_db.collection('travel_bookings').doc(bookingId).set(bookingDoc)`.

### Dispatch side-effects (must remain intact)
- `rideNotifications/{auto}` — driver-facing feed of new rides; `status:'new'`.
- `dispatchQueue/{bookingId}_0` — triggers Cloud Function `onDispatchQueueCreated` to offer/assign drivers.
- `functions/travelDispatch.js` `assignDrivers()` — tour driver assignment via `onTravelBookingCreated`.

---

## 3. Ownership-field audit & ownerId strategy

### Current ownership fields
- Barber: `vendorId` (e.g. `michael-nguyen-oc`). Resolvable to owner via `owner-model.js`.
- Ride: `driverId` / `assignedDriverId` (Firebase Auth UID of a driver). No owner concept.
- Tour: none.

### `owner-model.js` (already exists — Phase 1 of prior work)
- `OWNERS['michael-nguyen']` registry entry (id, displayName, emails[], phone, region).
- `BUSINESSES`: `michael-nguyen-oc` (barber, **active**, providerId `michael-nguyen-oc`),
  `michael-rides-oc` (ride, coming_soon), `michael-tours-oc` (tour, coming_soon).
- Helpers: `businessesForOwner`, `ownerForBusiness`, `resolveOwnerId(record)`, `ownerForEmail(email)`,
  `ownerHasMultipleBusinesses`.

### ownerId strategy (Option C — confirmed)
1. **Canonical field:** every booking carries `ownerId` + a normalized `serviceType` (`barber|ride|tour`).
2. **Stamp on creation** at all four creation points (§2). Do **not** hardcode `'michael-nguyen'`
   inline in customer flows — resolve through a new `owner-model.js` helper:
   `OwnerModel.resolveBookingOwner({ serviceType, region, vendorId, driverId })`.
   For Phase 1 the rule is: ride/tour in Orange County → `michael-nguyen`; barber → `resolveOwnerId(vendor)`.
   This keeps future-driver assignment clean (the helper, not the call sites, changes later).
3. **Portal query** is `ownerId == 'michael-nguyen'` across the three collections, with backward-compat
   fallbacks (§6) so existing un-stamped docs still appear.
4. **Future drivers** get their own `ownerId` (e.g. `driver-a`) or no owner if independent; they keep
   using `driver-admin.html` filtered by `assignedDriverId`. Michael is special only in that one owner
   spans three service types.

---

## 4. Action audit (what the unified portal must support)

### 4.1 Barber actions (existing — reuse as-is)
- `updateBookingStatus(bookingId, status)` (`mobile-barber-dashboard.js` ~1003–1034):
  merges `{status, updatedAt}` into `mobileBarberBookings/{id}`, queues confirmation email
  (`queueMobileBarberStatusChange`), reloads + re-renders.
- Statuses: `pending_barber_confirmation`/`pending_confirmation` → `confirmed` → (`in_progress`) →
  `completed`; `cancelled`; `rescheduled`. Buckets in `statusBucket()` (~1350–1362),
  labels in `STATUS_LABELS` (~734–740).
- Row + actions render in `bookingCard()` (~1364–1603); list in `renderBookings()` (~1945–1987).
- Extra actions present: map link, SMS confirm, payment (mark paid/unpaid, request Zelle, set method).

### 4.2 Ride / airport actions
Ride status writes today are **direct Firestore merges** on `bookings/{id}` (no callable for status
changes); the dispatch *assignment* is the Cloud-Function part. Target mapping for the portal:

| Portal action | Write to `bookings/{id}` | Notes / backend respect |
|---|---|---|
| Accept / confirm | `{status:'confirmed', driverId:<michael>, updatedAt}` | Same write driver-admin performs on accept. **VERIFY exact driver-admin accept fields before coding (§10 open item).** |
| Reject / cancel | `{status:'cancelled', cancelledAt, cancelReason}` | Triggers `onEmailQueue` customer notice. |
| Mark in-progress | `{status:'on_the_way', updatedAt}` (and/or `arrived`) | Mirror existing driver lifecycle values. |
| Mark completed | `{status:'completed', completedAt}` | Mirror existing. |
| Reschedule | update `rideDate/rideTime` (or `arrivalDate/arrivalTime` / `departureDate/departureTime`) + `datetime`; re-write `dispatchQueue/{id}_0` if re-dispatch needed | **No existing reschedule path** — new, must reuse dispatch trigger, not bypass it. |
| Contact customer | `tel:`/SMS using `customerPhone` | Reuse barber SMS/contact pattern. |
| Map / navigation | `routeLink` / `airportMapsLink` / `addrMapsLink` already on the doc | Reuse. |

### 4.3 Tour actions
Tours have **no management UI today** (write-once on customer side). `travel_bookings` statuses seen:
`pending` → `confirmed` → `assigned` (via `travelDispatch`) ; add `cancelled` / `completed`.

| Portal action | Write to `travel_bookings/{id}` | Notes |
|---|---|---|
| Confirm | `{status:'confirmed'}` | May trigger/await `assignDrivers()` (Cloud Function on create); confirm is a status flip. |
| Cancel | `{status:'cancelled', cancelledAt}` | |
| Mark in-progress | `{status:'in_progress'}` | New value, additive. |
| Mark completed | `{status:'completed', completedAt}` | |
| Reschedule | update `date`/`travel_date` | Additive. |
| Contact customer | `tel:`/SMS using `customer.phone` | |

---

## 5. Architecture / design

### 5.1 Owner-mode detection
On dashboard init, after vendor identity resolves (currently `?vendorId=`/`?id=` →
`getVendorId()` ~821, writes gated by persisted Firebase Auth session):
- Resolve `ownerId` via `OwnerModel.resolveOwnerId(vendor)` or `OwnerModel.ownerForEmail(authEmail)`.
- If `ownerId` set AND `OwnerModel.ownerHasMultipleBusinesses(ownerId)` → enter **owner mode**.
- Otherwise → unchanged single-vendor behavior (other barbers unaffected).

### 5.2 Multi-source load + normalization
New module **`mobile-barber/owner-bookings.js`** (keeps `mobile-barber-dashboard.js` focused):
- `loadOwnerBookings(ownerId)` runs three parallel queries:
  - `mobileBarberBookings` where `vendorId in [owner's barber vendorIds]` (existing path, reused).
  - `bookings` where `ownerId == ownerId` **OR** `assignedDriverId == <michael driver id>` (compat).
  - `travel_bookings` where `ownerId == ownerId` (+ compat region fallback for old docs).
- Normalizes each doc into the existing row shape the dashboard already renders, adding:
  - `serviceType: 'barber'|'ride'|'tour'` (badge: 💈 Barber / 🚗 Ride / 🧭 Tour)
  - `sourceCollection` (so actions write back to the correct collection)
  - mapped `customerName`, `customerPhone`, `dateTime`, `status`, `price`, plus a `raw` passthrough
    for type-specific expandable detail.
- Returns a single array assigned to `state.bookings`. `renderBookings()` keeps working unchanged.

### 5.3 Rendering changes (additive, in place)
- Add service-type filter chips `All / Barber / Ride / Tour` alongside the existing status filters.
- `bookingCard()` gains: a service-type badge, type-specific expandable detail block, and a
  type-specific action set chosen by `serviceType` (barber→existing; ride/tour→§4 mappings).
- Existing summary counters keep counting the (now larger) `state.bookings`.

### 5.4 Action routing
A thin `applyBookingAction(row, action)` dispatches by `row.serviceType` to:
- barber → existing `updateBookingStatus`.
- ride → `OwnerActions.ride.*` (writes `bookings`, re-uses dispatch where needed).
- tour → `OwnerActions.tour.*` (writes `travel_bookings`).
Each adapter writes only the documented fields and reuses existing email/dispatch hooks.

---

## 6. Migration / backfill plan

1. **Forward (creation stamping):** add `ownerId` + normalized `serviceType` at the four creation
   points (§2) via `OwnerModel.resolveBookingOwner(...)`. Customer UX unchanged (fields are additive).
2. **Backward (existing docs):** one-shot, idempotent backfill helper
   `scripts/ai/backfill_owner_ids.*` (or a guarded admin function) that sets `ownerId:'michael-nguyen'`
   + `serviceType` on:
   - `mobileBarberBookings` where `vendorId == 'michael-nguyen-oc'`.
   - `bookings` (ride/airport) in Michael's region / assigned to his driver id.
   - `travel_bookings` in Michael's region.
   Run once, logged; safe to re-run (only writes when field missing).
3. **Compat reads:** portal queries OR-fallback on legacy fields (`assignedDriverId`, region) so the
   portal is correct even before/without backfill.
4. **Indexes:** add Firestore composite indexes for `bookings(ownerId, serviceType)` and
   `travel_bookings(ownerId)` (and any orderBy used). Document in `firestore.indexes.json`.

---

## 7. Permission matrix

| Capability | Owner (Michael) | Independent driver |
|---|---|---|
| See barber bookings | ✅ (his vendors) | ❌ |
| See ride/airport bookings | ✅ (his `ownerId`) | ✅ only `assignedDriverId == self` |
| See tour bookings | ✅ (his `ownerId`) | ❌ (unless assigned a tour ride) |
| Accept / reject / reschedule / complete | ✅ all three types | ✅ assigned rides only |
| Contact customer / map | ✅ | ✅ assigned rides only |
| Manage other owners' data | ❌ | ❌ |

Enforced by: portal queries scoped to `ownerId`; `driver-admin.html` queries scoped to
`assignedDriverId`; Firestore rules (§9).

---

## 8. Why `driver-admin.html` remains (future-driver support)

Long-term every operator gets their own portal. Michael is the only *active* operator now, but
independent drivers will onboard later and need the dispatch accept/reject flow that
`driver-admin.html` provides. Therefore:
- Keep `driver-admin.html` fully functional and wired to `driver-login.html`.
- Only **hide** it from Michael's owner workflow navigation (not from drivers' own login path).
- Do **not** redirect or stub it.
- Ride dispatch backend (`rideNotifications`, `dispatchQueue`, Cloud Functions) is shared and untouched.

Navigation change: remove/avoid the driver-admin link in owner-facing surfaces
(`portal.html` line ~193 is the staff landing — keep the driver login card for drivers, but ensure
Michael's path lands on `mobile-barber/dashboard.html`). `functions/index.js` ~357 SMS link to
`/driver-admin` is for dispatched drivers — leave intact.

---

## 9. Firestore security rules (verified)
- `bookings/{doc=**}` — `read,write: if true` (fully open). Portal can write ride status directly.
- `travel_bookings/{id}` — `create:true`, `read:true`, `update: if request.auth != null`.
  Michael must be **authenticated** to update tours.
- `mobileBarberBookings/{id}` — write requires `isVendorMember(vendorId)`: Michael's
  `vendorUsers/{uid}` must map `vendorId == 'michael-nguyen-oc'` or `vendorIds` include it.

**Action items:** confirm Michael's `vendorUsers/{uid}` mapping covers his barber vendor; ensure the
dashboard runs under an authenticated session (it relies on persisted Firebase Auth). Tour writes
require that same auth. No rule changes anticipated for Phase 1 (bookings already open); revisit if
we later tighten `bookings`.

---

## 10. Risks & open items (resolve during planning, before coding the relevant part)
- **R1 — Ride accept exact write.** Pinpoint the precise fields `driver-admin.html` sets on
  accept/reject/in-progress/complete, and mirror them exactly so dispatch state stays consistent.
  (Audit confirms direct Firestore merges; exact field set to be lifted from driver-admin at impl time.)
- **R2 — Ride reschedule has no precedent.** New behavior; must re-enter the dispatch flow
  (`dispatchQueue`) rather than silently editing a confirmed ride. Keep minimal and reversible.
- **R3 — `workflowEngine.js` booking-doc write line** not yet pinned to an exact line; confirm and
  stamp `ownerId` there too (the AI chat ride path), not just `ride-intake.js`.
- **R4 — Auth dependency.** Tour + barber writes need an authenticated session; the dashboard is
  URL-driven for identity. Verify owner session before enabling tour/barber writes in owner mode.
- **R5 — Composite indexes** must be deployed or queries fail in production.
- **R6 — JS version strings.** Any edited JS (`mobile-barber-dashboard.js`, new `owner-bookings.js`,
  `ride-intake.js`, `travel-booking.js`, `mobile-barber-booking.js`, `owner-model.js`) requires
  bumping `?v=` in every HTML consumer per CLAUDE.md.
- **R7 — Multilingual.** All new UI strings (filters, badges, type-specific labels, ride/tour actions)
  must ship vi/en/es in the same change — no hardcoded strings in any language.

---

## 11. Phase 2 (deferred) — Unified notification center
Funnel new-booking and status-change alerts for barber + ride + tour into one in-portal feed for
Michael, building on the `ownerId` data layer established here. Current wiring stays as-is for
Phase 1: barber dashboard listeners, `driver-notif.js`, `rideNotifications`, and Cloud-Function
SMS/email each continue to operate independently.

---

## 12. Test plan (acceptance — from spec)
1. Create mobile barber booking for Michael → appears in unified portal (Barber badge).
2. Create ride booking (modal + AI chat) assigned to Michael → appears with Ride badge.
3. Create tour booking for Michael → appears with Tour badge.
4. Service-type filters All/Barber/Ride/Tour each show the correct subset.
5. Full actions per type succeed and persist (status/field writes verified in Firestore).
6. Ride reschedule re-enters dispatch without corrupting an in-flight ride.
7. Driver-admin link hidden from Michael's owner workflow; `driver-admin.html` still loads & works.
8. Customer ride booking still works end-to-end (modal + AI chat).
9. Customer tour + barber booking still work.
10. Mobile (375px) AND desktop (1280px) both correct.
11. vi/en/es correct on all new UI.
12. `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.

Deliverables on completion: before/after screenshots (mobile + desktop), migration notes (this §6),
rollback notes (§13), and PASS only if all existing booking flows still work.

---

## 13. Rollback notes
- **Code:** all changes are additive + behind owner-mode detection. Revert the feature by reverting
  the commit(s); single-vendor barber behavior and customer flows are untouched paths.
- **Data:** `ownerId`/`serviceType` fields are additive and ignored by existing code — safe to leave
  in place even after a code rollback. The backfill helper only adds fields; no destructive writes.
- **Driver-admin:** never modified destructively; nothing to roll back there.
- **Indexes:** dropping the added composite indexes is safe once the feature is reverted.
- **Version strings:** rolling back the commit restores prior `?v=` strings (do not hand-edit).

---

## 14. Result criteria
PASS only when: Michael monitors AND manages barber + ride + tour from `mobile-barber/dashboard.html`;
future drivers still have an independent, fully-functional `driver-admin.html`; customer flows
unchanged; `ownerId` is the canonical ownership model; dry run `FINAL: PASS`.

---

## 15. Implementation Report — Phase 1 (2026-05-28)

**Verdict:** Implemented + validated at the data/static layer. Authenticated owner-dashboard
screenshots are NOT included — the dashboard is gated behind Firebase vendor auth and live
Firestore; it cannot be rendered headlessly in this environment without Michael's credentials.
Data layer, asset serving, i18n coverage, and the full test gate were verified instead (below).

### 15.1 Files changed

**ownerId model & resolution**
- `owner-model.js` — flipped `michael-rides-oc` and `michael-tours-oc` from `coming_soon` →
  `active`; repointed their `dashboardUrl` from `/driver-admin.html` and `/tour` to the unified
  dashboard (`/mobile-barber/dashboard.html?type=ride|tour`). Removes driver-admin from owner nav.

**ownerId stamping (all 4 creation points — prior task, unchanged this pass)**
- `ride-intake.js`, `workflowEngine.js` (airport/tour/private-ride), `travel-booking.js`.

**Unified loader**
- `mobile-barber/owner-bookings.js` (NEW) — `OwnerBookings.load()` + normalizers; maps ride/tour
  docs onto barber-shaped rows with discriminators (`serviceType`, `serviceLabelKey`,
  `sourceCollection`, `routeLink`, `durationDays`, `_raw`).

**Dashboard UI + actions**
- `mobile-barber/mobile-barber-dashboard.js` — owner-mode detection (`resolveOwnerMode`),
  multi-source load branch, `?type=` deep-link filter, service-type filter bar + type badges,
  ride/tour detail sections, Navigate button (uses `routeLink`), action routing via
  `targetCollectionFor()` so status/payment writes hit the correct source collection.
- `mobile-barber/mobile-barber.css` — `.mb-service-filter*`, `.mb-type-badge*` (mobile + desktop).
- `mobile-barber/dashboard.html` — loads `owner-model.js` + `owner-bookings.js` before the data
  module; version bumps.

**Migration / ops**
- `scripts/ai/backfill-owner-id.js` (NEW) — idempotent, dry-run by default (`--apply` to write),
  never auto-run. Stamps `ownerId` on legacy docs via `OwnerModel.resolveBookingOwner`.
- `firestore.indexes.json` — added composite `bookings(ownerId, serviceType)`.
- `tests/lib/mobile-barber-landing.js` — fixture version strings synced (`r`→`s`, `o`→`p`).

### 15.2 Version bumps
- `owner-model.js`: `20260528a` → `20260528b` in all 5 consumers
  (`owner-dashboard.html`, `index.html`, `travel.html`, `airport.html`, `mobile-barber/dashboard.html`).
- `mobile-barber/mobile-barber.css`: `20260528o` → `20260528p` (dashboard.html).
- `mobile-barber/mobile-barber-dashboard.js`: at `20260528s` (dashboard.html).

### 15.3 Verification performed
- **Full gate:** `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` (460 passed, 0 failed).
- **`node --check`:** owner-model.js, owner-bookings.js, mobile-barber-dashboard.js,
  backfill-owner-id.js — all OK.
- **Data layer (node + fixtures):** `ownerHasMultipleBusinesses('michael-nguyen')===true`,
  `('tim-nguyen')===false`; `barberVendorIdsFor('michael-nguyen')===['michael-nguyen-oc']`;
  `resolveBookingOwner` returns `michael-nguyen` for pickup/dropoff/private_ride/tour and the
  correct owner for each barber vendor; normalizers emit barber-shaped rows for ride/tour/barber.
- **Asset serving:** dashboard.html, owner-model.js, owner-bookings.js all 200 on localhost.
- **i18n:** all 14 new keys present in vi/en/es with distinct, real translations (no placeholders).
- **driver-admin:** zero references in any owner-nav surface; `driver-admin.html` itself untouched.

### 15.4 Not yet done / follow-ups
- **Authenticated UI screenshots (mobile 375px + desktop 1280px):** require a logged-in Michael
  session against live Firestore — to be captured on the deployed staging/prod env.
- **Backfill execution:** `backfill-owner-id.js` written but NOT run against prod (by design —
  run manually with `--apply` after a dry-run review).
- **Index deploy:** `firestore.indexes.json` updated; `firebase deploy --only firestore:indexes`
  must be run to create the composite (current single-field queries work without it).
- **Deploy:** changes are committed-ready but NOT yet deployed to production.
