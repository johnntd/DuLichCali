# Production-Failed Fix — Double Booking in "Upcoming" + Missing Notification Badge

**Date:** 2026-05-31
**Trigger:** On-device iPhone screenshot (vendor portal) — *failing evidence*, overriding the prior code-level PASS.

## Failing evidence (screenshot)
The Michael vendor portal showed **"Sắp tới (2)"** (Upcoming = 2) with **two overlapping cards** for the same customer/time:
- John Nguyen · 2026-06-01 · 9:35 AM · Huntington Beach 92647 · Classic Haircut — **ĐÃ XÁC NHẬN** (confirmed)
- John Nguyen · 2026-06-01 · 9:35 AM · Huntington Beach 92647 · Line Up — **VENDOR XEM XÉT** (vendor_review)

Two actionable Upcoming cards for the same slot = a visible double-booking. And **no unread badge** on the bell.

---

## Why the previous fix didn't show on-device (root causes)

The earlier change auto-declined only **`pending`** overlaps and verified behavior at the code/live-smoke level. Five real gaps remained, all confirmed against the source:

| # | Root cause | File:line |
|---|---|---|
| 1 | **Server trigger early-returns on `vendor_review`** (`if (status === 'vendor_review') return`). A booking created *as* vendor_review (client guard / agent) never reached the conflict sweep, so it was never auto-declined — it stayed vendor_review (the screenshot's Line Up). | `functions/index.js:3173` |
| 2 | **`isUpcomingBooking()` only excluded `cancelled`/`completed`** — so `vendor_review` (and declined) bookings counted as Upcoming. | `mobile-barber-dashboard.js:1645` |
| 3 | **`isInactiveStatus()` listed `rejected` but NOT `declined`** — yet the server writes `status:'declined'`. A server-auto-declined booking was therefore treated as *active* and would itself slip into Upcoming. | `mobile-barber-dashboard.js:1318` |
| 4 | **`statusBucket()` had no `declined` case** (fell through to `pending`) and **`STATUS_LABELS`** had no `declined` key (labeled it "Pending confirmation") — wrong color + wrong label. | `mobile-barber-dashboard.js:1817,935` |
| 5 | **Badge only populated from LIVE alerts.** The initial-snapshot guard suppressed notifications for existing bookings, and nothing seeded the count on load → badge empty on every refresh / PWA resume. | `mobile-barber-dashboard.js:2756,3751` |

---

## Fixes

### Double booking — never an actionable Upcoming card
- **Server (`functions/index.js`)** — removed the `vendor_review` early-return; a vendor_review booking now runs the same owner-wide conflict sweep and **auto-declines** (`status:'declined'`, `declineReason:'time_conflict'`, `conflictBookingId`) when it truly overlaps an earlier booking. Still race-safe (earliest by `createTime` stands; update ≠ create so no loop).
- **`isInactiveStatus()`** — added `'declined'` so a server-declined booking is terminal (like `rejected`/`cancelled`) and drops out of the active set entirely.
- **`isUpcomingBooking()`** — rewritten to exclude **every terminal status AND `vendor_review`**. A conflict/review booking lives in the **Pending/Review** bucket (`pendingRows` still includes `vendor_review`), never in Upcoming. → **Upcoming count = 1.**
- **`statusBucket()`** — `declined` → `cancelled` (red) bucket; **`STATUS_LABELS`** — `declined` → `statusRejected`.
- **Card label** — a time-conflict decline renders a bold red **"DECLINED — TIME CONFLICT"** chip (`statusDeclinedTimeConflict`, vi/en/es) via a new `.mb-status-pill--conflict` style.

### Notification badge — visible, seeded, persistent
- New **`seedInitialNotifications()`** (called in `init()` after the first render) seeds the unread count from existing **actionable** bookings (`pending_confirmation` / `pending_barber_confirmation` / `vendor_review`). Idempotent (dedupes by booking key; bookings already in the persisted list keep their read/unread state), so the badge:
  - shows the count on first load / refresh / PWA resume (not just live alerts),
  - persists after refresh until marked read,
  - is scoped to `ownerId || vendorId` (Tim/Michael isolated),
  - works for any vendor (decoupled from `ownerMode` in the prior fix).

---

## Files changed
| File | Change |
|---|---|
| `functions/index.js` | trigger no longer skips `vendor_review` — conflict-checks + auto-declines it |
| `mobile-barber/mobile-barber-dashboard.js` | `isInactiveStatus`+`declined`; `isUpcomingBooking` excludes vendor_review+terminal; `statusBucket`/`STATUS_LABELS` declined; conflict pill label; `seedInitialNotifications()` + init call; vi/en/es `statusDeclinedTimeConflict` |
| `mobile-barber/mobile-barber.css` | `.mb-status-pill--conflict` (bold red) |
| `mobile-barber/dashboard.html` | `mobile-barber-dashboard.js?v=20260531d`, `mobile-barber.css?v=20260531b` |
| `mobile-barber/index.html`, `mobile-barber/vendor.html` | `mobile-barber.css?v=20260531b` |
| `tests/lib/mobile-barber-landing.js` | trigger-no-skip assertion; new dashboard-Upcoming/badge regression test; version fixtures |

## Tests
`node tests/runner.js` → **547 / 547 pass** (new test locks: `declined` terminal, Upcoming excludes vendor_review, `declined`→cancelled bucket, `seedInitialNotifications` present + called, conflict label in 3 languages).

## On-device production tests (the ones that count)
**Double booking**
1. Create booking 9:35. 2. Create overlapping 9:35. 3. Refresh.
- Upcoming count = **1** (only the booking that stands). Second is **not** an Upcoming card.
- New overlaps end up `status:'declined'` (Functions log `[booking-write-blocked]`), bucketed/labeled **DECLINED — TIME CONFLICT** if viewed. A pre-existing `vendor_review` overlap shows in **Cần xem xét/Pending**, not Upcoming.

**Badge**
1. New booking → bell badge **1**. 2. Another → **2**. 3. Refresh → still **2** until marked read. (Console `[notification-count]`.)

## PASS criteria
PASS only after the screenshot-level behavior is fixed on iPhone: Upcoming shows a single active booking per slot, conflicts are out of Upcoming (auto-declined / in Review), and the bell shows a persistent unread count. Verify on-device.
