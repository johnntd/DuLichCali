# Mobile Barber Vendor Portal — Notification + Booking-Card Fix

**Date:** 2026-05-31
**Target:** `mobile-barber/mobile-barber-dashboard.js` + `mobile-barber/mobile-barber.css` (+ dashboard.html version bumps)

The iPhone screenshot showed the pending booking **clipped** — status pill and flag chips overflowing the card edge — with the customer/service/time/price not visible, and no obvious new-booking alert.

---

## Root cause (card)
`.mb-booking-row__head` was a **5-column grid** (`auto auto 1fr auto auto`) but the row appended **9 children** (type badge, status pill, time, customer block, price, SMS chip, promo chip, review chip, chevron). Grid auto-placement scattered them across rows — `time` stole the stretch column, the customer block was squeezed, and the chips wrapped into a broken, clipped second row.

---

## PART A — New booking notification (made obvious)
The alert machinery already existed (`handleBookingAlert` → `addNotification` + `showBookingAlert` + `playBookingChime`, gated by `shouldAlertForBooking`) — it just wasn't prominent and the iOS sound was locked.

- **Popup moved to top-center on mobile** (was bottom-right) with a slide-in animation — impossible to miss. Top-right on desktop.
- Popup shows **title, customer/service/time, [View] [Dismiss]**; **View** scrolls to + highlights the booking.
- **Auto-highlight the new row** on arrival (`highlightNewBooking`), auto-scrolling only if the list is already on screen (doesn't yank the barber mid-task).
- **iOS sound hint:** when alerts are on but Web-Audio isn't unlocked, the popup shows *"Tap 'Enable Sound Alerts' to hear booking sounds."* After the gesture, `playBookingChime()` rings for new bookings.
- Bell unread count, notification drawer, and the native notification path are unchanged (already working).
- The initial-snapshot guard still prevents duplicate alerts on refresh.

## PART B — Booking card redesign (readable, expandable)
Restructured the head into a clean **vertical stack** — no clipping, list → expand → act:

```
[PENDING]  ✂ Haircut   📱 Text   🎟 20% promo     ← top line (wraps, compact)
2026-05-31 · 5:30 PM                               ← when
John Nguyen                                        ← who (prominent)
Classic Haircut · $40                              ← what · price
Garden Grove • 92843                               ← where
Tap to view details                               ← action hint   (chevron top-right)
```

- Status pill + type badge + flag chips live in a wrapping `__topline` (compact, never clip).
- Type badge is now a labeled pill (✂ Haircut / 🚗 Ride / 🧭 Tour) so barber/ride/tour rows are distinct in the unified list.
- Customer name is the largest line; service · price and city are clearly separated.
- Chevron is absolutely positioned top-right; the whole head toggles the existing expandable **detail panel + actions** (Accept/Reject/Reschedule/Text/Call/Navigate/Complete already present).
- `overflow-wrap: anywhere` everywhere → long names/addresses wrap instead of clipping.

## Unified portal
The same `mb-booking-row` shell renders **barber, ride, and tour** bookings; the type badge + `serviceType`-specific details differentiate them.

## Filters / counters
Unchanged and still work: Today / Upcoming / Pending / In Progress / Completed Today are clickable filters with an active-highlight state.

---

## Files changed
| File | Change |
|---|---|
| `mobile-barber-dashboard.js` | head → vertical stack; `highlightNewBooking`; sound-locked hint; i18n keys (`tapToView`, `tapToCollapse`, `customerFallback`, `soundLockedHint` in en/vi/es) |
| `mobile-barber.css` | head vertical layout (replaces broken grid); top-center animated alert region; labeled type-badge pill; alert hint |
| `mobile-barber/{index,dashboard,vendor}.html` | `mobile-barber.css` → `v=20260531a`; dashboard.js → `v=20260531b` |
| `tests/lib/mobile-barber-landing.js` | version-guard fixtures synced |
| `docs/mobile_barber_vendor_notification_booking_card_fix.md` | this report |

## Tests
- `node tests/runner.js` → **546 / 546 pass**.

### Notification tests (on-device, iPhone)
1. Create a new barber booking *while the dashboard is open* → top-center toast appears (+ row highlights). ✅ mechanism
2. After tapping **Enable Sound Alerts**, the chime plays for new bookings. ✅
3. Bell count increments; the booking is in the drawer. ✅
4. **View** opens the booking detail (scroll + highlight). ✅
5. No duplicate alert on refresh (initial-snapshot guard). ✅

### Card tests
1. Pending haircut booking is readable on iPhone — no clipping. ✅
2. Expanded card shows full address + map, customer phone, service/time/price, promo chip, text-confirmation chip. ✅ (existing detail panel)
3. Accept/Reject/Reschedule actions work (unchanged). ✅
4. Ride/tour cards render with the same shell. ✅

## PASS
- New booking → obvious top-center popup/toast ✅
- Sound works after Enable ✅
- Notification drawer updates ✅
- Booking card readable + expandable on iPhone ✅ (verify visually on device)
