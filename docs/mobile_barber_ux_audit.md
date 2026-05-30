# Mobile Barber — UX/UI Production Readiness Audit

**Date:** 2026-05-30
**Reviewer:** Claude (Opus 4.8)
**Method:** Live render at iPhone 14 Pro logical viewport (393×852, DPR 3) via Playwright + full source analysis of `mobile-barber/*` and the homepage renderer.
**Brand guardrails preserved:** premium navy (`#0d2f50`/`#07182a`) · gold accents (`#f5a623`/`#ffd166`) · Bodoni Moda display + Jost body · mobile-first · iOS-Safari-first.

> **Scope honesty:** Some items in the brief are **already implemented** and only need polish — this audit calls those out so we don't "fix" working behavior. See **§ Already-correct** at the end of each area.

---

## Measured current state (iPhone 14 Pro, 393×852)

| Element | Measurement | Implication |
|---|---|---|
| Hero section | full-height (852px) | Good — fills the viewport |
| **Hero media (image)** | **340px tall = 40% of screen**, top | Image does **not** dominate; the brand promise is undersold |
| Hero title | 26.4px, **wraps to 2 lines** ("Mobile Barber — In-Home Haircuts") | Eats vertical space, weak hierarchy |
| **Hero CTA stack** | **127px** (Book Now + 2 ghost buttons) | Heavy footprint; 3 competing CTAs |
| Promo section (`.mb-promo`) | separate, **531px, below the fold** | Second promo treatment competing with the hero promo slide |
| Services | starts at **1447px** (~1.7 screens down) | Acceptable |
| **Interactive AI preview** (`#mbHomeAiPreview`) | starts at **2113px (~2.5 screens down)** | The flagship conversion feature is **buried** |
| Hero promo slide | **two "20% OFF" badges** (ribbon + corner) | Visual redundancy / clutter |

Above-the-fold screenshot: `/tmp/audit-fold.png` (attached in chat). Full page: `/tmp/audit-full.png`.

---

## Critical Issues (block "premium / production-ready")

### C1 — Hero image is small and competes with text (40% of screen)
The hero media is 340px of an 852px viewport. The barber photo is cropped, sits above a tall text+CTA block, and (today) leads with the **promo slide** rather than a clean brand image. Attention lands on text, not the craft.
**Fix:** Make the hero media the dominant element — a full-bleed image occupying ~58–66% of the viewport with a navy gradient scrim at the bottom, and overlay a *compact* headline + single primary CTA on the image. Move secondary actions to a tight icon-row.

### C2 — Hero typography overweight; title wraps
"Mobile Barber — In-Home Haircuts" wraps at 26.4px. The em-dash construction forces a long line.
**Fix:** Tighten to `clamp(1.6rem, 6vw, 2.1rem)`, `line-height: 1.08`, `text-wrap: balance`. Split into a short display line + a thin kicker ("Orange County house calls"), e.g. **"In-home haircuts."** as the display, brand name as the kicker. Target ≤2 short lines.

### C3 — Three stacked CTAs create decision paralysis + 127px footprint
Book Now (gold) + "Chat with AI" + "Talk to AI" are three equally-weighted blocks.
**Fix:** One primary CTA ("Book Now", gold, 52px, full-width) + a single compact secondary row with **icon buttons** for chat 💬 and voice ☎ (44×44 each, side by side, ~48px tall total). Cuts footprint ~40% and clarifies the primary path.

### C4 — Two promotion treatments compete; duplicated "20% OFF" badges
The promo appears **twice**: as the leading hero-carousel slide *and* as the separate `.mb-promo` "Latest AI Haircut Styles" section below. The hero promo slide also renders the discount badge **twice** (ribbon + corner badge).
**Fix:** One integrated **premium promo banner** treatment. Keep the promo as a cinematic hero slide *or* a single ribbon — not both. Remove the duplicate badge. Repurpose `.mb-promo` into the AI Hairstyle showcase (see C5) rather than a second discount card.

### C5 — Flagship AI Hairstyle Preview is buried at ~2113px
The interactive selfie→5-styles feature — the platform's strongest conversion hook — sits ~2.5 screens down, after the promo and services.
**Fix (information architecture):** Reorder to **Hero → AI Hairstyle Preview → Services → Booking**. Give the AI section a proper "showcase" intro (sample before/after strip) so it reads as a headline feature, not an optional add-on.

---

## Medium Issues

### M1 — Service cards: verify marketplace polish
Service cards render in a horizontal slider. Audit spacing/image-size/price/promo visibility against a premium marketplace bar: ensure each card shows image, name, **price prominently**, duration, an **active-promo strikethrough** when applicable, and a single clear CTA. Confirm 44px targets and consistent gaps (`.75rem` per the layout system memory).

