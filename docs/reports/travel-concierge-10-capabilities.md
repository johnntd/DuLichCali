# Travel Concierge — 10 Core Capabilities: implementation + surfacing audit

**Date:** 2026-06-21 · **Surface:** `/travel-concierge` · **Target version:** hosting `v=20260620zu`
**Status:** Implemented · V3 landing 76/76 · V2 album/clips 107/107 · i18n parity 994×3 (vi/en/es) · rules 104/0 · `full_system_dry_run.sh` → `FINAL: PASS` · **NOT yet deployed (gated on confirmation)**

## What changed this release (the gap was surfacing, not the engines)
Capabilities 1–7, 9, 10 already existed in-app from prior phases (consensus engine, transport compare with Hoàng + DLC, stay intelligence, discovery agents, optimizer, V2 album/clips, shared costs). This release: **(a) repositioned the landing to communicate all 10**, **(b) simplified onboarding Step 1 to Origin/Destination/Dates with progressive disclosure**, and **(c) added the in-app activity/notifications feed** (Capability 8's missing piece). No server or rules change this round — hosting-only.

### New on the landing (`renderHero`)
- H1 → **"Your AI travel agent for families and friends."** + agent-framed sub (who/where/what → AI does experiences, transport, stays, plan, votes).
- **Who/Where/What band** (`whoWhereWhatBand`) — "tell us 3 things, AI does the homework."
- **How it works** (`howItWorksSection`) — 4 steps.
- **10 agent capability cards** (`capabilityCards`) — one per requirement.
- **Trust section** (`trustSection`) — From Du Lich Cali · no fake prices · no fake bookings · no AI attraction/restaurant photos.
- Repeat CTA after the story. Live sample preview retained.

### Onboarding (`renderCreate`)
- Primary fields: **Origin · Destination(s) · Dates**. Group name + budget + pace moved into a collapsed **"More details (optional)"** (`<details>`). Required = destination + dates; group name auto-defaults to the first destination city. Budget/pace keep smart defaults (moderate / balanced).

---

## Per-capability audit

| # | Capability | Implemented | Landing | Onboarding | Trip UI | Backend / function | Data model | Tests | Limitations |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Multi-family AI planning | ✅ Yes | `cap_family` card + WWW "who" + H1/sub | Families screen (adults/kids/teens/seniors/food/walking/budget/pace/special needs) | Group profile label + `groupTravelersBlock`; "why it fits your group" | `analyzeGroupProfile`, `tcGroupProfile`, `summarizeFamiliesForTrip`; skeleton/legDays prompts | `trip.families[]`, `trip.groupProfile` | V3 (`cap_family` ×3) | Group profile is heuristic + AI; not a survey |
| 2 | Best experience discovery | ✅ Yes | `cap_experiences` card | implicit (interests/atmosphere) | Tours panel + Attractions top-picks (why / who-benefits / time / tier) | `researchTripTours`, `researchAttractions` (Gemini grounded) | `trip.tours`, `trip.attractions` | V2/V3 cards | Prices = "pending verification"; no live availability |
| 3 | Attractions / food / events / hidden gems / stopovers | ✅ Yes | `cap_discover` card | — | Food, Events, Discoveries(stopovers), Route Opportunities (per travel day) | `researchTripStays/Restaurants/Events/Stopovers/RouteOpportunities` | `trip.food/events/stopovers/routeOps` | existing suites | Events within date range only when grounded; labeled estimates |
| 4 | Transport comparison (car/flight/Hoàng/DLC) | ✅ Yes | `cap_transport` card | Origin captured Step 1 | Transport tab — per-leg car/flight/Hoàng Bus/DLC ride; time, cost low/exp/high, best-for, links, select | `tcBuildTransportLegs`, `tcHoangServiceCity`, `computeTripRoute`; DLC via `requestDlcInquiry` | `trip.transport`, `transportChoice`, `transportVotes` | existing transport tests | Car dist/time authoritative; flight/bus/train = labeled estimates + search links (no live API); GOOGLE_MAPS server key placeholder → estimates |
| 5 | Hotels + Airbnb | ✅ Yes | `cap_stay` card | atmosphere chips (families) | Stay tab — best area + hotels by category + Airbnb areas + strategy compare; select/booked | `researchTripStays` | `trip.stays`, `hotelStatus` | existing stay tests | No live room prices/availability; rough ranges only |
| 6 | Family voting + optimization | ✅ Yes | `cap_vote` card + How-it-works ③ | — | `voteRow` (👍🤔👎❤️) on itinerary/food/stay/attractions/events/stopovers/transport/bookings/tours/route-ops; consensus badge + re-rank; skipped never returns | consensus helpers; `tcConsensusArrays`/`tcAvoidSet` in all research agents | `trip.votes`, `trip.favorites`, `trip.placeOverrides`, `transportVotes` | consensus/rebuild/phase3/rerank suites | — |
| 7 | AI keeps improving | ✅ Yes | `cap_optimize` card + How-it-works ③ | — | Experience Optimizer (10 multi-select goals) + 🔄 Optimize Trip rebuild + vote-change nudge | `improveTripPlan` (consensus+profile aware), `optimizeRebuild` | `lastOptimizedSignature`, votes/profile | improve/rebuild suites | Suggestions; user applies — never auto-books |
| 8 | Live maps + notifications | 🟡 Partial | `cap_live` card + How-it-works ④ | — | Group tab: embedded live map (`mountLiveMap`), member status (arrived/on-the-way/delayed), nav links, **+ NEW in-app activity feed** (`tripActivityFeed`: votes-needed, booking reminders, arrivals/delays) | live-location callables; feed derived client-side from existing data | `groupTrips/{id}/liveLocations`, `trip.bookings/suggestions` | V3 (`tripActivityFeed`) | **Push notifications NOT built** — in-app alerts only (stated in UI: "push coming soon"); map needs ≥1 member sharing coords |
| 9 | Album + AI Clips | ✅ Yes | `cap_album` card + How-it-works ④ | — | Album tab (link media, privacy) + AI Clips tab (consent-gated export package) | `generateTripClipPackage` | `groupTrips/{id}/media` (rules) | V2 (107) | Link-only media (no binary upload — Phase B); clips = export package, no render/post |
| 10 | Shared trip costs | ✅ Yes | `cap_costs` card | — | Costs tab — total / per-family / per-person by category; editable assumptions | `computeTripCosts`, `costSplit`, `familyShares` | `trip.dayTiming`/ledger, cost assumptions | existing cost tests | Editable estimates, clearly labeled; no live prices |

**Score: 9 ✅ full + 1 🟡 partial (notifications = in-app only; push deferred).**

## Anti-fabrication (honored across all 10)
No fake prices/availability/confirmations/URLs/photos/routes/events — everything is labeled "pending verification"/estimate; real photos come only from Google Places / Wikipedia; DLC inquiries create a request/draft handoff (no payment, no auto-post).

## Tests
- `/tmp/tc_v3_landing.js` (76): hero positioning ×3 langs, all sections present, exactly 4 how-it-works steps + 10 capability cards (each named + described ×3), Step-1 simplification (origin/dest/dates primary; name/budget/pace inside the optional disclosure), validation + group-name default, activity feed (booking reminders / pending suggestions / arrived+delayed only; empty state; push-coming-soon).
- `/tmp/tc_v2_album_clips.js` (107): unchanged, still green.
- i18n parity 994/994/994; rules 104/0; `full_system_dry_run.sh` → `FINAL: PASS`.

## Limitations / follow-ups
- **Push notifications** (Capability 8) — only in-app alerts today; needs FCM + a notifications collection + service worker (separate phase).
- **Live transport/hotel prices** — labeled estimates; no live pricing API. `GOOGLE_MAPS_API_KEY` server secret is a placeholder → server route legs degrade to estimates (client key works in-browser).
- **Album binary upload** — link-only until V2 Phase B (`storage.rules` review).
- Capabilities are AI-researched + grounded; quality depends on Gemini grounding for the destination.
