# Phase 2 — Driver Portal rebuilt on the Portal Kit

Rebuild the driver portal as a new PWA app under `/driver/`, built entirely on the **Portal Kit** (`portal-kit/*` from Phase 1), **preserving every existing driver capability** while fixing persistence, adding PWA + a notification center + counters/filters/expand-act cards + settings accordions + full vi/en/es. Old root URLs become redirect stubs so existing links/QR keep working.

## MUST read first (port their behavior faithfully; do not lose features)
- `driver-admin.html` (current portal, 3324 lines) — auth gate (1310–1331), active/rideService toggles, ride offers `rideNotifications` listener (1672) + `bookingOffers` active-offer (2021), accept/skip (2160–2190, skipRide), tours `travelAssignments` (1790) + tour status advance (1990–2000), assigned/active ride + `advanceTripStatus` (2369–2390) with `_TRIP_STATUS_NEXT` (1277–1283), upcoming rides (2622), history (2978), earnings (ride+tour; today/week/month, 3094–3160), ratings, compliance docs (2406–2585 via `driver-compliance.js`), profile save (1492–1534: name/phone/vehicle/regions/weeklySchedule/blackoutDates), GPS toggle + streaming (1560–1599), calendar (1640 via `driver-calendar.js`), driver-targeted notifications feed `where('targetId','==',_driverId)` (3048).
- `driver-login.html` — phone+PIN login: normalize phone (strip leading 1 on 11-digit; 207–211), derived email `d{digits}@dlc.app` (269), password = PIN padded to 6 (265), 10-digit then 11-digit fallback (274–287), `adminStatus` gate (blocked/deactivated/archived → error), `setPersistence(LOCAL)` (162), self-register path (306–315).
- `portal-kit/portal-auth.js`, `portal-notify.js`, `portal-pwa.js`, `portal-shell.js`, `portal-kit.css` — the APIs you must consume (read their exposed methods).
- `mobile-barber/dashboard.html` + `manifest.webmanifest` — the PWA head + manifest pattern to mirror.

## Firebase (compat v9.22.0) — identical to existing driver pages
Both new HTML pages load, in this order in `<head>`:
```
https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js
https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js
https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js
https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js
```
firebaseConfig: `{ apiKey:'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ', authDomain:'dulichcali-booking-calendar.firebaseapp.com', projectId:'dulichcali-booking-calendar', storageBucket:'dulichcali-booking-calendar.appspot.com', messagingSenderId:'623460884698', appId:'1:623460884698:web:a08bd435c453a7b4db05e3' }` then `if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);` (copy the exact authDomain/storageBucket/messagingSenderId from the current `driver-login.html`).

## Deliverables

