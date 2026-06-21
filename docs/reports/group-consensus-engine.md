# Group Consensus Engine — Architecture Report

**Date:** 2026-06-20 · **Surface:** `/travel-concierge` · **Target version:** hosting `v=20260620zo` + functions `improveTripPlan`
**Status:** Implemented · full regression 18 suites / 412 assertions green · `full_system_dry_run.sh` → `FINAL: PASS` · **NOT yet deployed (awaiting confirmation)**

## Goal
Turn every per-family Like / Maybe / Skip / ❤️ Favorite, on every surface, into a weighted AI planning signal so families collaboratively shape the trip and the AI keeps optimizing for the whole group. No hardcoding — everything is driven by AI + preferences + votes.

## Data model (persisted on `groupTrips/{id}`, no schema/rules change)
- `trip.votes[pid][familyId]` = `'like' | 'maybe' | 'skip'` (existing; pid = `id || name`).
- `trip.favorites[pid][familyId]` = `1` (**new** — additive ❤️, independent of like/skip).
- `trip.transportVotes['<legKey>|<mode>'][familyId]` = `'like' | 'skip'` (**new** — mode preference, does NOT feed place rejection).
- Rejections continue via the existing `trip.placeOverrides` (auto `action:'skipped'` from majority-skip / not-needed) — already deployed; "skipped never returns" is unchanged.

## Components

### 1. Universal voting widget — `voteRow(p, opts)`
👍/🤔/👎 + ❤️ Favorite + a live **consensus badge**, with per-family counts. `opts.booking` (default off) shows the reservation status; `opts.favorite` (default on). Now rendered on **every** voteable surface: itinerary places, attractions, food picks, stay/hotel cards, events, stopovers, route-opportunity discoveries (+ transport via a dedicated mode-vote). A deciding skip still flows into the existing rejection engine (hidden + never re-suggested); favorites/likes are positive signals.

### 2. GroupConsensusAgent (deterministic, client) — `consensusFor(pid)`
Weights each family by size + kids + seniors + accessibility (`familyWeight`): `1 + travelers*0.1 + kids*0.12 + seniors*0.12 + 0.15 if accessibility`. Score = Σ(like·w, maybe·0.3w, −skip·w) + favorite·0.6w. Verdict ∈ `loved | liked | mixed | skip | none`. A bigger/higher-need family carries proportional say; "all families skip" → `skip`; liked + favorited → `loved`.

### 3. TripPreferenceProfile (deterministic, client) — `buildPreferenceProfile(trip)`
Evolves from families + votes + favorites: travelers/adults/seniors/kids/teens, budget, pace, `likedCuisines`, `stayPrefs`, `oceanPreference`, `themeParkPreference`, `walkingTolerance`, `accessibilityNeeds`, `likedPlaces`, `favoritePlaces`, `skippedPlaces`, `likedTransport` / `skippedTransport`. Recomputed on demand (no extra storage).

### 4. TripOptimizationAgent — `improveTripPlan` (reused/extended; "Improve this trip with AI")
The client sends `preferenceProfile` + `likedPlaces` + `favoritePlaces` + `skippedPlaces` + `votesSummary` (multi-select goals preserved). The Gemini prompt now treats **group consensus as the primary signal**: prioritize + keep favorited/liked; never re-suggest skipped (replace with a real alternative serving the same need); match the profile (cuisines, ocean/theme-park/walking/budget/pace, liked vs skipped transport); and every "why" references the group's votes/preferences (explanation engine). Suggestions only — the user applies them; no fake prices/URLs.

## "Improve this trip with AI" = the Optimize-with-our-votes action
The existing Experience Optimizer panel (top of the Itinerary tab) is now vote/consensus/profile-aware on every run; its subtitle states it optimizes from the group's votes, favorites and preferences.

## Preserved / not broken
- Rejection engine ("skipped never returns") — unchanged, now fed by the universal widget.
- Cost engine, ride-share handoff (`requestDlcRide`/`RideIntake`), tour services, Hoàng/transport, Stay/Food/Events/Stopovers/Route-Opportunity agents — untouched call paths.
- Multilingual vi/en/es (895 keys, 0 parity gaps); mobile-first CSS.

## Tests
`/tmp/tc_consensus.js` (26): family weighting, all-skip→skip verdict, liked+favorited→loved, profile from families/votes/favorites, transport-mode prefs, votesSummary, optimizer payload carries all signals, voting renders on itinerary/food/stay/attraction surfaces, vi/es. Full regression: 18 suites / 412 assertions, 0 failed. Gate `FINAL: PASS`.

