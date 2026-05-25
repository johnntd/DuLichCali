# Patch Prompt — Mobile Barber Profit Pricing + Vendor Dashboard Improvements

## Goal

Improve the Mobile Barber system so pricing includes travel cost, gas/wear-and-tear, service time, and distance. Also improve the vendor dashboard so appointments are easier to see, use 12-hour time, and show upcoming appointments only by default.

---

## Problems

1. Current service prices do not appear to include travel cost.
2. Mobile haircut may not be profitable once gas, driving time, and wear-and-tear are included.
3. Vendor dashboard is hard to read.
4. Appointment cards do not clearly show service type, travel fee, total price, payment method, and customer address.
5. Time format should be 12-hour AM/PM.
6. Vendor portal should show only upcoming appointments by default.

---

## Strict Rules

1. Do NOT break:
   - manual booking
   - AI booking
   - voice booking
   - vendor dashboard
   - salon booking
   - food
   - rides
   - travel pages
2. Do NOT add online prepayment.
3. Payment remains after service:
   - Cash
   - Zelle to vendor phone
4. Apply to all Mobile Barber vendors, not only Michael or Tim.
5. Use vendor configuration where possible.
6. If real map distance/geocoding is unavailable, use safe fallback distance tiers and clearly document limitation.

---

## Part 1 — Audit Current Pricing

First inspect the current Mobile Barber data and booking flow.

Search:

```bash
grep -R "mobileBarber" -n .
grep -R "travelFee" -n .
grep -R "servicePrice" -n .
grep -R "amountDue" -n .
grep -R "paymentMethod" -n .
grep -R "mobile-barber" -n .
```

Document:

- where service price is stored
- where travel fee is stored
- where amountDue is calculated
- whether booking currently stores total price
- whether vendor dashboard reads that total
- whether AI booking and manual booking use the same price calculation

---

## Part 2 — Add Mobile Barber Pricing Engine

Create or update a reusable pricing helper.

Suggested function:

```js
calculateMobileBarberPrice({
  vendor,
  service,
  customerAddress,
  distanceMiles,
  travelMinutes,
  requestedDateTime
})
```

Return:

```js
{
  baseServicePrice,
  travelFee,
  vehicleWearCost,
  distanceAdjustment,
  peakAdjustment,
  totalPrice,
  estimatedDistanceMiles,
  estimatedTravelMinutes,
  pricingExplanation,
  quoteType
}
```

---

### Pricing Defaults

Use these defaults unless vendor config overrides them:

```js
{
  wearRatePerMile: 0.67,
  freeTravelMiles: 5,
  customQuoteMiles: 20,
  minimumMobileVisitPrice: 50,
  minimumHourlyTarget: 35
}
```

Distance tiers:

- 0–5 miles: $0 travel fee
- 5–10 miles: +$8
- 10–15 miles: +$15
- 15–20 miles: +$25
- 20+ miles: custom quote / vendor review

Vehicle wear:

```js
vehicleWearCost = estimatedDistanceMiles * wearRatePerMile
```

Round trip preferred if available:

```js
billableDistanceMiles = roundTripMiles
```

If only one-way distance is available:

```js
roundTripMiles = oneWayMiles * 2
```

---

### Profitability Guard

Estimate effective job time:

```js
effectiveMinutes =
  service.durationMinutes
  + service.cleanupBufferMinutes
  + estimatedTravelMinutes
```

Estimate profit:

```js
grossProfitEstimate = totalPrice - vehicleWearCost
```

Estimate hourly:

```js
estimatedHourlyGross = grossProfitEstimate / (effectiveMinutes / 60)
```

If `estimatedHourlyGross` is below `minimumHourlyTarget`, add a small mobile convenience adjustment or flag vendor review.

Do NOT overcharge silently. Show the explanation.

---

### Customer-Facing Price Display

Before confirmation, show:

```
Service: Fade Haircut
Service price: $45
Travel/mobile service fee: $10
Estimated vehicle/travel cost included
Total due after service: $55
Payment is collected after the haircut by cash or Zelle.
```

If over 20 miles:

```
This address may be outside the normal service area. The barber will review and confirm the final travel fee.
```

---

### Booking Record Fields

Ensure manual and AI bookings save:

```js
{
  servicePrice,
  travelFee,
  vehicleWearCost,
  distanceAdjustment,
  peakAdjustment,
  amountDue,
  totalPrice,
  estimatedDistanceMiles,
  estimatedTravelMinutes,
  pricingExplanation,
  quoteType,
  paymentMethod,
  paymentStatus,
  zellePhone
}
```

