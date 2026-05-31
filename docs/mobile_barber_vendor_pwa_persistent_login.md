# Mobile Barber Vendor Portal — PWA, Persistent Login & Booking Alerts

**Date:** 2026-05-31
**Target:** `mobile-barber/dashboard.html` (+ supporting files)
**Goal:** Installable iOS Home Screen web app that stays logged in, shows a proper
Mobile Barber icon, opens standalone, and is ready to receive booking push alerts —
for Michael, Tim, and any future vendor.

---

## What shipped

### 1. Branded app icon (proper, square, readable)
Generated barber-pole icons (navy `#061b33`, red/white/blue striped cylinder, gold caps):
- `assets/icons/mobile-barber-vendor-180.png` (apple-touch-icon)
- `assets/icons/mobile-barber-vendor-192.png`
- `assets/icons/mobile-barber-vendor-512.png`
- `assets/icons/mobile-barber-vendor-maskable-512.png` (safe-zone maskable)

### 2. PWA manifest → standalone install
`mobile-barber/manifest.webmanifest`:
- `name`: *DuLichCali Mobile Barber Vendor*, `short_name`: *Barber Vendor*
- `start_url`: `/mobile-barber/dashboard.html`, `scope`: `/mobile-barber/`
- `display: standalone`, `background_color`/`theme_color`: `#061b33`
- icons: 192 (any), 512 (any), 512 (maskable)

### 3. iOS meta tags (`dashboard.html` head)
`apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title=Barber Vendor`,
`apple-mobile-web-app-status-bar-style=black-translucent`, `mobile-web-app-capable=yes`,
`theme-color=#061b33`, `<link rel="manifest">`, and apple-touch-icon / icon links.

### 4. Persistent login (the core fix)
- **`setPersistence(LOCAL)`** is forced in `gateAndInit` (and in the in-app login),
  so the vendor portal never uses session-only auth and never logs out on refresh.
- **`getVendorId()` resumes the last vendor** from `localStorage` — the Home Screen app
  launches `start_url` with no query param, so this is what lets it re-open the right
  vendor and stay logged in.
- **In-scope login screen** (`MBVendorPWA.showLogin`): the gate previously redirected to
  `/vendor-login.html`, which is **outside** the `/mobile-barber/` PWA scope — on iOS that
  opens Safari, so the login would not persist back into the installed app. In standalone
  mode the gate now shows an **in-app email+password login** (email/password, LOCAL
  persistence, reload on success). First-time PIN setup still links to the full
  `/vendor-login.html`. Browser (non-installed) flow is unchanged.
- No auth/localStorage is cleared during dashboard load.

> **iOS note (expected):** Safari and the Home Screen app have separate storage. After
> *Add to Home Screen*, the vendor logs in **once from the Home Screen app**; from then on
> the session persists across launches until explicit logout.

### 5. Service worker (`mobile-barber/sw.js`, scope `/mobile-barber/`)
- App-shell cache (dashboard + manifest + icons) for instant, offline-resilient launch.
- **Network-only for Firebase/Google/API requests** — never serves stale bookings/promos.
- Cache-first for static assets (icons/css/fonts); network-first for HTML + versioned `.js`.
- Safe versioning (`CACHE_VERSION`): old caches purged on `activate`.
- `firebase.json` serves `sw.js` **no-cache** (+ `Service-Worker-Allowed`) so SW updates load.
- Handles `push` (showNotification) and `notificationclick` (focus/open the portal).

### 6. Booking alerts (iOS-compatible Web Push) — `mobile-barber/mobile-barber-pwa.js`
- New **"Enable Booking Alerts"** button in the Booking-alerts panel.
- Requests Notification permission **only on tap**, registers a **Web Push (VAPID)**
  subscription via the service worker, and stores it scoped to the vendor.
- **Fallback copy** when push is unsupported (iOS Safari tab): *"Add this portal to your
  Home Screen to enable push alerts (iOS 16.4+). Until then, keep it open for live alerts."*
