# Mobile Barber — Dashboard Clickable Summary Filters

**Date:** 2026-05-27
**Status:** ✅ Shipped to production (`https://www.dulichcali21.com/mobile-barber/dashboard.html`)

---

## Goal

Turn the 5 summary counter cards at the top of the vendor dashboard from
static numbers into clickable filters that drive a single dynamic appointment
list below. Single-selection, gold-glow active state, mobile + desktop parity.

---

## Before / after

### Before

```
┌────────────────────────────────────────────────────────────┐
│  [Today]  [Upcoming]  [Pending]  [In Progress] [Completed] │   ← static counters
└────────────────────────────────────────────────────────────┘

┌─── Today's appointments ──┐  ┌─── Pending confirmations ──┐
│  (list)                   │  │  (list)                    │
└───────────────────────────┘  └────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Upcoming  [Upcoming][All][Completed][Cancelled]             │   ← filter chips
│  (list)                                                       │
└──────────────────────────────────────────────────────────────┘
```

Operator had to scroll past two list panels + a chip row to choose between
five overlapping booking views.

### After

```
┌──────────────────────────────────────────────────────────────┐
│  [TODAY ●][Upcoming][Pending][In Progress][Completed today]  │   ← clickable filters
└──────────────────────────────────────────────────────────────┘

┌─── Appointments — Today (3) ────────────────── [ ↻ Refresh ]─┐
│  Showing appointments scheduled for today.                    │
│  (single dynamic list, driven by the active card above)       │
└──────────────────────────────────────────────────────────────┘
```

One filter row, one list, one source of truth. Default selection is `today`
so the dashboard opens to "what do I need to do now?"

---

## How it works

### Markup

Each card is a real `<button>` (not a div), with:

```html
<button class="mb-dashboard-stats__article [--active]"
        type="button"
        role="tab"
        aria-selected="true|false"
        data-summary-filter="today | upcoming | pending | in_progress | completed_today">
  <span data-i18n="statToday">Today</span>
  <strong id="mbStatToday">3</strong>
</button>
```

The 5 cards together form a `role="tablist"`; the appointment panel below is
the implicit tabpanel. ARIA + keyboard (`Enter` / `Space`) handled.

### State + filter logic

`mobile-barber-dashboard.js`:

```js
state.summaryFilter = 'today';   // default

function bookingsForSummaryFilter(filter, now) {
  // today           → active.requestedDate === today
  // upcoming        → active && start >= now (excludes today's past slots)
  // pending         → status in {pending_confirmation,
  //                              pending_barber_confirmation, vendor_review}
  // in_progress     → status in {in_progress, traveling}
  // completed_today → status === 'completed' && requestedDate === today
  //                   (sorted most-recent first)
}

function renderBookings() {
  // 1. compute all 5 buckets
  // 2. update all 5 counters (always live, regardless of active filter)
  // 3. pick rows = bookingsForSummaryFilter(state.summaryFilter)
  // 4. renderBookingList('mbAppointmentList', rows)
  // 5. set dynamic header: "Appointments — Today (3)"
  // 6. set hint copy
  // 7. toggle active class + aria-selected across cards
}

function setSummaryFilter(filter) {
  state.summaryFilter = filter;
  state.expandedBookingId = null;   // collapse any open detail row
  renderBookings();
  // optional: scroll list into view politely (no jump on desktop)
}
```

### UX rules implemented