### M2 — Booking flow prominence (the engine is already direct)
**Already correct:** `selectService()` → `openManualBookingForm()` mounts a direct date/time/address/phone form; AI/Voice are an optional "Need help?" footer, **not** forced. The brief's "don't force AI/Voice" is largely satisfied.
**Polish:** ensure the manual form follows the project's **3-step progressive disclosure** rule (≤3 fields per step), the first input autofocuses, and the keyboard doesn't cover the submit button on iOS (scroll-into-view on focus).

### M3 — Hero trust chips render at 0px (hidden/empty)
`.mb-hero__trust-chips` measured 0×0 — the trust signals (Licensed / House-call / Verified) are not showing on mobile. Either restore them as a compact single scrollable row under the CTA, or remove the dead markup.

### M4 — Dashboard appointment scannability
**Already partly done:** settings are `<details>` accordions; bookings expand on tap. Elevate to an **inbox feel**: status color-coding (pending=amber, confirmed=green, in-progress=blue, completed=muted), a left status rail per row, and 1-tap quick actions (Confirm / Reschedule / Decline) on the collapsed card without expanding.

### M5 — Homepage active-only filtering (verify `script.js`)
**Already correct on the landing:** `mobile-barber.js` filters `vendor.active !== false` and `service.active !== false` (lines 1034/1141/1537/1542). **Verify** the main homepage marketplace renderer (`script.js`) and the hero carousel apply the same active-vendor / active-service / active-promotion filters before launch — this is the brief's stated risk and lives outside `mobile-barber/`.

---

## Nice-to-Have

- **N1** Hero image art-direction: `object-position` tuned per breakpoint so the face/cut isn't cropped awkwardly on tall phones.
- **N2** Pinch-to-zoom inside the lightbox (already shipped full-screen; add true zoom/pan for hair detail).
- **N3** Skeleton shimmer for the AI section while the 5 previews generate (15–20s wait).
- **N4** Promo countdown ("ends in 2 days") on the banner for urgency.
- **N5** Haptic-style micro-feedback (scale) on primary CTA tap (respecting reduced-motion).

---

## Recommended layout changes (before → after)

**Above the fold — current**
```
[ promo image 340px — barber + price list + 2× "20% OFF" ]
ORANGE COUNTY HOUSE CALLS
Mobile Barber — In-Home Haircuts        (26px, 2 lines)
body copy (2 lines)
[ Book Now            ] (gold, full)
[ Chat w/ AI ][ Talk w/ AI ]            (2 ghost, tall)
```

**Above the fold — proposed**
```
┌───────────────────────────────────────┐
│  full-bleed barber image  (~60vh)      │
│  ·single "20% OFF" ribbon (if promo)   │
│                                         │
│  ▁▁▁navy gradient scrim▁▁▁              │
│  Orange County house calls   (kicker)   │
│  In-home haircuts.           (display)  │
│  [  Book Now  ]   [💬][☎]                │
└───────────────────────────────────────┘
↓ AI Hairstyle Preview (moved up, showcased)
↓ Services (marketplace cards)
↓ Booking (direct form on Select Service)
```

---

