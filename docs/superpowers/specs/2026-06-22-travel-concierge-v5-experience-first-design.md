# Travel Concierge V5 — Experience-First UX Reset Design

**Date:** 2026-06-22
**Status:** Approved (multi-agent UX audit + wireframe + 4 decisions locked) — ready for plan
**Branch:** `travel-concierge`
**Supersedes:** the V4 Overview hero/IA (V4 shipped 2026-06-22 at v=20260622g; V5 reworks the Overview tab heavily — keeps the tab/render plumbing, replaces the dashboard feel).

---

## Problem

The trip page reads like a **project-management dashboard**, not a vacation. The V4 Overview hero
stacks a readiness ring + budget chip + 4 status chips + a next-task CTA; the tab bar crushes **13
tabs** to ~8% width on mobile; everything is visible at once. The user's directive: a **complete UX
reorganization** so a first-time viewer feels *"Wow, I can't wait for this trip"* — like Airbnb
Experiences + Google Travel + Apple Photos Memories + Disney Genie+ — **not** *"I have 100 things to
manage."* Excitement (experiences/highlights) must come **before** logistics (tasks/costs/details).

This is a **presentation-layer reorganization** (no new Firestore/Functions/AI; ~90% reuse of
existing code). The four reference products share one structure: a cinematic photo hero, dominant
photo-first horizontal card rails, and logistics tucked into separate collapsible modules.

---

## Locked decisions (user-approved)

1. **Canvas:** keep the **dark navy + gold** brand (Apple Photos Memories is dark so photos pop;
   zero brand drift; reuses all `tc-*` tokens/scrims/glass). Borrow Airbnb's *card anatomy*, not its
   light canvas.
2. **Hero "Continue Planning →" CTA → Days** (the day-by-day itinerary; the "see our trip" moment).
3. **Bottom-nav "Profile" → account only** (login status, language vi/en/es, logout) — reuses the
   existing `#tcHeaderAcct` account control.
4. **AI Discoveries + hero emoji teasers → auto-sourced from the trip's real top picks**
   (`liveHighlights`/`attractions`), never hardcoded; "Add to trip" / "Replace existing" wire to the
   existing place-add flow.

Defaults (not separately asked — stated for the record, easy to change):
- **Costs** stays reachable via **More** + an Overview **Cost Center** module; the **Tasks tab =
  tasks only** (`renderBookings`), not money. **Clips merges into the Album tab.**

---

## Information hierarchy (experience-first Overview scroll order)

| # | Section | Default | Reuse |
|---|---------|---------|-------|
| 1 | **Cinematic Hero** | expanded | `placeMedia`, scrim/Ken-Burns, `.tc-ov-hero__cta` |
| 2 | **Highlights** (dominant) | expanded | `ovHighlightCard` (enlarged), `consensusSort`, `TCMedia`, `openPlaceModal` |
| 3 | **AI Discoveries** | expanded | `liveHighlightsBlock`, `ovDiscoveryCard`, `liveCatIcon` |
| 4 | **Memories** (Album teaser) | hidden until media | `tripMedia` (Album/Clips data) |
| 5 | **Timeline** (collapsed days) | collapsed | `ovTimelineRow` (→ `<details>`) |
| 6 | **Task Center** | collapsed | `deriveTripTasks`, relocated `TCOverview.statusChips/nextAction/readiness` |
| 7 | **Cost Center** | collapsed | `computeTripCosts`, `costSplit`, `familyShares`, `TCTasks.computeBalances` |
| 8 | **Details** | collapsed | routes to transport/stay/food/events/group tabs (replaces redundant `tc-ov-quick`) |

### Hero composition (replaces the dashboard hero)
Full-bleed real photo via `placeMedia` (Google Places → Wikipedia → honest navy gradient; multi-city
cross-fades 2–3 real city photos with the existing Ken-Burns keyframes, frozen under
`prefers-reduced-motion`). Apple-Memories bottom scrim. Type: gold uppercase **eyebrow** (destinations),
Bodoni `clamp(2.6rem,9vw,4.6rem)` **big title** (season/group name, e.g. "Summer 2026"), Jost **subtitle**
("Jul 1–4 · 3 families · 10 travelers"). One row of **3–4 glass emoji teaser chips** auto-sourced from
top highlights. **One** gold "Continue Planning →" CTA → Days. **REMOVED from hero:** `ovRing` readiness
%, `tc-ov-hero__budget` chip, `tc-ov-hero__chips` status row, next-task CTA. Keep the tiny
unverified-data note only when `tr._fallback`.

### Highlights card (the soul of the page)
Photo-dominant card (media ~58–62%, ≥230px), floating top-left dark-glass **Must-See / Top-Pick** badge
(from `tier`), `✓ verified photo` note when a real photo loads, name (Bodoni), a **dotted meta line**
(⭐rating · ⏱duration · 🎟price — **only facts that exist**, `~` on estimates, no fabricated numbers),
2-line description, and an **action-link row** (Official ↗ / ▶ YouTube review / Maps via `TCMedia`).
Horizontal scroll-snap rail with the next card peeking (~14% mobile). Tap → `openPlaceModal`.

### Tabs: 13 → 5
`['overview' (Overview), 'itinerary' (relabeled **Days**), 'bookings' (already **Tasks**), 'album'
(**Album**, with Clips merged in), 'more' (**More**)]`. **All 13 render branches stay intact.** The
"More" tab opens the existing `openMoreSheet`, extended to list the other 8 surfaces (journey,
transport, stay, food, events, stopovers/Discoveries, costs, group, clips) and set `state.activeTab`.
The tab bar becomes sticky + blurred, 5 equal pills (no wrap at 375px).

