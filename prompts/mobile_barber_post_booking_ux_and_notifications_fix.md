# Mobile Barber — Post-Booking UX + Notification Pipeline Fix

Production booking flow saves to Firestore correctly, but the UX after success and the customer/vendor notification channels are insufficient. Customers cannot tell if a booking was placed. Vendors do not receive timely notice. Duplicate submits are possible.

Fix all four issues below in a single coordinated patch.

---

## ISSUE 1 — CRITICAL: prevent duplicate submits + show a clean success state

### Current behavior

After `confirmManualBooking()` succeeds, `renderFinalBookingSummary()` writes the summary into `#mbBookingSummary`, but the form (service dropdown, step navigation) and the orange "Xác nhận đặt lịch" / "Confirm Booking" button stay visible. The user can click Confirm again and `BOOKING.saveBooking` will create a second document with the same ID overwrite or a new ID, depending on rebuild — at minimum the user is confused; at worst a duplicate booking is created.

### Required fix

On successful Firestore write:

- Hide the entire booking form (service dropdown + all 4 step containers + step nav)
- Hide the Confirm button + Back button
- Show ONLY a clean confirmation card containing:
  - Title — "Booking confirmed" / "Đã xác nhận đặt lịch" / "Reserva confirmada"
  - Booking ID (large, copyable)
  - Customer, barber, service, date/time, address, price summary (already in `renderFinalBookingSummary`)
  - Notification status line — see ISSUE 2/3 below
  - Two CTAs:
    - "Done" — closes the modal
    - "New booking" — resets the modal to Step 1 with a fresh draft (clears `state.lastBooking`, `state.availabilityResult`, `state.manualDraft`)

### Rules

- The Confirm button must be hidden (`hidden=true`) AND disabled the moment `saveBooking` resolves, not just disabled — disabled buttons are still ambiguous in mobile UX
- Pressing the close (X) button after success must also close the modal cleanly without retriggering save
- The summary card uses `mb-confirmation-card` styling — full width, generous padding, no horizontal scroll on 375px
- Do NOT change AI or voice booking confirmation paths — they already render `renderFinalBookingSummary` and route through the chat overlay; only the manual modal needs the clean replacement

---

## ISSUE 2 — HIGH: close the customer notification gap

### Current behavior

`notifications.js` → `queueMobileBarberConfirmation`:

- Writes in-app notification keyed to `customerPhone` (customer never sees this — there is no customer-facing notification inbox in mobile-barber yet)
- Sends email ONLY if `booking.customerEmail` is present
- SMS is intentionally disabled

Email is OPTIONAL in Step 1. If the customer skips it, they get **no confirmation** outside the screen they're looking at. Close the tab → no record.

### Required fix

Three layered safeguards, in priority order:

**(a) Make email strongly recommended, not silently optional**

- Keep email field optional but add a visible warning under the email field when blank:
  - vi: "Không có email — bạn sẽ không nhận xác nhận đặt lịch qua email."
  - en: "No email — you won't receive an email confirmation."
  - es: "Sin correo — no recibirá confirmación por correo."
- When user advances from Step 1 without an email, show a soft inline notice (not a blocking modal) that says "Email recommended for confirmation. Continue without?"

**(b) Always show a downloadable / shareable confirmation locally**

On success, the confirmation card must include:
- A copy-to-clipboard button for the booking ID
- A "Save confirmation" button that triggers a native browser share (`navigator.share` if available) with text: `"DuLichCali Mobile Barber — Booking {id} — {barberName} — {date} {time} — {address}"`. Fallback: copy the same text to clipboard with a toast.

**(c) Optional SMS — feature-flagged, off by default**

Do NOT enable Twilio in this patch. But:
- Add a `smsOptIn` checkbox in Step 1 (default off), with text "Text me a confirmation" / "Nhắn tin xác nhận" / "Enviar SMS de confirmación"
- When checked, save `smsOptIn: true` on the booking document
- Add a TODO comment in `notifications.js` next to `queueMobileBarberConfirmation` documenting that the SMS branch is wired but disabled, and noting which Firebase Function would dispatch it when Twilio is approved

