# Codex-Claude Loop — Smart Unified Booking System for Michael (rides + tours + haircuts)

## GOAL

Make the owner-wide booking conflict guard (`booking-conflict-guard.js`) and every
booking caller *smart* enough that Michael — who personally performs share rides, tours,
and in-home haircuts on ONE shared timeline — can accept business across all three
services without (a) double-booking himself and (b) hard-rejecting bookings that are
merely *ambiguous* and should instead be queued for his manual review.

This replaces the current binary "available / abort" model with a **three-way
disposition**: `confirm` (write normally), `review` (write as `vendor_review` and queue
for Michael), or `block` (true hard conflict — do not write). The disposition decision
lives in ONE place: the guard. Callers only react to it.

### Binding product decisions (already made by the owner — do NOT re-litigate)

1. **Provider model:** Michael does all three services himself → a single shared timeline.
2. **Time conflicts:** Queue for Michael (accept as `vendor_review`, he reschedules from
   the dashboard) — do NOT silently reject.
3. **Edge / unverifiable / outside-radius locations:** Accept as `vendor_review`, not a hard reject.
4. **Working hours + 1 tour/day cap:** configurable; violations → `review`, not hard reject.

### The headline bug this fixes

`travel-booking.js` builds a guard request with NO lat/lng and empty `city`/`zip`, so the
guard returns `vendor_review_required` (`ok===false`) and the caller **throws**
(`throw new Error('booking_guard_' + guardResult.reason)`) → the wizard shows a generic
"Booking failed" error → **tours are 100% un-bookable today.** After Phase A, that same
case writes a `vendor_review` booking and tells the customer it's pending confirmation.

---

## STRICT RULES (apply to EVERY phase)

1. Do NOT break existing DuLichCali flows: salon, food, ride/airport, travel packages,
   vendor pages, AI receptionist, voice mode, driver admin, Luxurious Nails.
2. No blind rewrites. Smallest safe change. Additive where possible.
3. **Guard stays composite-index-free:** single-equality `where` + `.limit()` only.
   Never add `.orderBy()` to an owner query that would require a Firestore composite index.
4. **NO hardcoded user-facing strings in any language** (vi/en/es). Customer-facing
   "pending review" copy must route through the AI via a `[SYSTEM: ...]` English-only
   reason string, OR through an existing `t(key)` table with vi+en+es added in the SAME change.
5. **`?v=` cache-busting:** any edited `.js` file must have its `?v=` bumped in EVERY HTML
   file that loads it. Discover consumers with
   `grep -rn "<file>.js" . --include="*.html"`. Use a version string never used before
   (verify against `git log --all`); today is 2026-05-29 so use `20260529x`+ (a letter not
   already taken that day).
6. Listeners/guards are READ-ONLY against other services — never change a write path of a
   different service or any Cloud Function.
7. **Do NOT deploy, push, or commit.** Local edits + tests only.
8. Each phase ends with a report in `docs/` (see per-phase Report section).

---

## PHASE ORDER

Run each phase with:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/smart_booking_phaseX_<name>.md --max-loops 3
```

Do NOT start the next phase until the current one reaches **FINAL: PASS** or has a clear
blocker report. Phases are dependent: B/C/D build on A's disposition model.

| Phase | File | Summary |
|---|---|---|
| A | `prompts/smart_booking_phaseA_disposition_fix.md` | Guard three-way disposition; callers write `vendor_review` instead of throwing; customer "pending review" message. **Fixes the tour hard-block.** |
| B | `prompts/smart_booking_phaseB_hours_cap_fix.md` | Configurable working hours + 1-tour/day cap in owner-model; guard checks → `review`. |
| C | `prompts/smart_booking_phaseC_multiday_travel_lock_fix.md` | Multi-day tour per-day blocking; haversine travel-time buffer; stale-lock release. |
| D | `prompts/smart_booking_phaseD_dashboard_review_fix.md` | Owner dashboard review queue: Approve / Reschedule / Decline `vendor_review` bookings with reason shown. |

---

## SHARED ACCEPTANCE (verified each phase)

```bash
node --check <each edited .js>
node tests/runner.js          # must stay green (no regressions)
scripts/ai/targeted_dry_run.sh booking
scripts/ai/full_system_dry_run.sh    # must be FINAL: PASS
```

Interactive popup/sound/live-Firestore behavior that needs an authenticated owner session
must be reported as **BLOCKED**, never claimed PASS.