- The existing in-app **sound + toast** (`unlockSoundAlerts` / `playBookingChime`) and the
  **"Enable Sound Alerts"** button are kept working unchanged — that already satisfies the
  "enable alert sound / unlock on gesture" requirement.

### 7. Send side — `functions/index.js` → `sendMobileBarberBookingPush`
Fires on each new `mobileBarberBookings/{id}`; reads the vendor's
`mobileBarberVendors/{vendorId}/pushSubscriptions`, sends a Web Push via `web-push`
(VAPID), and prunes dead (404/410) subscriptions. VAPID **public** key is shipped in the
client; **private** key is the `VAPID_PRIVATE_KEY` Functions secret.

### 8. Security
- VAPID **public** key only in client JS; **private** key is a Functions secret (never committed).
- Firestore rule: `mobileBarberVendors/{vid}/pushSubscriptions/{id}` is read/write **only**
  for `isVendorMember(vid) || isAdmin()` — **a customer can never register as a recipient.**
- Subscription writes carry `uid` + `vendorId`; the send function uses the Admin SDK.

---

## Files changed / added
| File | Change |
|---|---|
| `assets/icons/mobile-barber-vendor-{180,192,512,maskable-512}.png` | new branded icons |
| `mobile-barber/manifest.webmanifest` | new PWA manifest |
| `mobile-barber/sw.js` | new service worker |
| `mobile-barber/mobile-barber-pwa.js` | new — SW reg, push subscribe, in-app login |
| `mobile-barber/dashboard.html` | PWA head meta, alerts button, load pwa.js, version bumps |
| `mobile-barber/mobile-barber-dashboard.js` | LOCAL persistence, vendorId resume, in-scope login hook |
| `firestore.rules` | `pushSubscriptions` subcollection rule (vendor-scoped) |
| `firebase.json` | `sw.js` no-cache + `.webmanifest` content-type |
| `functions/index.js` + `functions/package.json` | `sendMobileBarberBookingPush` + `web-push` dep + `VAPID_PRIVATE_KEY` |

---

## Test checklist (run on a real iPhone — these are device tests)
| # | Test | How verified |
|---|---|---|
| 1 | Add dashboard to iPhone Home Screen | manual (device) |
| 2 | Open Home Screen app | manual |
| 3 | Login once (in-app login screen) | manual |
| 4 | Close app fully | manual |
| 5 | Reopen app | manual |
| 6 | Vendor remains logged in | manual — backed by `setPersistence(LOCAL)` + vendorId resume |
| 7 | Icon displays correctly on Home Screen | manual — icons + apple-touch-icon shipped |
| 8 | Opens standalone (not a Safari tab) | manual — `display:standalone` + apple meta |
| 9 | "Enable Booking Alerts" button appears | ✅ in the alert panel |
| 10 | Enable sound works after tap | ✅ existing `unlockSoundAlerts` (kept) |
| 11 | New booking → in-app toast + sound | ✅ existing `addNotification` + `playBookingChime` |
| 12 | If push supported, subscription is saved | ✅ stored at `…/pushSubscriptions/{id}` (rule-scoped) |
| 13 | If push unsupported, fallback message appears | ✅ fallback copy in the alert panel |

Server-side `sendMobileBarberBookingPush` is unit-safe (Admin SDK + `web-push`); end-to-end
push delivery to an installed iOS PWA must be confirmed on-device (tests 1–8).

---

## Deploy
```
firebase functions:secrets:set VAPID_PRIVATE_KEY   # done (v1)
firebase deploy --only firestore:rules,hosting,functions:sendMobileBarberBookingPush
```

## Remaining (on-device)
- Add to Home Screen on an iOS 16.4+ iPhone, log in once in the app, tap **Enable Booking
  Alerts**, grant permission, then create a test booking to confirm a push arrives while the
  app is closed. (Browser tabs on iOS will show the fallback message — expected.)
