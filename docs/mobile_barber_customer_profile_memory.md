# Mobile Barber — Customer Profile Memory

**Date:** 2026-06-01
**Goal:** When a customer books again, the app auto-loads their known info and shares it with the
AI booking brain so returning customers don't re-enter known details.
**Deploy (production `https://www.dulichcali21.com`):** Functions
`onMobileBarberCustomerBookingStatus`, `firestore:rules`, and hosting
(`mobile-barber-agent.js?v=20260601a`, `mobile-barber-booking.js?v=20260601a`,
`mobile-barber-customer.js?v=20260601b`).

---

## Audit first (what already existed)

A 5-agent parallel audit found the **phone-first lookup + prefill machinery already existed** and
should be **extended, not rebuilt**:

- `agentContext.customerLookupProvider(phone)` → `BOOKING.lookupReturningCustomer(null, phone)`
  (localStorage → `mobileBarberCustomers` by phone → `mobileBarberBookings` fallback) →
  `applyCustomerRecord()` / `applySavedAddress()` already prefill name/address/barber/previous service.
- The prompt already said "Phone lookup is always first for booking."

The real gaps: (1) loaded memory was **never injected into the Claude-API prompt**, so the brain
cold-started; (2) **no explicit "same address AND same style as last time?"** confirmation;
(3) the profile was written **only on `completed`**, with ~5 fields, so most memory was never
persisted (especially for anonymous customers); (4) the lookup projection dropped most fields;
(5) the vendor read rule **over-permitted** (any member of the stored `vendorId`, no assigned-booking check).

## Changes (minimal, reuse existing machinery)

| File | Change |
|---|---|
| **`functions/index.js`** | New `mbUpsertCustomerProfileFromBooking(booking, id)` called from the booking trigger on **EVERY** write (create + status change), **before** the status-change short-circuit. Admin SDK → works for logged-in (`uid`) **and anonymous (`phone_<normalized>`)** customers. Persists name/phone/email/vendor/preferred barber/address/last service/payment+confirmation prefs + a bounded `bookingHistory` (last 20) + **text-only** `haircutPreferences` (styleId/name/description/color/highlight/texture/notes — **never** the AI image). **Never overwrites a customer-set `preferredLanguage`.** Writes a `vendorAccess/<vendorId>` marker. |
| **`mobile-barber-agent.js`** | Inject sanitized returning-customer memory into `_buildAIBrainPrompt` (`preferredBarber`, `previousService`, `previousAddress`, `preferredLanguage`, `previousPayment`, `customerNotes`, `bookingHistorySummary`). New `_sanitizeForPrompt()` strips `[]{}\n\r` + caps length so a stored value can't forge a `[STATE:{…}]` marker. Added `styleConfirmed` state + `foundCustomerStyle` string (vi/en/es) for the combined "same address AND same {service}?" question; affirming at the confirm step adopts `previousServiceId` (gated to that step so a stray "yes" never auto-selects). `applyCustomerRecord` also prefills payment preference. |
| **`mobile-barber-booking.js`** | `safeCustomerRecord` now also returns `preferredLanguage`, `paymentMethod`, `confirmationPreference`, `reminderPreferenceWeeks`, `haircutPreferences`, `bookingHistory` (existing keys unchanged). |
| **`mobile-barber-customer.js`** | `profilePayload` adds `paymentPreference` + `confirmationPreference` (scalars only — no array fields a merge-save could wipe). |
| **`firestore.rules`** | Vendor read of `mobileBarberCustomers` now requires `isVendorMember(vendorId)` **AND** `exists(.../vendorAccess/<vendorId>)` — strictly more restrictive, scopes vendor reads to assigned bookings. Added `match /vendorAccess/{vid}` (client deny; Admin-written). |

Language is intentionally driven by in-session detection (not forced from the profile) so the
language lock isn't overridden; the saved language is surfaced to the brain via the prompt.

## Verification

