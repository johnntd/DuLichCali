# Phase 1 — Portal Kit (reusable vendor/operator portal framework)

Implement the shared **Portal Kit**: a portal-agnostic, themable framework extracted from the Mobile Barber vendor portal patterns. It will be consumed first by the new Driver portal (Phase 2) and later by food/nails/tour portals. **Create the six new files only. Do NOT modify Mobile Barber, the driver portal, or any existing page in this phase.**

Read these reference files first (the patterns to generalize), but do NOT edit them:
- `mobile-barber/mobile-barber-pwa.js` — SW registration (lines 25–26, 66–71), VAPID subscribe (24, 80–99), `isStandalone`.
- `mobile-barber/sw.js` — cache strategy (17–106): network-only Firebase (`isApiRequest`), network-first HTML, cache-first static, activate-purge; push + notificationclick (108–154).
- `mobile-barber/mobile-barber-dashboard.js` — auth gate `runGate` transient-tolerant (3875–3935); notification center: `subscribeBookingAlerts` (2954–2991), `handleBookingAlert` (2828–2842), `shouldAlertForBooking` (2598–2613), de-dup `markBookingNotified` (2585–2596), `playBookingChime` (1626–1662), `unlockSoundAlerts` (1597–1624), badge `setAppIconBadge` (1468–1475), drawer `renderNotificationDrawer` (1477–1583), counters/filters `renderBookings`/`setSummaryFilter` (3104–3148, 3762–3771), card expand `toggleBookingRow` (2565–2568).
- `mobile-barber/dashboard.html` — head meta/manifest (1–29); counter bar (70–91); settings `<details>` accordions (102–291); notif drawer markup (294–307).

## Objective
Create `portal-kit/` with six self-contained files. Each JS file is an **IIFE exposing a single global** (`window.PortalPWA`, `PortalAuth`, `PortalNotify`, `PortalShell`). No build step. No ES modules. Must work with the Firebase v9.22.0 **compat** SDK already used across the project.

### 1. `portal-kit/portal-kit.css`
Themable shared styles. Define a `:root` token block: `--pk-bg`, `--pk-surface`, `--pk-navy:#0d2f50`, `--pk-gold:#ffcc44`, `--pk-accent` (defaults; consumers override per portal), `--pk-text`, `--pk-muted`, `--pk-danger`, `--pk-radius`, plus status colors `--pk-pending/--pk-active/--pk-progress/--pk-done/--pk-cancelled`. Provide classes (prefix `.pk-`):
- shell: `.pk-shell` (max-width 1120px, centered, safe-area insets), `.pk-hero`, `.pk-topbar`, `.pk-lang`.
- counters: `.pk-stats` (scroll-snap row of buttons), `.pk-stat`, `.pk-stat--active`, `.pk-stat__num`, `.pk-stat__label`.
- filters: `.pk-chips`, `.pk-chip`, `.pk-chip--active`.
- cards: `.pk-card`, `.pk-card--expanded`, `.pk-card__head` (button), `.pk-card__row`, `.pk-status` + `.pk-status--{pending,active,progress,done,cancelled}`, `.pk-card__detail` (hidden unless expanded), `.pk-card__actions`, `.pk-btn`, `.pk-btn--primary`, `.pk-btn--ghost`, `.pk-btn--danger`, `.pk-btn--sm`.
- drawer/toast: `.pk-notif-bell`, `.pk-notif-badge`, `.pk-drawer`, `.pk-drawer__backdrop`, `.pk-drawer__panel`, `.pk-notif-item`, `.pk-notif-item--unread`, `.pk-toast`.
- accordions: `.pk-accordion` (style native `<details>`/`<summary>`), `.pk-accordion__chevron`.
Mobile-first base, then `@media (min-width:768px)` (2-col settings grid, larger type) and `@media (min-width:1200px)` (roomier shell, multi-column counters). No hardcoded user-facing text.

### 2. `portal-kit/portal-pwa.js` → `window.PortalPWA`
- `PortalPWA.register({swUrl, scope})` → registers the service worker at the given scope; returns the registration (resolves null, never throws, if unsupported).
- `PortalPWA.isStandalone()` → boolean (display-mode standalone or iOS `navigator.standalone`).
- `PortalPWA.setBadge(n)` / `PortalPWA.clearBadge()` → wrap `navigator.setAppBadge`/`clearAppBadge` in try/catch (no-op if unsupported).
- `PortalPWA.subscribePush({vapidPublicKey})` → requests `Notification.requestPermission()`, gets/creates a PushManager subscription via the registered SW, returns the subscription JSON `{endpoint, keys}` (or null). Include a base64url→Uint8Array helper for the VAPID key.
- `PortalPWA.unsubscribePush()` → unsubscribes; returns boolean.
Storage of the subscription is the **caller's** job (different collections per portal). Guard every Web API (`serviceWorker`, `Notification`, `PushManager`).

