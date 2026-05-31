# Mobile Barber — Reuse Proven Double‑Booking Guard (Root‑Cause Fix)

**Date:** 2026‑05‑31
**Scope:** Mobile Barber booking write path (manual, AI chat, voice, promotion, AI‑style)
**Trigger:** "Frontend double booking is still not fixed. Stop inventing isolated patches — reuse the salon's proven double‑booking prevention."

---

## TL;DR — what was actually wrong

The double‑booking fix **already existed in the working tree but was never committed or deployed.** Both halves of it:

| Component | Working tree | Committed (HEAD) | Production (served) |
|---|---|---|---|
| `createMobileBarberBookingGuarded` (server pre‑write guard) | present | **absent (count 0)** | **404 — not deployed** |
| `guardedCreateViaCallable` (frontend wiring to call it) | present | **absent (count 0)** | **absent (count 0)** |

**Evidence**

```
# Probe production callables (control vs subject)
aiProxy                          -> HTTP 200   (deployed v2 onCall — proves URL/probe valid)
rejectOffer                      -> HTTP 200   (deployed)
createMobileBarberBookingGuarded -> HTTP 404   (NOT deployed)

# Git: function exists only locally, never committed
git show HEAD:functions/index.js | grep -c createMobileBarberBookingGuarded   -> 0
grep -c createMobileBarberBookingGuarded functions/index.js                   -> 2  (worktree)

# Production-served frontend has no guard wiring
curl .../mobile-barber/mobile-barber-booking.js | grep -c guardedCreateViaCallable -> 0
```

So on production today, the **anonymous customer flow** (which cannot run the owner‑scoped conflict query under Firestore rules) wrote bookings **directly to Firestore with no pre‑write conflict check**, showed "success," and overlaps were only caught *after the fact* by the `onMobileBarberBookingCreated` auto‑decline trigger — i.e. the customer saw a confirmed booking that later silently declined. That is exactly "frontend double booking still not fixed."

**A second, smaller hole:** even the local (un‑shipped) `guardedCreateViaCallable` degraded to an **unguarded direct write that reported success** whenever the callable was unreachable (`mobile-barber-booking.js:1499‑1516`). That violates the explicit rule *"NO SUCCESS BEFORE SAFE WRITE."* This was hardened (see Fix below).

---

## Required Audit — how the proven guard works

> **Important honest finding:** the nail **salon** was named as the gold standard, but the audit shows the salon is actually the **weakest** of the booking paths — it has **no** server guard, **no** transaction, writes `status:'confirmed'` directly from the client, and shows the customer success **before** the write resolves. It "works" only because it is a single authenticated salon whose client can read its own bookings and run `NailAvailabilityChecker.check()` before the AI confirms. The genuinely proven, race‑safe pattern in this repo is the **main‑site `BookingGuard`** (`script.js`, `travel-booking.js`) plus the **server `createMobileBarberBookingGuarded` callable**. The Mobile Barber already implements a *stronger* version of this than the salon — it just wasn't shipped.

1. **How availability is checked (live):** `createMobileBarberBookingGuarded` re‑queries the owner's calendar across **all three service collections** (`mobileBarberBookings`, `bookings`, `travel_bookings`) with the Admin SDK (bypasses rules), `functions/index.js:3328‑3341`.
2. **How overlap is prevented:** geometric window overlap `mbOverlaps(a,b) = a.start < b.end && b.start < a.end` with per‑service duration **+ buffer** baked into the window (`functions/index.js:3094`, `3342`). The shared client guard mirrors this in `booking-conflict-guard.js` (`windowsConflict`, travel‑buffer aware).
3. **How pending bookings are handled:** any non‑terminal status is blocking (`MB_NON_BLOCKING` set; `vendor_review` is **not** skipped — it is still conflict‑checked), `functions/index.js:3172,3320,3337`.
4. **How a slot is confirmed available:** the callable returns `{ ok:false, code:'time_conflict', suggestions:[...] }` (3 same‑day free starts) and **refuses to write** when any overlap exists, `functions/index.js:3349‑3358`.
5. **How the booking is written safely:** only on a clear result does it `ref.set(...)` the validated doc, `functions/index.js:3361‑3366`.
6. **Transaction / idempotency:** deterministic booking id → idempotent retries return the existing non‑terminal doc as success (`3317‑3324`). The client `BookingGuard.guardedWrite` (used by authenticated vendors and the main site) adds a Firestore **transaction + `bookingConflictLocks` lock** (`booking-conflict-guard.js:497‑541`). The race‑safety net for the rare simultaneous write is the `onMobileBarberBookingCreated` trigger: earliest `createTime` wins, the later overlap auto‑declines itself (`functions/index.js:3214‑3261`).
7. **Final booking gate:** for the **customer (anonymous)** path, `createMobileBarberBookingGuarded` is the authoritative pre‑write gate; for **authenticated vendors**, `BookingGuard.guardedWrite` (transaction + lock).

---

## Salon vs Mobile Barber — comparison

