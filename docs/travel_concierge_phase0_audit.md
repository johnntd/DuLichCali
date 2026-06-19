# AI Group Travel Concierge — Phase 0 Audit & Implementation Note

**Date:** 2026-06-18 · **Status:** Phase 0 complete; building Phases 1–8 autonomously.

## How the existing app is built (audit findings)
- **Stack:** static HTML/CSS/JS, **no build step / no framework**. Each "page" is a root `*.html` + its own JS module (IIFE) + shared `style.css` + `desktop.css`. So the new feature is a new `travel-concierge.html` + `travel-concierge.js` + `travel-concierge.css`.
- **Routing:** Firebase Hosting `rewrites` in `firebase.json` (clean URLs). → add `{ "/travel-concierge" → "/travel-concierge.html" }`.
- **AI backend:** Cloud Functions v2 `onCall` (region `us-central1`), keys are **server-side secrets** (`getAiKey('claude'|'openai'|'gemini')` + `serverCallClaude/serverCallOpenAI`). Frontend calls callables via `firebase.functions().httpsCallable(...)`. The generic `aiProxy` exists but caps at **1500 tokens** — too small for a full multi-day, multi-family plan → add a dedicated **`generateGroupTripPlan`** callable (JSON mode, higher cap) with a **mock fallback**.
- **Auth:** anonymous Firebase Auth is the public-page pattern (style-studio/mobile-barber). Share/collaboration uses an **unguessable trip id as a capability** (no login required), persisted to Firestore.
- **Firestore:** rules use helper fns (`isVendorMember`, `isAdmin`) + per-collection `match` blocks. → add an **additive** `match /groupTrips/{tripId}` block (capability model: create by any anon user; read/update by anyone holding the id). Test with `npm run test:rules`.
- **Travel data:** `destinations.js` (`DESTINATIONS`, real places incl. Las Vegas/Yosemite) — reused to seed mock places.
- **Homepage:** `index.html` Panel 3 "Tours & Travel California" (3-panel architecture is a hard contract) → add a **"Plan a Group Trip with AI"** card there (additive, preserves structure).

## Architecture (isolated, additive, non-breaking)
| Layer | What |
|---|---|
| Route | `firebase.json` rewrite `/travel-concierge` |
| Page | `travel-concierge.html` (mobile-first shell, loads firebase compat incl. **functions** SDK) |
| Module | `travel-concierge.js` — all screens + state + render + providers; vi/en/es; localStorage + Firestore |
| Styles | `travel-concierge.css` (base → 768 → 1200) |
| AI | `functions/index.js` → `generateGroupTripPlan` callable (Claude/Gemini JSON + mock fallback + validation) |
| Persist/share | Firestore `groupTrips/{tripId}` + additive rules; share via `?trip=<id>` |
| Homepage | "Plan a Group Trip with AI" card in the Tour & Travel panel |

## Provider abstraction (mock-first; real later)
`TravelPlanGenerator` (callable + mock), `TravelResearchProvider`, `PlaceMediaProvider` (placeholder images now), `MapLinkProvider` (**real** — builds Google/Apple Maps search URLs from name+address; allowed), `ReservationLinkProvider` (null/official-only), `TravelTicketProvider` (plane: airline/Google-Flights **search links** + "price pending verification"), `BusTicketProvider` (Vietnamese services e.g. Xe Bus Hoang; manual entry + "price pending"). **No fake prices, no fake confirmations, no illegal video embeds.** Every AI place carries `dataSource: "ai_generated_pending_verification"`.

## Data model
`Trip`, `TripFamily`, `TripParticipant`, `TripPreference`, `TripPlan` → `TripDay` → `ItinerarySection` → `PlaceCard`; plus `TripFamilyTransportation` (per-family car/plane/bus arrival itinerary + synchronized meetup), `TripVote`, `TripNote`, `TripBookingStatus`. Persisted as one `groupTrips/{tripId}` document (subfields) for simple capability-based sharing.

## Safety
Isolated module; additive edits only (rewrite + one homepage card + one rules block + one new callable); existing booking/vendor/barber/ride/tour/style-studio/promotions untouched; mobile-first; AI failure → mock fallback (never a crash); unverified suggestions clearly labelled.

## Build order (this work)
P1 data model + sample plans → P2 trip/intake/preferences UI (+ per-family transportation) → P3 `generateGroupTripPlan` callable + mock fallback → P4 visual itinerary → P5 place detail + map links → P6 collaboration (share/vote/notes/booking) + **Family Arrival Plan** → P7 regenerate/replace → P8 tests + regression.
