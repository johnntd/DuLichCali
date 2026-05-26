# Patch Prompt — Mobile Barber Vendor Popup Notifications With Sound

## Goal

Implement popup notifications for Mobile Barber vendors the same way the nail salon / hair salon vendor portal already does.

When a new Mobile Barber booking is created, the correct barber vendor should receive:

- visible popup notification
- sound alert
- booking message
- customer/service details
- quick action to view booking

---

## Strict Rules

1. Reuse the existing nail salon / hair salon vendor notification system if available.
2. Do NOT create a totally separate notification framework unless necessary.
3. Do NOT break:
   - nail salon vendor notifications
   - hair salon vendor notifications
   - mobile barber booking
   - AI booking
   - manual booking
   - vendor dashboard
4. Apply to all Mobile Barber vendors, not just Michael or Tim.
5. Notification must only go to the vendor/barber associated with the booking.
6. Sound must respect browser restrictions: enable sound after user interaction if needed.

---

## Required Audit

First inspect how nail salon / hair salon vendor notifications work.

Search:

```bash
grep -R "notification" -n .
grep -R "notify" -n .
grep -R "sound" -n .
grep -R "new booking" -n .
grep -R "salon" -n .
grep -R "vendor" -n .
grep -R "toast" -n .
grep -R "audio" -n .
```

Document:

- notification UI component
- sound/audio file used
- event listener or Firestore listener
- booking collection watched
- vendor filtering logic
- permission handling
- popup style
- how vendor clicks to view booking

---

## Required Mobile Barber Behavior

When a Mobile Barber booking is created in:

```
mobileBarberBookings
```

Vendor dashboard should listen for new bookings where:

```
booking.vendorId === currentVendor.id
```

Then show popup:

```
New Mobile Barber Booking
Customer: [customer name]
Phone:    [customer phone]
Service:  [service name]
Date:     [date]
Time:     [12-hour time]
Address:  [city/zip or full address in vendor portal only]
Payment:  Cash/Zelle
Amount Due: $[amountDue]
[View Booking]
```

---

## Sound Alert

Use the same notification sound as nail/hair salon if available.

If not available, add a lightweight sound file or generate a simple beep.

Rules:

- play sound once per new booking
- do not loop forever
- do not spam sound for old bookings
- suppress duplicates
- only play after dashboard has user gesture if required
- show "Enable Sound Alerts" button if browser blocks autoplay

---

## Popup UI Requirements

Popup should be:

- clear
- readable on mobile and desktop
- dismissible
- not block the whole dashboard
- persistent enough for vendor to notice
- includes "View Booking"
- includes "Dismiss"
- uses Mobile Barber branding

---

## Data / State Requirements

Maintain local seen-notification state to avoid repeated alerts.

Use one or more:

```
lastSeenBookingIds
notifiedBookingIds
localStorage
sessionStorage
```

Do not notify repeatedly on page refresh for old bookings.

Only notify:

- newly created booking
- newly assigned booking
- booking status changed to pending/confirmed if relevant

---

## Integration Requirements

Trigger notifications from:

1. Manual booking
2. AI chat booking
3. Voice booking

All should create the same booking record shape so dashboard listener works.

---

## Vendor Dashboard Requirements

Add notification status/control area:

```
Sound alerts: On/Off
Enable sound alerts
Last booking alert
```

Show browser notification permission state if applicable.

Optional if already implemented elsewhere:

- Browser Notification API
- in-page toast only

---

## Verification

Test:

1. Open Mobile Barber vendor dashboard for Michael.
2. Create a new booking for Michael.
3. Michael dashboard shows popup.
4. Sound plays.
5. View Booking scrolls/opens the booking.
6. Tim dashboard does NOT receive Michael booking.
7. Open Tim dashboard.
8. Create Tim booking.
9. Tim receives popup.
10. Refresh dashboard.
11. Old booking does not re-alert.
12. Manual booking triggers alert.
13. AI booking triggers alert if AI booking creates booking.
14. Voice booking triggers alert if voice booking creates booking.
15. Existing nail salon notification still works.

---

## Allowed files

- mobile-barber/dashboard.html
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/mobile-barber.css
- mobile-barber/mobile-barber-data.js (only if a notification field is added to schema)
- assets/sounds/*  (new directory if a sound file needs to be added)
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-booking.js
- docs/mobile_barber_vendor_popup_notifications_report.md

Do NOT touch:

- nailsalon/*, hairsalon/*, salon-admin.html (read-only reference only)
- functions/index.js
- firestore.rules
- script.js, style.css, desktop.css
- marketplace/*, foods/*, airport.html, tour.html
- notifications.js (the shared module — read-only reference for the salon pattern)

---

## Required Report

Create:

```
docs/mobile_barber_vendor_popup_notifications_report.md
```

Include:

1. Existing salon notification system found
2. Files reused
3. Files changed
4. Notification listener implementation
5. Sound implementation
6. Duplicate prevention
7. Vendor filtering
8. Tests run
9. PASS / BLOCKED

---

## PASS Criteria

Do not mark PASS unless:

- Mobile Barber vendor receives popup for new booking
- Sound alert works after enable/user interaction
- Notification includes customer, service, time, amount
- Only correct vendor receives alert
- Old bookings do not spam alerts
- Nail/hair salon notification behavior is not broken

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_vendor_popup_notifications.md --max-loops 3 --allow-dirty --timeout 1800
```
