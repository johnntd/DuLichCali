# Travel Concierge — Trip Task Tracker / Action Items

**Date:** 2026-06-22 · **Branch:** `travel-concierge` · **Status:** design locked (user-approved), code-hardened.

## 1. Goal
A prioritized, assignable, payment-aware checklist per trip so the organizer + families know what must be done before/during the trip (book transport/hotels/tickets, reserve restaurants, collect payment, track confirmations).

## 2. Locked decisions
- **Evolve the existing bookings checklist into the Task Tracker** (one unified list) — enrich `newBooking`/`trip.bookings[]`, rename the "Bookings" tab → **"Tasks"**. No parallel `trip.tasks[]`, no duplicate checklist.
- **Payment balance/rollup in P2** (per-family balance = share owed − paid; total-paid / remaining-unpaid) built on the existing `costLedger`/`costSplit`/`familyShares`.
- **Phased P1→P2→P3; deploy once at the end** (per "do not deploy until tests pass").
- **Auto-gen is deterministic** (reuse `deriveBookingChecklist` + new helpers) — **no new AI callable** (reliable, no fabrication).

## 3. Reuse map (verified)
| Need | Existing (reuse) |
|---|---|
| Task record + factory | `newBooking(type,title,extra)` (L1149) → `trip.bookings[]`; dedup `bookingKey` (L1160), `mergeBookings` (L1198, non-clobbering) |
| Auto-derivation | `deriveBookingChecklist(trip)` (L1163) + `ticketedAttractionBookings(tr)` (L1386); seeded on tab open (L7120) |
| Status state machine | `bookingStatus` 6 states (research_needed/researching/ready_to_book/user_approval_needed/booked/skipped), human-approval-gated, never auto-purchases |
| Render | `renderBookings` (L7146) / `bookingCard` (L7175) / `bookingTypeIcon` / `bookingStatusClass` |
| Who-paid + split | `costLedger[]` {familyId,amount,paid} (L1472) · `costSplit` 4 modes (L1459) · `familyShares` (L1460) · `renderCosts` (L6822) |
| Tab / families / roles | `TAB_PAIRS` (L3869) · `families[]`/`tripFamilies()` (L5305)/`getMe` · `canEditPlan`/`canApprove` |
| Notify | Web Push stack (`pushSubscriptions`, `monitorDealWatchTrips` pattern L4184) + in-app `tripActivityFeed` (L6979, already alerts on unbooked-with-deadline + pending suggestions) |
| Persistence / rules | `saveTrip`/`stripRuntime` (new fields auto-persist); field-open Firestore rules (no rules change) |

## 4. Net-new
1. **Enriched task fields** on `newBooking`: `priority` (P0/P1/P2), `assignedToFamily` (family id), `dueDate` (alias of `deadline`), `costEstimate`, `actualCost`, `paidBy` (family id), `splitMode`, `splitBetween[]`, `linkedSegmentId`. Broaden `BOOKING_TYPES` task categories with **packing, payment, confirmation, other** (non-booking tasks). Backward-compatible (additive; existing bookings still valid).
2. **Status superset:** keep the 6 `bookingStatus` + add **`paid`**; map to the spec's labels (research_needed≈not_started, researching≈in_progress, user_approval_needed≈waiting_for_confirmation, booked, paid, skipped≈cancelled, + not_needed via the per-place `booking` map). UI shows the spec's status set.
3. **Priority rules** (`taskPriority(type)`, pure): **P0** transport(flight/bus/ride/rental_car) · hotel/airbnb · limited-availability attraction tickets; **P1** restaurant · ride confirmation · parking; **P2** packing · payment-collection · album/clips · backup. Auto-assigned at generation; user-overridable.
4. **Two new deterministic generators** (the current `deriveBookingChecklist` reads legacy `plan.transportation`, not V2 data): `lockedLegsTasks(tr)` (Bus Hoang/Michael → bus/ride task, using the render predicates: DLC ride = `transportMode==='private_ride' || /michael|dulichcali|dlc/i`; bus = `needsResearch||mode==='bus'`) and `transportChoiceTasks(tr)` (chosen mode per `trip.transport` leg via `chosenMode`/`legKeyOf`, skip `personal_car`). Add `hotelNeeded !== false` filter to the hotel derivation.
5. **Tasks tab** (`renderTasks`): per-task checkbox · status dropdown · **priority badge** · due date · assign-family `<select>` · cost · paid-by · confirmation# · booking link · mark-paid · mark-not-needed. **Filters:** All · Urgent (P0) · My tasks (assignedToFamily===getMe) · Unpaid · Bookings · Completed.
6. **Payment balance (P2):** `computeTaskBalances(tasks, families, splitMode, ledger)` (pure) → per-family `{owed, paid, balance}` + `totalPaid` + `remaining`; surfaced in the Costs tab. Reuses `costSplit` modes + `familyShares`.
7. **Notifications (P3):** task-change push (a `groupTrips` onUpdate trigger or a client callable diffing tasks → the `monitorDealWatchTrips` webpush loop) + a `tripActivityFeed` task branch (in-app, P1).

