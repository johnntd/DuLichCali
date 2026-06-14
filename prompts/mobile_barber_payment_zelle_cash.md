# Mobile Barber — Cash + Zelle Payment Handling

Use **ui-ux-pro-max**.

Add payment handling to the Mobile Barber booking flow + vendor portal.

For now, **ONLY** support:
- **Cash**
- **Zelle**

Do NOT implement Apple Pay, Google Pay, Stripe, or any card processor in this cycle.

---

## Customer booking flow

During the AI chat booking (or any other customer-facing booking surface), ask the customer:

> **Preferred payment method:**
> ◯ Cash
> ◯ Zelle
>
> Default: **Cash**

Persist `paymentMethod` (`'cash' | 'zelle'`) on the booking document. (The field already exists in `BOOKING_FIELDS`; today's `normalizePaymentMethod()` accepts `cash` / `zelle` / `unknown`. Default to `cash` instead of `unknown` for new bookings created via the customer flow.)

---

## Vendor portal — appointment detail

Inside the expanded booking row (`mobile-barber-dashboard.js` `bookingCard()` detail), display:

- **Payment method:** Cash / Zelle (colored pill)
- **Payment status:** UNPAID / PAYMENT REQUESTED / PAID (colored pill)

Color chips:
| Status | Color |
|---|---|
| `unpaid` | yellow (already present) |
| `payment_requested` | orange (NEW status — add to allow-list) |
| `paid` | green (already present) |

---

## Zelle flow

When `paymentMethod === 'zelle'`, the vendor row shows a **`Request Zelle Payment`** action button.

Tapping it:

1. Opens an in-portal panel showing the **barber's Zelle payment information** from vendor settings — whichever of these is configured (in priority order: QR > phone > email):
   - Zelle QR image (uploaded by vendor)
   - Zelle phone number
   - Zelle email
2. Optionally: queues a customer-facing notification (existing SMS launcher infrastructure from `confirmation_text` cycle can be reused with a different body template).
3. Sets `paymentStatus = 'payment_requested'`.

---

## Customer payment screen

When a customer opens a booking with `paymentMethod === 'zelle'` AND `paymentStatus !== 'paid'`, surface a **"Pay with Zelle"** panel that displays:

- QR image (if vendor uploaded one)
- OR phone instructions
- OR email instructions

Example:

> **Send payment to:**
> 714-227-6007
> or
> duyhoa9256@gmail.com

(Customer-facing surface for this: in this cycle, expose it only inside the vendor's appointment-detail view + the existing thank-you / confirmation page. Marketplace landing chat agent does not need a payment screen yet.)

---

## Payment actions (vendor)

Vendor portal action buttons (extend the existing `[paid / unpaid / cash / zelle / addPaymentNote]` row):

- **Request payment** — sets `paymentStatus = 'payment_requested'`; shows the customer Zelle panel
- **Mark received** / **Mark paid** — sets `paymentStatus = 'paid'`
- **Mark unpaid** — sets `paymentStatus = 'unpaid'`
- *(optional follow-up — not required for PASS)* **Send Zelle request SMS** — reuses the SMS launcher pattern from `confirmation-text` cycle, prefilled with a "Zelle payment request" body

---

## Vendor Settings — new "Payments" accordion panel

Inside the existing Settings accordion (already shipped), add a new `<details>` panel: **Payments**.

Fields:
- **Cash enabled** toggle (default ON)
- **Zelle enabled** toggle (default ON)
- **Zelle phone** text input
- **Zelle email** text input
- **Upload Zelle QR image** file input (image/*)

Persist all five on the vendor document. The data model (`mobile-barber-data.js` `VENDOR_FIELDS`) already includes `phone` and `email` — add new fields: `cashEnabled`, `zelleEnabled`, `zellePhone` (already exists at booking level, mirror up), `zelleEmail`, `zelleQrUrl`.

Image upload approach: keep it simple — compress the QR client-side (use the existing `MobileBarberAIPreview.compressImage()` helper) and store as a data URL on the vendor doc. QR images compress small (<50 KB typical). Do NOT introduce a new storage bucket.

---

## Booking statuses + display

Booking shows one of three payment chips:

| Code | English | Vietnamese | Spanish | Color |
|---|---|---|---|---|
| `unpaid` | UNPAID | CHƯA THANH TOÁN | NO PAGADO | yellow |
| `payment_requested` | PAYMENT REQUESTED | ĐÃ YÊU CẦU THANH TOÁN | PAGO SOLICITADO | orange |
| `paid` | PAID | ĐÃ THANH TOÁN | PAGADO | green |

`mobile-barber-data.js` `validateBooking()` currently accepts `['unpaid', 'pending', 'paid', 'waived']` for `paymentStatus`. Add `payment_requested` to the allow-list (keep `pending` and `waived` for backwards compatibility).

---

## DO NOT BREAK

- Booking DB writes (Firestore `mobileBarberBookings` rules + statuses)
- Vendor portal (Settings accordion, summary filter cards, compact list-row bookings, SMS launcher)
- Appointment flow (status updates: accept/reject/reschedule/cancel/complete)
- AI booking (chat agent's auto-submit + duplicate-booking guard)
- Voice booking (`mobile-barber-voice.js`)
- The AI haircut preview pipeline
- The preferred-barber dropdown shipped on 2026-05-27
- The marketplace routing (Find My Barber gate is REMOVED — do not bring it back)

---

## Audit

Inspect:
- `mobile-barber/mobile-barber-data.js` — `BOOKING_FIELDS`, `VENDOR_FIELDS`, `validateBooking`, `validateVendor`
- `mobile-barber/mobile-barber-booking.js` — `normalizePaymentMethod`, `normalizePaymentStatus`, `buildBooking`
- `mobile-barber/mobile-barber-dashboard.js` — `bookingCard()` detail rendering; existing payment action handlers; Settings accordion in `dashboard.html`
- `mobile-barber/dashboard.html` — add the new "Payments" `<details>` panel inside `mbSettingsSection`
- `mobile-barber/mobile-barber-agent.js` — agent prompt + slot fill (consider whether to ask payment method conversationally OR collect it via a small UI control on the marketplace landing)
- `mobile-barber/mobile-barber.js` — marketplace landing (where to surface payment method choice if doing it pre-chat)
- `firestore.rules` — verify booking-create allow-list still accepts the new `payment_requested` status

---

## Tests

```
node tests/lib/mobile-barber-data-model.js   # asserts new payment fields validate
node tests/lib/mobile-barber-agent.js
node tests/lib/mobile-barber-landing.js (via runner)
scripts/ai/full_system_dry_run.sh
node --check on all mobile-barber + functions modules
```

Manual checks on mobile (real phone) AND desktop:
- Customer creates a Cash booking via chat → vendor sees `Cash · UNPAID` chips
- Customer creates a Zelle booking via chat → vendor sees `Zelle · UNPAID` chips
- Vendor configures Settings → Payments with a Zelle phone OR uploads a QR image → saves to Firestore
- Vendor taps "Request Zelle Payment" on a Zelle booking → status flips to `payment_requested` (orange) → the Zelle info / QR panel renders
- Vendor taps "Mark paid" → status flips to `paid` (green)
- Reload page → all persisted state survives

---

## Report

Write to `docs/mobile_barber_cash_zelle_payments.md`:

- **Data model changes** — new vendor fields, new payment_requested status
- **Customer flow** — where the payment-method choice surfaces + how it's persisted
- **Vendor portal changes** — new chips, new actions, new Settings → Payments panel
- **Zelle info display** — priority order (QR > phone > email) + screenshots if possible
- **Booking status flow** — UNPAID → PAYMENT REQUESTED → PAID
- **Test results**
- **Production deploy confirmation** (`firebase deploy --only hosting` output, curled version strings)
- **Remaining risks**

PASS only if:
- Customer can choose Cash or Zelle (Cash as default)
- Vendor sees the chosen payment method in the appointment detail
- Vendor's Zelle info / QR image renders correctly on the Zelle-request panel
- Vendor can transition payment status through `unpaid → payment_requested → paid`
- No regression in any of the DO NOT BREAK items
