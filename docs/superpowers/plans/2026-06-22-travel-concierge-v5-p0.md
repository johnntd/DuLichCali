# Travel Concierge V5 — P0 (Experience-First Shell) Implementation Plan

> **For agentic workers:** executed INLINE this session by the controller (deep single-file context). Steps use `- [ ]` tracking.

**Goal:** Replace the dashboard-feel Overview with an experience-first shell — cinematic hero (no status/cost/progress), dominant Highlights cards, 5-tab nav, and a Trips/AI-Concierge/Share/Profile bottom nav. Presentation-layer only; ~90% reuse.

**Architecture:** Edit `renderOverview` (travel-concierge.js:4111) hero + Highlights; shrink `TAB_PAIRS` (3935) to 5 + relabel + extend `openMoreSheet` (2228) for hidden tabs; rebuild the `.tc-actionbar` (3962) into a 4-item bottom nav folding the FAB in. New pure helper `TCOverview.heroTitle` (season+year). CSS in travel-concierge.css. `?v=20260622h`.

**Tech Stack:** Vanilla browser JS IIFE, dark navy+gold tokens, Bodoni/Jost, pure-node tests (eval), Playwright smoke. Deploy HELD.

---

## Task 1: `TCOverview.heroTitle` pure helper + tests + season i18n
**Files:** `tc-overview.js`, `tests/tc-overview.test.js`, `travel-concierge.js` (season_* i18n ×3)

- [ ] Add `heroTitle(dateRange)` → `{ seasonKey, year }` or `null`. Parse 4-digit year + first month from the dateRange string (month names or numeric `M/D`); month→season (12/1/2 winter, 3-5 spring, 6-8 summer, 9-11 fall). Return null when no year parseable.
- [ ] Tests: "July 1–4, 2026"→{summer,2026}; "Dec 2025"→{winter,2025}; "2026-03-10"→{spring,2026}; "no dates"→null. Run `node tests/tc-overview.test.js` (expect all pass).
- [ ] Add `season_spring/summer/fall/winter` to en/vi/es tables.
- [ ] Commit.

## Task 2: Rewrite the Overview hero (cinematic; strip dashboard chrome)
**Files:** `travel-concierge.js` renderOverview (4111–4172), add `ovTeasers(tr)` helper

- [ ] Replace the hero block (lines ~4115–4172: tasks/readiness/nextAction/statusChips computation + `tc-ov-hero__stat`/ovRing/budget/`tc-ov-hero__chips`/next-task CTA) with: lead `placeMedia` bg, `tc-ov-hero__eyebrow` (destinations/destination), `tc-ov-hero__title` = `heroTitle()` → `t(seasonKey)+' '+year` else groupName, `tc-ov-hero__sub` (dateRange · N families · M travelers), a `tc-ov-hero__teasers` row from `ovTeasers(tr)` (top 4: liveHighlights then attractions; icon via liveCatIcon/catAttrIcon, short name), and ONE `tc-ov-hero__cta` "Continue Planning →" → `state.activeTab='itinerary'` (Days). Keep the `tr._fallback` unverified note.
- [ ] `ovTeasers(tr)`: returns up to 4 `{icon,label}` from real picks (liveHighlights first, then consensusSorted attractions), rejected filtered.
- [ ] `ovRing` left defined (used nowhere now) — or removed; keep for P1 Task Center reuse.
- [ ] Parse check; commit.

## Task 3: Promote Highlights + Discoveries to large photo-first cards
**Files:** `travel-concierge.js` ovHighlightCard (4064), ovDiscoveryCard (4100)

- [ ] Evolve `ovHighlightCard`: large media (CSS), floating glass badge (`tier`→Must-See/Top-Pick via `t('tier_'+tier)` mapped, or tier label), name (Bodoni), a dotted meta line (`⭐`+rating only if `a.rating`, `⏱`+`a.duration`/`estimatedDuration` if present, `🎟`+ticket — only existing facts, no fabrication), 2-line `why`, and a links row built from `TCMedia.build(a,'attraction',city)` (Official ↗ / ▶ YouTube / Maps) using `renderMediaLinks` if available, else `learnMoreSection` link set. Tap → `openPlaceModal`. New classes `tc-ov-card--lg`.
- [ ] Evolve `ovDiscoveryCard` similarly (P2 adds Add/Replace; P0 just the larger card + liveCatIcon badge + links).
- [ ] Parse check; commit.

## Task 4: Tabs 13 → 5 (+ relabel Days, merge Clips into Album, More sheet)
**Files:** `travel-concierge.js` TAB_PAIRS (3935), dispatch (3944), openMoreSheet (2228), i18n

