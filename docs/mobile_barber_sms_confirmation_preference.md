# Mobile Barber — Customer Confirmation Preference + Vendor SMS Launcher

**Date:** 2026-05-27
**Status:** ✅ Shipped to production

---

## Goal

Let customers choose how the barber should confirm their appointment
(**Call / Text / App notification**, default **Text**), persist that choice
on the booking, and give the vendor a one-tap "Send Confirmation Text"
launcher inside the dashboard appointment row so they can fire off the
confirmation from their own phone without typing.

---

## Customer side — booking flow

### Data model

`mobile-barber-data.js`:

- Added `confirmationPreference` + `confirmationSentAt` to `BOOKING_FIELDS`.
- New exports: `CONFIRMATION_PREFERENCES = ['call', 'text', 'app']` and
  `DEFAULT_CONFIRMATION_PREFERENCE = 'text'`.
- `validateBooking()` rejects anything outside the allow-list; empty/null is
  permitted so old bookings without the field stay valid.

`mobile-barber-booking.js`:

- New `normalizeConfirmationPreference(pref)` resolves any input to one of
  the 3 supported values, falling back to `'text'`.
- `buildBooking()` writes `confirmationPreference` on every new booking.
- `buildRebookDraft()` carries the preference forward when a customer rebooks.
- AI agent bookings flow through the same `buildBooking()` path, so they
  default to `text` without the agent having to ask another question.

### Customer form (manual booking modal, `vendor.html` step 1)

3-pill radio group placed right under contact info, where it's most relevant:

```
How would you like us to confirm your appointment?
  ( ) Text (SMS)            ← default checked
  ( ) Phone call
  ( ) App notification
Text is the default. The barber will reach out using your choice.
```

- Persisted by `getManualDraft()` / `setManualDraft()`
- Default `'text'` is set both in HTML (`checked` attribute) AND in JS
  (`(query) || 'text'`) so a tabbed-past form still saves a deterministic
  value.

i18n keys added in vi / en / es: `confirmationPreferenceLabel`,
`confirmationPreferenceText`, `confirmationPreferenceCall`,
`confirmationPreferenceApp`, `confirmationPreferenceHint`.

---

## Vendor portal — appointment row

### Row chip (collapsed view)

Inside the `mb-booking-row__head` button, between the meat and the price, a
preference chip renders:

| Preference | Chip | Color treatment |
|---|---|---|
| `text` | `📱 TEXT CONFIRMATION REQUIRED` | Gold gradient + animated pulse halo (2.4s ease-in-out, reduced-motion guarded) |
| `call` | `📞 CALL TO CONFIRM` | Sky-blue calm pill |
| `app`  | `🔔 APP NOTIFICATION` | Slate-grey pill |

When pref is `text`, the row's left-border accent is also nudged to the
gold "needs attention" tone via `:has(.mb-confirmation-chip--text)`.

### Expanded detail

