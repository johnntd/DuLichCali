# Travel Concierge V4 — Trip Experience Redesign (Overview) Design

**Date:** 2026-06-22
**Status:** Approved (wireframe + UX review complete) — ready for implementation plan
**Branch:** `travel-concierge`
**Scope:** P0 of a 3-phase redesign. P1/P2 noted but out of scope for this spec.

---

## Problem

The trip page (`render()` plan screen in `travel-concierge.js`) currently lands the user on a
flat strip of **12 engineering-dashboard tabs** (`itinerary, journey, transport, stay, food,
events, stopovers, costs, bookings, album, clips, group`). Every tab is a list of text cards.
A first-time member opening a shared trip cannot answer the three questions that matter in the
first 5 seconds:

1. **Where are we going and when** — buried in a small hero chip.
2. **Is the trip ready, or is something blocking us** — invisible; requires opening Tasks.
3. **What's the single most important thing to do next** — invisible.

The user directive: *"DO NOT simply add more cards."* Make the page **immersive, image-first,
experience-first** (reference: Airbnb Experiences / Google Travel / Apple Photos Memories /
Disney Genie+ / Booking.com). Separate **OVERVIEW** (understand the trip at a glance) from
**DETAILS** (the existing tabs). The user understands the trip in 5 seconds.

This is a **presentation-layer redesign**. No new Firestore fields, no new callables, no AI
behavior change. It composes existing computed data into a new landing surface.

---

## Goals

- A new **Overview** tab becomes the **default landing tab** (replacing `itinerary`).
- Overview answers WHERE/WHEN, READINESS, and NEXT ACTION in one scroll-free viewport on
  desktop and one short scroll on mobile.
- Image-first **Highlights** (top attractions) and **AI Discoveries** rails — horizontal scroll
  on desktop, horizontal swipe on mobile (approved layout).
- A **collapsed Daily Timeline** preview that links into the full Itinerary tab.
- A **floating AI Concierge** entry point (FAB) available on every tab, reusing the existing
  command-bar engine.
- All 12 existing tabs remain reachable and unchanged. Overview is additive + reorders the tab
  strip so Overview is first.

### Non-goals (this phase)

- No changes to the 12 detail-tab renderers' internals (`renderItinerary`, `renderStays`, …).
- No new Firestore schema, security rule, or Cloud Function.
- No AI/fake imagery — honest-image rule (below) is absolute.
- P1 (Tasks/Bookings split polish, Costs polish) and P2 (Album/Clips/Live surfacing) are
  deferred to later specs.

---

## Honest-data rules (NON-NEGOTIABLE — inherited from the project)

- **Images:** real photos only, via the existing `placeMedia(p, cls)` helper (Google Places /
  Wikipedia). When no real photo exists, render the existing honest fallback — a navy gradient
  tile (`tc-place__media--ph` / `tc-cine` style) with the category emoji + place name. **NEVER**
  an AI-generated or stock-guess image.
- **Prices/ratings/hours:** never fabricated. Budget figures come only from `computeTripCosts`
  (labeled estimates) and `TCTasks.computeBalances` (actuals the user entered). Anything the AI
  could not verify stays labeled "pending verification" exactly as the existing cards do.
- **Readiness %** is derived purely from real task statuses — it is a computed progress metric,
  not a claim about the world.

---

## Architecture

### Where it slots in

The plan screen is rendered by the big `render()` path that builds (in order):
`hero` → concierge research banner → `familyPicker()` → **tab strip (`TAB_PAIRS`)** → the
active-tab body → bottom back button + mobile action bar.

V4 P0 changes exactly three things in that path and adds one new render function plus one
floating element:

1. **`TAB_PAIRS`** (travel-concierge.js:3917) — prepend `['overview','tab_overview']` as the
   first entry.
2. **Tab dispatch** (travel-concierge.js:3926) — add a new first branch:
   `if (state.activeTab === 'overview') s.appendChild(renderOverview(plan)); else if (...)`.
3. **Default `state.activeTab`** — every place that currently initializes a freshly-opened trip
   to `'itinerary'` changes to `'overview'`. There are 7 such sites (confirmed by grep):
   `2056, 2083, 2640, 3534, 3587, 5827, 7583` plus the stale-tab heal at `3918`.
   The heal line (`if (!TAB_PAIRS.some(...)) state.activeTab = 'itinerary'`) changes its
   fallback to `'overview'`.