---

## ISSUE 3 — HIGH: real-time vendor notification

### Current behavior

`queueMobileBarberConfirmation` writes an in-app notification keyed to `mobile_barber_vendor` + `vendor.id`. Michael only sees it if he opens his vendor page and the page happens to render notifications. There is no push, no toast, no audible signal, no email. If a customer books at 7pm while the vendor is offline, the booking sits invisible until the vendor manually refreshes.

### Required fix

**(a) Real-time toast on vendor dashboard via Firestore `onSnapshot`**

In `mobile-barber-vendor.js` `init()`:

- Subscribe to `mobileBarberBookings` where `vendorId == state.vendor.id` AND `createdAt > pageLoadTime`, ordered by `createdAt desc`, limit 5
- On new document, render a toast in the corner: "New booking: {customerName} — {date} {time}" with a "View" button that scrolls to / opens the bookings list
- Play a short subtle audio cue (use a base64 chime or `<audio>` tag with a short mp3). Respect user preference: provide a toggle button in the vendor header "Sound: On / Off", persist via `localStorage('mb_vendor_sound')`.

**(b) Update the existing in-app notification render**

If the vendor page already has a notifications panel, make sure it surfaces unread mobile barber booking notifications prominently (badge count on the bookings tab). If it does not, add a small notification bell in the header that opens a list of recent bookings.

**(c) Optional vendor email — feature-flagged**

Add a vendor profile setting `notificationEmail` (text input in vendor settings, optional). If set, when a new booking arrives, queue an email to the vendor via the same Firebase Function path that handles customer emails. Default unset — opt-in only.

### Rules

- The `onSnapshot` listener MUST detach on `unload` / when the vendor switches pages — no leaked listeners
- The audio cue must NOT play on page load (only on new bookings after page load)
- The toast must be readable on mobile (375px) and not block the page content
- vi/en/es required for all new strings

---

## ISSUE 4 — MEDIUM: booking status badge

### Current behavior

A booking is written with a status field (default likely `pending` or similar — verify in code). The customer-facing confirmation summary does not mention status. The customer thinks "I booked, the barber is coming" when in reality the booking may still need barber acceptance.

### Required fix

**(a) Define the status lifecycle**

Verify (in `mobile-barber-booking.js` `buildBooking`) what status is set on creation. Standardize on:

- `pending_barber_confirmation` — created by manual/AI/voice booking; vendor has not yet accepted
- `confirmed` — barber explicitly accepted from the vendor dashboard
- `declined` — barber declined; surfaces to customer
- `completed` — service delivered
- `cancelled` — cancelled by either party

If the current code uses different strings, add a translation map but DO NOT break existing data; default unknown statuses to `pending_barber_confirmation` for display.

**(b) Show a status badge in the confirmation card**

In `renderFinalBookingSummary`, add a colored pill near the booking ID showing the human-readable status:

- vi: `Đang chờ thợ xác nhận` / `Đã xác nhận` / `Bị từ chối` / `Hoàn thành` / `Đã hủy`
- en: `Waiting for barber confirmation` / `Confirmed` / `Declined` / `Completed` / `Cancelled`
- es: `Esperando confirmación del barbero` / `Confirmado` / `Rechazado` / `Completado` / `Cancelado`

Color: amber for pending, green for confirmed, red for declined/cancelled, gray for completed.

**(c) Show the same badge in vendor bookings list**

Vendor sees the same pill on each row in their booking list. Vendor can click an "Accept" / "Decline" button which calls `BOOKING.updateBookingStatus(bookingId, 'confirmed' | 'declined')` — wire to Firestore update.

**(d) When status changes, re-fire notifications**

Add `queueMobileBarberStatusChange(booking, vendor, newStatus, lang)` in `notifications.js` that:
- Writes a customer in-app notification + email (if email present) when status flips to `confirmed` / `declined` / `cancelled`
- Does NOT spam for every internal state change — only the customer-visible ones above