| Rule | Implementation |
|---|---|
| Click card → list updates | `setSummaryFilter()` re-renders the single list |
| Active card highlight | `.mb-dashboard-stats__article--active` + gold gradient + 3px halo box-shadow |
| Same gold glow style | Reuses existing `rgba(245, 166, 35, ...)` palette + `var(--gold-lt)` |
| Single-selection mode | `renderBookings()` toggles the class on all 5 cards each frame; only one can be active |
| Auto-refresh appointment list | `setSummaryFilter` calls `renderBookings()` |
| Counters stay synced | All 5 buckets are recomputed every render; counters reflect ALL bookings regardless of which filter is active |
| Scroll list into view | `list.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` after each click (no-op when already visible) |
| Desktop + mobile parity | Same code path; CSS grid `auto-fit minmax(120px, 1fr)` flows 5→3→2 columns as the viewport shrinks |
| Keyboard | `Enter` and `Space` keys on each card trigger `setSummaryFilter` |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { transition: none }` |

### CSS active state (gold glow)

```css
.mb-dashboard-stats__article--active {
  border-color: rgba(245, 166, 35, .9);
  background:
    linear-gradient(135deg, rgba(245, 166, 35, .18), rgba(255, 200, 87, .08)),
    rgba(245, 166, 35, .04);
  box-shadow:
    0 0 0 3px rgba(245, 166, 35, .22),
    0 8px 22px rgba(245, 166, 35, .18);
}
.mb-dashboard-stats__article--active span,
.mb-dashboard-stats__article--active strong {
  color: var(--gold-lt);
}
```

Hover state previews the gold accent without committing:

```css
.mb-dashboard-stats__article:hover {
  border-color: rgba(245, 166, 35, .55);
  background: rgba(245, 166, 35, .06);
}
```

---

## What got removed (intentionally consolidated)

| Removed | Reason | Replaced by |
|---|---|---|
| `<div id="mbTodayList">` panel | Cards now show Today count + open the today view | Single `mbAppointmentList` + `data-summary-filter="today"` card |
| `<div id="mbPendingList">` panel | Same | `data-summary-filter="pending"` card |
| `<div id="mbUpcomingList">` panel | Same | `data-summary-filter="upcoming"` card |
| `mbBookingFilters` chip row (`Upcoming / All / Completed / Cancelled`) | Redundant once the cards are filters | Cards (note: "All" and "Cancelled" views are not directly exposed — see Remaining Risks) |

The underlying `state.bookingFilter` + `filteredBookings()` helper are
retained (untouched) since other code paths and tests still reference them;
they're just no longer wired into the dashboard UI.

`renderBookingList(id, rows)` was made null-safe (early-return when the
target node doesn't exist) so any legacy caller (e.g. a future re-render of
a list that no longer ships in the DOM) silently no-ops instead of throwing.

---

## i18n keys added (en / vi / es)

| Key | EN | VI | ES |
|---|---|---|---|
| `appointmentListTitle` | Appointments | Lịch hẹn | Citas |
| `appointmentListHint` | Tap a card above to switch the list. | Bấm thẻ ở trên để chuyển danh sách. | Toca una tarjeta arriba para cambiar la lista. |
| `appointmentListHintToday` | Showing appointments scheduled for today. | Hiển thị lịch hẹn cho hôm nay. | Mostrando citas programadas para hoy. |
| `appointmentListHintUpcoming` | Showing future bookings not yet started. | Hiển thị lịch sắp tới chưa bắt đầu. | Mostrando reservas futuras aún no iniciadas. |
| `appointmentListHintPending` | Showing requests waiting for your confirmation. | Hiển thị yêu cầu đang chờ bạn xác nhận. | Mostrando solicitudes esperando tu confirmación. |
| `appointmentListHintInProgress` | Showing appointments currently in progress or traveling. | Hiển thị lịch đang làm hoặc đang trên đường. | Mostrando citas en curso o en camino. |
| `appointmentListHintCompleted` | Showing today's completed appointments. | Hiển thị lịch đã hoàn tất hôm nay. | Mostrando las citas completadas de hoy. |

The dynamic header re-uses the existing `statToday` / `statUpcoming` /
`statPending` / `statInProgress` / `statCompleted` keys plus a `(count)`
suffix, e.g. `Appointments — Today (3)`.

---

## Files changed

```
 mobile-barber/dashboard.html             |  -25 / +27   (5 buttons + dynamic panel)
 mobile-barber/mobile-barber-dashboard.js |  +120        (state + bucket helper + render rewrite + bind + i18n × 3)
 mobile-barber/mobile-barber.css          |   +60        (button reset, hover, focus, --active gold halo)
 mobile-barber/index.html                 |    1 line    (css version bump)
 mobile-barber/vendor.html                |    1 line    (css version bump)
 tests/lib/mobile-barber-landing.js       |   ~12 lines  (new id + filter assertions, version bumps)
```

---

## Tests

```
$ node tests/lib/mobile-barber-data-model.js
Mobile Barber data model tests: 12 passed, 0 failed

$ node tests/lib/mobile-barber-agent.js
Mobile Barber agent tests: 29 passed, 0 failed

$ node tests/lib/mobile-barber-landing.js (via runner)
PASS 35 / FAIL 0

$ scripts/ai/full_system_dry_run.sh
FINAL: PASS

$ node --check mobile-barber/mobile-barber-dashboard.js
syntax OK
```

---

## Production deploy verification

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete

$ curl -sL "https://www.dulichcali21.com/mobile-barber/dashboard.html" \
    | grep -E "data-summary-filter|mbAppointmentList|v=20260527"
  <link rel="stylesheet" href="/mobile-barber/mobile-barber.css?v=20260527c">
  <button ... data-summary-filter="today">
  <button ... data-summary-filter="upcoming">
  <button ... data-summary-filter="pending">
  <button ... data-summary-filter="in_progress">
  <button ... data-summary-filter="completed_today">
  <section class="mb-dashboard-panel mb-dashboard-appointments" ...>
  <div ... id="mbAppointmentList"></div>
```

✔ Production updated — https://www.dulichcali21.com

---

## What did NOT change (per spec)

- Booking DB writes (Firestore `mobileBarberBookings` rules + statuses) — untouched
- Appointment status updates (Accept / Reject / Reschedule / Cancel / Mark paid / Mark unpaid / Cash / Zelle / Payment note) — same actions, same Firestore writes, same emitter logic
- Service editor, working-hours editor, blocks editor, portfolio uploader, review responses — all still in the collapsed Settings accordion shipped in the previous cycle
- AI routing engine (`BOOKING.findVendorForAddress`) — untouched
- Voice mode, Gemini Vietnamese voice — untouched
- Customer-facing landing (`/mobile-barber`) — untouched
- Vendor customer page (`/mobile-barber/vendor/...`) — untouched

---

## Remaining risks

1. **`All` and `Cancelled` views are no longer one click away.** The previous
   chip row exposed `Upcoming / All / Completed / Cancelled`; the new card
   row exposes `Today / Upcoming / Pending / In progress / Completed today`.
   If an operator needs to see cancelled bookings, no UI is currently bound
   to that. Mitigation: the underlying `filteredBookings()` helper still
   supports `cancelled` — adding a 6th card or re-introducing the chips is a
   ~5-line follow-up.
2. **`Completed today` is scoped to today only.** Historical completed
   bookings (yesterday and earlier) are not in any card. Same mitigation as
   above — add a "Completed (all)" card if needed.
3. **Default selection is `today`.** A vendor opening the dashboard on a day
   off with zero appointments will see an empty-state card. The 4 other cards
   still display their live counts so the empty state is informative, not
   confusing.
4. **Card grid uses `auto-fit minmax(120px, 1fr)`** which can wrap to 3+2 on
   very narrow viewports (~375px). Each card stays ≥120px wide so the count
   text remains readable; tap targets stay ≥44px height via existing padding.
5. **Polite scroll-into-view** uses `block: 'nearest'` so it never jumps when
   the list is already visible. On a long-scroll mobile view, the operator
   may want a more pronounced jump — acceptable trade-off for desktop UX.
