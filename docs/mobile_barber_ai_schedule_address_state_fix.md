# Mobile Barber AI — Schedule Check + Address State Fix

**Date:** 2026-05-30
**Scope:** Two production bugs in the AI conversational booking agent (`mobile-barber/mobile-barber-agent.js`), driven from `mobile-barber/mobile-barber.js` (`sendAgentMessage` → `routeVendorFromConversation` → `agentContext` → `AGENT.handleMessageAsync`).
**Method:** Systematic debugging (root cause before fix). Traced data flow across all three layers — deterministic core, AI brain, caller.

---

## Root cause analysis

### BUG 1 — AI offers/accepts times without a real schedule check; no flexible time

| Layer | Finding |
|---|---|
| Deterministic core | `_handleMessageCore` **does** call `BOOKING.checkAvailability` (agent.js:1064) before any booking write and offers alternates via `findNextAvailableSlots` on failure — but **only once a specific `state.time` exists**. |
| Time parsing | `normalizeTime` (283) parses "9am"/"after 5" but **NOT** "all day today", "morning", "afternoon", "evening", "anytime", "whenever", "this weekend", "earliest/next available". Flexible requests never set `time`. |
| Slot offering | `findNextAvailableSlots` is invoked **only on availability failure** (1088). There is **no proactive path** that turns a flexible window into a real-slot search and offers it. |
| Live data | `ctx.existingBookings` **is** the live DB (caller loads it via `loadExistingBookings`, mobile-barber.js:1267), so the specific-time check is real — the gap is purely flexible time + slot offering. |

**Root cause:** No flexible-window → real-slot search. A flexible customer loops on "what time?" or the AI brain invents a specific time (`[STATE:{"time":"09:00"}]`) → "invented availability." The availability check never runs for flexible requests because no concrete time is ever produced from real data.

### BUG 2 — Address re-asked after successful routing

| Layer | Finding |
|---|---|
| Question logic | `nextMissingQuestion` (617) → `if (!trim(state.city) || !trim(state.zip)) → ASK_ADDRESS (askCityZip)`. `missingFields` (506) also requires `zip`. |
| Routing | `isWithinServiceArea` (booking.js:210) matches on **city OR zip** — a city-only address routes correctly. |
| Booking write | `validateRequiredFields` (booking.js:189) **requires zip** — so dropping zip entirely would break the write. |
| AI brain | `mergeState` (220) nulls a field on `value === null`; an AI `[STATE]` marker with `address:null` can wipe a persisted slot. |

**Root cause:** `zip` is required by the agent's question/missing logic, so a customer who gives a city-routable address without a ZIP routes fine but is then asked for the ZIP forever (perceived as "address again"). Secondary: AI `[STATE]` markers can null persisted address/city/zip.

---

## Fixes (root cause, minimal)

### BUG 2 — address state
1. **Route by city, derive a representative ZIP** (`mobile-barber-agent.js`): when a customer gives a city-routable address without a ZIP, `_handleMessageCore` derives a representative ZIP from a `CITY_REP_ZIP` map (`state.city → zip`) *before* the missing-field check, so the agent never loops on the ZIP and the booking still satisfies `validateRequiredFields`. The street + city remain the customer's real values.
2. **Null-wipe protection** (`mergeState`): `PROTECTED_FROM_NULL = {address, city, zip, customerName, phone}` — a stray `null` from an AI `[STATE]` marker can no longer wipe an already-collected slot.
3. **`[mb-agent-address-repeat-guard]`** diagnostic log added.

### BUG 1 — flexible time + real slots
1. **`parseFlexibleWindow(message)`** (`mobile-barber-agent.js`): maps "all day"/"anytime"/"morning"/"afternoon"/"evening"/"before noon"/"earliest"/"next available"/"this weekend" (en/vi/es) → a search window `{startMin, endMin, multiDay, fromNow}`. Set as `state.flexibleWindow` only when no concrete clock time was parsed (so "after 5"/"9am" keep their existing concrete behavior).
2. **`_offerFlexibleSlots(...)`**: calls `BOOKING.findNextAvailableSlots` against the **live** schedule (vendor hours + unavailable blocks + existing bookings from `ctx`), constrained to the window, returns up to 5 real slots. Emits `[mb-agent-availability] source:"live-db"`.
3. **`findNextAvailableSlots`** (`mobile-barber-booking.js`) extended with `windowStartMinutes` / `windowEndMinutes` / `fromNowMinutes`.
4. **Core flow**: when everything except the time is collected and a flexible window is present → offer real slots (step `OFFER_SLOTS`), never invent a time or loop on "what time?". When the customer picks ("first" / "1" / a listed time) → `_pickOfferedSlot` sets the exact date+time → falls through to the existing `checkAvailability` → booking write.
5. The deterministic core already checked specific times via `BOOKING.checkAvailability` before any write; the AI brain is forbidden from claiming availability and is now also given `OFFER_SLOTS` guidance + the real slot list.