### `driver/login.html`
- PWA head: `<meta name="theme-color" content="#0d2f50">`, viewport `viewport-fit=cover`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-touch-icon`→`/assets/icons/driver-180.png?v=1`, `<link rel="manifest" href="/driver/manifest.webmanifest">`, favicons → driver-192/512. NO `name`/`apple-mobile-web-app-title`.
- Loads `portal-kit/portal-kit.css?v=20260606a` + Firebase + `portal-kit/portal-auth.js?v=20260606a` + an inline (or `driver-portal.js`-shared) STRINGS table.
- Phone+PIN login UI on the kit styling; `PortalAuth.enableLocalPersistence(firebase.auth())` before sign-in; derive email/password exactly as the current page (incl. 10/11-digit fallback); on success check `driverUsers/{uid}` → `drivers/{driverId}` `adminStatus` (blocked/deactivated/archived → error, else redirect to `/driver/dashboard`). Keep the self-register path if present today. Full vi/en/es.

### `driver/dashboard.html`
- Same PWA head (manifest `/driver/manifest.webmanifest`).
- Load order: Firebase (4 compat SDKs) → `portal-kit/*.js?v=20260606a` → `/driver-calendar.js`, `/driver-compliance.js`, `/ride-booking.js`, `/notifications.js` (bump `?v=` only if you change them — you should NOT) → `/driver/driver-portal.js?v=20260606a`. Link `portal-kit/portal-kit.css` + a small `driver` theme override (`--pk-accent` etc.).
- Body structure using kit classes: `.pk-shell` → topbar (brand, driver name, language switcher vi/en/es, notification bell `.pk-notif-bell` with `.pk-notif-badge`, sign-out) → active/rideService toggle row → "Enable Alerts" button → `.pk-stats` counter mount → `.pk-chips` filter mount → ride/tour card list mount → settings `<details class="pk-accordion">` panels → `.pk-drawer` notification drawer → `.pk-toast`. All visible text via `data-i18n` bound from STRINGS.

### `driver/driver-portal.js`
Driver glue (IIFE). Inline `STRINGS = { en:{...}, vi:{...}, es:{...} }` covering every label/button/status/accordion title (NO hardcoded user-facing strings anywhere else, in any language). `t(key)` + `applyI18n()` binding `[data-i18n]`; `setLang(l)` persists `dlc_lang`+`dlcLang`, re-renders.
- **Auth:** `PortalAuth.enableLocalPersistence` + `PortalAuth.guard({ auth, readContext: user => Promise.all([driverUsers/{uid}.get(), then drivers/{driverId}.get()]), isValid: returns true when driver doc exists and adminStatus is active; returns a string reason ('blocked'|'deactivated'|'archived'|'not_found') when a SUCCESSFUL read is definitively bad; onReady → init(driverId, driverData); onReject(reason) → redirect to /driver/login (preserving nothing sensitive) })`. Resolve `driverId = driverUsers.driverId || uid` (== uid in practice). **Never sign out on a transient read error** (the guard handles this).
- **PWA:** `PortalPWA.register({ swUrl:'/driver/sw.js', scope:'/driver/' })`. Wire "Enable Alerts" → `PortalNotify.enableAlerts()` (Phase 3 adds push subscribe).
- **Feeds → PortalNotify.init** with listeners (each `{query, mapDoc}`): (1) `rideNotifications.where('status','in',['new','accepted'])` (the broadcast offer pool — keep as-is), (2) `bookingOffers.where('driverId','==',driverId).where('status','==','pending')` (targeted active offer), (3) `bookings.where('driver.driverId','==',driverId)` (assigned/active), (4) `travelAssignments.where('travel_driver_id','in',travelDriverIds)` (tours), (5) the driver-targeted notifications feed `where('targetId','==',driverId)`. `dedupeKeyFn` = collection+id; `statusWhitelist` includes new/offered_to_driver/assigned plus tour-assigned. `scopeId`=driverId, `storagePrefix`='dlc_driver'.
- **Counters (PortalShell.summaryCounters)** over assigned rides+tours: **Today** (status in active set AND pickup date == today), **Upcoming** (assigned/driver_confirmed, future), **Pending** (`offered_to_driver` offers + new `rideNotifications` awaiting response), **In Progress** (`on_the_way`/`arrived`/`in_progress`), **Completed Today** (`completed` today). Clicking a counter sets the active filter and re-renders the list.
- **Filters (PortalShell.filterChips):** All / Rides / Tours (+ reuse counter as filter). 
- **Cards (PortalShell.cardList):**
  - Collapsed: status pill (`.pk-status--*`), pickup time, customer name, pickup city (short), destination (short), passengers/luggage summary.
  - Expanded: customer phone, full pickup address, full dropoff address, date/time, flight info (airport rides), passengers + luggage, fare/estimate + notes; action buttons → **Map** + **Navigate** (`RideIntake`/`ride-booking.js` `generateMapLink`/`generateNavLink`), **Accept** (offer → `firebase.functions().httpsCallable('acceptOffer')({bookingId})`; on `offer_not_pending` show a friendly "ride already taken" toast), **Decline/Skip** (mirror current skip), **Advance status** button using `_TRIP_STATUS_NEXT` {assigned→on_the_way→arrived→in_progress→completed} writing `{status,statusUpdatedAt,statusUpdatedBy:'driver:'+driverId,statusHistory:arrayUnion(...)}` + `DLCNotifications.queueStatusChangeNotification`, **Call** (`tel:`), **Text** (`sms:`). Tours: confirm/picked-up/start/complete via `travelAssignments` updates as today.
- **Settings accordions** (native `<details class="pk-accordion">`): Profile & contact (name, phone), Vehicle (make/model/year/color/seats/plate), Service regions (Bay Area / Orange County), Working hours (7-day weeklySchedule), Blackout dates, Compliance documents (render+submit via `driver-compliance.js` exactly as today → `driver_compliance/{driverId}` + mirror expiry fields on `drivers/{driverId}`), Alerts (sound on/off via PortalNotify, Enable Push placeholder), Language, GPS sharing toggle (stream to `drivers/{driverId}.driverLat/driverLng/driverLocAt` as today). Save profile to `drivers/{driverId}` (same fields as current `doSave`).
- **Earnings + ratings + calendar:** keep a section/accordion that renders earnings (ride+tour, today/week/month) and ratings as today, and the weekly calendar via `DLCCalendar.renderCalendar(tours, rides)` (`driver-calendar.js`).
- **active/rideService toggles:** write `drivers/{driverId}.active` / `.rideServiceEnabled` as today.

### `driver/manifest.webmanifest`
`{ description, id:'/driver/dashboard.html', start_url:'/driver/dashboard.html', scope:'/driver/', display:'standalone', orientation:'portrait', background_color:'#0d2f50', theme_color:'#0d2f50', lang:'en', categories:['business','travel','productivity'], prefer_related_applications:false, icons:[192 any, 512 any, maskable 512] → /assets/icons/driver-192.png?v=1, driver-512.png?v=1, driver-maskable-512.png?v=1 }`. NO `name`/`short_name` (driver names own Home-Screen icon).

### `driver/sw.js`
```
self.PORTAL_SW_CONFIG = { cacheVersion:'driver-v1-20260606a', scope:'/driver/', startUrl:'/driver/dashboard.html',
  shellUrls:['/driver/dashboard.html','/driver/login.html','/driver/manifest.webmanifest',
             '/assets/icons/driver-192.png','/assets/icons/driver-512.png',
             '/portal-kit/portal-kit.css','/portal-kit/portal-pwa.js','/portal-kit/portal-auth.js',
             '/portal-kit/portal-notify.js','/portal-kit/portal-shell.js'] };
importScripts('/portal-kit/portal-sw-core.js?v=20260606a');
```

### Redirect stubs (preserve existing URLs / QR)
Replace `driver-admin.html` and `driver-login.html` with tiny HTML that JS-redirects (preserving `location.search`+`location.hash`) to `/driver/dashboard` and `/driver/login` respectively, with a `<noscript>` meta-refresh fallback and a manual link. (No driver PWA is installed today, so this is safe.)

### `firebase.json`
- Add rewrites: `{ "source":"/driver", "destination":"/driver/dashboard.html" }`, `{ "source":"/driver/login", "destination":"/driver/login.html" }` (place BEFORE any catch-all; keep existing rewrites).
- Add a headers block for `/driver/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /driver/` (mirror the existing `/mobile-barber/sw.js` block) so the global immutable js/css header doesn't freeze the SW.

## Constraints (MUST follow)
- **No hardcoded user-facing strings in any language** — everything via STRINGS (vi+en+es in the same change). Admin/operational labels included.
- Mobile-first; verify layout at 375 and 1280 (kit CSS handles breakpoints).
- **Do NOT modify** any `mobile-barber/*` file, `portal-kit/*` (Phase 1 frozen), `functions/index.js`, `firestore.rules` (those are Phase 3/4). Reuse `driver-calendar.js`/`driver-compliance.js`/`ride-booking.js`/`notifications.js` WITHOUT editing them.
- Preserve the ride dispatch lifecycle and `acceptOffer`/status semantics exactly.
- IIFE; defensive; fire-and-forget writes.

## Acceptance
- `node --check driver/driver-portal.js` and `driver/sw.js` pass; HTML well-formed.
- `/driver/login.html` and `/driver/dashboard.html` load with no console errors (against the real Firebase project; unauthenticated → login screen shows; the dashboard gate redirects to login when signed out and does NOT redirect on a transient read error).
- Every current capability is present (offers, accept/skip, tours, status advance, upcoming, history, earnings, ratings, compliance, profile/vehicle/regions/hours/blackouts, GPS, calendar) plus the new counters/filters/expand-act cards/accordions/notification center/PWA/i18n.
- `scripts/ai/full_system_dry_run.sh` ends `FINAL: PASS` (regression guard — existing tests unaffected).

## Allowed files
- driver/dashboard.html
- driver/login.html
- driver/driver-portal.js
- driver/manifest.webmanifest
- driver/sw.js
- driver-admin.html
- driver-login.html
- firebase.json
