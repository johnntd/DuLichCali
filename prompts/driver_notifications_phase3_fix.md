# Phase 3 — Driver background web push (best-effort) + subscribe wiring

Foreground notifications (popup/chime/in-app + home-screen badge/drawer/dedup) are ALREADY wired in `driver/driver-portal.js` via `PortalNotify` (Phase 2). This phase adds **best-effort background Web Push** for new ride offers, mirroring the Mobile Barber vendor push. Per the approved design: push is **best-effort, foreground listeners remain primary, and the 35s ride-offer window is NOT changed** — the push deep-links to the dashboard, it must NOT auto-accept an offer.

## IMPORTANT — do NOT run validation yourself
Your ONLY job is to edit the files under "Allowed files". **Do NOT run `scripts/ai/full_system_dry_run.sh`, `npm run test:rules`, `firebase emulators:*`, `firebase deploy`, or start any emulator/server.** Your sandbox cannot bind ports (the Firestore emulator fails with `EPERM` — that is NOT a stop signal); the harness runs the gate afterward. Use `node --check` for syntax if you wish. Make the edits and end.

## MUST read first (mirror these exactly)
- `functions/index.js` — VAPID setup: `VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY')` (line 59), `VAPID_PUBLIC_KEY = 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8'` (line 60). The TEMPLATE function `sendMobileBarberBookingPush` (≈3230–3295): `onDocumentCreated` with `secrets:[VAPID_PRIVATE_KEY]`, `require('web-push')`, `setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, priv)`, read the vendor's `pushSubscriptions` subcollection, `webpush.sendNotification({endpoint,keys}, payload, {TTL:3600})`, prune subs on 404/410. Copy its structure faithfully.
- `functions/index.js` `onDispatchQueue` (≈4032–4109): creates `bookingOffers/{bookingId}` with `{ driverId: selected.id, status:'pending', expiresAt:+35s, ... }` (doc id == bookingId). This is the trigger source.
- `portal-kit/portal-pwa.js` — `PortalPWA.subscribePush({vapidPublicKey})` → resolves the subscription JSON `{endpoint, keys}` (or null); `PortalPWA.unsubscribePush()` → boolean. (Do NOT edit the kit.)
- `driver/driver-portal.js` — current `enableAlerts()` (≈284) and the Alerts accordion; `state.driverId`.

## Deliverables

### A) `functions/index.js` — new `sendDriverRidePush`
Add a new exported Cloud Function (place it right after `sendMobileBarberBookingPush`):
- Trigger: `onDocumentCreated('bookingOffers/{bookingId}', { secrets:[VAPID_PRIVATE_KEY], region:'us-central1' }, ...)`.
- Read the created offer doc: `const offer = event.data.data()`; `const driverId = offer.driverId`; bail if no `driverId`.
- `require('web-push')` (guard if unavailable), `const priv = VAPID_PRIVATE_KEY.value()` (bail with a warn if empty), `webpush.setVapidDetails('mailto:dulichcali21@gmail.com', VAPID_PUBLIC_KEY, priv)`.
- Read `drivers/{driverId}/pushSubscriptions` collection; if empty, return.
- **badgeCount** = (count of `bookingOffers` where `driverId==driverId` AND `status=='pending'`) + (count of `bookings` where `driver.driverId==driverId` AND `status in ['assigned','driver_confirmed']`). Keep the queries small (`.limit(50)` each).
- Payload JSON: `{ title:'New ride offer', body: <short: serviceType/airport + pickup time if present on the offer or its booking>, url:'/driver/dashboard.html', tag:'dlc-ride-offer', audience:'driver', badgeCount }`. (English-only is acceptable for the push title/body fallback — these are rare system messages; if the offer/booking carries a `lang`, you MAY localize, but do not block on it.)
- `webpush.sendNotification({ endpoint:s.endpoint, keys:s.keys }, JSON.stringify(payload), { TTL:3600 })` for each sub; on error with statusCode 404/410, delete that subscription doc (prune). Wrap everything so a failure never throws out of the trigger.
- Do NOT modify `onDispatchQueue`, `acceptOffer`, or the 35s window. This function is purely additive.

### B) `driver/driver-portal.js` — subscribe/unsubscribe wiring
- In `enableAlerts()` (after `PortalNotify.enableAlerts()` resolves): also call `PortalPWA.subscribePush({ vapidPublicKey: 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8' })`. If it resolves a subscription `{endpoint, keys}`, store it at `drivers/{state.driverId}/pushSubscriptions/{hash}` where `{hash}` is a stable hash of the endpoint (small inline hash fn). Store `{ endpoint, keys, uid:auth.currentUser.uid, platform: PortalPWA.isStandalone() ? 'home-screen':'browser', userAgent:(navigator.userAgent||'').slice(0,300), updatedAt: serverTimestamp() }` with `{merge:true}`. Fire-and-forget (`.catch` no-op) — the write may be denied until the Phase 4 rule lands; that must not break the foreground alerts.
- Add a **"Disable push"** action in the Alerts accordion (new `data-action="disablePush"`): calls `PortalPWA.unsubscribePush()` then deletes the matching `pushSubscriptions/{hash}` doc (best-effort), and reflects state in the UI. Add the STRINGS keys (`enablePush`, `disablePush`, `pushEnabled`, `pushDisabled`, `pushUnsupported`) in vi/en/es.
- Replace the existing `pushPlaceholder` action wiring so the "Enable Push" button actually subscribes (reuse `enableAlerts` or a dedicated `enablePush()`), and show a clear status line.
- Keep everything fire-and-forget and defensive (guard missing `PortalPWA`).

### C) `driver/dashboard.html`
- **Bump** `driver/driver-portal.js?v=20260606a` → `?v=20260606b` (cache-busting rule — you changed the JS).
- Ensure the Alerts accordion has the Enable/Disable push controls + a status element the JS targets (add `data-action`/ids as referenced by driver-portal.js). Keep all text via `data-i18n`.

## Dependency note (do NOT act on it here)
The client write to `drivers/{driverId}/pushSubscriptions/{id}` requires a Firestore rule that is added in **Phase 4**. Until then the write is denied and silently ignored (foreground alerts still work). Do NOT edit `firestore.rules` in this phase.

## Constraints
- Do NOT modify `portal-kit/*`, `mobile-barber/*`, `firestore.rules`, or any page other than the driver dashboard.
- No hardcoded user-facing strings in the driver UI (push payload English fallback is allowed as a rare system message).
- Preserve dispatch lifecycle, `acceptOffer`, and the 35s window exactly.
- IIFE/defensive; fire-and-forget writes.

## Acceptance
- `node --check functions/index.js` and `node --check driver/driver-portal.js` pass.
- `sendDriverRidePush` is additive and mirrors `sendMobileBarberBookingPush` (same VAPID secret + public key, web-push, prune).
- Driver dashboard `?v=` bumped for `driver-portal.js`.
- `scripts/ai/full_system_dry_run.sh` ends `FINAL: PASS` (regression guard).

## Allowed files
- functions/index.js
- driver/driver-portal.js
- driver/dashboard.html
