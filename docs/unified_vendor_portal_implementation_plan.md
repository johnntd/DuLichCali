# Unified Vendor Portal Framework — Implementation Plan (Phase 0–4)

**Date:** 2026-06-06
**Companion to:** `docs/unified_vendor_portal_design_review.md` (GO with conditions — approved)
**Execution model:** Codex‑Claude loop (`scripts/ai/ai_dev_loop.sh prompts/<phase>_fix.md`) — Codex implements, Anthropic API reviews, test gate enforced. **No git push. No production deploy.** Firestore rules validated in the emulator before PASS.

**Approved decisions:**
- **D1:** Keep the 35s ride-offer window. Web push = **best-effort**; foreground `onSnapshot` is the **primary** path; **do not change the dispatch lifecycle.**
- **D2:** Driver `update` is **field-pinned**. Drivers may write ONLY: `status` (allowed transitions), `statusUpdatedAt`, `statusUpdatedBy`, `statusHistory`, `acceptedAt`, `startedAt`, `completedAt`, `driverNotes`. They may **NOT** write: `paymentStatus`, price/fare fields, `driver`/`currentOfferDriverId`/`assignedDriverId`, `ownerId`, customer info, admin/internal notes.

**Non-negotiables:** Keep Mobile Barber (`mobile-barber/*`) untouched & working; keep **Michael's unified owner portal** working (barber by `vendorId`, ride+tour by `ownerId`, compat scan); keep customer booking / ride / tour / salon / food working; keep future driver/vendor portals supported.

---

## Phase 0 — Pre-flight findings (COMPLETE ✅)

| Item | Finding | Source |
|---|---|---|
| Assigned-driver field | **nested `driver.driverId`** (NOT top-level) | `functions/index.js:4150`; `driver-admin.html:2230,2623,2978,3102` |
| `driverId` vs `uid` | **`driverId === uid`** always | `admin.html:2700-2704`, `driver-login.html:308-315` |
| Ride status lifecycle | `dispatching → offered_to_driver → assigned → driver_confirmed → on_the_way → arrived → in_progress → completed` (+ `cancelled`/`rejected`/`no_show`) | `driver-admin.html:2228`, `functions/index.js:4101,4144` |
| Dispatch feeds | broadcast pool `rideNotifications` (`status in ['new','accepted']`) + targeted `bookingOffers` (`driverId==uid && status=='pending'`, 35s) + assigned `bookings` (`driver.driverId==uid`) + tours `travelAssignments` (`travel_driver_id in [...]`) | census |
| Driver status writes | `{status, statusUpdatedAt, statusUpdatedBy, statusHistory}` | `driver-admin.html:2369-2386` |
| Customer auth | **anonymous** (`signInAnonymously`) → list-rule tightening is zero-regression (current rule already requires non-anonymous) | `script.js:11`, `travel.html`, `airport.html`, `tracking.html` |
| Tour driver isolation | drivers read tours via `travelAssignments.travel_driver_id`, NOT by listing `travel_bookings` | census |
| Tooling | `npm run test:rules` → emulator (`tests/rules/firestore-rules.test.js`, `@firebase/rules-unit-testing`), `full_system_dry_run.sh`, Codex loop, PIL 12.2, firebase-tools 14.12 | — |
| Baseline dry-run | **`FINAL: PASS`** (8/8, 0 fail) | this session |
| Driver icons | generated: `assets/icons/driver-{180,192,512,maskable-512}.png` via `generate_driver_icons.py` (shuttle on navy→ocean + gold) | this session ✅ |

---

## Phase 1 — Portal Kit (`prompts/portal_kit_phase1_fix.md`)

**Deliverables (new, portal-agnostic, themable, IIFE globals):**
- `portal-kit/portal-kit.css` — tokens (`--pk-accent`, `--pk-bg`, `--pk-navy`, `--pk-gold`…) + shell, summary-counter bar, filter chips, expand/collapse cards, notification drawer, toast, native `<details>` accordions. Mobile-first base + `@media (min-width:768px)` + `(min-width:1200px)`.
- `portal-kit/portal-pwa.js` — `PortalPWA.init({swUrl,scope,vapidPublicKey,subscribe})`: SW registration (scoped), install/standalone detection, `setAppBadge`/`clearAppBadge` wrapper, VAPID `subscribe()`/`unsubscribe()` returning the subscription (storage handled by caller).
- `portal-kit/portal-auth.js` — `PortalAuth.enableLocalPersistence(firebase)` + `PortalAuth.guard({auth,readContext,isValid,onReady,onReject})`: **transient-tolerant** gate — `setPersistence(LOCAL)`, sign out / reject ONLY on a *successful* read that's definitively invalid; retry with capped backoff on read error (keeps session). NOT credential UI.
- `portal-kit/portal-notify.js` — `PortalNotify.init({listeners[],dedupeKeyFn,statusWhitelist,renderItem,scopeId,storagePrefix,sound,onOpenItem})`: client Notification Center — N `onSnapshot` listeners → toast/popup + AudioContext chime (gesture-unlocked) + in-app badge + `setAppBadge` + drawer (mark-read/mark-all) + de-dup (initial-snapshot suppression + localStorage `notified` set). Distinct from server `notifications.js`.
- `portal-kit/portal-shell.js` — headless primitives: `summaryCounters({mount,tabs,onSelect})`, `filterChips({mount,chips,onSelect})`, `cardList({mount,items,renderCollapsed,renderExpanded,expandedId,onToggle})`. Domain lives in caller render callbacks.
- `portal-kit/portal-sw-core.js` — SW core imported by each portal's `sw.js`: versioned cache, **network-only Firebase/Google**, **network-first HTML**, **cache-first static**, old-cache purge, `push` + `notificationclick` (audience-aware, deep-links to start URL). Config via `self.PORTAL_SW_CONFIG`.

