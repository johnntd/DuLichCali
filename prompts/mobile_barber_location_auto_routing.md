# Patch Prompt — Mobile Barber Location-Based Auto-Routing to the Right Vendor

## Goal

Today the Mobile Barber landing and service-card flow defaults customers to Michael Nguyen regardless of where they live. Customers in Tim's service area (San Jose / Bay Area) end up routed to Michael's vendor page anyway. The system already knows each vendor's `serviceAreas` and has a `findVendorForAddress()` helper. Use it.

Add an address gate to the landing flow so the customer's location decides which vendor to route to, automatically.

---

# Current Problem

- `/mobile-barber/` shows both vendor cards but the service cards (and any deep-link via `?serviceId=...`) bias to Michael.
- `landingServices()` and `renderBeforeAfterGallery()` in `mobile-barber.js` hardcode `DATA.MICHAEL_VENDOR_ID` as their source — fine for sample content, wrong as default routing.
- On vendor.html the "Switch to {other vendor}" banner only appears AFTER Step 2 address entry and requires a manual tap. Most customers will book with the wrong barber and the booking gets `pending_barber_confirmation` on the wrong dashboard.

---

# What "auto-routing" means here

When a customer wants to start a booking from the landing page or a service card, **prompt them for their city/zip first**. Pick the vendor whose `serviceAreas` covers that city/zip, then route them to that vendor's page with the chosen service + city already filled.

If no vendor serves the address → show a friendly "Not yet serving your area — we'll let you know" capture, do NOT proceed to a vendor page.

On the vendor.html flow, when a customer is already on the wrong vendor's page and Step 2 detects out-of-area + another vendor serves it → **auto-redirect** with `?carryDraft=1` after a 2-second visible toast, instead of waiting for a manual tap on the existing "Switch" banner.

---

# Strict Rules

1. Do NOT remove Michael's or Tim's vendor pages — they still need to be reachable directly via `/mobile-barber/vendor/{id}`.
2. Do NOT break:
   - existing direct-link entry: `/mobile-barber/vendor/michael-nguyen-oc?...` and same for Tim must still work
   - the manual booking 4-step flow on vendor.html
   - the AI booking flow (which already enforces `service_area_out_of_range`)
   - the existing "Switch to {vendor}" banner (it stays as a fallback for the case where address changes after Step 2)
3. Do NOT hardcode Michael or Tim in routing logic. Use `BOOKING.findVendorForAddress()` against `DATA.sampleVendors`.
4. Apply to all current and future mobile barber vendors automatically.
5. Persist the customer's last-used location in `localStorage('mb_customer_location')` (city + zip) so they aren't prompted on every visit.

---

# Required UI changes

## A. Landing page address gate

Add an above-the-fold address prompt to `/mobile-barber/`:

```
Where would you like the barber to come?
[ City ____ ] [ Zip ____ ]  [ Find My Barber ]
```

- Default values: read from `localStorage('mb_customer_location')` if present
- On submit: call `BOOKING.findVendorForAddress({ city, zip })`
  - Match → save location to localStorage, redirect to `/mobile-barber/vendor/{matchedId}?city=...&zip=...&from=landing`
  - No match → show "We don't serve {city} yet. Leave your email and we'll let you know when we expand." (simple email capture; write to `mobileBarberWaitlist` Firestore collection — see Schema section below)

## B. Service card click on landing

When the customer taps an AI Style card or a service card on the landing page WITHOUT having submitted the address gate:

- Open the address gate as a small inline modal (not a full overlay), pre-populated with the saved location if any
- Submit routes to the correct vendor's page with `?serviceId=<clicked>` carried over

## C. Vendor page auto-switch on address mismatch

Currently `checkAddressVendorMatch()` in `mobile-barber-vendor.js` shows a banner. Upgrade to:

- Still show the amber banner with the suggestion (so the customer sees what's happening)
- After 2 seconds, automatically call `persistDraftForSwitch()` + navigate to the matched vendor with `?carryDraft=1`
- If the customer interacts with the modal or clicks "Stay" within those 2 seconds, cancel the auto-redirect
- vi/en/es: add a "Switching to {vendor} in 2s — Stay?" string

## D. Remove Michael bias from sample content

In `mobile-barber.js`:

- `landingServices(services)` — instead of preferring Michael, return a merged/deduped list from ALL active vendors. Each service card should know which vendorId it belongs to.
- `renderBeforeAfterGallery()` — same: blend portfolio rows from all active vendors (round-robin or by displayOrder). Today both vendors share the same template rows so visual output is identical; the routing fix is what matters.

## E. Last-location memory

- `localStorage('mb_customer_location')` schema: `{ city: 'San Jose', zip: '95121', savedAt: 173... }`
- Expire after 30 days
- Read by: landing address gate prefill, vendor.html Step 2 prefill (if empty)
- Clear when customer explicitly changes city via a "Change location" link in the landing header

---

# Schema additions

## `mobileBarberWaitlist` Firestore collection

For out-of-area capture:

```js
{
  id,                 // auto
  email,
  city,
  zip,
  createdAt,          // serverTimestamp
  source              // 'landing_no_match'
}
```

Firestore rule: allow `create` if `email` is a non-empty string and `city` is a non-empty string. No read/update/delete from clients.

---

# Required tests

1. `BOOKING.findVendorForAddress({ city: 'San Jose' })` returns Tim (existing behavior).
2. `BOOKING.findVendorForAddress({ city: 'Westminster' })` returns Michael.
3. `BOOKING.findVendorForAddress({ city: 'Boston' })` returns null.
4. Landing address gate exists in `mobile-barber/index.html` and submit handler reads city + zip.
5. Submit with covered city sets `localStorage('mb_customer_location')` and navigates to the matched vendor URL.
6. Submit with uncovered city shows the email-capture fallback, does NOT navigate.
7. `landingServices()` no longer references `DATA.MICHAEL_VENDOR_ID` as the preferred vendor; returns merged list from all vendors.
8. `renderBeforeAfterGallery()` does not hardcode `MICHAEL_VENDOR_ID`.
9. Vendor.html auto-switch: when address is out-of-area AND another vendor serves it, the redirect fires after ~2s unless cancelled.
10. Direct-link entry `/mobile-barber/vendor/tim-nguyen-bay` still works (no address gate forced).
11. localStorage location persists across page loads and expires after 30 days.

---

# Allowed files

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber.css
- firestore.rules (only to add the `mobileBarberWaitlist` collection rule)
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-booking.js
- docs/mobile_barber_location_auto_routing_report.md

Do NOT touch:

- mobile-barber/mobile-barber-agent.js (AI flow is separate and already strict)
- mobile-barber/mobile-barber-dashboard.js
- nailsalon/*, hairsalon/*, salon-admin.html
- functions/index.js
- script.js, style.css, desktop.css
- marketplace/*

---

# Required Report

Create:

```
docs/mobile_barber_location_auto_routing_report.md
```

Include:

1. Files changed
2. Address gate placement on landing
3. localStorage schema + expiry
4. Routing decision flow (city → vendor)
5. Auto-switch timing on vendor.html
6. Waitlist Firestore schema + rule
7. Tests run + count
8. vi/en/es coverage proof for new strings
9. PASS / BLOCKED

Do not mark PASS unless:

- Submitting "San Jose" on the landing routes to Tim
- Submitting "Westminster" routes to Michael
- Submitting "Boston" shows waitlist capture
- Direct links `/mobile-barber/vendor/{id}` still work unaffected

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_location_auto_routing.md --max-loops 3 --allow-dirty --timeout 1800
```