---

## Allowed files

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber.css
- notifications.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-agent.js
- tests/lib/notifications.js
- docs/mobile_barber_post_booking_ux_and_notifications_fix_report.md

Do NOT touch:
- functions/index.js (Functions deploy is a separate gate; only add a TODO marker if needed)
- Any nail salon, hair salon, marketplace, ride, or travel files
- Firestore security rules
- Existing AI / voice booking flow logic (those reuse `renderFinalBookingSummary` and `queueMobileBarberConfirmation` — both must still work)

## Required tests

1. After `saveBooking` resolves, form + Confirm + Back are all hidden; only confirmation card visible
2. Clicking close (X) after success does not re-trigger save
3. Clicking "New booking" resets `state.lastBooking`, `state.availabilityResult`, `state.manualDraft` and shows Step 1
4. Step 1 without email shows warning text; with `smsOptIn` checked, saved booking has `smsOptIn: true`
5. Confirmation card shows status badge with correct text + color for each status
6. Copy-to-clipboard button on booking ID works (mock `navigator.clipboard`)
7. Vendor onSnapshot listener fires for bookings with `createdAt > pageLoadTime` only (not historical)
8. Vendor toast renders for new booking and dismisses after click
9. Audio cue does NOT play on initial page load
10. Vendor "Accept" button calls `BOOKING.updateBookingStatus(id, 'confirmed')` and triggers `queueMobileBarberStatusChange`
11. `queueMobileBarberStatusChange` writes customer notification on confirmed/declined/cancelled
12. Status flow works for both Michael and Tim vendor pages
13. AI and voice booking paths still create bookings and render confirmation correctly (no regression)
14. All new strings present in vi + en + es (no hardcoded language strings)
15. Mobile (375px) layout: confirmation card and toast both readable and not cropped

## Required diagnostic logs

```
[mobile-barber-manual-booking] step, selectedService, hasContact, hasAddress, hasDateTime, availabilityStatus, submitStatus, bookingId, error
[mobile-barber-vendor-realtime] event, bookingId, vendorId, source ("snapshot" | "manual"), soundEnabled
[mobile-barber-notification] type ("customer_email" | "customer_inapp" | "vendor_inapp" | "vendor_email" | "sms_optin"), bookingId, channelOutcome, lang
[mobile-barber-status-change] bookingId, fromStatus, toStatus, actor ("vendor" | "system"), lang
```

## Required report

`docs/mobile_barber_post_booking_ux_and_notifications_fix_report.md`

Include:

- Root cause for each of the 4 issues
- Before / after for the confirmation modal (describe DOM, list visible elements)
- Notification matrix (customer email / customer in-app / customer SMS / vendor in-app / vendor toast / vendor sound / vendor email) — each row: Status (✓ wired / ⚠ flagged-off / ❌ not in scope), Trigger, Acceptance test
- Status lifecycle table with all 5 states and which actor can transition between them
- Firestore listener attach/detach lifecycle proof
- Tests passing summary
- Production verification steps (manual)
- Remaining risks (Twilio not enabled, vendor email function not yet deployed, etc.)
- PASS / BLOCKED

## Version string bumps

Bump every JS file you modify per the project version-string rule. Use `v=20260525i` as next safe floor for vendor.js, `v=20260525e` for booking.js, increment letters as needed for additional files. Verify the new string has not been used previously: `git log --all -p -- mobile-barber/vendor.html | grep "mobile-barber-vendor.js"`.

## PASS criteria

- No duplicate submit possible
- Customer always has a copyable record (booking ID + share button) even without email
- Vendor sees new bookings within ~2 seconds while their tab is open, with optional audio
- Status badge correct across all 5 states for both Michael and Tim
- 340+ tests pass; full system dry run PASS
- vi/en/es coverage complete for every new string
- AI and voice booking still work end-to-end

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_post_booking_ux_and_notifications_fix.md --max-loops 3 --allow-dirty --timeout 1800
```