## 5. Architecture / units
- **`tc-tasks.js`** (new pure browser-IIFE + node-testable, like `tc-media.js`): `TCTasks.priority(type, opts)` and `TCTasks.computeBalances(tasks, families, split, ledger)`. No DOM/Firebase deps.
- **`travel-concierge.js`**: extend `newBooking` fields + `BOOKING_TYPES`; add `lockedLegsTasks`/`transportChoiceTasks`; extend `deriveBookingChecklist` (hotelNeeded filter + priority via `TCTasks.priority`); `renderTasks` tab + filters (rename `tab_bookings`→`tab_tasks`, render the enriched list); wire generation on tab open via `mergeBookings`. Export `_deriveTripTasks` for the acceptance test.
- **Generation order:** ensure `applyParsedJourneyToTrip` ran → `mergeBookings(tr, deriveBookingChecklist(tr) + ticketedAttractionBookings(tr) + lockedLegsTasks(tr) + transportChoiceTasks(tr))`. Idempotent via `bookingKey`; never clobbers user edits/booked status.

## 6. Honesty
- Cost estimates labeled (`costEstimate` = "pending verification" or a range; `priceRange` from research). No fabricated confirmation numbers (user-entered only). Never auto-purchase (the existing `user_approval_needed` gate stays). Generators only emit tasks from real user/locked/research data; group-rejected places never become tasks (`rejectedNameSet`).

## 7. Collaboration
- **Create/edit/assign/delete** gated by `canEditPlan()` (owner/organizer) — mirrors every other plan-mutating control. **Members** can toggle their assigned task's status + vote on "choose/vote" tasks. `assignedToFamily` = family id (`tripFamilies()` for the picker). **Caveat:** no per-individual member roster exists → assignment is per-**family**; `assignedToMember` maps to a family (documented limitation).

## 8. Phasing
- **P1** — enriched task model + `BOOKING_TYPES` + priority rules + `lockedLegsTasks`/`transportChoiceTasks` + hotelNeeded filter + **Tasks tab UI** (status/priority/assign/filters) + auto-gen on open + i18n + `tripActivityFeed` task branch. Version bump. Acceptance: the Bus Hoang+Michael trip yields the 8 expected tasks with priority/status/linked segment.
- **P2** — `costEstimate`/`actualCost`/`paidBy`/`splitMode` on tasks + `computeTaskBalances` + Costs-tab balance/total-paid/remaining rollup.
- **P3** — task-change Web Push (trigger/callable) + push opt-in reuse.

## 9. Testing
`TCTasks.priority` + `computeBalances` → node unit tests. Task derivation → eval-IIFE acceptance test: feed the Bus Hoang+Michael trip fixture, assert the 8 tasks (Book Bus Hoang outbound, Confirm Michael OC→SD, Book San Diego hotel, Buy SD Zoo tickets, Confirm Michael SD→OC, Book Orange County hotel, Choose/vote dinner, Book Bus Hoang return) each with priority + linkedSegment. Gate: `npm run test:rules` + `full_system_dry_run` `FINAL: PASS`. **No deploy until all phases pass + user confirms.** Verify 375px/1280px.