- [ ] `TAB_PAIRS = [['overview','tab_overview'],['itinerary','tab_days'],['bookings','tab_tasks'],['album','tab_album'],['more','tab_more']]`. (Keep keys; new labels `tab_days`,`tab_tasks`,`tab_more`.)
- [ ] Tab click for `'more'` → `openMoreSheet()` (do NOT set activeTab to 'more'); all other tabs set activeTab. The `'more'` pill shows active state only transiently (it's a sheet trigger).
- [ ] Heal fallback stays `'overview'`. Dispatch: keep ALL 13 branches; add `album` branch renders `renderAlbum` then appends `renderClips` (merge). Unknown/`more` → falls through (sheet handles it; body shows current tab).
- [ ] Extend `openMoreSheet`: after the existing dash/edit/share/delete buttons, add a labelled list of the hidden surfaces — Journey, Transport, Stay, Food, Events, Discoveries(stopovers), Costs, Group — each `closeModal(); state.activeTab=key; render();`.
- [ ] i18n: add `tab_days`('Days'/'Ngày'/'Días'), `tab_tasks` (reuse existing 'Tasks' label from tab_bookings), `tab_more`('More'/'Thêm'/'Más'), `moreNavTitle`.
- [ ] Parse check + grep that all 13 render branches remain. Commit.

## Task 5: Bottom nav (Trips / AI Concierge / Share / Profile) + fold FAB in
**Files:** `travel-concierge.js` action-bar block (3958–3973)

- [ ] Replace the `.tc-actionbar` contents with 4 `abBtn`s: 🗂 Trips→`goDashboard()`, 🤖 AI Concierge→`openConciergeSheet(tr)`, 🔗 Share→`openShareModal()` (owner-only; if not owner show 👥 Group→`state.activeTab='group'` or omit), 👤 Profile→opens the account control (reuse `#tcHeaderAcct` login/logout via a small `openProfileSheet()` or trigger the header login). Keep the bar for `!tr._demo`.
- [ ] REMOVE the separate floating `conciergeFab` mount (folded into the bottom nav). `conciergeFab`/`openConciergeSheet` functions stay (sheet reused by the nav button).
- [ ] Give the bottom nav a class `tc-actionbar tc-bottomnav` for V5 styling; relayer z-index in CSS (bottomnav 40, sheet/modal above).
- [ ] Parse check; commit.

## Task 6: CSS — V5 hero, large cards, sticky tabs, bottom nav
**Files:** `travel-concierge.css`

- [ ] `.tc-ov-hero` → cinematic: min-height clamp(380px,62vh,560px), Apple-Memories scrim, `__eyebrow` gold uppercase, `__title` Bodoni clamp(2.6rem,9vw,4.6rem), `__sub`, `__teasers` glass chips. Hide `.tc-ov-hero__media .tc-nophoto` extras (keep gradient). Remove reliance on removed `__stat/__budget/__chips`.
- [ ] `.tc-ov-card--lg`: media 230–260px, `.tc-ov-card__badge` floating glass (gold variant), `.tc-ov-card__meta` dotted line, `.tc-ov-card__links` row; rail peek 86%/60%/38%.
- [ ] `.tc-tabs` sticky under app-bar + blur, 5 equal pills.
- [ ] `.tc-bottomnav` 4-column; z-index 40; keep `.tc-ov-fab` removed from layout (or hide). `.tc-ov-sheet` z-index above. `.tc-plan` padding-bottom for the bar.
- [ ] 768/1200 breakpoints + `prefers-reduced-motion`. Brace-balance check. Commit.

## Task 7: HTML version bump + verification (HOLD deploy)
**Files:** `travel-concierge.html`

- [ ] Bump `travel-concierge.js` + `.css` + `tc-overview.js` `?v=` → `20260622h` (verify never deployed).
- [ ] Run all pure suites (incl. tc-overview), `npm run test:rules` (113/0), `full_system_dry_run.sh` (FINAL: PASS).
- [ ] Update `tests/live/v4-overview-smoke.js` → v5 assertions (hero has NO ring/budget/status chips; `.tc-ov-hero__title` present; exactly 5 tabs; `.tc-bottomnav` 4 items; 0 our-errors) OR add `tests/live/v5-overview-smoke.js`. Run headless at 390 + 1280; screenshot.
- [ ] Report PASS/FAIL. **Do NOT deploy** — hold for user confirmation.

---

## Self-review
- Spec coverage: hero strip ✓(T2), highlights dominant ✓(T3), 5 tabs ✓(T4), bottom nav ✓(T5), CSS ✓(T6), honesty (placeMedia/no fabricated meta) ✓(T2/T3), version ✓(T7), tests ✓(T1/T7).
- All 13 render branches preserved (5 visible + 8 via More) — verified in T4.
- Deploy held.
- Placeholders: none — code authored inline at each step with parse checks.