**Acceptance:** modules load without error in a throwaway harness; no console errors; `portal-kit.css` renders the shell at 375/768/1280; full vi/en/es support carried by the consuming portal (kit is string-free except ARIA). `full_system_dry_run.sh` → `FINAL: PASS` (regression guard).

**Allowed files:** the six `portal-kit/*` files only.

---

## Phase 2 — Driver portal on the kit (`prompts/driver_portal_phase2_fix.md`)

**Deliverables (new `/driver/` app, scope `/driver/`):**
- `driver/dashboard.html`, `driver/login.html` — thin HTML on Portal Kit; theme `#0d2f50` + gold; apple meta tags; manifest link; **no** `name`/`short_name`/`apple-mobile-web-app-title` (driver names own icon); apple-touch-icon → `/assets/icons/driver-180.png`.
- `driver/driver-portal.js` — driver glue: inline `STRINGS` (vi/en/es); **transient-tolerant** auth via `PortalAuth.guard` (collections `driverUsers`/`drivers`, `adminStatus` gate); phone+PIN→`d{digits}@dlc.app` login in `login.html`; the 4 existing feeds (rideNotifications pool, bookingOffers, assigned `bookings` via `driver.driverId==uid`, `travelAssignments`); counters **Today / Upcoming / Pending / In Progress / Completed Today**; clickable filters; **list→expand→act** ride cards; settings accordions (Profile, Vehicle, Regions, Hours, Blackouts, Compliance, Alerts, Language, GPS); actions: accept (`acceptOffer` callable) / decline / advance status (`assigned→…→completed`) / call / text / map / navigate.
- `driver/manifest.webmanifest` (scope `/driver/`, start_url `/driver/dashboard.html`, theme `#0d2f50`, icons 192/512/maskable), `driver/sw.js` (sets `self.PORTAL_SW_CONFIG` then `importScripts('/portal-kit/portal-sw-core.js?v=…')`).
- Reuse: `driver-calendar.js`, `driver-compliance.js`, `ride-booking.js` (map/nav).
- Convert `driver-admin.html` + `driver-login.html` → **redirect stubs** to `/driver/dashboard` / `/driver/login` (preserve query/hash); no driver PWA installed today.
- `firebase.json` — rewrites `/driver`→`/driver/dashboard.html`, `/driver/login`→`/driver/login.html`; **new header block** for `/driver/sw.js` (`no-cache` + `Service-Worker-Allowed:/driver/`) so the global immutable js/css header doesn't freeze the SW.

**Acceptance (local `http://localhost:8080/driver/`):** login persists across refresh; **transient Firestore failure does NOT log out** (D3 fix); counters/filters/expand-act all work; existing dispatch feeds still function (offer accept/decline, status advance, tours); vi/en/es switch; mobile 375 + desktop 1280; Mobile Barber + owner portal unaffected; `full_system_dry_run.sh` → `FINAL: PASS`.

**Allowed files:** `driver/*` (new), `driver-admin.html`, `driver-login.html`, `firebase.json`, `index.html`/landing files **only if** a driver-portal link must be added (otherwise none).

---

## Phase 3 — Notifications (`prompts/driver_notifications_phase3_fix.md`)

**Foreground (no backend):** wire `PortalNotify` in `driver-portal.js` — popup + chime (after "Enable Alerts") + in-app badge + `setAppBadge` + drawer + de-dup, across the 4 feeds. **Primary path.**