### Bottom nav
Reuse `tc-actionbar` + `abBtn` + existing handlers: **Trips** = `goDashboard`, **AI Concierge** =
`openConciergeSheet` (folds the floating `tc-ov-fab` into the nav so there is ONE concierge entry),
**Share** = `openShareModal` (owner-only, mirroring current gate), **Profile** = `#tcHeaderAcct`
account sheet. **z-index relayer:** action surfaces below, bottom-nav 40, any float 50, modal 2100+.

---

## Honesty rules (NON-NEGOTIABLE — unchanged)
- **Real photos only** via `placeMedia` (Google Places/Wikipedia) or the honest navy-gradient
  fallback. **No illustrations / SVG artwork / cartoons / AI imagery.** Emojis as small accents OK.
- **No fabricated ratings/prices/durations.** Show a datum only when it exists/verified; prefix
  estimates with `~`; otherwise omit or show an honest search link. YouTube/TikTok = **search links**,
  never embeds, unless a real video ID exists.
- `GOOGLE_MAPS_API_KEY` is a placeholder → photos often fall back to the gradient; that is the honest
  expected behavior, not a bug.

---

## Phasing (each independently shippable; deploy HELD until user confirms)

- **P0 — Experience-first shell:** rewrite the hero (strip ring/budget/status/next-task; cinematic
  photo + emoji teasers + single CTA→Days); promote Highlights to dominant large cards; shrink
  `TAB_PAIRS` to 5 (rename Days, merge Clips into Album, route the rest via `openMoreSheet`); add the
  4-item bottom nav (fold in the FAB, relayer z-index). CSS + `?v=` bump.
- **P1 — Collapsible centers:** Timeline → `<details>` Day N ▼ (sibling auto-collapse, collapse-all,
  expand-on-tap, deep-link preserved); collapsed **Task Center** (relocated `TCOverview` metrics) and
  **Cost Center** (`computeTripCosts`/`familyShares`/`computeBalances`) with 1-line summaries;
  **Details** collapsible routing to the remaining tabs; remove redundant `tc-ov-quick`;
  `localStorage` collapse-state persistence; `prefers-reduced-motion` + `contain:layout`.
- **P2 — Rich discovery + memories:** full AI Discovery cards (`liveCatIcon` badge, sourced
  rating/price/duration, Official/Maps/YouTube/Tripadvisor links, **Add to trip** / **Replace
  existing** handlers → `tr.addedPlaces`/existing add flow); **Memories** teaser strip on Overview
  (real `tripMedia` only, hide-when-empty); Album/Clips merged-tab polish; desktop rail arrows;
  lazy-load images.

---

## Component list (reuse vs new)

| Component | Reuse / New |
|---|---|
| Cinematic hero | NEW layout; REUSE `placeMedia` + Ken-Burns + scrim + `.tc-ov-hero__cta` |
| Emoji teaser chips | NEW glass chips; labels auto from top highlights via `t()` |
| Large highlight card | EVOLVE `ovHighlightCard` (bigger photo, glass badge, dotted meta, links, peek) |
| AI Discovery card | EVOLVE `ovDiscoveryCard` (badge + Add/Replace) |
| Rails | REUSE `tc-ov-rail` snap; NEW peek widths + desktop arrows |
| Memories strip | NEW; REUSE `tripMedia`; hide-when-empty |
| Collapsible day | EVOLVE `ovTimelineRow` → `<details>`; sibling auto-collapse |
| Task Center | REUSE `deriveTripTasks` + `renderBookings` rows + relocated `TCOverview` metrics |
| Cost Center | REUSE `computeTripCosts`/`costSplit`/`familyShares`/`TCTasks.computeBalances`/`renderCosts` |
| Details collapsible | NEW wrapper; REUSE tab routing; removes `tc-ov-quick` |
| 5-tab nav | REUSE `.tc-tab` + dispatch (13 branches intact); shrink surface; sticky+blur |
| More sheet | REUSE/EXTEND `openMoreSheet` to list hidden tabs |
| Bottom nav | REUSE `tc-actionbar`+`abBtn`+`goDashboard`/`openConciergeSheet`/`openShareModal`/`#tcHeaderAcct` |
| `openPlaceModal`, `learnMoreSection`, `TCMedia`, `researchPlaceMedia` | REUSE as-is |

---

## Testing & deploy
- Pure helpers (any new logic, e.g. teaser-sourcing / tier→badge) get node tests (eval pattern like
  `tc-overview.test.js`).
- Playwright render smoke per phase (extend `tests/live/v4-overview-smoke.js` → v5): hero stripped of
  dashboard chrome, 5 tabs, bottom nav present, 0 errors from our code, honest fallback.
- Regression: all pure suites green, `npm run test:rules` 113/0 (no rules change),
  `scripts/ai/full_system_dry_run.sh` `FINAL: PASS`.
- `?v=` bump on `travel-concierge.js`/`.css` (+ any new module) in `travel-concierge.html`, next
  unused string (≥ `20260622h`). **Deploy HELD** until the user confirms after wireframe/spec review;
  deploy uses the stash-mobile-barber-WIP procedure.

---

## Risks
- **Hero rewrite touches the most-seen surface** — the V5 smoke must confirm the dashboard chrome is
  gone and the cinematic hero renders with the honest fallback.
- **Tab-surface shrink** must keep all 13 render branches reachable (5 visible + 8 via More) — a missed
  branch strands a feature. Covered by the smoke (every `state.activeTab` still dispatches).
- **Bottom nav vs existing `.tc-actionbar`/FAB** — must not double-stack; the FAB folds into Concierge
  and z-index is relayered. Verify at 375px.
- **Real photos depend on the browser Maps key** on the live domain; headless shows the honest
  gradient — verify on device after deploy.