| Capability | Salon (nailsalon/receptionist.js) | Mobile Barber — **before** (production) | Gap | Fix |
|---|---|---|---|---|
| Pre‑write availability check | Client `NailAvailabilityChecker.check()` (reads own bookings) | None for anonymous customer (rules block the read) | Customer never had a real check | Route every customer write through `createMobileBarberBookingGuarded` (Admin‑SDK owner‑wide check) |
| Overlap detection | `_overlaps()` strict `>` | Post‑write trigger only | Overlap caught *after* "success" | Server guard refuses overlap **before** write |
| Pending bookings | Queried from `escalations` | n/a client‑side | — | Guard treats all non‑terminal as blocking |
| Confirms slot before "success" | Yes (client check) but shows success **before** write | Showed success on a direct unguarded write | False success | UI success only after guard returns `ok:true` |
| Safe write | Direct client `.set('confirmed')`, no tx | Direct client `.set()` (anonymous) | No gate | Guarded callable writes only when clear |
| Transaction / idempotency | **None** | None (deployed) | — | Deterministic id (idempotent) + `BookingGuard` tx/lock for vendors |
| Final gate | `_submitDirectBooking` (client) | — | Not deployed | `createMobileBarberBookingGuarded` (server) |
| "No success before safe write" | ✗ (shows success early) | ✗ (false success) | Violated | ✓ enforced for all barber paths |

All five Mobile Barber entry paths already funnel through one writer — `BOOKING.saveBooking → persistBooking` (`mobile-barber-booking.js:1432,1519`): **manual** (`mobile-barber.js:2999`), **AI chat** (`mobile-barber.js:1263`), **voice** (same chain via the controller), **promotion** and **AI‑style** (`mobile-barber.js:3322`). So aligning that single writer fixes every path at once.

---

## The Fix

1. **Ship the existing guard.** Commit + deploy `createMobileBarberBookingGuarded` (functions) and the `guardedCreateViaCallable` wiring + multilingual conflict copy (hosting). This alone restores the intended behavior: the second booking for a taken slot is blocked at submit with *"That time is no longer available. Next available: …"* (vi/en/es).
2. **Harden the silent‑fallback hole** (`mobile-barber-booking.js`, `guardedCreateViaCallable`): the customer path now **never reports success without a guarded write**. A real `time_conflict` → conflict UI; any other guard refusal or an unreachable callable → a retry‑able failure (`bookingUnavailableError`), **never** a direct unguarded write that flashes "success." Authenticated‑vendor writes are unchanged (still `BookingGuard.guardedWrite`).
3. **Version strings bumped** `…531a/c/e → 531f` for `mobile-barber-booking.js`, `mobile-barber.js`, `mobile-barber-dashboard.js`, `mobile-barber.css` across `index.html`, `dashboard.html`, `vendor.html` (+ matching test assertions).

### Files changed
- `functions/index.js` — `createMobileBarberBookingGuarded` (+ `mbSuggestAlternativeTimes`, `mbFmtHHMM`) [ship]
- `mobile-barber/mobile-barber-booking.js` — harden `guardedCreateViaCallable`, add `bookingUnavailableError`
- `mobile-barber/mobile-barber.js` — multilingual `bookingConflictNextTimes` copy + `bookingConflictMessage` wired to all catch handlers
- `mobile-barber/mobile-barber-dashboard.js`, `mobile-barber.css` — notification‑badge visibility fix (same batch)
- `mobile-barber/{index,dashboard,vendor}.html` — version bumps
- `tests/lib/mobile-barber-booking.js` — 3 new guarded‑path tests; `tests/lib/mobile-barber-landing.js` — version assertions

---

## Tests

- **Dry‑run command:** `scripts/ai/full_system_dry_run.sh`
- **Dry‑run result:** `FINAL: PASS` (552 passed, 0 failed)
- **New unit coverage (guarded customer path):**
  - conflict → rejects with `bookingConflict` + alternates, **no** direct write
  - clear → saves with `source:'callable'`, client does **not** also write
  - callable unreachable → **rejects** (no false success), **no** direct write
- **Real frontend verification:** see checklist below (requires production deploy).

---

## Verdict
**Approve (root‑cause).** Not a new isolated patch — it ships the already‑built proven guard and enforces the "no success before safe write" invariant the salon itself does not meet.

## Remaining risks
- If the guarded callable has an outage, customer bookings now **fail with a retry message** instead of writing optimistically. This is the deliberate, user‑requested trade‑off (safety > availability). Authenticated vendors are unaffected.
- The server guard's pre‑write check is read‑then‑write (not a transaction); the `onMobileBarberBookingCreated` trigger remains the race‑safety net for simultaneous writes (earliest wins).

## Real‑frontend verification checklist (post‑deploy)
1. Book **Classic Haircut @ 9:35** → success.
2. Same vendor/same 9:35 again → **blocked** before success, shows alternates.
3. Overlapping time (within service+buffer window) → **blocked**.
4. Time after the buffer window → **passes**.
