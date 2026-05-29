# Phase 2 — Unified Owner Notification Center (real build, close the two gaps)

The owner's unified portal (`mobile-barber/dashboard.html` + `mobile-barber/mobile-barber-dashboard.js`)
already has MOST of the realtime-alert machinery. The doc
`docs/unified_owner_notifications_phase2.md` describes the full intended feature but
overclaims "IMPLEMENTED": two pieces do NOT exist in code yet. Build ONLY those two,
reusing the existing primitives. Make the smallest safe change. Do NOT deploy, push,
or commit. This is a CRITICAL TRIGGER AREA (booking listeners + mobile + i18n) — read
the current code first.

## What ALREADY EXISTS (reuse — do NOT duplicate or rewrite)
In `mobile-barber/mobile-barber-dashboard.js`:
- `showBookingAlert(booking)` (~line 1936) — ephemeral popup with type title via `t('newBookingAlertTitle')`,
  View/Dismiss buttons, native `Notification`, 45s auto-dismiss.
- `handleBookingAlert(booking, changeType)` (~1983) — initial-snapshot seeding + dedupe
  via `markBookingNotified` / `shouldAlertForBooking`.
- `playBookingChime()` (~1219), `unlockSoundAlerts()` (~1190), `state.soundReady` / `state.soundBlocked`,
  `renderNotificationControls()`.
- Owner detection: `state.ownerId`, `state.ownerMode` (set via `OwnerModel.resolveOwnerId` /
  `ownerHasMultipleBusinesses`, ~909-920), `OwnerBookings.load` / `OwnerBookings.barberVendorIdsFor`.
- `renderServiceTypeFilter()` (~2035) — owner-only All/Barber/Ride/Tour tab bar already built.
- `t(key)` i18n lookup, `STORAGE` keys object (~line 6), `readJson`/`writeJson`, `el()` DOM helper,
  `viewBooking(id)`, `OwnerModel.serviceBucket()`.

## GAP 1 — Multi-source owner booking listener
`subscribeBookingAlerts()` (~1997) currently attaches ONE `onSnapshot` to
`DATA.COLLECTIONS.bookings` filtered by `vendorId`. That is correct for a single-service
vendor and MUST stay unchanged for that path.

Add an owner branch: when `state.ownerMode` is true, instead of (or in addition to) the
single-vendor listener, attach one `onSnapshot` listener PER SOURCE:
| Source | Query | Bucket |
|---|---|---|
| `mobileBarberBookings` | `where vendorId == <each id from OwnerBookings.barberVendorIdsFor(ownerId)>` | barber |
| `bookings` | `where ownerId == <ownerId>` | ride/tour via `OwnerModel.serviceBucket()` |
| `travel_bookings` | `where ownerId == <ownerId>` | tour |

Rules:
- **Single equality + `limit` only** — must hit Firestore's automatic single-field index.
  A composite-index error must be impossible. Do NOT add `.orderBy()` to the owner queries
  if it would require a composite index (the existing single-vendor listener uses
  `.orderBy('createdAt')` + a `.limit`-only fallback on error — mirror that fallback pattern,
  or omit orderBy for owner queries and sort client-side).
- Each listener seeds its OWN initial snapshot silently (mark existing docs notified via the
  existing seeding flag pattern — no popup/sound/inbox spam on load), then alerts only on
  genuinely new `added`/status-change docs.
- Reuse `handleBookingAlert` → `showBookingAlert` + `playBookingChime` for popups/sound.
- Store all unsubscribe fns and tear them down on portal close / re-subscribe (no leaks).
- Debounce the list refresh (`loadBookings().then(renderBookings)`) ~250ms across sources.

## GAP 2 — Persisted bell + drawer inbox (owner mode only)
Add a notification-center inbox on top of the popups:
- **Bell** in the dashboard hero (owner mode ONLY; never for single-service vendors) with an
  unread-count badge. New markup id `mbNotifBell` + `mbNotifBadge` in `dashboard.html`.
- **Drawer** (`mbNotifDrawer` + `mbNotifList`): title, "Mark all read", close, filter tabs
  (All / Barber / Ride / Tour), scrollable list. Each item: type icon, title, compact
  values-only message, unread dot. Clicking an item marks it read and opens the booking row
  via `viewBooking` (switch the service-type filter so the row is in scope).
- **Inbox model** (`addNotification`, `renderNotificationDrawer`, mark-read/mark-all):
  entry shape `{ id, ownerId, serviceType, bookingId, sourceCollection, title, message,
  status, read, createdAt }`. Dedupe key / `id` = `serviceType + ':' + bookingId`
  (same key used for `notifiedBookingIds`), so a booking can never create two inbox rows
  even after reload (initial-snapshot seeding skips already-seeded docs).
- Persist to `localStorage` key `dlc_mobile_barber_owner_notifications_<ownerId>`, cap ~120
  entries; rehydrate on load so unread persists across reloads.
- First bell tap also acts as an iOS audio-unlock gesture (`if (!state.soundReady) unlockSoundAlerts()`).
- The compact `message` must be values-only (`customer • service • date • time • status`) — no
  hardcoded field labels — so it stays language-safe.

## Mandatory rules (CLAUDE.md — non-negotiable)
- **Mobile-first**: bell/drawer must work and look correct at 375px AND 1280px (drawer = full
  bottom/side sheet on mobile, side panel ≥768px). Same code path both.
- **NO hardcoded user-facing strings in any language.** Every new label (bell aria, drawer
  title, "Mark all read", filter tabs, type titles) goes through `t(key)` with vi + en + es
  entries added together in the dashboard i18n table. Never write a literal string into the DOM.
- **`?v=` cache-busting**: bump `mobile-barber-dashboard.js` (and `mobile-barber.css` if you edit
  it) in EVERY HTML consumer (`grep -rn "mobile-barber-dashboard.js" --include="*.html"`) to a
  version string NEVER used before — verify against `git log --all`. Current dashboard.js
  high-water in `dashboard.html` is `?v=20260528s`; today is 2026-05-29, so use `20260529a`
  or higher (and a letter not already taken on that date).
- Run `scripts/ai/full_system_dry_run.sh` → must be **FINAL: PASS**. `node --check` the edited
  JS. `node tests/runner.js`. Add/extend tests where feasible (e.g. dedupe key shape, owner vs
  single-vendor branch selection, inbox cap) — note any that need a live Firestore session.

## Do NOT break / do NOT touch
- Single-service vendor dashboard path (e.g. Tim): original `subscribeBookingAlerts` vendorId
  listener, NO bell, NO inbox — must be byte-for-byte behavior-identical.
- Luxurious Nails (`nailsalon/`) and `driver-admin.html` / compliance gates — unrelated, do not touch.
- Booking CREATION paths (barber/ride/tour) and the conflict guard — listeners are READ-ONLY,
  change no write path and no Cloud Function.
- Vendor data isolation — owner listeners only read the owner's own vendor ids / ownerId.
- No deploy, no push, no commit. No Firestore composite-index requirement.

## Report
Update `docs/unified_owner_notifications_phase2.md` so it reflects the ACTUAL final state
(distinguish what pre-existed from the two gaps you built), list every file changed, the exact
version-string bumps, test results, do-not-break verification, and an honest PASS/BLOCKED status
(interactive popup/sound/drawer with real bookings requires an authenticated live Firestore
session — mark that BLOCKED, do not claim PASS).