### 3. `portal-kit/portal-auth.js` → `window.PortalAuth`
The **transient-tolerant session gate** (the correctness-critical pattern; do NOT abstract credential UI).
- `PortalAuth.enableLocalPersistence(firebaseAuth)` → `setPersistence(LOCAL)` wrapped in try/catch.
- `PortalAuth.guard({ auth, readContext, isValid, onReady, onReject, maxDelayMs })`:
  - On `onAuthStateChanged`: if no user → `onReject('no_user')`.
  - Else call `readContext(user)` (a Promise resolving the gate data, e.g. `{userDoc, entityDoc}`).
  - On resolve: call `isValid(data, user)` → if it returns a truthy "ok" → `onReady(data, user)`; if it returns a definitive rejection reason (string) → `auth.signOut()` then `onReject(reason)`.
  - On **read error** (network/offline/cold-start): DO NOT sign out, DO NOT reject — retry `readContext` with exponential backoff capped at `maxDelayMs` (default 15000), keeping the session intact. Mirror `runGate` in `mobile-barber-dashboard.js:3881-3935`.

### 4. `portal-kit/portal-notify.js` → `window.PortalNotify`
Client Notification Center (foreground; distinct from server `notifications.js`).
- `PortalNotify.init({ listeners, scopeId, storagePrefix, dedupeKeyFn, statusWhitelist, renderItem, onOpenItem, sound, els })` where:
  - `listeners`: array of `{ query, mapDoc }` — each is a Firestore query to `onSnapshot`; `mapDoc(docData, docId)` → a normalized notification `{id, title, message, kind, status, bookingId, raw}`.
  - `dedupeKeyFn(item)` → unique key; persisted set in `localStorage[storagePrefix+'_notified_'+scopeId]` (trim to ~80).
  - `statusWhitelist`: statuses that should raise an alert (e.g. ride: `['offered_to_driver','assigned','new']`).
  - Initial-snapshot suppression: on each listener's first snapshot, mark existing as notified but do NOT pop/sound (mirror `bookingAlertInitialSnapshot`).
  - `renderItem(item)` → drawer row HTML; `onOpenItem(item)` → caller opens the related booking.
  - Persist the notifications list in `localStorage[storagePrefix+'_list_'+scopeId]` (trim ~120) so unread count survives refresh.
- Methods: `enableAlerts()` (gesture-unlock AudioContext + `Notification.requestPermission`; persist `on` flag), `playChime()` (3-oscillator ascending chime like `playBookingChime`), `openDrawer()`/`closeDrawer()`, `markRead(id)`, `markAllRead()`, `unreadCount()`, `refreshBadge()` (in-app `.pk-notif-badge` text + `PortalPWA.setBadge`).
- `els`: `{ bell, badge, drawer, list, enableBtn }` DOM refs supplied by the caller.

### 5. `portal-kit/portal-shell.js` → `window.PortalShell`
Headless UI primitives (domain lives in caller callbacks):
- `PortalShell.summaryCounters({ mount, tabs, activeKey, onSelect })` — `tabs:[{key,label,count}]` → renders `.pk-stats` of `.pk-stat` buttons; toggles `--active`; click → `onSelect(key)`.
- `PortalShell.filterChips({ mount, chips, activeKey, onSelect })` — same shape with `.pk-chips`.
- `PortalShell.cardList({ mount, items, renderCollapsed, renderExpanded, expandedId, onToggle })` — renders `.pk-card` per item; head button calls `onToggle(item.id)`; when `item.id===expandedId` render `renderExpanded(item)` into `.pk-card__detail` and add `--expanded`. Accordions use native `<details class="pk-accordion">` (no JS needed).
All renderers return HTML strings or accept a container; sanitize via `textContent` where inserting dynamic values (no raw innerHTML of user data).

### 6. `portal-kit/portal-sw-core.js`
Service-worker core, imported by each portal's own `sw.js` via `importScripts`. Reads `self.PORTAL_SW_CONFIG = { cacheVersion, shellUrls, startUrl, scope }` (the portal's `sw.js` sets this BEFORE importScripts). Implement (mirror `mobile-barber/sw.js`):
- `install`: precache `shellUrls` individually (tolerate 404s), `skipWaiting`.
- `activate`: delete old caches with the portal's prefix, `clients.claim`.
- `fetch`: network-only for Firebase/Google/auth/functions (`isApiRequest`); network-first for HTML navigations (fallback to cached `startUrl`); cache-first for static assets; network-first otherwise.
- `push`: show notification `{title, body, icon, badge, tag, data:{url}}`; if `data.badgeCount` is a number, `setAppBadge`/`clearAppBadge`.
- `notificationclick`: focus an existing client in scope or `openWindow(data.url || startUrl)`.

## Constraints (project rules — MUST follow)
- **No hardcoded user-facing strings in any language** in the kit (kit is string-free; consumers supply vi/en/es). ARIA labels passed in by caller.
- Mobile-first; include `@media (min-width:768px)` and `(min-width:1200px)` in the CSS.
- IIFE globals; defensive (guard `window.firebase`, Web APIs); fire-and-forget Firestore writes never block UI.
- Do not import or alter Mobile Barber files. Do not register any service worker from the kit itself (the consumer calls `PortalPWA.register`).

## Acceptance
- All six files created under `portal-kit/`. No syntax errors (`node --check portal-kit/portal-pwa.js` etc. for the 4 JS files; `portal-sw-core.js` uses SW globals so wrap a `node --check` only for syntax).
- No existing file changed. `scripts/ai/full_system_dry_run.sh` ends `FINAL: PASS` (regression guard — the kit is not yet loaded anywhere, so existing tests must be unchanged).

## Allowed files
- portal-kit/portal-kit.css
- portal-kit/portal-pwa.js
- portal-kit/portal-auth.js
- portal-kit/portal-notify.js
- portal-kit/portal-shell.js
- portal-kit/portal-sw-core.js
