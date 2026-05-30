# Mobile Barber — Go-Live Booking Regression Report

**Date:** 2026-05-30
**Scope:** Full booking-safety regression across all Mobile Barber booking paths before production launch.
**Verification:** 542 automated unit/integration tests + 14 **live production Firestore** smoke checks + static dry-run gate.
**Production target:** `https://www.dulichcali21.com` (Firebase project `dulichcali-booking-calendar`).

---

## Recommendation: ✅ **GO**

Every go-live PASS criterion is met and verified — the safety-critical ones against the **live production database**, not just mocks. The booking write path that previously failed (the "AI built a booking but Firestore rejected the write" incident) is fixed and **live-verified accepting an anonymous customer create**. Duplicate prevention, the server-side cross-service conflict guard, promotion snapshots, and vendor-portal delivery all pass live. Three residual items are **monitored risks, not blockers** (detailed at the end); none can cause a double booking, a silent write failure, or a stale auto-confirmation.

---

## How this regression was run

1. **Codex↔Claude loop** (`ai_dev_loop.sh`, 2 iterations) produced the code improvements (idempotency key, `bookingRequestId`, `requireDatabase: true`, live vendor hydration) and an adversarial safety audit. The loop's automated harness passed (540 tests); its reviewer returned a **conditional NO-GO** because the live smoke tests, the live-data fallback enforcement, and this report were not yet done. (The loop's 2nd iteration halted on a Codex usage-limit, not a code error.)
2. **This session** then: audited every Codex change line-by-line, fixed the one functional gap (live-data fallback → `vendor_review`), added regression tests, and executed the **live production smoke tests** the loop structurally cannot run.

---

## Test matrix

### A. Automated suite — `node tests/runner.js` → **542 passed, 0 failed**

| Area | Coverage | Result |
|---|---|---|
| Region routing | San Jose/Santa Clara/Sunnyvale → Tim; Garden Grove/Westminster/Irvine → Michael; out-of-area & ambiguous → review/clarify | ✅ |
| Conflict guard | exact / partial / back-to-back-with-buffer overlap; owner-wide cross-service (barber↔ride/tour); non-blocking statuses (cancelled/completed) ignored | ✅ |
| Idempotency | deterministic `bookingRequestKey` (phone\|vendor\|service\|date\|time); repeated id → same doc | ✅ |
| Promotion pricing | apply active; expired/disabled blocked; max-redemption; price never $0; snapshot stored | ✅ |
| Address validation | full accepted; city-only → review; missing city → clarify; out-of-region blocked; unknown not silently confirmed | ✅ |
| Booking build/write | required fields present; `requireDatabase: true` rejects on write failure; save-failure copy replaces (not appends) | ✅ |
| AI haircut reference | selected style image + barber notes + audience/color/highlight fields persisted; dashboard renders them | ✅ |
| **Live-data enforcement (new)** | `static-fallback` availability → `vendor_review`; `firestore` data confirms normally | ✅ (2 new tests) |

### B. Live production Firestore smoke — `node tests/live/mb-go-live-smoke.js` → **14 passed, 0 failed**

Anonymous customer identity (`signInAnonymously`), name **"Smoke Test"**, phone **408-555-0199**, doc ids `SMOKE_TEST_*`. Writes use the **real customer path** (anon REST → subject to security rules; Admin SDK is only used to verify + clean up).

| # | Live check | Result |
|---|---|---|
| 1 | Anonymous auth (production-referrer-locked API key) | ✅ 200 |
| 2 | **Anon create accepted by live security rules** (incl. new `bookingRequestId` + promo fields) | ✅ 200 |
| 3 | Booking visible in Michael **owner-scoped query** (vendor portal source) | ✅ |
| 4 | Stored status is a pending/review status | ✅ `pending_barber_confirmation` |
| 5 | **Promo snapshot persisted** ($40 → $32, 20% "Father's Day") | ✅ |
| 6 | Discounted price ≠ $0 | ✅ $32 |
| 7 | `bookingRequestId` stored on doc | ✅ |
| 8 | **Duplicate submit blocked** (same deterministic id → `ALREADY_EXISTS`) | ✅ 409 |
| 9 | Exactly one doc exists for the duplicate id | ✅ count=1 |
| 10 | Overlapping booking created (pending) | ✅ 200 |
| 11 | **Live `onMobileBarberBookingCreated` elevated overlap → `vendor_review`** | ✅ `reviewReason=owner_conflict` |
| 12 | Cleanup deleted all smoke docs | ✅ deleted=2 |
| 13 | Zero smoke-test residue after run | ✅ remaining=0 |
| 14 | (auth) production Referer required — key is domain-locked | ✅ (security positive) |

### C. Static gate — `scripts/ai/full_system_dry_run.sh` → **FINAL: PASS**

---

## Verification by required dimension