In the **Customer contact** section, a new row surfaces the resolved
preference label ("SMS (text message)" / "Phone call" / "In-app
notification"), so the vendor can see the channel even if the chip in the
collapsed row scrolled out of view.

### "Send Confirmation Text" launcher

Inside the actions row (alongside Accept / Reschedule / Cancel / Mark paid
/ etc.), an `<a class="mb-button mb-button--primary mb-sms-button">`
appears when:

- `booking.confirmationPreference === 'text'` AND
- `booking.customerPhone` is present

Clicking it opens the vendor's native SMS app composing to the customer
with a prefilled body:

```
Hi {customer},

This is {barber} Mobile Barber.

Confirming your appointment:

Service: {service}
Date: {date}
Time: {time}

Reply YES to confirm.

Thank you.
```

The href is constructed as:

```
sms:{digits-of-customerPhone}?&body={URL-encoded body}
```

(`?&body=` works on both iOS and Android.)

The template is language-aware: vi / en / es bodies all live in the
dashboard `STRINGS` table under `smsConfirmationBody`. `interpolate()`
fills in `{customer}` (first name only), `{barber}` (from
`state.vendor.barberName || businessName`), `{service}` (`booking.serviceName`),
`{date}` (`booking.requestedDate`), `{time}` (`formatTime12Hour`).

### Mobile vs desktop

| Surface | Treatment |
|---|---|
| **Desktop** | Chip sits inline in the row; SMS button is a normal small primary button beside other actions. |
| **Mobile (≤680px)** | Chip stays inline (wraps with the customer name + service line); SMS button claims `flex: 1 1 100%` so it becomes a full-width primary CTA inside the actions row (min-height 48px for easy thumb). |

i18n keys (vi / en / es): `confirmTextChip`, `confirmTextChipAria`,
`confirmCallChip`, `confirmAppChip`, `confirmationPreferenceLabel`,
`confirmPrefText`, `confirmPrefCall`, `confirmPrefApp`,
`sendConfirmationTextAction`, `sendConfirmationTextAria`,
`smsConfirmationBody`.

---

## Files changed

```
 mobile-barber/mobile-barber-data.js      |  +7   (field + exports + validator)
 mobile-barber/mobile-barber-booking.js   |  +18  (normalizer + buildBooking + rebook draft)
 mobile-barber/vendor.html                |  +18  (3-pill radio in step 1)
 mobile-barber/mobile-barber-vendor.js    |  +24  (getManualDraft + i18n vi/en/es)
 mobile-barber/mobile-barber-dashboard.js |  +105 (chip render + sms launcher + helpers + i18n)
 mobile-barber/mobile-barber.css          |  +110 (chip + animation + sms button + radio pills)
 mobile-barber/dashboard.html             |   5 lines (css + js version bumps)
 mobile-barber/index.html                 |   3 lines (data + booking + css version bumps)
 tests/lib/mobile-barber-data-model.js    |  +12  (preference + default + invalid case)
 tests/lib/mobile-barber-landing.js       |   5 lines (version asserts)
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

$ node --check mobile-barber/mobile-barber-{data,booking,vendor,dashboard}.js
all syntax OK
```

---

## Production deploy verification

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete

$ curl -sL "https://www.dulichcali21.com/mobile-barber/dashboard.html" \
    | grep "v=20260527"
  <link ... mobile-barber.css?v=20260527d>
  <script ... mobile-barber-data.js?v=20260527a>
  <script ... mobile-barber-booking.js?v=20260527a>
  <script ... mobile-barber-dashboard.js?v=20260527c>

$ curl -sL "https://www.dulichcali21.com/mobile-barber/vendor.html" \
    | grep mbConfirmationPreference
  <fieldset class="mb-radio-group mb-radio-group--confirmation" id="mbConfirmationPreferenceGroup">
  <input type="radio" name="mbConfirmationPreference" value="text" checked>
  <input type="radio" name="mbConfirmationPreference" value="call">
  <input type="radio" name="mbConfirmationPreference" value="app">
```

✔ Production updated — https://www.dulichcali21.com

---

## What did NOT change

- Booking DB writes (Firestore `mobileBarberBookings` rules + statuses)
- Appointment status updates (Accept / Reject / Reschedule / Cancel / Mark
  paid / Mark unpaid / Cash / Zelle / Payment note / Map link)
- Voice booking pipeline
- AI booking flow (slot machine, vendor routing)
- Settings accordion + clickable summary filter cards from prior cycles
- Customer landing (`/mobile-barber`)
- Vendor portal login / dashboard layout

---

## Remaining risks

1. **AI agent never asks** for the preference — it always lands as `text`.
   Acceptable since text is the spec default and the customer can change it
   in the manual form. Adding a one-line agent prompt is a small follow-up
   if Michael / Tim want to capture it conversationally.
2. **SMS launcher uses `sms:` URI**, which depends on the vendor's phone
   having a default SMS app. On desktop browsers without an SMS handler,
   clicking the link does nothing (or opens a system handler picker). The
   vendor portal is primarily used on phones, so this is fine in practice.
3. **`confirmationSentAt` field is reserved** in the data model but not
   updated yet. A follow-up could write a timestamp when the vendor taps
   the launcher (via a click handler + Firestore update) to track whether
   a confirmation has gone out. Today the vendor still owns whether they
   tap the button.
4. **No two-way SMS delivery / reply parsing.** The customer's "YES" reply
   lands in the vendor's normal SMS inbox; we don't auto-update the
   booking status. Out of scope; would require Twilio.
5. **Animation on the gold chip** is gentle (2.4s pulse). On long lists with
   many `text`-preference bookings the page paints repeatedly; impact is
   negligible (CSS-only, `box-shadow` interpolation, GPU-friendly) and
   `prefers-reduced-motion` strips it entirely.