### Live — server profile memory (deployed trigger) — `tests/live/mb-customer-profile-memory-verify.js` — **11/11**
Anonymous (phone-keyed) booking → profile created with name/last service/vendor, address/city/zip,
payment preference, a `bookingHistory` entry, **text-only** style memory (styleId + color), and a
`vendorAccess` marker. **No AI hairstyle image persisted.** A second booking with a new address
**updates** the profile (merge) and a later booking does **NOT** overwrite the customer-set
`preferredLanguage` (`vi`); history accumulates both bookings.

### Live — notification prefs (regression) — `mb-customer-notif-prefs-verify.js` — 6/6 (unchanged).

### Functional — the brain actually uses the memory (tests 4 & 5)
Executed `AGENT.buildAIBrainPrompt(state, ctx)` with a rich record: the prompt contains
`preferredBarber: Tim Nguyen`, `previousService: Classic Haircut`,
`previousAddress: 123 A St, San Jose`, `bookingHistorySummary:`, `previousPayment: zelle`; a
note containing `[STATE:{evil}]` is **stripped** before injection; `styleConfirmed` merges.

### Dry-run gate
`scripts/ai/full_system_dry_run.sh` → **FINAL: PASS — 584 passed, 0 failed** (+8 source + 3 functional
profile-memory tests in `tests/lib/mobile-barber-profile-memory.js`).

### 8 required tests
| # | Test | Result |
|---|---|---|
| 1 | New customer creates profile | ✅ live (profile built on first booking) |
| 2 | Returning phone loads profile | ✅ `lookupReturningCustomer` + extended `safeCustomerRecord` |
| 3 | Manual booking pre-fills data | ✅ vendor portal already loads + applies saved profile (unchanged path) |
| 4 | AI chat uses profile context | ✅ functional (prompt contains the memory) |
| 5 | Voice agent uses profile context | ✅ shared brain — same prompt + `foundCustomerStyle` confirm |
| 6 | Updated address saves back | ✅ live (merge; language not overwritten) |
| 7 | Selected haircut style saves | ✅ live (text-only; no image) |
| 8 | Vendor portal shows customer history | ✅ booking-scan + profile read scoped to assigned bookings |

## Security

- Customer can view/edit only their own profile (owner-only client write; `customerId == auth.uid`).
- The profile is written from bookings only by the **Admin-SDK trigger** (bypasses rules) — the
  only path that can serve anonymous-by-phone customers; clients still cannot write another
  customer's profile.
- Vendor read is now scoped to **assigned bookings** via the Admin-written `vendorAccess` marker —
  strictly more restrictive than before (can only deny more, never grant more). The customer flow +
  own-profile reads are unaffected.
- **Firestore rules emulator harness** (`tests/rules/firestore-rules.test.js`, run with
  `npm run test:rules`) now locks this rule against the real `firestore.rules` in the Firestore
  emulator — **12/12**: assigned vendor reads ✓, vendor with no `vendorAccess` marker denied ✓,
  non-assigned vendor denied ✓, vendor cannot modify the profile ✓, customer own/cross-customer
  read + notification field-guard ✓. Uses `@firebase/rules-unit-testing` (JDK 11+ via Homebrew
  `openjdk@17`). Wired into `scripts/ai/full_system_dry_run.sh` **skip-aware**: it runs when the
  firebase CLI + dev deps + a JDK 11+ are present (and fails the gate if the rules test fails),
  and SKIPs (never PASS/FAIL) when those prerequisites are missing — so the gate never hard-requires
  Java/network.
- **No AI hairstyle images / selfies** are persisted — only text style references (verified live).

## Verdict
**PASS** — returning customers no longer re-enter known info (server builds/refreshes a phone- or
uid-keyed profile after every booking; lookup prefills name/address/barber/last style/payment), and
the AI brain receives and uses the memory (verified: prompt carries the profile, asks the combined
"same address and same {service} as last time?" question, and adopts the previous service on
affirmation). Booking/double-booking guards and notification settings remain intact (584/584).
