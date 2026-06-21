# Travel Concierge — Phase X: Adaptive AI Travel Agent (Node-Graph) — DESIGN PROPOSAL

**Date:** 2026-06-21 · **Status:** Proposal for review — **NOT implemented.** Awaiting approval, then incremental + backward-compatible build.
**Principle:** Users edit ANY part; AI preserves good/locked decisions and replans only what's affected. No hardcoded destinations, no fake schedules.

---

## 1. Audit — current architecture (as built today)

| Concern | Current implementation | 
|---|---|
| Itinerary model | `trip.plan.days[]` → each day `{dayNumber,date,title,theme,summary,destinationIndex,isTravelDay,isReturnDay, sections[]→places/items[]}` |
| Edits | `trip.placeOverrides{}` keyed by **place name** (`placeKey`), action ∈ `moved/reordered/time_slot_changed/skipped/deleted/replaced`, with `fromDay/toDay/onDay/fromSlot/toSlot/order` |
| User additions | `trip.addedPlaces[]` (day/slot/order) |
| "Must-do" | `trip.pinnedActivities[]` (+ `togglePin`/`isPinned`) — activity-only |
| Per-day timing | `trip.dayTiming{}` |
| Transport | **Separate** from days: `trip.transport[]` legs (origin→dest→home) + `trip.transportChoice` + `trip.transportStrategies` (V3 `connectionPlan`: transfer hubs, hybrid bus+ride, return options) |
| Voting | `trip.votes{}` + `trip.favorites{}` keyed by **place name**; consensus engine; "skipped never returns" (`recomputeAutoReject`) |
| Preferences | `buildPreferenceProfile(trip)` (derived per-trip from families+votes) |
| Replanning | per-day `regenerateSingleDay` / `fixTimingOnly` / `resetDayToAI`; whole-trip `optimizeRebuild` + `generatePlanSmart` |
| Stopovers | `researchTripStopovers` + route-opportunities (per travel leg) |

**It already does a lot** (per-day regen, name-keyed move/skip/replace overrides, voting/consensus, pinning, real transport research). The gap is structural, below.

## 2. Gaps vs. the "living document / node graph" vision

1. **No unified node graph.** Activities live in `plan.days`; transport lives in `trip.transport[]`; they're never one connected journey (San Jose →Bus Hoàng→ OC →Michael→ San Diego →…→ home). You can't drag/lock a *transport leg* inside the day flow.
2. **Edits are name-keyed, not ID-stable.** `placeOverrides[placeName]` breaks on duplicate/renamed names and can't represent "this specific node." No stable `node.id`.
3. **`lock` is not a primitive.** Only activities can be "pinned." You can't lock a *bus leg* or a *specific hotel* so AI optimizes strictly around it.
4. **Replanning granularity is the whole day or whole trip.** Changing dates/destinations/transport tends to trigger broad regeneration (`optimizeRebuild`/`generatePlanSmart`) — the "change one thing → regenerate everything" complaint. No **affected-range-only, lock-aware** replan.
5. **No natural-language edit layer.** Improve/AI-chat give *suggestions*; nothing maps "return to OC July 3 by 4 PM via Michael" → mutate only the July 3–4 transport+stay nodes.
6. **No cross-trip memory.** Preference profile is per-trip; nothing persists learned food/walking/transport/hotel prefs or past trips across trips (mobile-barber already has a customer-profile pattern to mirror).

## 3. Node-graph design — "Trip Journey Graph"

A trip's canonical timeline becomes an **ordered list of typed nodes** (a linear journey with day buckets — a DAG is unnecessary). Transport, stays, activities, meals, stopovers and transfers are all **first-class nodes**.

```
NODE TYPES
  transport  → { mode(bus_hoang|flight|dlc_ride|car|amtrak|uber|transfer…), from, to,
                 operator, departTime, arriveTime, scheduleStatus:"pending_verification",
                 costRange, bookingRef, officialUrl }
  stay       → { name, area, checkIn, checkOut, nights, bookingStatus }
  activity   → { name, category, time, durationMin, ticketed }
  meal       → { name, cuisine, time }
  stopover   → { hub, ideas[], durationHrs }            (e.g. hours in Little Saigon)
  transfer   → { mode, from, to }                       (last-mile to hotel)
  note       → { text }

EVERY node: { id(uid, STABLE), type, day, order, status(planned|skipped|booked),
              locked(bool), source(ai|user|ai_edited), aiBase(original AI value),
              votes{familyId:like|maybe|skip}, favorite{familyId:1}, createdBy, ts }
```

**Example (the scenario), as a node chain:**
```
[D1] ⛓ San Jose ──(transport: Bus Hoàng 🔒)── Orange County
        └─(transfer: Michael ride)── San Diego ──(stay: SD hotel)
[D2] ⛓ activity · activity · meal …  (San Diego)
[D3] ⛓ (transport: Michael ride, leave 2 PM)── Huntington Beach Hotel 🔒  (arrive ~4 PM)
        └─ stopover: Little Saigon evening · meal · meal
[D4] ⛓ (transport: Bus Hoàng 🔒)── San Jose   [return]
```

**Backward compatibility (critical):**
- `buildTripGraph(trip)` **derives** the node list from existing `plan.days` + `trip.transport[]` + `placeOverrides` + `addedPlaces` + `pinnedActivities` (pins → `locked:true`). Old trips work with zero migration.
- `materializePlan(graph)` writes back to `plan.days` so **every existing renderer (Itinerary/Transport/Costs/Bookings tabs) keeps working unchanged.**
- The graph persists as a **new additive field** `trip.graph` once edited; until then it's derived on load. Votes/skips/pins continue to function (mapped name→nodeId with a back-compat read).