4. **New `renderOverview(plan)`** function — composes the five Overview blocks (below).
5. **New `conciergeFab()`** floating element — appended once to the plan screen container
   (outside the tab body so it persists across tab switches), `position:fixed`.

> **Why default to Overview, not keep Itinerary:** approved by the user — "Overview is the
> landing tab." Deep links that previously assumed itinerary still work because the tab is still
> present; only the *default* changes. `pushTripUrl`/URL restore that hard-set `'itinerary'`
> are updated too so a refresh lands on Overview.

### `renderOverview(plan)` — five blocks

Returns a single `<div class="tc-ov">` containing, in order:

#### Block 1 — Trip Hero (`tc-ov-hero`)
Image-first hero banner. Reuses existing trip data; adds a readiness ring + status chips + a
prominent Next-Action CTA.

- **Background:** the trip's lead destination photo via `placeMedia` of the top attraction (or
  the honest navy-gradient fallback if none) + dark scrim for text legibility.
- **Title:** `plan.groupName || tr.groupName` (Bodoni Moda display).
- **Subtitle line:** `plan.dateRange || tr.dateRange` · destination · `N families · M travelers`
  (M from `totalTravelers()`).
- **Readiness ring:** an SVG ring showing `readinessPct` (computed below) with the integer % in
  the center. Accessible: `role="img"` + `aria-label` = localized "Trip N% ready".
- **Budget chip:** `money(computeTripCosts(tr).total.expected)` labeled as estimate
  (reuse `t('costRange')`/`t('costEstTotal')`). Tapping it switches to the `costs` tab.