**Firestore write.** Live anon create returns HTTP 200 — the create rule `isValidMobileBarberBookingCreate()` uses `hasAll([...])` (required fields present) **not** `hasOnly`, so the new `bookingRequestId` field and promo snapshot are accepted. `delete: if false` for clients is confirmed (cleanup needs Admin SDK). `requireDatabase: true` is enforced in `persistBooking` (rejects on transaction failure, plain-set failure, and Firestore-unavailable) so the customer never sees a false "confirmed" when the write fails.

**Conflict guard.** Live: an overlapping second booking was elevated to `vendor_review` (`owner_conflict`) by the deployed Cloud Function — owner-wide, Admin-SDK, runs on every create regardless of client state. Client-side guard + unit tests cover overlap/buffer/cross-service.

**Duplicate / spam.** Doc id is the deterministic `bookingRequestKey`; `persistBooking` writes with `.doc(id).set()`. A repeat submit is `ALREADY_EXISTS` (live-verified 409) → no duplicate document.

**Promotions.** Live snapshot persisted with `promotionId`, `promotionName`, `discountPercent`, `originalPrice`, `discountedPrice`, `promoApplied`; expired/disabled/max-redemption and price-never-$0 covered by unit tests.

**Vendor portal.** Live owner-scoped query (`ownerId == michael-nguyen`) returns the booking with status, promo, and `bookingRequestId` intact.

**AI chat.** Phone-first, returning-customer lookup, no address re-ask after routing, real-slot offers (`OFFER_SLOTS`), never confirms before DB write, `vendor_review` on uncertainty — covered by the agent suite; the shared write path is live-verified. AI now also passes `liveDataSource` so a stale turn routes to review.

**Voice.** Voice uses the **same** agent → `buildBooking` → `saveBooking({requireDatabase:true})` path as AI chat; it inherits idempotency, live-data enforcement, and the write-failure guard. (A dedicated voice **behavioral** E2E test is a post-launch enhancement — see risks.)

**Live data.** Customer (`mobile-barber.js`), vendor (`mobile-barber-vendor.js`), and agent (`refreshLiveBookingData`) all hydrate live vendor doc + services + promos + blocks before the availability check. **New this pass:** if the live read fails and the check ran on the static fallback, `buildBooking` now routes the booking to `vendor_review` (`reviewReason='stale_vendor_data'`) instead of auto-confirming on stale data.

---

## Changes made this pass

- `mobile-barber/mobile-barber-booking.js` — `checkAvailability` echoes `liveDataSource`; `buildBooking` routes `static-fallback` availability → `vendor_review`. (Codex: deterministic idempotency key + `bookingRequestId`.)
- `mobile-barber/mobile-barber-agent.js` — agent `checkAvailability` passes `liveDataSource`.
- `mobile-barber/mobile-barber.js` — threads `refreshLiveBookingData` source into the agent context.
- `mobile-barber/mobile-barber-vendor.js` *(Codex)* — `hydrateLiveVendorData`; `requireDatabase: true` on save.
- `mobile-barber/mobile-barber-data.js` *(Codex)* — `bookingRequestId` added to `BOOKING_FIELDS`.
- `tests/lib/mobile-barber-booking.js` — 2 new live-data enforcement tests.
- `tests/live/mb-go-live-smoke.js` *(new)* — reusable live production smoke harness.
- HTML version strings bumped to `?v=20260530k` for the 5 edited JS files (cache-busting).

---

## Remaining risks (monitored — not go-live blockers)

1. **AI brain live obedience.** The deterministic state machine + `_sanitizeResponse` banned-phrase guard + real-slot data constrain the model, but a model (Claude/OpenAI/Gemini) ultimately obeying the "never invent availability" contract under arbitrary input can only be proven by live API monitoring. *Mitigation:* monitor first-week conversations; the booking still cannot be written without passing the deterministic `checkAvailability`.
2. **Voice behavioral E2E.** Voice shares the verified agent write path but has no dedicated behavioral test that drives a voice turn to a write. *Mitigation:* add one post-launch; logic is identical to AI chat which is covered.
3. **No recurring live-data refresh timer.** Live data is re-hydrated before every availability check/booking (so per-booking data is fresh), but a long idle session does not auto-refresh on a timer. *Mitigation:* the per-booking hydrate already bounds staleness to the moment of the check; a 10-min timer (nail-salon pattern) is a minor enhancement.

---

## Remaining go-live steps (require explicit user confirmation to deploy)

This regression did **not** deploy. To ship:

```
git add mobile-barber/ tests/ docs/mobile_barber_go_live_booking_regression.md prompts/mobile_barber_go_live_booking_regression.md
git commit -m "..."
git push origin main
firebase deploy --only hosting        # ← updates production; needs user go-ahead
curl -s "https://www.dulichcali21.com/mobile-barber/mobile-barber-booking.js" | head -3
```

**Confirm:** `✔ Production domain updated — https://www.dulichcali21.com`

---

## Reproduce

```
node tests/runner.js                     # 542 passed
bash scripts/ai/full_system_dry_run.sh   # FINAL: PASS
node tests/live/mb-go-live-smoke.js      # 14 passed (needs ADC; writes+cleans test docs)
```
