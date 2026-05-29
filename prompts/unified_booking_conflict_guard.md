# Unified Booking Conflict Guard — Shared Engine (NOT a one-off barber fix)

## Context

DuLichCali is a multi-service platform owned at the account level by an **owner**
(`ownerId`, e.g. `michael-nguyen`) who runs barber + ride/airport + tour businesses.
Bookings live in three Firestore collections:

| Service | Collection | Keyed by |
|---|---|---|
| barber | `mobileBarberBookings` | `vendorId` (each owned barber vendor) |
| ride / airport | `bookings` | `ownerId` |
| tour | `travel_bookings` (canonical) + `bookings` (chat-created tours) | `ownerId` |

Today the app does **NOT** reliably prevent duplicate, impossible, or overlapping
bookings **across** services. Barber has a per-vendor overlap check
(`mobile-barber/mobile-barber-booking.js` → `checkBookingOverlap`,
`checkWindowAvailability`, `loadExistingBookings`) but ride and tour do not, and
nothing checks conflicts **owner-wide across all three services**. A 9:00–10:00
barber booking does not currently block a ride or tour for the same owner at 9:30.

This task builds a **single shared conflict engine** that every booking path calls,
not a barber-only patch. The barber-specific logic must be refactored to delegate to
the shared engine (or the engine must subsume it) so there is one source of truth.

## Goal

Create a reusable function:

```
validateUnifiedBookingRequest({
  ownerId,
  serviceType,            // 'barber' | 'ride' | 'tour'  (airport maps to 'ride')
  vendorId,               // barber vendor id when serviceType === 'barber'
  customerPhone,
  customerName,
  customerUid,            // optional
  customerEmail,          // optional
  requestedStart,         // epoch ms or ISO — normalize internally
  requestedEnd,           // optional; if absent, derive from serviceDurationMinutes
  pickupAddress,
  serviceAddress,
  city,
  zip,
  lat,                    // optional
  lng,                    // optional
  serviceDurationMinutes, // default per service if absent
  travelBufferMinutes,    // default per service if absent
  source                  // 'manual' | 'ai' | 'voice' | 'web-intake' | etc.
})
```

returning:

```
{
  ok,                     // boolean — true only if no blocking conflict AND location resolvable
  reason,                 // machine code: 'available' | 'time_conflict' | 'customer_duplicate'
                          //   | 'outside_service_radius' | 'vendor_review_required' | 'invalid_request'
  conflicts,              // array of { serviceType, bookingId, collection, start, end, status, customerName }
  suggestedSlots,         // 3–5 alternate { start, end } windows that are conflict-free
  normalizedWindow,       // { start, end } in epoch ms after buffer applied
  customerDuplicateRisk,  // { level: 'none'|'possible'|'likely', matchedBookingId, matchedBy }
  distanceMiles,          // number | null when location unknown
  withinServiceRadius     // boolean | null when location unknown
}
```

## Required behavior

### 1. Owner-wide cross-service conflict checking
- A conflict in ANY of the owner's services blocks a new booking in ANY service.
- Example: a 45-minute haircut at 9:00 with a 20-minute travel buffer occupies
  **9:00–10:05**; a ride or tour requested at any overlapping minute (e.g. 9:30,
  or 10:00) must be rejected with `reason: 'time_conflict'` and the barber booking
  listed in `conflicts`.
- Apply `travelBufferMinutes` to BOTH the existing bookings and the requested one
  (mobile services need travel time between locations). Default buffers per service
  (pick sensible defaults, e.g. barber 20, ride 15, tour 30) — do not hardcode a
  single global number; make them per-service constants in one place.
- Default `serviceDurationMinutes` per service when the caller omits it.

### 2. Conflict sources
- Query `mobileBarberBookings` for every barber `vendorId` the owner owns
  (`OwnerBookings.barberVendorIdsFor` / `OwnerModel`), plus `bookings` by `ownerId`,
  plus `travel_bookings` by `ownerId`. Use single-equality + `limit` queries so they
  hit Firestore's automatic single-field index — **no composite index** may be
  required (a composite-index error must be impossible).

### 3. Blocking vs non-blocking statuses
- **Blocking** (occupy a time slot): `pending`, `pending_confirmation`,
  `pending_barber_confirmation`, `confirmed`, `accepted`, `in_progress`, `traveling`,
  `vendor_review`.
- **Non-blocking** (ignored): `cancelled`, `rejected`, `completed`, `expired`,
  `no_show`.
- Centralize these two sets as named constants; reuse the existing barber status
  normalizer (`normalizeBookingStatus`) where possible rather than duplicating it.

### 4. Customer duplicate rule
- Detect when the SAME customer is creating a near-identical booking (same owner,
  same service, overlapping/again-same time). Match by **normalized phone**
  (strip non-digits, last 10), then `customerUid`, then lowercased `customerEmail`.
- Return `customerDuplicateRisk` and, when likely, set `reason: 'customer_duplicate'`
  with the matched booking in `conflicts`. Do not block two genuinely different
  bookings by the same customer at non-overlapping times.

### 5. 30-mile service radius
- If `lat`/`lng` are present for both the owner/vendor service origin and the
  request, compute great-circle `distanceMiles`; reject when > 30 with
  `reason: 'outside_service_radius'`.
- If lat/lng missing, fall back to `city`/`zip` heuristic. If the location **cannot
  be resolved at all**, NEVER silently pass — return
  `reason: 'vendor_review_required'` with `withinServiceRadius: null`,
  `distanceMiles: null`. Unknown location is a soft block requiring vendor review,
  not an auto-approve.

### 6. Integration into ALL booking-creation paths
Every path that writes a booking must call `validateUnifiedBookingRequest` and abort
the write when `ok === false`, surfacing the reason to the user through the existing
AI/UI channel (NOT a new hardcoded string — see "Mandatory rules"). Known paths:

- **Barber — customer (marketplace)**: `mobile-barber/mobile-barber-booking.js`
  (`saveBooking` / `buildBooking`). Refactor existing `checkBookingOverlap` to
  delegate to the shared engine.
- **Barber — manual/vendor + dashboard**: `mobile-barber/mobile-barber-vendor.js`,
  `mobile-barber/mobile-barber-dashboard.js`, `mobile-barber/mobile-barber-data.js`.
- **Ride / airport**: `ride-intake.js` (`submit` / `buildBookingData`),
  `ride-avail.js`, `workflowEngine.js` (AI ride flow).
- **Tour**: `travel-booking.js` (`submitTravelBooking`), `workflowEngine.js`
  (AI tour flow), `script.js` where it writes `travel_bookings`/`bookings`.
- **AI / voice**: `chat.js`, `workflowEngine.js`, `nailsalon/receptionist.js`,
  `marketplace/marketplace.js`, and the barber voice path — anywhere a booking is
  confirmed by AI or voice. Grep for write sites; do not miss one.

The engine itself goes in a **new shared file** (e.g. `booking-conflict-guard.js` at
repo root) as a UMD module. Per project convention the factory must declare
`var root = (typeof window !== 'undefined') ? window : globalThis;` internally and
export a global (e.g. `window.BookingGuard`) plus `module.exports` for Node tests.
Load it from every HTML consumer that runs a booking path, with a fresh `?v=` string.

### 7. Suggested alternate slots
- Always return 3–5 conflict-free `{start,end}` windows near the requested time
  (same day first, then next available), respecting buffers and the same conflict
  rules. These feed the AI so it can offer the customer real alternatives.

### 8. Atomicity / race safety
- Re-check conflicts **inside** the write transaction (or immediately before the
  write) so two near-simultaneous requests can't both pass. Use a Firestore
  transaction or a deterministic lock document keyed by
  `ownerId + ':' + dateString + ':' + timeWindowStart`. Document the chosen mechanism
  in the report. The pre-write re-check is mandatory — a stale read must not allow a
  double-book.

### 9. Diagnostic logging
- Emit concise `[booking-guard]` console logs at decision points: inputs summary,
  conflict found (which collection/booking/status), distance decision, final verdict.
  No PII beyond what already appears in existing logs; no secrets.

## Tests (14 — add to the existing test harness so `node tests/runner.js` covers them)

1. Barber 9:00–9:45 (+20 buffer→10:05) blocks ride at 9:30 → `time_conflict`.
2. Barber 9:00–9:45 allows ride at 10:30 (after buffer) → `available`.
3. Ride blocks overlapping tour for same owner → `time_conflict`.
4. Tour blocks overlapping barber for same owner → `time_conflict`.
5. Cancelled/rejected/completed/expired bookings do NOT block → `available`.
6. `pending`/`confirmed`/`in_progress`/`traveling` DO block.
7. Same customer same-time duplicate → `customer_duplicate`, risk `likely`.
8. Same customer different non-overlapping time → `available`, risk `none`.
9. Phone normalization: `+1 (408) 916-3439` matches `4089163439`.
10. Location > 30 miles via lat/lng → `outside_service_radius`.
11. Location within 30 miles → not blocked on radius.
12. Unknown/unresolvable location → `vendor_review_required`, `withinServiceRadius:null`.
13. `suggestedSlots` returns 3–5 conflict-free windows that themselves pass the guard.
14. Pre-write re-check / lock: two simultaneous identical requests → exactly one
    succeeds, the other gets `time_conflict` (simulate the transaction re-read).

## Mandatory rules (from CLAUDE.md — non-negotiable)

- **Mobile-first**: behavior identical on mobile (375px) and desktop (1280px); same
  code path on both. The conflict guard is logic, so it must behave identically.
- **NO hardcoded user-facing strings in any language** (vi/en/es). Rejection reasons
  surface to the customer by passing an **English-only** `[SYSTEM: ...]` reason back
  through the AI so it replies in the customer's language — never write a localized
  rejection string directly. Internal admin/vendor messages must use the existing
  translation-key lookups (vi+en+es in the same change).
- **JS/CSS `?v=` cache-busting**: any `.js`/`.css` file you edit or add must have its
  `?v=` bumped in EVERY HTML consumer to a version string never used before
  (`grep -rn "filename.js" --include="*.html"`; verify against `git log --all`). Use
  a date ≥ today with a letter suffix higher than any prior.
- Booking availability logic is a **critical trigger area**: read current code before
  changing; make the smallest safe change; do not weaken any existing availability or
  compliance gate.
- Run `scripts/ai/full_system_dry_run.sh` and ensure **FINAL: PASS** before declaring
  done. Also `node --check` every edited/new `.js`. Targeted: `node tests/runner.js`.

## Do NOT break / do NOT touch

- Luxurious Nails (`nailsalon/`) page behavior — must remain unchanged.
- `driver-admin.html` and driver compliance gates — out of scope, do not modify.
- Vendor data isolation (nails vs hair vs food vs barber) — no cross-vendor leakage.
- Existing booking-creation success path when there is NO conflict — a valid booking
  must still be created exactly as before.
- Do NOT deploy. Do NOT push to remote. Do NOT commit (the operator commits manually).
- Do NOT introduce a Firestore composite-index requirement.

## Report

Write `docs/unified_booking_conflict_guard.md` covering: chosen atomicity mechanism,
engine API, per-service buffer/duration defaults, every integration point touched,
the 14 test results, version-string bumps, do-not-break verification, and an honest
PASS/BLOCKED status (runtime that requires an authenticated live Firestore session is
BLOCKED, not falsely claimed PASS — match the Phase 2 report's honesty).
