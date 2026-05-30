# Mobile Barber — AI Chat Availability + Compact Controls

**Date:** 2026-05-30
**Scope:** Customer AI chat — (1) real next-slot offering for unavailable/bare-day requests, (2) collapse the payment selector and (3) the preferred-barber selector into compact chips so the conversation owns the screen.
**Verification:** 546 automated tests (`node tests/runner.js`) + `full_system_dry_run.sh` FINAL: PASS + live mobile (390px) Playwright visual check.

---

## Summary

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | "Hôm nay được không?" / "today" → AI just keeps asking for a time | Offer real next slots from the live schedule when the customer gives a **day or a window but no clock time** | ✅ |
| 2 | Payment panel eats chat space | Collapse to `Payment: Cash [Change]` chip; radios preserved behind it | ✅ |
| 3 | Preferred-barber dropdown eats chat space | Collapse to `Barber: Tim Nguyen [Change]` chip once routed; dropdown preserved behind it | ✅ |

---

## 1. Availability — never loop on time; offer real slots

### Root cause (investigated, not guessed)
A bare day like **"hôm nay"** / **"today"** set `state.date` but **not** `state.flexibleWindow`. The slot-offer gate required `state.flexibleWindow`, so it fell through to `nextMissingQuestion()` → `if (!date || !time)` → "what day and time?" — an endless time-ask loop. Separately, **"after 5"** was parsed by `normalizeTime` as a fixed `17:00` (one minute) instead of an open band.

### Fix (`mobile-barber-agent.js`)
- **Gate broadened** — offer slots when the customer has a **day OR a flexible window** and no concrete time:
  `if (!preTimeMissing.length && !state.time && (state.flexibleWindow || state.date))`.
- **Forward fallback in `_offerFlexibleSlots`** — if the requested day is full, keep the same time band and search the next ~14 days, so "today full" returns **tomorrow's** real openings (the prompt's "Tim is full today — next open is mai 9:00 / 10:30 / 1:00" behavior).
- **`parseTimeBandWindow`** (new) — "after N" / "before N" / "sau N" become an open band (`{kind:'after', startMin:1020}`), detected **before** `normalizeTime`, so the agent offers every slot in the band rather than locking one minute.
- **Vietnamese fix** — `stripDiacritics("tôi")` ("I") collapsed to `"toi"` and was mis-matched as `"tối"` (evening), forcing an evening-only window on the extremely common "tôi muốn…" phrasing. The evening pattern now matches only the unambiguous `buổi tối` / `tối nay`.

All offered slots come from `BOOKING.findNextAvailableSlots` (live schedule + working hours + unavailable blocks + existing bookings + travel buffer). **No invented times.** Concrete `date+time` requests are unchanged — they go straight to `checkAvailability`, and a taken slot still triggers the existing alternate-slot suggestions.

### Phrase coverage (live-verified in unit logs)
| Phrase | Result |
|---|---|
| "hôm nay được không?" / "today" / "can I come in today?" | date=today, no time → **OFFER_SLOTS** (real slots, forward-fallback if full) |
| "all day today" | flexibleWindow=allday → OFFER_SLOTS |
| "tomorrow afternoon" | date=tomorrow + afternoon band → OFFER_SLOTS in 12:00–17:00 |
| "after 5" / "ngày mai sau 5 PM" | band `{after, 17:00}` → offered **5:00 PM, 5:30 PM** (verified) |
| "earliest available" | multi-day forward search |
| "tôi muốn cắt tóc ngày mai" | **not** mis-read as evening; offers next-day slots |

---

## 2 & 3. Compact controls (collapse to chips)

`mobile-barber.js` + `index.html` + `mobile-barber.css`:
- **Payment** — on chat open, the `mbPaymentChoice` fieldset collapses to a `Payment: Cash [Change]` chip (`renderPaymentControls`). Picking a method re-collapses with the new value. The radios stay in the DOM, so `selectedPaymentMethod()` and the booking payload are unchanged.
- **Barber** — once an address routes the customer, the dropdown collapses to a `Barber: {name} [Change]` chip (`renderBarberChip`, wired into `refreshPreferredBarberPicker` + `handlePreferredBarberChange`). The `<select>` stays in the DOM, so `handlePreferredBarberChange()` and `preferredVendor()` are unchanged.
- **[Change]** re-opens the full control (radios / dropdown) and focuses it.
- New i18n keys `paymentChipLabel` / `barberChipLabel` / `controlChange` in **vi / en / es**. New `.mb-control-chip` styles reuse existing tokens; `:focus-visible` + reduced-motion handled.

**Mobile visual check (390px Playwright):** on open → `Payment: Cash [Change]` chip with fieldset hidden; after "…Westminster 92683" → `Barber: Michael Nguyen [Change]` chip with dropdown hidden; payment **Change** re-opens the radios. Both controls are single-line chips and the transcript owns the vertical space (~94px reclaimed vs. the two fieldsets).

---

## Tests (prompt checklist)

| Prompt test | Result |
|---|---|
| 1. Pick barber → selector collapses to chip | ✅ (visual + handler) |
| 2. Pick payment → panel collapses to chip | ✅ (visual + handler) |
| 3. "today?" when unavailable → next live slots | ✅ (gate + forward fallback; new unit test) |
| 4. "all day today" → live schedule | ✅ (existing + new unit test) |
| 5. Select suggested slot → booking continues | ✅ (existing BUG1 pick test) |
| 6. Vietnamese responses | ✅ ("hôm nay" parse + "tôi" no-evening tests) |
| 7. Mobile Safari more conversation space | ✅ (chips collapse; 390px screenshot) |

Automated: **546 passed, 0 failed**. New tests: bare-"today" → OFFER_SLOTS; "hôm nay" parse; "tôi" ≠ evening; "after 5" band ≥ 17:00; updated the "after 5" address test to the new band behavior.

---

## DO NOT BREAK — verified intact
manual booking · AI chat booking · voice booking (shares the agent path) · Tim/Michael routing · promotion pricing · payment preference (radios preserved) · preferred-barber selection (select preserved) · mobile layout (improved). All covered by the 546-test suite + the live mobile check.

---

## Files changed
- `mobile-barber/mobile-barber-agent.js` — gate broadening, `parseTimeBandWindow`, forward fallback, Vietnamese evening fix.
- `mobile-barber/mobile-barber.js` — `renderPaymentControls` / `renderBarberChip` / `hideBarberControls`, wiring, i18n keys, open-panel collapse.
- `mobile-barber/index.html` — chip DOM; `?v=20260530l` bumps (agent.js, mobile-barber.js, css).
- `mobile-barber/mobile-barber.css` — `.mb-control-chip` styles.
- `mobile-barber/vendor.html`, `mobile-barber/dashboard.html` — `?v=20260530l` bumps for shared assets.
- `tests/lib/mobile-barber-agent.js` — 4 new availability tests + the "after 5" band update.
- `tests/lib/mobile-barber-landing.js` — version pins synced to the live HTML (also corrected the go-live `?v=` drift).

---

## Version strings (cache-busting)
`mobile-barber-agent.js` → `20260530l`, `mobile-barber.js` → `20260530l`, `mobile-barber.css` → `20260530l` (across every HTML consumer; landing test pins synced). Go-live files (`data`/`booking`/`vendor.js`) remain at `20260530k`. **Not deployed** — production still serves the previous build until `firebase deploy --only hosting`.

## Reproduce
```
node tests/runner.js                     # 546 passed
bash scripts/ai/full_system_dry_run.sh   # FINAL: PASS
# visual: python3 -m http.server 8099 → mobile-barber/index.html @ 390px, open chat
```