Default:

```
paymentStatus: "unpaid"
zellePhone: vendor.phone
```

---

### AI Booking Agent Pricing Behavior

AI agent must use the same pricing engine.

It should say naturally:

> The fade haircut is $45. Based on your location, the mobile travel fee is about $10, so the total due after service is $55. You can pay by cash or Zelle after the haircut.

Do not let AI invent prices.

---

### Manual Booking Pricing Behavior

Manual booking flow must:

1. customer selects service
2. enters address/city/zip
3. pricing engine calculates quote
4. shows price breakdown
5. then allows availability check
6. then final confirmation

---

## Part 3 — Vendor Dashboard Improvements

Vendor dashboard should be easier to use.

### Default Filter

Show only upcoming appointments by default.

Upcoming means:

```
appointment start time >= now
status not cancelled
status not completed
```

Add filters:

```
Upcoming | All | Completed | Cancelled
```

---

### 12-Hour Time Format

All appointment times must display in 12-hour format:

```
9:00 AM
10:30 AM
2:15 PM
```

Never show only 24-hour time like:

```
14:30
```

Use helper:

```js
formatTime12Hour(dateOrTime)
```

Use it consistently in:

- vendor dashboard
- booking confirmation
- customer review screen
- AI summary if applicable

---

### Booking Card Must Show

Each upcoming appointment card must clearly show:

**Customer**
- name
- phone

**Appointment**
- service name/type
- duration
- date
- time in AM/PM
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
- cash / Zelle / unknown
- unpaid / paid
- Zelle phone

**Notes**
- style request
- customer notes
- AI conversation summary if available

---

### Vendor Visibility

At top of dashboard, show a clear vendor identity card:

```
Vendor:
Michael Mobile Barber OC
Michael Nguyen
Orange County
Zelle: 714-227-6007
```

For Tim:

```
Tim Mobile Barber Bay Area
Tim Nguyen
Bay Area
Zelle: 408-504-3684
```

Do not hardcode logic to only these vendors. Use loaded vendor data.

---

## Part 4 — Migration / Backfill

Existing bookings may not have pricing fields.

Add safe normalization:

If missing:

```
travelFee = 0
vehicleWearCost = 0
amountDue = servicePrice
paymentStatus = unpaid
zellePhone = vendor.phone
```

Do not crash dashboard when old booking records are missing new fields.

---

## Part 5 — Verification

Run tests or create test scripts for:

1. Pricing calculation:
   - 3 miles
   - 8 miles
   - 14 miles
   - 19 miles
   - 25 miles custom quote
2. Manual booking:
   - price breakdown appears
   - booking saves amountDue
   - booking saves travelFee
   - booking saves zellePhone
3. AI booking:
   - uses same pricing engine
   - does not invent price
   - explains cash/Zelle after service
4. Vendor dashboard:
   - upcoming only by default
   - completed/cancelled hidden by default
   - filters work
   - time is 12-hour AM/PM
   - service type visible
   - total amount due visible
   - payment method/status visible
5. Regression:
   - mobile barber booking still works
   - vendor pages still load
   - nail salon still loads
   - salon payment flow not broken

---

## Allowed files

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
- docs/mobile_barber_profit_pricing_vendor_dashboard_fix_report.md

Do NOT touch:

- nailsalon/*, hairsalon/*, salon-admin.html (read-only reference)
- functions/index.js
- firestore.rules (unless a new pricing-related field needs allowlisting in the create check — if so, add only the new field, do not change unrelated rules)
- script.js, style.css, desktop.css
- marketplace/*, foods/*, airport.html, tour.html
- notifications.js

---

## Required Report

Create:

```
docs/mobile_barber_profit_pricing_vendor_dashboard_fix_report.md
```

Include:

1. Current pricing audit findings
2. Profitability risks found
3. Pricing engine details
4. Distance/travel assumptions (including any geocoding fallback)
5. Files changed
6. Booking fields added
7. Vendor dashboard improvements
8. Tests run
9. PASS / BLOCKED

---

## PASS Criteria

Do not mark PASS unless:

- travel fee is included in booking quote
- amountDue is saved to booking
- vendor dashboard shows service type, travel fee, and total
- dashboard defaults to upcoming appointments only
- time is displayed in 12-hour AM/PM format
- AI and manual booking use the same pricing logic
- old bookings do not crash dashboard

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_profit_pricing_vendor_dashboard_fix.md --max-loops 3 --allow-dirty --timeout 2400
```
