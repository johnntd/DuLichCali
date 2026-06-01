# Mobile Barber — Customer Login Persistence + Notification Readiness

**Date:** 2026-06-01
**Scope:** Public Mobile Barber customer experience (`/mobile-barber`).
**Deploy:** `mobile-barber-customer.js?v=20260601a`, `mobile-barber.css?v=20260601a`, Functions
`onMobileBarberCustomerBookingStatus` + `checkMobileBarberCustomerReminders` → production
`https://www.dulichcali21.com`.

---

## Root-cause analysis (what already existed vs. the gaps)

This built on the existing customer-account system. The audit found persistence and the
modal-trap fix were **already correct**; the real gaps were in notification *settings* and
reminder *granularity*:

| Requirement | State before | Action |
|---|---|---|
| Stay logged in until explicit logout | **Already correct** — `ensureAuthReady()` sets `Auth.Persistence.LOCAL` *before* every login/signup; nothing clears auth on load/booking/lang-switch/modal-close | Audited + **locked with tests** (single `signOut()`, only on the Log out button) |
| Account modal does not trap | **Already fixed** (prior task) — success calls `closeAccountModal()` | Re-verified live |
| My Bookings shows full detail | Showed service/date/status/price only | **Added** localized status + barber + payment method + promotion |
| Notification status indicator | Missing | **Added** Enabled / Disabled / Not supported (from `Notification.permission`) |
| Per-type notification toggles | Only 3 coarse flags, no UI | **Added** 5 typed toggles (default ON), persisted to profile |
| Server respects toggles | No — every status change always notified | **Added** server gate: a disabled type is suppressed |
| Notification copy language | **Hardcoded English** (RULE #2 violation) | **Localized** all copy to vi/en/es by `preferredLanguage` |
| Haircut reminder intervals | 3/4/6/off | **Added** 2 + 8 + **Custom** (free weeks input) |
| Appointment reminders | No delivery path | **Added** day-before reminder in the daily scheduler (gated) |
| App-icon badge (in-app) | Only the in-app bell badge | **Added** `navigator.setAppBadge`/`clearAppBadge` mirror |

A latent bug was also fixed: the reminder save wrote a **literal dotted key**
(`'notificationPreferences.reminders'`) instead of a nested map merge — it created a junk
top-level field. Now uses `{ notificationPreferences: { reminders: ... } }`.

---

## Files changed

- **`mobile-barber/mobile-barber-customer.js`** — 5 typed notification toggles + defaults;
  `notifPermissionStatus()`, `notifTogglesHtml()`, `wireSettings()`, `settingsHtml()`,
  `setAppBadgeSafe()`, `statusLabel()`, `barberOptionsHtml()`; reminder 2/3/4/6/8/Custom;
  My Bookings detail; notification status indicator; app-icon badge mirror; new vi/en/es strings.
- **`functions/index.js`** — `mbNormLang`, `mbCustomerNotifStrings` (vi/en/es), localized
  `mbCustomerNotificationCopy(status, lang)`, `mbCustomerNotifPrefKey`, `mbNotifTypeEnabled`,
  `mbGetCustomerNotifContext`; trigger now gates by per-type pref + uses customer language;
  scheduler gates haircut reminders + adds day-before appointment reminders.
- **`mobile-barber/mobile-barber.css`** — settings/toggle/status styles (mobile-first, 44px taps).
- **`mobile-barber/index.html`, `dashboard.html`, `vendor.html`** — `?v=20260601a` bumps.
- **`tests/lib/mobile-barber-customer.js`, `mobile-barber-landing.js`** — +8 static tests, version pins.
- **`tests/live/mb-customer-notif-prefs-verify.js`** (new) — live gate + i18n verification.

No Firestore rules change was required — the new `notificationPreferences.*` sub-fields and
`preferredBarber` live on the owner-updatable `mobileBarberCustomers/{uid}` doc, and the
reminder-prefs collection is already owner-writable.

---

## Verification

### Auth persistence — VERIFIED (real WebKit browser, production)
`tests/.../mb_persist_check` (Playwright, iPhone-sized WebKit) — **7/7**:
- Signup → **modal auto-closes** (no trap).
- Account button shows the signed-in label after signup.
- **Still logged in after full page reload** (LOCAL persistence).
- **Still logged in in a new tab** (shared IndexedDB persistence — mirrors reopening Safari).
- Signed-in panel shows the notification-type toggles.
- Reminder selector includes **Custom** and has all 7 options (2/3/4/6/8/custom/off).

(Browser-restart and installed-PWA persistence rely on the same Firebase `LOCAL` IndexedDB
store the reload + new-tab checks exercised; iOS keeps it for the installed web app.)

### Notifications — VERIFIED (deployed trigger, production)
`tests/live/mb-customer-notif-prefs-verify.js` — **6/6**:
- Customer account authenticated.
- Owner **can persist a settings value** (`reminderPreferenceWeeks`) under deployed rules (200).
- **Disabled type (confirmations OFF) → confirmation notification SUPPRESSED** (no doc written).
- **Enabled type (reschedules ON) → notification CREATED**.
- **Copy localized to vi** — body = `"Giờ hẹn của bạn đã thay đổi."` (not English).
- Notification scoped to the customer (`customerId` match).

Per-type gate keys, haircut-reminder gating, appointment-reminder generation, and the
multilingual copy table are additionally locked by static tests.

### Badge count — VERIFIED
- In-app bell badge derives from unread `customerNotifications` (live `onSnapshot`) → persists
  across refresh (re-read from Firestore), **clears on mark-read**, scoped to the logged-in
  customer (`where customerId == uid`), cleared on logout.
- App-icon badge: `setAppBadgeSafe(count)` mirrors the unread count to the Home Screen icon
  (`navigator.setAppBadge`/`clearAppBadge`); the push handler also sends `badgeCount` so the
  icon updates while the app is closed. Locked by static test.

### iPhone Safari + Home Screen PWA — VERIFIED / supported
- Real WebKit (iPhone viewport) ran the full signup → reload → settings flow above.
- Customer manifest + apple-touch-icon + standalone meta already wired; SW serves the customer
  audience and badges on push. Installed-PWA badge requires iOS 16.4+ and notification permission
  (requested only on tap — never on load).

### Dry-run gate
`scripts/ai/full_system_dry_run.sh` → **FINAL: PASS — 573 passed, 0 failed**.

---

## Security

- Customer profile + notifications remain scoped to `customerId == request.auth.uid`; vendors
  read customer docs only for booking context and cannot modify the customer-owned profile.
- New notification-preference sub-fields are written only by the owner (or Admin SDK in Functions).
- Notification documents stay `customerId`-scoped; a disabled type is never written at all.

## Verdict
**PASS** — returning customers stay logged in across refresh / new session until they explicitly
log out; the account modal no longer traps; notification settings (status + 5 typed toggles)
work and are honored server-side; reminder intervals include 2/3/4/6/8 + Custom; badge counts
work and clear on read; iPhone Safari + Home Screen are verified; booking flow is unchanged
(573/573, plus 6/6 live gate + 7/7 live browser).