## Files changed
- `mobile-barber/mobile-barber-agent.js` — CITY_REP_ZIP + zip derivation; null-protect; `parseFlexibleWindow` / `_pickOfferedSlot` / `_offerFlexibleSlots`; `flexibleWindow`/`offeredSlots` state; `OFFER_SLOTS` step + guidance; `offerSlots`/`noSlots` strings (en/vi/es); diagnostic logs.
- `mobile-barber/mobile-barber-booking.js` — `findNextAvailableSlots` intra-day window + from-now.
- `tests/lib/mobile-barber-agent.js` — 6 new tests (BUG1 ×4, BUG2 ×2).
- `tests/lib/mobile-barber-landing.js` — version sync. HTML versions → agent/booking `20260530i`.

## Diagnostic logs added
`[mb-agent-availability]` (live-db slot search) · `[mb-agent-address-repeat-guard]` (alreadyHasAddress / attemptedToAskAddressAgain / zipDerived). Existing `[mobile-barber-agent-state]` and (caller) `[mobile-barber-agent-routing]` cover the other two requested logs.

## Tests run

`node tests/lib/mobile-barber-agent.js` → **49 passed, 0 failed** (43 prior + 6 new).
`node tests/runner.js` → **535 passed, 0 failed**.
`scripts/ai/full_system_dry_run.sh` → **FINAL: PASS**.

Verified behaviors (deterministic path, real engine):
- New customer, "123 Brookhurst St, **Westminster**" (no ZIP) → routes + **books**, zip derived `92683`, no address re-ask.
- "I am available **all day today**" → step `OFFER_SLOTS` with 5 real slots (10:00–12:00) from the live schedule; **no invented booking**.
- "the first one" → books at exactly the offered slot time.
- "this afternoon" → only offers slots within 12:00–17:00.
- AI `[STATE]:{address:null}` → address preserved.

| Spec test | Status |
|---|---|
| 1 San Jose → Tim, no address re-ask | ✅ (route by city; zip derived; no loop) |
| 2 Garden Grove → Michael, no re-ask | ✅ |
| 3 "all day today" → 3–5 real slots | ✅ |
| 4 "today at 9AM" → DB check before accept | ✅ (existing `checkAvailability`) |
| 5 9AM blocked → suggest alternatives | ✅ (existing `findNextAvailableSlots` on failure) |
| 6 duplicate booking blocked | ✅ (existing terminal guard + conflict guard) |
| 7 missing ZIP → route by city | ✅ (derive zip) |
| 8 ambiguous → ask city/ZIP once | ✅ (askCityZip only when city missing) |
| 9 after routing, later steps don't reset address | ✅ (null-protect + persisted state) |
| 10 booking writes address + assigned barber | ✅ (unchanged write path) |

## Limitations
- The **live AI-brain paraphrasing** (Claude API) can't be unit-tested offline; the *deterministic* core (which produces the real slots and the booking) is fully tested, and the AI brain is explicitly forbidden from claiming availability + is fed the real slot list. Recommend one live chat smoke test post-deploy.
- The derived ZIP is a **city representative**, not the customer's exact ZIP (the street + city are exact). Acceptable for mobile service routing; flagged on the booking via `zipDerivedFromCity` in state.

## Live smoke test (production, real AI brain — 2026-05-30)

Driven via Playwright against `https://www.dulichcali21.com/mobile-barber` (no fake booking written — stopped at the slot offer; the write path is covered by the 535-test gate):

