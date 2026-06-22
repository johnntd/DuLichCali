# Travel Concierge V6 — Dependency Graph + Booking Engine Design

**Date:** 2026-06-22
**Status:** Approved (direction + fork resolutions) — investigation complete, ready for plan
**Branch:** `travel-concierge`

---

## Problem

The trip's to-dos are a **flat task list** (`tr.bookings[]` sorted by static type-priority). Real
travel planning is a **dependency graph**: you can't buy Zoo tickets before you've got the transport
to San Diego and a hotel there; the return bus is the last thing. Users should always know **what to
do next, what's blocking the trip, what's done, who's responsible, what depends on what, and what
happens when plans change** — the app should feel like an **AI travel secretary, not a spreadsheet.**

This is an **architectural layer on top of the existing model** (confirmed by investigation): the
existing nodes (`tr.bookings[]` from `deriveTripTasks`), the deterministic journey ordering
(`segments → buildSegmentDayPlan → plan.days → buildDayView`), `buildTripGraph`, locks
(`lockedLegs`/`node.locked`), votes, cost engine, replan, and live-notify all stay — V6 adds a
**deterministic dependency solver + a dependency-aware Next-Action/priority engine** over them.

---

## Locked decisions (user-approved)

1. **Deterministic dependency derivation** from journey/segment/day order + type — **no AI call**
   (instant, reliable, honest, offline-safe). AI is never required to know the order.
2. **One large Next-Action card** (the single next thing to do), not a list/tree.
3. **Vertical dependency chain** for the map (mobile-first; reuses journey-builder node cards), not a
   heavy graphical DAG.
4. **Locked nodes are sacred** — rebuild only affected nodes, never modify locked ones.
5. **Co-pilot**: AI fills, user overrides always win; auto-rebuild on dates/votes/edit/add/delete
   (cheap because derivation is deterministic — re-derive on render), but the AI *replan* stays
   lock-aware and affected-only.
6. **Phased** P0 → P1 → P2 (below); deploy held per phase until confirmed.

---

## The node model (extend, don't replace)

V6 graph nodes ARE the existing `tr.bookings[]` task nodes (`newBooking`). Add these fields
(additive; legacy bookings stay valid):

- `dependencies[]` — ids of nodes that must be DONE before this one (derived, recomputed each build)
- `blocked` (bool) + `blockedReason` (`missing_transport` | `missing_stay` | `missing_prior_leg`)
- a derived `priorityScore` (number) — for ordering (the stored `priority` P0/P1/P2 stays the tier)
- `completedAt`/`completedBy` already set by the checkbox; generalized here.

DONE set = `bookingStatus ∈ {booked, paid, completed, skipped, not_needed}` (existing
`TCTasks.isDone`). A node is **BLOCKED** when any of its `dependencies[]` is not DONE.

`dependencies[]`/`blocked`/`priorityScore` are **never persisted as truth** — they're recomputed on
every build from the journey + current statuses (so they self-heal on any change). The status,
assignee, cost, confirmation#, locks ARE persisted (they already are).

---

## Engine — `tc-depgraph.js` (NEW pure module, node-testable like `tc-tasks.js`)

`window.TCDepGraph`. Pure, no DOM/Firebase. The caller tags each task into a graph node, then the
module does all the graph logic.

### Node tagging (caller-side, in travel-concierge.js)
For each `tr.bookings` task, build `{ id, kind, city, journeyIndex, status, dueDate, votes,
priority, type, title }` where:
- `kind` = `transport` | `lodging` | `ticket` (ticketed attraction/tour) | `activity` | `food` |
  `optional` (mapped from `type`).
- `city` = the task's destination/segment city (from `destinationId`/`segmentId`/derived).
- `journeyIndex` = position of that city/leg in the ordered journey (from
  `segments(tr)` order + `tr.transport` `legType`/order). Return transport = last.