**Background web push (best-effort, D1):**
- `functions/index.js` — `sendDriverRidePush`: onCreate `bookingOffers/{id}` → read `drivers/{driverId}/pushSubscriptions/*` → VAPID push `{title, body, url:'/driver/dashboard.html', badgeCount}` (badge = count of the driver's pending offers + assigned-unconfirmed) → prune 404/410. Mirrors `sendMobileBarberBookingPush`. Deep-links to the **dashboard**, NOT an auto-accept (avoids the 35s race). Also reconcile badge on app open.
- `driver-portal.js` — store subscription at `drivers/{driverId}/pushSubscriptions/{hash}` on "Enable Alerts"; "Disable push" removes it; graceful "ride already taken" on expired offers.

**Acceptance:** foreground popup+chime+badge locally; `sendDriverRidePush` lints/builds (`cd functions && npm run lint` if present); push payload unit-shaped; expired-offer path returns a clean message; `full_system_dry_run.sh` → `FINAL: PASS`. **No Functions deploy** (gated).

**Allowed files:** `driver/driver-portal.js`, `portal-kit/portal-notify.js` (if tweaks), `functions/index.js`.

---

## Phase 4 — Firestore rules + emulator tests (`prompts/driver_firestore_rules_phase4_fix.md`)

**`firestore.rules` changes (exact):**
```firestore
function isAssignedDriver() {
  return request.auth != null
      && 'driver' in resource.data
      && resource.data.driver.driverId == request.auth.uid;          // driverId == uid (verified)
}
function isPortalVendorUser() {
  return request.auth != null
      && request.auth.token.firebase.sign_in_provider != 'anonymous'
      && exists(/databases/$(database)/documents/vendorUsers/$(request.auth.uid));  // Michael (owner) + vendors
}
function driverUpdateFieldsOk() {
  return request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status','statusUpdatedAt','statusUpdatedBy','statusHistory',
                     'acceptedAt','startedAt','completedAt','driverNotes']);
}

match /bookings/{doc=**} {
  allow create: if true;
  allow get:    if request.auth != null;                              // unchanged (anon customer tracking)
  allow list:   if isAdmin() || isPortalVendorUser() || isAssignedDriver();
  allow update: if isAdmin() || isPortalVendorUser()
             || (isAssignedDriver() && driverUpdateFieldsOk());        // D2 field-pinning
  allow delete: if isAdmin();
}
// /travel_bookings: list/update = isAdmin() || isPortalVendorUser()   (drivers use travelAssignments; owner uses ownerId + compat)
match /travelAssignments/{docId} {
  allow read:  if isAdmin() || isPortalVendorUser()
            || (request.auth != null && resource.data.travel_driver_id == request.auth.uid);
  allow write: if false;                                              // Admin SDK only
}
match /drivers/{driverId}/pushSubscriptions/{subId} {
  allow read, write: if request.auth != null && request.auth.uid == driverId;
}
```

**Emulator tests (extend `tests/rules/firestore-rules.test.js`) — must all pass:**
- Driver D lists `bookings.where('driver.driverId','==',D)` → **ALLOW**; unconstrained `bookings` list → **DENY**; `where('driver.driverId','==',other)` → **DENY**.
- Driver D updates own booking `{status, statusUpdatedAt}` → **ALLOW**; updates `{paymentStatus}`/`{driver}`/`{ownerId}`/price → **DENY**; updates unassigned booking → **DENY**.
- **Michael** (vendorUser) lists `bookings.where('ownerId','==','michael-nguyen')` → **ALLOW**; `travel_bookings.where('ownerId',…)` → **ALLOW**; unfiltered `travel_bookings` compat scan → **ALLOW**; `mobileBarberBookings.where('vendorId',…)` → **ALLOW** (unchanged).
- Anonymous customer: `create` booking → **ALLOW**; `get` by id (tracking) → **ALLOW**; `list` → **DENY** (unchanged).
- `travelAssignments`: driver reads own (`travel_driver_id==uid`) → **ALLOW**; another driver's → **DENY**; admin/owner → **ALLOW**.
- `drivers/{D}/pushSubscriptions`: D writes own → **ALLOW**; another uid → **DENY**.

**Acceptance:** `npm run test:rules` → all green (new + existing); `full_system_dry_run.sh` → `FINAL: PASS`. **No rules deploy** (gated on explicit OK).

**Allowed files:** `firestore.rules`, `tests/rules/firestore-rules.test.js`.

---

## Phase 5 — Future portals (DOCUMENT ONLY, after 1–4)
`docs/unified_vendor_portal_pwa_framework.md` — final report: files changed, PWA/manifest/icon changes, auth-persistence behavior, notification/badge behavior, iOS Home-Screen notes, migration playbook for food (`vendor-admin.html`), nails (`salon-admin.html`), tour — each adopts its own scope folder + manifest + `portal-sw-core` + inline `STRINGS` + the transient-tolerant gate, with the Driver portal as the worked example. Tests run; PASS/BLOCKED.

---

## Execution order & gates
1. Phase 1 → loop → dry-run PASS.
2. Phase 2 → loop → local manual checks + dry-run PASS.
3. Phase 3 → loop → foreground checks + dry-run PASS (no Functions deploy).
4. Phase 4 → loop → **emulator rules tests green** + dry-run PASS (no rules deploy).
5. Phase 5 → report.
6. Full validation matrix (design-review §9) on mobile + desktop.
7. **STOP — request explicit confirmation before any deploy** (Hosting, Functions, rules).

Each phase prompt is filename‑`fix` (full dry-run gate) and carries a `## Allowed files` scope list. Run sequentially; do not start the next phase until the current reports `FINAL: PASS`.