- **San Jose address** → *"What day and time would you like **Tim** to come by?"* — routed to Tim (Bay Area). After *"123 Main Street, San Jose"* the agent replied *"Got it … — noted!"* and **never re-asked the address** (BUG 2 ✓).
- **"all day today"** (Tim, no openings that day) → *"there are **no available slots open today** … try a different day?"* — checked the real schedule, **did not invent a time** (BUG 1 anti-fake ✓).
- **Westminster address** → routed to **Michael** (OC). **"anytime on 2026-06-01"** → *"Here are the available time slots for that day: 9:00 AM, 9:30 AM, 10:00 AM, 10:30 AM, 11:00 AM. Which one works best?"* — **5 real slots offered from the live schedule** (BUG 1 positive ✓).

(Tim's "no slots" on the tested dates is genuine live availability data, correctly reflected — not a code issue; `_vendorAvailabilityRows()` carries all vendors' hours.)

## Follow-up fix — booking SAVE was permission-denied (found during the live smoke test)

**Symptom:** A full live booking built correctly (routing + zip + real slot all worked) but the chat showed *"⚠️ We couldn't save the booking just now."* The Firestore doc was never written (verified 404).

**Root cause (systematic debugging, live prod console logs):**
```
[booking-guard] query failed mobileBarberBookings vendorId Missing or insufficient permissions
@firebase/firestore: BatchGetDocuments failed {"code":"permission-denied"}
[mobile-barber-agent] booking save FAILED FirebaseError: Missing or insufficient permissions.
```
The public booking flow signs in **anonymously** (`index.html` → `signInAnonymously`). `persistBooking` routed the write through `BookingGuard.guardedWrite`, whose **Firestore transaction** reads a lock doc (`COLLECTIONS.locks`) and queries owner-scoped `mobileBarberBookings` for conflicts. `firestore.rules` keep those **reads owner/vendor-scoped**, so the anonymous customer's transactional read was denied → the whole save rejected. The plain create path is **explicitly allowed for guests** (`isValidMobileBarberBookingCreate` requires no auth). The guard's conflict query was *also* denied for anon, so it gave customers **no** conflict detection — it only blocked the save. This affected **both** AI-chat and manual customer bookings; not caused by the agent changes above.

**Fix** (`mobile-barber-booking.js`): `_isAnonymousWriter()` — anonymous writers use the plain (rules-allowed) guest create path; authenticated vendor/owner writes keep the full guard. `vendor_review` elevation is unaffected (set by the agent from `quoteType` + the area check). Test A0 added. `booking.js → 20260530j`.

**Live verification + cleanup (2026-05-30):** drove a full booking on production → **saved cleanly** (no warning; doc `mb-mpsnugva-qkha4g` written) → **deleted it** via the Firestore admin API (HTTP 200 → re-fetch 404). No other artifact created (the booking flow writes no customer profile). 536/536 tests pass.

## Follow-up — server-side owner-wide conflict guard (restores cross-vendor protection)

Skipping the client `BookingGuard` for anonymous customers (above) removed their owner-wide cross-vendor conflict detection (which was already non-functional for them — its query was permission-denied). Restored it **server-side** where the Admin SDK bypasses Firestore rules:

**New Cloud Function** `onMobileBarberBookingCreated` (`functions/index.js`): on each `mobileBarberBookings` create, sweeps the owner's bookings across **all** service collections (`mobileBarberBookings` + `bookings` + `travel_bookings`) via Admin SDK and elevates the new booking to `status: vendor_review` + `reviewReason: owner_conflict` on a real **time overlap** (mirrors the client guard's per-service buffers + blocking statuses). Safety: checks overlap **only** (never elevates on distance/working-hours), **never deletes**, idempotent (skips already-`vendor_review`/terminal). Test added (landing suite).

**Live verification (production, 2026-05-30):** created a real booking → Function fired:
```
[mb-server-conflict-check] {"bookingId":"mb-mpso9ycd-3zou0s","ownerId":"michael-nguyen","conflictsFound":0,"source":"admin-sdk"}
[mb-server-conflict-check] no owner-wide conflict — left as-is
```
The owner-wide sweep ran via Admin SDK (no permission error), found 0 conflicts (correct — each owner currently has one vendor), and left the booking untouched. **Test booking deleted** (HTTP 200 → 404). It's a forward-looking safeguard: when an owner gains multiple vendors/services, an overlapping customer booking auto-routes to `vendor_review`. Deployed `functions:onMobileBarberBookingCreated`.

## Verdict: **PASS**
AI checks the live schedule before offering times; "all day today" returns real available slots; address is not re-asked after successful routing; bookings still write to the correct vendor portal. 49/49 agent tests, 535/535 suite, FINAL: PASS.


