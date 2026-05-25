# Critical bug: Mobile Barber manual booking modal is not wired correctly.

From production screenshot:

- User selects service
- Manual booking opens Step 3 / Contact
- Modal only asks name, phone, email
- There is no visible address/date/time fields
- "Kiểm tra lịch trống" and "Xác nhận yêu cầu" appear together/confusingly
- There is no clear final submit button after availability check
- User cannot complete manual booking

Fix the manual booking flow end-to-end.

## Required correct flow

1. Select service
2. Open booking modal
3. **Step 1: Customer contact**
   - name
   - phone
   - optional email
4. **Step 2: Service address**
   - street address
   - city
   - zip
5. **Step 3: Date/time**
   - requested date
   - requested time
   - Check Availability button
6. **Step 4: Review + Confirm**
   - barber
   - service
   - price
   - duration
   - address summary
   - date/time
   - final "Confirm Booking" submit button

## Rules

- Do not show final confirm until required fields and availability pass.
- "Check availability" must not be the final submit.
- "Confirm booking" must call the real booking create/write path.
- After submit, show success confirmation and booking ID.
- If Firestore/database write fails, show clear error.
- Do not close modal silently.
- Keep mobile layout readable.
- Fix both Michael and Tim vendor pages and all future barber vendors.
- Do not break AI booking or voice booking.

## Files likely involved

- `mobile-barber/mobile-barber-booking.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber.css`
- `tests/lib/mobile-barber-agent.js`
- `tests/lib/mobile-barber-landing.js`

## Allowed files

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber.css
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-agent.js
- docs/mobile_barber_manual_booking_wiring_fix_report.md

## Add tests

1. Manual booking modal shows contact, address, date/time, review steps.
2. Confirm button hidden/disabled until required fields complete.
3. Check availability advances to review only when valid.
4. Confirm booking calls create booking.
5. Booking write failure displays error.
6. Booking success displays confirmation.
7. Michael and Tim vendor pages both work.

## Add diagnostic logs

```
[mobile-barber-manual-booking] step, selectedService, hasContact, hasAddress, hasDateTime, availabilityStatus, submitStatus, bookingId, error
```

## Create report

`docs/mobile_barber_manual_booking_wiring_fix_report.md`

Do not mark PASS unless manual booking creates a booking record successfully.

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_manual_booking_wiring_fix.md --max-loops 3 --allow-dirty --timeout 1800
```