### `TCDepGraph.build(nodes)` → `{ nodes, nextAction, progress }`
Derives, per the approved deterministic rules:
- **lodging(city)** depends on the **inbound transport(city)** (the leg arriving in that city).
- **ticket/activity/food(city)** depends on **inbound transport(city)** AND **lodging(city)**.
- **transport leg N** depends on **transport leg N-1** (journey is sequential → "Book Bus, then
  confirm Michael").
- **return transport** depends on all prior transport legs.
- **pinned** nodes (`tr.pinnedActivities`) are REQUIRED → priority bump.
- `blocked` = any dependency not DONE; `blockedReason` from the first missing dep's kind.

### `priorityScore(node)` (the spec's formula)
`importance(typeWeight) + daysUntilDueWeight + dependencyWeight(in-degree) + familyVotesWeight`,
where transport > lodging > ticket > activity > food > optional; sooner due = higher; more nodes
depending on it = higher; more family up-votes = higher. **Never** sort by creation time/alpha.

### `nextAction(nodes)` → the ONE next node
Highest `priorityScore` among nodes that are **not DONE and not blocked**. If everything is blocked,
surface the unblocking prerequisite (the earliest not-done transport/lodging). Null when all done.

### `progress(nodes)` → per-group + overall %
`{ transport, hotels, tickets, activities, food, overall }` (done/total per `kind`).

---

## UI (phased)

### P0 — the secretary core
- **Next-Action hero card** at the top of the Tasks tab (and a compact echo on the Overview): the
  single next node — title, route/city, due date, "Critical" tier, estimated cost, assigned family,
  and the actions **Research options / Mark booked / Assign**. On completion it auto-advances to the
  next node (re-derive on render).
- **Blocked badges** on task cards: `⚠ Waiting for transportation` / `⚠ Hotel not booked` (from
  `blockedReason`); blocked nodes sort below actionable ones and are visually de-emphasized.
- **priorityScore ordering** replaces the flat sort in `renderBookings` (transport→…→optional,
  dependency-aware).
- **Booking-progress chips** (Transport 75% · Hotels 50% · … · Overall 42%) — reuses
  `progress()` (extends the V5 progress bar).

### P1 — smarts
- **Smart warnings** strip ("Hotel should be booked before Zoo tickets", "Return bus still missing",
  "Seal Tour may sell out", "Arrival after 4 PM may reduce activities") — derived from graph gaps +
  journey timing.
- **Auto-rebuild** wired to date/vote/edit/add/delete (re-derive deterministically on render; AI
  replan stays lock-aware/affected-only via existing `replanRange`).
- **Family/member assignment** polish (assignedTo member, not just family) + per-node + per-family +
  per-member cost rollup (reuses `computeBalances`/`familyShares`).

### P2 — visualize + custom + live
- **Dependency Map** (vertical chain: node → ↓ → node, with lock/blocked/done state) as its own
  view, **separate from the Timeline** (the existing day-by-day stays as-is).
- **Custom places**: user adds a place → research (rating/price/hours/YouTube/Maps via
  `researchUserPlace`/`researchPlaceMedia`/`TCMedia`) → fit into the schedule (existing
  `addPlaceToDay`); **user override always wins**, AI never forces.
- **Live group** notifications on node changes ("Loan booked Bus Hoang") via existing
  `notifyTripTask`/`tripActivityFeed`.

---

## Reuse map

| Need | Reuse |
|---|---|
| Nodes | `tr.bookings[]` + `newBooking` + `deriveTripTasks`/`mergeBookings` |
| Journey order | `segments(tr)` + `buildSegmentDayPlan` + `plan.days[].destinationIndex` + `tr.transport`/`lockedLegs` |
| Done/priority | `TCTasks.isDone`/`setDone`/`priority` |
| Cost rollup | `computeTripCosts`/`costSplit`/`familyShares`/`TCTasks.computeBalances`/`costLedger` |
| Locks | `lockedLegs`/`node.locked`/`isNodeLocked`/`lockNode`/`unlockNode` |
| Replan (affected-only, lock-aware) | `replanRange`/`runReplanDay`/`applyEditPlan` |
| Votes | `nodeVotes`/`tr.votes` |
| Custom-place research | `researchUserPlace`/`researchPlaceMedia`/`learnMoreSection`/`TCMedia` |
| Live group | `notifyTripTask`/`tripActivityFeed` |
| Timeline view | `plan.days` / V5 `ovDayDetails` (kept separate) |
| New | `tc-depgraph.js` (solver + priorityScore + nextAction + progress + warnings), Next-Action hero card, blocked badges, progress chips, dependency-map render, custom-place form, auto-rebuild hooks |

---

## Honesty (unchanged, NON-NEGOTIABLE)
Real photos/links only (`placeMedia`/`TCMedia`); no fabricated ratings/prices/hours (`~` on
estimates); YouTube = search links unless a real id exists; multilingual vi/en/es for every new
string; mobile-first 375/1280. The dependency graph is **derived**, not invented — it reflects the
user's actual journey + statuses.

---

## Testing & deploy
- `tests/tc-depgraph.test.js` (pure node, eval pattern): the success-test trip (Bus SJ→OC → Michael
  OC→SD → SD hotel → Zoo → Seal → return → HB hotel → Pho → return bus) must derive the exact
  ordered next-actions (1 Book Bus, 2 Confirm Michael, 3 Book SD hotel, 4 Zoo, 5 Seal, …, last
  return bus); blocked propagation; priorityScore ordering; progress %.
- Regression: all pure suites green, `npm run test:rules` (no rules change), `full_system_dry_run`
  `FINAL: PASS`, Playwright smoke (Next-Action card renders, blocked badges, progress).
- `?v=` bump per phase; **deploy HELD** until confirmed.

---

## Risks
- **Task→journey mapping** is the crux — a task whose city/segment can't be resolved must degrade
  gracefully (treat as unscheduled/optional, never crash or wrongly block the whole trip).
- **Never over-block:** a missing/ambiguous dependency must not block everything (the success test
  guards the exact expected order). Locked/pinned nodes always remain actionable.
- **Derive-on-render cost** — derivation is O(n) over tasks; cheap. No persistence of derived fields.
