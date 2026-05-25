# Patch Prompt — Mobile Barber Vendor Portal Booking Details + Cash/Zelle Payment

## Goal

Improve the Mobile Barber vendor portal/dashboard so barbers can clearly manage customer bookings and payment collection.

The app does NOT take advance payment.

Customers pay the barber directly by:

1. Cash
2. Zelle using the vendor/barber phone number

This should work like the nail salon vendor payment flow where applicable.

---

# Current Problem

The barber vendor portal does not show enough booking detail.

The vendor needs to clearly see:

- who booked
- what service they booked
- how much it costs
- where to go
- when to go
- notes/style request
- payment method
- payment status
- whether customer will pay cash or Zelle

---

# Strict Rules

1. Do NOT add Stripe/card payment.
2. Do NOT require prepayment.
3. Do NOT break:
   - booking creation
   - AI booking
   - voice booking
   - manual booking
   - salon vendor portal
   - nail salon Zelle/cash flow
4. Reuse existing nail salon payment display logic if available.
5. Use vendor phone number as Zelle number.
6. Make this apply to all mobile barber vendors, not just Michael or Tim.

---

# Payment Model

Add or support fields on mobile barber booking:

```js
{
  paymentMethod: "cash" | "zelle" | "unknown",
  paymentStatus: "unpaid" | "pending" | "paid" | "waived",
  zellePhone: vendor.phone,
  amountDue: servicePrice + travelFee,
  paymentNote: ""
}
```

Default:

```
paymentMethod: "unknown"
paymentStatus: "unpaid"
zellePhone: vendor.phone
```

---

# Vendor Data

For existing vendors:

**Michael Nguyen:**

- phone/Zelle: `714-227-6007`

**Tim Nguyen:**

- phone/Zelle: `408-504-3684`

Do not hardcode only these two in logic. Use `vendor.phone`.

---

# Customer-Facing Booking Confirmation

After customer books, show:

```
Payment is collected after service.
You can pay your barber by:
- Cash
- Zelle to [barber phone]
No online prepayment is required.
```

If vendor is Michael:

```
Zelle: 714-227-6007
```

If vendor is Tim:

```
Zelle: 408-504-3684
```

---

# Vendor Portal Booking Card

Each booking card must show:

**Customer**

- name
- phone
- email if provided

**Appointment**

- service name
- service category/type
- duration
- date
- time
- status

**Location**

- street address
- city
- zip
- map link if available

**Pricing**

- service price
- travel fee
- total amount due

**Payment**

- payment method: cash / Zelle / unknown
- payment status
- Zelle number
- mark as paid button
- mark as unpaid button
- optional payment note

**Notes**

- customer notes/style request
- AI conversation summary if available

---

# Vendor Portal Actions

Vendor should be able to:

- accept booking
- reject/cancel booking
- mark completed
- mark paid
- mark unpaid
- update payment method to cash
- update payment method to Zelle
- add payment note

---

# Manual Booking Flow

Manual booking should allow customer to choose preferred payment method:

```
How would you like to pay after the haircut?
[Cash] [Zelle]
```

If skipped:

```
paymentMethod: "unknown"
```

---

# AI Booking Flow

AI should explain naturally:

> Payment is collected after the haircut. You can pay by cash or Zelle to the barber's phone number. Which do you prefer?

Do not block booking if customer does not choose payment method.

---

# Firestore / Database

Audit current mobile barber booking schema.

Ensure booking write includes:

```
paymentMethod
paymentStatus
zellePhone
amountDue
travelFee
servicePrice
```

Update old bookings safely with defaults if missing.

---

# Verification

Test:

1. Create manual booking with cash.
2. Create manual booking with Zelle.
3. Create booking with unknown payment.
4. Vendor dashboard shows service type/name.
5. Vendor dashboard shows total amount due.
6. Vendor dashboard shows Zelle number from vendor phone.
7. Vendor can mark booking paid.
8. Vendor can mark booking unpaid.
9. Existing nail salon vendor payment flow still works.
10. Michael uses 714-227-6007.
11. Tim uses 408-504-3684.
12. Future vendor uses that vendor's own phone.

---

# Allowed files

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/mobile-barber.css
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-agent.js
- docs/mobile_barber_vendor_portal_booking_payment_fix_report.md

Do NOT touch:

- nailsalon/* (read-only — used as reference only)
- hairsalon/* (read-only — used as reference only)
- salon-admin.html (read-only — used as reference only)
- functions/index.js
- firestore.rules (unless a new field needs to be allowlisted — if so, add only the new field, do not change unrelated rules)
- script.js, style.css, desktop.css
- marketplace/*

---

# Required Report

Create:

```
docs/mobile_barber_vendor_portal_booking_payment_fix_report.md
```

Include:

1. Files changed
2. Booking fields added
3. Vendor portal improvements
4. Payment behavior
5. Zelle phone source
6. Tests run
7. PASS / BLOCKED

Do not mark PASS unless vendor portal clearly shows service type and payment details, and payment status can be updated.

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_vendor_portal_booking_payment_fix.md --max-loops 3 --allow-dirty --timeout 1800
```