## Phase 2 — Auto-rebuild (built 2026-06-20, target `v=20260620zp`)
- **One-click `optimizeRebuild(tr)`** — regenerates the whole trip from accumulated votes: re-runs `generatePlanSmart` (skeleton + per-leg) feeding **PREFER** = liked + favorited (`preferredNames`) and **AVOID** = skipped (`rejectedNames`) and existing pins, then re-derives the booking checklist and re-runs `runConciergeResearch` (stays/food/events/stopovers/transport/attractions/route-ops). Manual skips/replaces/pins survive (name-keyed `placeOverrides`). Owner-only; cost engine + ride/tour untouched.
- **Server PREFER** — `generateTripSkeleton` + `generateLegDays` accept `preferredPlaces` and feature them when they genuinely fit (never forced/duplicated). Threaded through all 4 itinerary-gen call sites (skeleton, multi-leg, regenerate-leg, regenerate-day) alongside `avoidPlaces`.
- **Vote-change nudge** — `votesSignature(tr)` (stable hash of votes + favorites + transport-votes) vs `trip.lastOptimizedSignature`; `votesChangedSinceOptimize` shows a "✨ Optimize Trip" banner atop the Itinerary when the group's votes changed since the last rebuild. A persistent "🔄 Optimize Trip" also lives in the optimizer panel.
- **Skipped-never-returns everywhere** — the Food, Stay, Events and Stopover displays now filter `rejectedNameSet` (matching attractions/route-ops/itinerary), so a voted-down restaurant/hotel/event/stop never reappears on any surface.
- Tests: `/tmp/tc_rebuild.js` (17) — preferredNames, nudge on change / cleared after rebuild, rebuild sends PREFER+AVOID to skeleton & legs, bookings re-derived, skipped hidden on Food. Full regression 19 suites / 429 assertions; gate `FINAL: PASS`.

## Phase 3 (built 2026-06-20, target `v=20260620zq`)
- **Per-booking-choice voting** — every Bookings-tab card now carries the full vote widget (👍🤔👎 + ❤️ + consensus), keyed by the booking's place name, so families vote on hotel/activity/restaurant/transport booking choices via the same consensus + rejection engine.
- **Consensus into the research agents** — `researchTripStays` / `Restaurants` / `Events` / `Stopovers` now accept `avoidPlaces` (skipped) + `preferredPlaces` (liked/favorited) — plus `likedCuisines` for food. A shared `tcConsensusPromptLine()` tells each agent to NEVER re-suggest a skipped place and to feature liked/favorited when they fit, and each callable defensively filters out any returned item whose name is in the avoid set. Client wrappers pass `rejectedNames` + `preferredNames` (+ profile cuisines). So skipped restaurants/hotels/events/stops never come back even from a fresh research run, and the group's up-votes steer the results.
- Tests: `/tmp/tc_phase3.js` (12). Full regression 20 suites / 441 assertions; gate `FINAL: PASS`.

## Phase 4 (built + DEPLOYED 2026-06-20, `v=20260620zr`)
- **Consensus re-rank** — `consensusSort(items, nameFn)` stably re-orders each voted list by the weighted group score: loved/liked float to the top, unvoted keep their AI order, mixed/negative sink (skipped already filtered out). Applied to Food picks, Stay hotels, Attraction top-picks, Events, Stopovers, and Route Opportunities. A "📊 Sorted by your group's votes" hint appears atop a list once any item is voted. `hotelVoteName(h, city)` shared by the card's vote widget and the sort so they agree.
- Tests: `/tmp/tc_rerank.js` (10). Full regression 21 suites / 451 assertions; gate `FINAL: PASS`.

## AI Experience Builder refinement (built + DEPLOYED 2026-06-20, `v=20260620zs`)
Turns the concierge into an experience designer. NET-NEW on top of the existing agents (route-ops, stopovers, attractions, food, events, stays, transport, optimizer, consensus — all already shipped):
- **Tour Discovery Agent** — server `researchTripTours` (Gemini-grounded; real tours/unique experiences per destination: harbor/whale/hop-on/food/kayak/amphibious/brewery/cultural… with type/duration/familyFit/whoBenefits/priceRange "pending verification"/why; consensus-aware avoid+prefer; no fake prices/URLs). Client `toursPanel` in the Itinerary, voteable + consensus re-rank + rejection filter + "Request via DuLichCali" tour inquiry + pin. Verified live: San Diego → Flagship Harbor Cruise, Old Town Trolley, food tour, etc.
- **Experience Paths** — the optimizer's goal chips expanded 5 → **10 trip styles** (Best overall / Kids / Foodie / Lowest cost / **Relaxing / Scenic / Theme parks / Hidden gems / Senior-friendly / Rainy-day backup**), multi-select; server `improveTripPlan` GMAP + ALLOWED extended. Users pick one or combine; the optimizer balances them with the consensus + preference profile.
- **DuLichCali service inquiries** — `requestDlcInquiry(kind: ride | van_transfer | tour | airport_pickup)` reuses the existing `sessionStorage('dlc_ride_prefill') → /airport → RideIntake.openWithPrefill` handoff (no payment — request/draft only). Buttons: transport flight → airport pickup; bus/Hoàng → van transfer to hotel (the arrival-hub → transfer → hotel pattern); tour card → DLC tour inquiry. `airport_pickup` opens the pickup form, others the ride form.
- Tests: `/tmp/tc_experience.js` (23). Full regression 22 suites / 474 assertions; gate `FINAL: PASS`.

## Status: the Group Consensus Engine roadmap (Engine + Phases 2–4) + AI Experience Builder are COMPLETE and live.
Separate/unstarted (different roadmap, needs its own design): the V2 social roadmap — Album + AI-Clips tabs (export package, not video render — rendering lives in the separate ai_social_content_agent repo) + a true embedded live map.