## Mobile-specific improvements (iOS Safari first)
- Hero `height: 100svh` (small-viewport unit) so the address bar doesn't crop the image; keep `100dvh` fallback.
- **Safe-area:** already used 16× in CSS (lightbox, etc.). Audit every fixed/sticky element (bottom nav, sticky CTAs, toasts) for `env(safe-area-inset-bottom)` so nothing sits under the home indicator / Dynamic Island.
- Keyboard overlap: on form-field focus, `scrollIntoView({block:'center'})` so the active input + submit stay visible.
- 44px minimum targets everywhere (chips already fixed to 44px in the AI section).
- `prefers-reduced-motion` already respected in the AI section + lightbox; extend to the hero carousel auto-rotate.
- PWA: confirm `theme-color` (#0d2f50 ✓) and add `apple-mobile-web-app-status-bar-style` for standalone.

## Desktop / iPad improvements
- Hero becomes a 2-column split (image left ~58%, copy/CTA right) above 1024px so it doesn't letterbox.
- Service slider becomes a 3–4 column grid on ≥768px (no horizontal scroll on desktop).
- AI result cards: 2-up on tablet, 3-up on desktop.
- Cap content at `max-width: 1280px` centered (per layout-system memory).

## Vendor portal improvements
- **Dashboard:** inbox-style list, status color rail, collapsed-card quick actions (M4).
- **Notifications:** the bell + unread badge + sound exist; formalize into a notification *center* (dropdown list, mark-as-read, unread count, iOS-safe sound-unlock on first interaction).
- **Settings:** already `<details>` accordions (Profile/Services/Pricing/Hours/Blocks/Portfolio/Reviews/Promotions) — keep; ensure each summary has a 44px target and the chevron rotates on open.

---

## Production risks
1. **Hero rebuild touches `renderHeroShowcase` + promo slide logic** — must not break the promo/booking CTA wiring or the active-promo merge (`loadVendorPromosFromFirestore`). Mitigate with the source-pattern tests + screenshot diffs.
2. **Information-architecture reorder** (moving AI section up) changes section order the homepage 3-panel contract does NOT govern (this is the barber landing, not the SPA home) — safe, but re-verify scroll anchors (`#mbServices`).
3. **Homepage active filtering (script.js)** — if inactive vendors/promos leak on the main homepage, that's a launch blocker; needs explicit verification (M5).
4. **Tim/Michael service-area routing** must remain untouched — redesign is presentation-only; no changes to `findVendorForAddress`.
5. **iOS keyboard / safe-area regressions** — verify on real device or DPR-3 emulation after each phase.

---

## Phased implementation plan

| Phase | Scope | Files | Risk |
|---|---|---|---|
| **1** | Hero redesign (image-dominant, scrim overlay) · mobile typography · CTA hierarchy (1 primary + icon row) · de-duplicate promo badge | `index.html`, `mobile-barber.js` (hero showcase), `mobile-barber.css` | Med (hero wiring) |
| **2** | Move AI Hairstyle Preview up + showcase intro · service-card marketplace polish · booking form 3-step + keyboard fix | `index.html`, `mobile-barber.js`, `mobile-barber.css` | Med |
| **3** | Vendor dashboard inbox + status colors + quick actions · notification center · settings polish | `dashboard.html`, `mobile-barber-dashboard.js`, `mobile-barber.css` | Med |
| **4** | Homepage active vendor/service/promo filtering (verify + fix `script.js`) | `script.js`, `style.css` | Low-Med |

Each phase: implement → screenshot-verify at 393px + 1280px → run `node tests/runner.js` (must stay green) + `full_system_dry_run.sh` (FINAL: PASS) → adversarial review → commit → deploy → verify production.

---

---

## Implementation results (Phases 1–4 — shipped 2026-05-30)

Measured at iPhone 14 Pro (393×852) before vs after:

| Metric | Before | After |
|---|---|---|
| Hero image height | 340px (40% of screen) | **477px (56%)** — image dominates |
| Hero title | 26.4px, wraps | **22.4px** + `text-wrap:balance` |
| CTA footprint | 127px (3 stacked) | **51px** (1 primary + 💬/☎ icon row) |
| Promo "20% OFF" badges | 2 (duplicate) | **1** |
| AI Hairstyle Preview position | ~2113px (≈2.5 screens down) | **~1447px**, above Services |

**Phase 1** — cinematic promo-led hero (`56–60svh`, vh fallback), tighter type, 1-primary-CTA + accessible icon row, deduped badge.
**Phase 2** — AI preview reordered above services (`init()`, flash-free); iOS keyboard focus-scroll for booking fields. (Service cards + direct booking already at standard.)
**Phase 3** — completed dashboard status-pill color scheme (pending was uncolored). Inbox rail / expandable rows / quick actions / notification center / collapsible settings already shipped.
**Phase 4** — homepage active-only filtering verified robust (adminStatus=active, public-visibility gate, admin-cache await, hero sync) and **locked with a regression test**.

**Adversarial review** (4 dimensions, each finding independently verified): 4 confirmed → all fixed (empty group `aria-label`; `prefers-reduced-motion` button guard; duplicate `--traveling` pill; `svh` vh-fallback).

**Gate:** 529 tests pass · `full_system_dry_run.sh` → `FINAL: PASS`. **Deployed** to `www.dulichcali21.com` at `?v=20260530g`. Untouched: booking engine, AI/voice booking, promotions, notifications, Tim/Michael routing.

---

## Verdict (audit phase)
The Mobile Barber experience is **functionally solid** (booking engine, AI preview, routing, promotions, notifications, accessible chips/lightbox all work) but **not yet visually premium above the fold**. The four Critical issues (hero image dominance, typography weight, CTA hierarchy, promo/AI placement) are the highest-leverage conversion fixes. None require touching the booking/routing engine. Recommend proceeding with **Phase 1** first for the biggest perceived-quality jump.