- **Status chips:** one chip per readiness category (Hotels / Transport / Tickets / Food), each
  `✓` (all that category's tasks done) or `⚠` (a P0/P1 task incomplete). Tapping a `⚠` chip
  deep-links to the relevant detail tab.
- **Next-Action CTA:** a single prominent gold button — `t('ovNext') + ': ' + nextAction.label`
  — that performs `nextAction.go()` (switch to the owning tab, or open the relevant card).
  Hidden when nothing is outstanding (show a "You're all set ✓" state instead).

#### Block 2 — Highlights rail (`tc-ov-highlights`)
Horizontal scroll rail (desktop) / swipe (mobile) of large image-first cards — the top
attractions across all destinations.

- **Source:** flatten `tr.attractions[].attractions[]` (filtered by `rejectedNameSet`), run
  through the existing `consensusSort(list, fn)`, take the top 6.
- **Each card:** `placeMedia` image (honest fallback otherwise) + tier badge (if `at.tier`) +
  name + one-line `why` + best-for + ticket badge (if `at.ticketed`). Reuses the existing
  Learn-more / vote / favorite affordances already attached by `attractionCard` where practical;
  the Overview card is a compact image-first variant that, when tapped, opens `openPlaceModal(p)`
  (the existing detail modal) — so no duplicated detail logic.
- **"See all" affordance:** links to the `itinerary` tab.
- Empty state (research still running): a localized "AI is curating highlights…" placeholder row
  using the existing `researchBanner` style.

#### Block 3 — Daily Timeline preview (`tc-ov-timeline`)
A **collapsed** day-by-day strip — one compact row per day (Day N · city · 2–3 chips of the
day's headline places). Tapping a day switches to the `itinerary` tab at that day
(`state.activeTab='itinerary'; state.activeDay=i; render()`). Reads `plan.days[]` (already
finalized by the P0 journey-days fix). Travel/transfer days render with the existing travel-day
treatment (do not invent activities). This is a **preview**, not a second itinerary — at most
the first ~5 days shown with a "View full itinerary" link.

#### Block 4 — AI Discoveries rail (`tc-ov-discoveries`)
Horizontal image-first rail of `plan.liveHighlights` (reuses `liveHighlightsBlock` data source:
`plan.liveHighlights || state.trip.liveHighlights`). Same honest-image rule. Each card opens
its detail/search link exactly as the current live-highlights cards do. Hidden entirely when
there are no live highlights (no empty box).

#### Block 5 — (within hero/footer) quick links
A small row of text links to the tabs not surfaced above (Group, Stay, Food, Costs, Tasks) so
Overview is a true hub. Reuses `t('tab_*')` labels.

### Floating AI Concierge (`conciergeFab()`)

- A `position:fixed` bottom-right FAB (above the mobile action bar) labeled with the concierge
  glyph + `t('ovConcierge')`.
- Tapping it opens a sheet that **reuses the existing command engine** — `commandBar(tr)` markup
  is extracted/lifted into the sheet; the same `interpretCommand(tr, utterance)` →
  `editPlanPreview(tr)` → `applyEditPlan(tr, plan)` pipeline runs unchanged. Quick-intent chips
  ("Optimize my plan", "Find hidden gems", "What should I book next?") pre-fill the utterance;
  optimize/hidden-gems route through the existing `improveTripPlan` path.
- The FAB persists across all tabs (it lives on the plan-screen container, not the tab body).
- Read-only viewers (non-members) see the concierge in a read-only/disabled state, matching how
  `commandBar` already gates on `state.readonly`.

---

## Derived computations (pure, testable)

These go into a new pure helper module **`tc-overview.js`** (browser IIFE exposing
`window.TCOverview`, node-testable like `tc-tasks.js`), so the math is unit-tested without a DOM.
`renderOverview` calls these and only does DOM assembly.

```
TCOverview.readiness(tasks)
  → { pct, doneCount, totalCount }
  DONE set = status ∈ {booked, paid, skipped, not_needed}.   (matches deriveTripTasks/bookingCard)
  pct = totalCount ? round(100 * doneCount / totalCount) : 100   // empty trip = 100% (nothing blocking)

TCOverview.nextAction(tasks)
  → { label, taskKey, priority } | null
  The highest-priority not-DONE task: sort by priority P0<P1<P2, then dueDate asc, then order.
  null when everything is done.

TCOverview.statusChips(tasks)
  → [ { key:'hotels'|'transport'|'tickets'|'food', state:'ok'|'warn', tab } … ]
  Group tasks by category; state='warn' if any P0/P1 task in the group is not DONE, else 'ok'.
  Only emit a chip for a category that has at least one task.
```

`renderOverview` obtains `tasks` from `deriveTripTasks(tr)` (the existing generator that returns
`tr.bookings`). Budget = `computeTripCosts(tr)`. Highlights = `tr.attractions` →
`consensusSort`. No new data is fetched.

---

## i18n

All new user-facing strings get keys in `T` (en ~L37, vi ~L314, es ~L581) — **all three
languages in the same commit** (project hard rule). New keys (final names may adjust):

- `tab_overview` — "Overview" / "Tổng quan" / "Resumen"
- `ovReady` — "{n}% ready" (template; ring aria-label)
- `ovNext` — "Next" / "Tiếp theo" / "Siguiente"
- `ovAllSet` — "You're all set ✓"
- `ovHighlights` — "Highlights" / "Điểm nổi bật" / "Lo más destacado"
- `ovSeeAll` — "See all"
- `ovTimeline` — "Your days" / "Lịch trình" / "Tus días"
- `ovViewItinerary` — "View full itinerary"
- `ovDiscoveries` — reuse existing `liveTitle` if it fits; else add
- `ovConcierge` — "Ask the concierge" / "Hỏi trợ lý" / "Pregunta al concierge"
- `ovCuratingHighlights` — "AI is curating highlights…"
- status-chip labels: reuse existing `tab_stay`/`tab_transport`/`costTickets`/`tab_food` where
  they read correctly; add `ovChipHotels`/`ovChipTickets` only if the existing label is wrong in
  context.

Existing `disc_*` and `heroShowcaseLead` keys (already in all 3 languages at L65/344/613) are
reused for the Discoveries rail where applicable.

---

## CSS (`travel-concierge.css`)

New mobile-first classes prefixed `tc-ov*`, with `@media (min-width:768px)` and
`@media (min-width:1200px)` sections per the project's breakpoint rule.

- `.tc-ov-hero` — full-bleed image + scrim; title/meta/ring/chips/CTA stacked on mobile,
  ring + meta side-by-side ≥768px.
- `.tc-ov-ring` — SVG ring; gold progress stroke on navy track.
- `.tc-ov-rail` — horizontal scroll container: `display:flex; overflow-x:auto;
  scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch`; children
  `scroll-snap-align:start`. On ≥1200px the rail still scrolls (approved "horizontal scroll
  rail") — no wrap to grid.
- `.tc-ov-card` — image-first card; `min-width` so ~1.2 cards peek on mobile (affordance that
  it scrolls), ~3–4 visible on desktop.
- `.tc-ov-fab` — `position:fixed; bottom` clears the mobile action bar; `z-index` within the
  project's documented scale; 44×44px min touch target.
- Honest fallback tile reuses existing `.tc-place__media--ph` gradient styling.

Accessibility: ring has text % + aria-label (color not the only signal); status chips pair the
✓/⚠ glyph with a text label; FAB has `aria-label`; rails are keyboard-scrollable; all touch
targets ≥44px; respects `prefers-reduced-motion` for any scroll/snap animation.

---

## Version bump & deploy

- `tc-overview.js` is a new file → add `<script src="/tc-overview.js?v=20260622g">` to
  `travel-concierge.html` **before** `travel-concierge.js`.
- `travel-concierge.js`, `travel-concierge.css` edited → bump their `?v=` to the next unused
  string (`20260622g`, verified higher than the deployed high-water mark).
- **Deploy is HELD.** Per the user's V4 directive ("Do NOT deploy immediately. Perform UX review
  first. Then implement incrementally. Run regression tests."), this phase ends with local
  verification + regression tests + a PASS/FAIL report. Deploy only on explicit user confirmation,
  using the stash-WIP-then-restore procedure.

---

## Testing

- **`tests/tc-overview.test.js`** (new, pure-node, eval pattern like `tc-tasks.test.js`):
  - `readiness`: empty→100%; all-done→100%; half-done→50%; rounds correctly.
  - `nextAction`: returns highest-priority incomplete (P0 before P1 before P2); null when done;
    dueDate tiebreak.
  - `statusChips`: ✓ when category fully done; ⚠ when a P0/P1 incomplete; omits empty categories.
- **`package.json`** add `test:overview`.
- **Regression:** existing pure tests must still pass — `test:journeydays`, `test:media`,
  `test:tasks`, `test:userplace`, `npm run test:rules` (rules unchanged → must stay green),
  and `scripts/ai/full_system_dry_run.sh` must end `FINAL: PASS`.
- **Manual mobile/desktop:** verify at 375px and 1280px that Overview lands first, the rails
  scroll, the ring/chips/CTA reflect real task state, and all 12 tabs remain reachable —
  including the demo trip and a real shared trip.

---

## Reuse map (no duplication)

| Need | Reuse |
|---|---|
| Top attractions | `tr.attractions[]` + `consensusSort` + `rejectedNameSet` |
| Real images / honest fallback | `placeMedia(p, cls)` + `.tc-place__media--ph` |
| Detail modal on card tap | `openPlaceModal(p)` |
| Budget total | `computeTripCosts(tr)` + `money(n)` |
| Paid/owed actuals | `TCTasks.computeBalances` (already wired in Costs) |
| Task list + statuses | `deriveTripTasks(tr)` → `tr.bookings` |
| Traveler count | `totalTravelers()` |
| Live discoveries | `plan.liveHighlights` / `liveHighlightsBlock` source |
| Concierge engine | `commandBar` → `interpretCommand`/`editPlanPreview`/`applyEditPlan`/`improveTripPlan` |
| Day timeline data | `plan.days[]` (post journey-days fix) |
| Cost strip deep-link | `costSummaryStrip` pattern (`state.activeTab='costs'`) |

---

## Risks

- **Default-tab change is load-bearing** — must update *every* `state.activeTab='itinerary'`
  init site (7 confirmed) + the heal fallback, or a refresh/deep-link can land on a stale tab.
  Covered by the manual matrix (fresh open, refresh, deep link, demo trip).
- **FAB overlap** — must clear the existing mobile `.tc-actionbar`; verify at 375px.
- **Rail performance** — 6 highlight cards + N discovery cards each call `placeMedia`; reuse the
  existing lazy/once-per-trip media load guard (`state._mediaLoadedFor`) so Overview doesn't
  re-fetch.
- **Empty/early states** — a freshly created trip whose research is still running must show
  honest "curating…" placeholders, never blank boxes or fabricated content.
