# Travel Concierge V6 — P0 (Secretary Core) Implementation Plan

> Executed inline this session (controller has deep single-file context). TDD on the pure engine.

**Goal:** Turn the flat task list into a dependency-aware booking engine: a single Next-Action card, blocked-state badges, dependency-aware priority ordering, and booking-progress chips — all derived deterministically from the existing journey + task statuses.

**Architecture:** New pure `tc-depgraph.js` (`window.TCDepGraph`: build/priorityScore/nextAction/progress) + a caller `buildDepNodes(tr)` in travel-concierge.js that tags `tr.bookings` → graph nodes (kind/city/journeyIndex). Wire into `renderBookings` (Next-Action hero, blocked badges, priority sort, progress chips). Reuse `TCTasks.isDone`/`deriveTripTasks`/`segments`/`tr.transport`. `?v=20260622j`. Deploy held.

---

## Task 1: `tc-depgraph.js` pure engine + tests (TDD)
**Files:** Create `tc-depgraph.js`, `tests/tc-depgraph.test.js`; modify `package.json` (`test:depgraph`).

- [ ] Write `tests/tc-depgraph.test.js` first — the success-test trip as tagged nodes:
  `t_bus1`(transport,SJ→OC,idx0) → `t_michael1`(transport,OC→SD,idx1) → `h_sd`(lodging,SD,idx1) →
  `a_zoo`(ticket,SD,idx1) → `a_seal`(ticket,SD,idx1) → `t_michael2`(transport,SD→OC,idx2,return-ish) →
  `h_hb`(lodging,OC,idx2) → `f_pho`(food,OC,idx2) → `t_bus2`(transport,OC→SJ,idx3,return). Assert:
  - all NOT_STARTED → `nextAction` = `t_bus1` (first transport).
  - mark `t_bus1` booked → nextAction = `t_michael1`.
  - mark `t_michael1` booked → nextAction = `h_sd` (SD lodging, now unblocked).
  - `a_zoo`/`a_seal` are `blocked` (blockedReason `missing_stay`) until `h_sd` done.
  - `h_sd` blocked (`missing_transport`) until `t_michael1` done.
  - `progress().transport` reflects done/total; `overall` correct.
  - locked/pinned node stays actionable; an unmappable node (no city) is unscheduled, never blocks others.
- [ ] Run `node tests/tc-depgraph.test.js` → FAIL (module missing).
- [ ] Write `tc-depgraph.js`:
  - `DONE = {booked,paid,completed,skipped,not_needed}`; `isDone(n)=DONE[n.status]`.
  - `KIND_WEIGHT = {transport:100,lodging:80,ticket:60,activity:45,food:30,optional:10}`.
  - `build(nodes)`: sort by `journeyIndex` then kind-weight; derive `dependencies[]` per rules
    (lodging←inbound transport same city/idx; ticket/activity/food←inbound transport + lodging same
    city; transport idx N ← prior transport; return transport ← all prior transport); compute
    `blocked`/`blockedReason`; `priorityScore = KIND_WEIGHT + dueWeight + inDegree*5 + votes*3 +
    (pinned?20:0)`; return `{nodes, nextAction, progress}`.
  - `nextAction(nodes)`: highest priorityScore among not-done & not-blocked; if none actionable but
    work remains, return the earliest not-done transport/lodging (the unblocking step).
  - `progress(nodes)`: per-kind + overall done%.
- [ ] Run → PASS. Add `test:depgraph`. Commit.

## Task 2: `buildDepNodes(tr)` caller mapping
**Files:** travel-concierge.js (near deriveTripTasks).
- [ ] `buildDepNodes(tr)`: `var tasks = deriveTripTasks(tr)`; for each, map → `{id, status:bookingStatus, dueDate, priority, votes, type, title, kind: depKind(type), city: depCity(tr,task), journeyIndex: depIndex(tr,task), pinned, locked}`. `depKind`: transport types→transport; hotel/airbnb→lodging; attraction/tour ticketed→ticket else activity; restaurant→food; packing/payment/confirmation/other→optional. `depCity`/`depIndex` resolve from `segmentId`/`linkedSegmentId`/`destinationId`/`title` against `segments(tr)` order (return legType → last index). Unresolved city → `journeyIndex = +Infinity` sentinel (unscheduled, never blocks). Return `root.TCDepGraph.build(mapped)`.
- [ ] Parse check; commit.

## Task 3: Next-Action hero card + blocked badges + priority sort (renderBookings)
**Files:** travel-concierge.js renderBookings/bookingCard, i18n, CSS.
- [ ] In `renderBookings`: compute `var dg = buildDepNodes(tr)`. Render a **Next-Action hero**
  (`tc-na`) at top: `dg.nextAction` → title, city/route, due, tier, est cost, assigned family, +
  Research/Mark-booked/Assign buttons (reuse existing handlers: open official/search link,
  `TCTasks.setDone`/mark-booked, assign-family select). If none → "You're all set ✓".
- [ ] Order the task list by `priorityScore` (map booking→dg node by id); render blocked nodes
  de-emphasized with a `⚠ <blockedReason>` badge (`bookingCard` gets a `blocked`/`reason` arg).
- [ ] Progress chips: extend the existing `tc-bookings__progress` to show per-group (Transport/
  Hotels/Tickets/Activities/Food) + overall from `dg.progress`.
- [ ] i18n ×3: `naTitle`("Next") , `naAllSet`, `naResearch`, `blkTransport`("Waiting for transportation"), `blkStay`("Hotel not booked yet"), `blkPrior`("Waiting on an earlier step"), `progTransport`/`progHotels`/`progTickets`/`progActivities`/`progFood`/`progOverall`.
- [ ] CSS `tc-na*` (hero card, dark navy+gold) + `tc-bk--blocked` + progress-group chips. 768/1200 + reduced-motion.
- [ ] Parse check; commit.

## Task 4: Overview echo + version bump + verify (HOLD deploy)
**Files:** travel-concierge.js (Overview Task Center summary → show next-action title), travel-concierge.html, package.json.
- [ ] Overview Task Center: show `dg.nextAction` title as the "→ Next:" line (reuse buildDepNodes).
- [ ] Bump `tc-depgraph.js` (new) + travel-concierge.js/.css `?v=20260622j` in travel-concierge.html (load tc-depgraph.js before travel-concierge.js).
- [ ] Run all pure suites + `test:rules` (117/0) + `full_system_dry_run` (FINAL: PASS) + Playwright smoke (Next-Action card renders, progress chips, 0 our-errors). Report PASS/FAIL. **Hold deploy.**

## Self-review
- Spec coverage: nodes+deps (T1/T2), blocked (T1/T3), next-action (T1/T3), priorityScore (T1/T3), progress (T1/T3), Overview echo (T4). P1 (warnings/auto-rebuild/assignment) + P2 (viz/custom/live) deferred.
- Honesty: derived-not-invented; no fabricated data; i18n ×3.
- Robustness: unmappable node → unscheduled sentinel, never over-blocks (success-test guards order).