## 4. Firestore schema (all additive — no destructive change)

```
groupTrips/{id}
  graph: {                      ← NEW (additive; plan.days kept in sync for rendering)
    version: 1,
    nodes: [ {id,type,day,order,status,locked,source,aiBase,votes,favorite,…typeFields} ],
    updatedAt
  }
  votes / favorites             ← keep; new writes keyed by nodeId (read falls back to name)
  placeOverrides / addedPlaces / pinnedActivities / transport / transportStrategies  ← keep (derived into graph)

groupTrips/{id}/editLog/{autoId}   ← NEW (optional) audit of node edits (who/what/when) for collab
travelMemory/{uid}                 ← NEW cross-trip learning (mirrors mobile-barber customer profile):
  { foodPrefs[], cuisines[], walkingTolerance, kids, seniors, budget, pace,
    transportPrefs[], hotelPrefs[], rejected[], pastTrips[], updatedAt }
```
**Rules:** members already `update` the trip doc → `graph` is covered; add explicit allow for `graph`/`editLog` shape. `travelMemory/{uid}`: read/write own; trip can read members' memory only via the existing member-access marker. (Schema/rules change → goes through the rules-review + emulator-test gate.)

## 5. APIs (reuse first; 2 net-new callables)

| API | Status | Role |
|---|---|---|
| `generateTripSkeleton`, `generateLegDays` | exists | reused for **scoped** day-range gen (pass `lockedNodes` + `dayRange`) |
| `researchTransportStrategies` (connectionPlan) | exists | transport nodes (real research, pending-verification) |
| `researchTrip{Stays,Restaurants,Events,Stopovers,Tours,RouteOpportunities}`, `improveTripPlan` | exists | node content + "improve around" |
| **`replanTripRange`** | **NEW** | input `{graph, lockedNodeIds, affectedDays, preferences, votes}` → returns **only** the updated nodes for the affected range; locked nodes returned verbatim. Wraps `generateLegDays` scoped to days. |
| **`interpretTripCommand`** | **NEW** | input `{graphSummary, utterance, lang}` → a structured **edit plan**: `[{op(add/move/replace/delete/skip/lock/retime), target(nodeId|where), payload}]` + `affectedDays`. NL → node mutations. No data fabricated — returns intents; the client applies + calls `replanTripRange` for gaps. |

All keep anti-fabrication: real research, schedules "pending verification" + official links, never invented prices.

## 6. Edit workflow (the core: partial, lock-aware)

```
user op (UI ⋯ menu)  OR  NL command ("return to OC Jul 3 by 4 PM via Michael")
        │
        ▼
interpretTripCommand → EDIT PLAN (preview diff)  ──►  show "Here's what I'll change (Jul 3–4):
        │                                                + Michael ride OC→… · keep Bus Hoàng 🔒 …"
        ▼ user confirms
apply node mutations locally (optimistic) → persist trip.graph
        │
        ▼ if gaps (timing/route holes) in affected range only
replanTripRange({lockedNodeIds, affectedDays})  → updates ONLY those days
        │   (locked + unaffected nodes untouched)
        ▼
materializePlan(graph) → plan.days re-synced → existing tabs re-render
        │
        ▼ votes/skips → travelMemory (rejected never return; prefs learned)
```
**Locking:** `node.locked` → excluded from every replan/move/delete; passed to the AI as an immutable anchor ("optimize around these").

## 7. UI (evolve the Itinerary tab into a Journey Timeline)

- **Vertical journey timeline**: nodes (transport · stay · activity · meal · stopover) connected by `↓`, grouped by **day dividers**. Each node = a card with: type icon, title, time, status chip (pending verification / booked), **🔒 lock toggle**, **vote row** (👍🤔👎❤️), and a **⋯ menu**: Edit · Move · Replace · Delete · Skip · Add before · Add after · **Improve around this**.
- **Command bar** (top): "Tell the concierge what to change…" → NL edit → **preview diff** → Apply.
- Locked nodes show 🔒 and are visually anchored; replanned nodes briefly highlight.
- Transport nodes deep-link to the existing Transport-strategy + DLC-ride handoff.
- Mobile: same timeline, full-width cards, swipe; ⋯ menu as a sheet.

## 8. Diagrams + screenshots
- Node-chain + workflow diagrams: above.
- UI mockup (journey timeline + ⋯ node menu + command bar): see the attached desktop + mobile screenshots in the review message.

---

## Rollout (incremental, backward-compatible)
1. **Derive-only** `buildTripGraph`/`materializePlan` behind a flag — graph mirrors today's plan; no behavior change (ships dark).
2. **Lock primitive** + per-node IDs; map pins→locks; node-scoped votes (name fallback).
3. **`replanTripRange`** + wire per-day/affected-range replans to use locks (replaces broad `optimizeRebuild` for single edits).
4. **Journey-timeline UI** (transport interleaved) + node ⋯ ops.
5. **`interpretTripCommand`** NL edit bar + preview diff.
6. **`travelMemory`** cross-trip learning.
Each step: i18n vi/en/es, mobile-first, gate FINAL:PASS, no fake data; rules step gated by emulator tests.
