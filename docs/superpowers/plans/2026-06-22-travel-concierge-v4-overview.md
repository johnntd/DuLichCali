# Travel Concierge V4 — Overview Redesign (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an immersive, image-first **Overview** tab as the default landing surface of the Travel Concierge trip page — Trip Hero (readiness ring, budget, status chips, Next-Action CTA), Highlights rail, collapsed Daily Timeline, AI Discoveries rail, and a floating AI Concierge — composed entirely from existing computed data.

**Architecture:** Presentation-layer only. A new pure module `tc-overview.js` (`window.TCOverview`) computes readiness/next-action/status-chips from `deriveTripTasks(tr)`. A new `renderOverview(plan)` in `travel-concierge.js` assembles DOM by reusing `placeMedia`, `consensusSort`, `computeTripCosts`, `money`, `totalTravelers`, `openPlaceModal`, `liveHighlightsBlock` data, and the `commandBar` engine. Overview is prepended to `TAB_PAIRS` and becomes the default `state.activeTab`. No new Firestore/Functions/AI; honest-image rule absolute.

**Tech Stack:** Vanilla browser JS IIFE, no build. Pure-node tests via `new Function('window', src)` eval (like `tests/tc-tasks.test.js`). CSS in `travel-concierge.css` (mobile-first + 768/1200 breakpoints). i18n via the module-level `T` object (en/vi/es).

---

## File Structure

- **Create** `tc-overview.js` — pure readiness/next-action/status-chip math (`window.TCOverview`). One responsibility: derive Overview metrics from a task list. Node-testable, no DOM.
- **Create** `tests/tc-overview.test.js` — pure-node unit tests for the module.
- **Modify** `travel-concierge.js` — add `renderOverview(plan)` + `conciergeFab()`; prepend Overview to `TAB_PAIRS`; add dispatch branch; change 7 `state.activeTab='itinerary'` init sites + heal fallback to `'overview'`; add i18n keys in en/vi/es.
- **Modify** `travel-concierge.css` — `tc-ov*` classes (hero, ring, rail, card, fab) mobile-first + 768/1200.
- **Modify** `travel-concierge.html` — add `<script src="/tc-overview.js?v=…">` before `travel-concierge.js`; bump `?v=` on `travel-concierge.js` + `travel-concierge.css`.
- **Modify** `package.json` — add `test:overview` script.

---

## Task 1: `tc-overview.js` pure module + tests (readiness / nextAction / statusChips)

**Files:**
- Create: `tc-overview.js`
- Test: `tests/tc-overview.test.js`
- Modify: `package.json` (add `test:overview`)

- [ ] **Step 1: Write the failing test** — `tests/tc-overview.test.js`

```javascript
'use strict';
// node tests/tc-overview.test.js — pure-module test (no DOM). Loads the browser IIFE like tc-tasks.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-overview.js'), 'utf8') + '\nreturn window.TCOverview;';
const O = new Function('window', src)({});
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// ── readiness(tasks) — done/total → pct; DONE = booked|paid|skipped|not_needed ──
ok('empty → 100%', O.readiness([]).pct === 100);
ok('all done → 100%', O.readiness([{ status: 'booked' }, { status: 'paid' }]).pct === 100);
ok('half done → 50%', O.readiness([{ status: 'booked' }, { status: 'todo' }]).pct === 50);
ok('skipped/not_needed count as done', O.readiness([{ status: 'skipped' }, { status: 'not_needed' }]).pct === 100);
ok('rounds 1/3 → 33%', O.readiness([{ status: 'booked' }, { status: 'todo' }, { status: 'todo' }]).pct === 33);
var r = O.readiness([{ status: 'booked' }, { status: 'todo' }]);
ok('reports counts', r.doneCount === 1 && r.totalCount === 2);

// ── nextAction(tasks) — highest-priority incomplete; P0<P1<P2, then dueDate, then order ──
ok('null when all done', O.nextAction([{ status: 'booked', priority: 'P0' }]) === null);
var na = O.nextAction([{ status: 'todo', priority: 'P1', title: 'B' }, { status: 'todo', priority: 'P0', title: 'A' }]);
ok('P0 beats P1', na.title === 'A');
var na2 = O.nextAction([{ status: 'todo', priority: 'P0', title: 'late', dueDate: '2026-08-01' }, { status: 'todo', priority: 'P0', title: 'soon', dueDate: '2026-07-01' }]);
ok('earlier dueDate wins within priority', na2.title === 'soon');
ok('returns label/priority/key', !!na.title && na.priority === 'P0');

// ── statusChips(tasks) — one chip per non-empty category; warn if a P0/P1 incomplete ──
var chips = O.statusChips([
  { category: 'stay', status: 'booked', priority: 'P0' },
  { category: 'transport', status: 'todo', priority: 'P0' },
  { category: 'activities', status: 'booked', priority: 'P1' }
]);
function chip(k) { return chips.filter(function (c) { return c.key === k; })[0]; }
ok('stay chip ok', chip('stay') && chip('stay').state === 'ok');
ok('transport chip warn', chip('transport') && chip('transport').state === 'warn');
ok('activities chip ok', chip('activities') && chip('activities').state === 'ok');
ok('omits empty category (food)', !chip('food'));
ok('P2-only incomplete does NOT warn', O.statusChips([{ category: 'other', status: 'todo', priority: 'P2' }])[0].state === 'ok');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/tc-overview.test.js`
Expected: FAIL — `Cannot find module '../tc-overview.js'` (file does not exist yet).

- [ ] **Step 3: Write the module** — `tc-overview.js`

```javascript
/* tc-overview.js — pure Overview metrics for the Travel Concierge V4 landing tab.
   Browser IIFE exposing window.TCOverview; node-testable (no DOM). Derives readiness %,
   the single highest-priority next action, and per-category status chips from the task
   list produced by deriveTripTasks(tr) (i.e. tr.bookings). Presentation-layer only —
   never fabricates data. */
(function (root) {
  var DONE = { booked: 1, paid: 1, skipped: 1, not_needed: 1 };
  var PRIO = { P0: 0, P1: 1, P2: 2 };
  function isDone(tk) { return !!(tk && DONE[tk.status]); }
  function prioRank(tk) { var p = (tk && tk.priority) || 'P2'; return PRIO[p] == null ? 2 : PRIO[p]; }

  // Which readiness category a task rolls up to. Maps task categories/types to the four
  // hero chips. Unknown categories fall through to 'other' (not shown as a chip).
  function categoryOf(tk) {
    var c = String((tk && (tk.category || tk.type)) || '').toLowerCase();
    if (/stay|hotel|airbnb|lodg/.test(c)) return 'stay';
    if (/transport|flight|bus|train|car|ride|parking/.test(c)) return 'transport';
    if (/activit|attraction|ticket|tour|event/.test(c)) return 'activities';
    if (/food|restaurant|dining/.test(c)) return 'food';
    return 'other';
  }

  function readiness(tasks) {
    var list = tasks || [], total = list.length;
    var done = list.filter(isDone).length;
    return { doneCount: done, totalCount: total, pct: total ? Math.round(100 * done / total) : 100 };
  }

  function nextAction(tasks) {
    var open = (tasks || []).filter(function (tk) { return !isDone(tk); });
    if (!open.length) return null;
    open.sort(function (a, b) {
      var pr = prioRank(a) - prioRank(b); if (pr) return pr;
      var da = a && a.dueDate ? String(a.dueDate) : '~', db = b && b.dueDate ? String(b.dueDate) : '~';
      if (da !== db) return da < db ? -1 : 1;
      return 0;
    });
    var tk = open[0];
    return { title: tk.title || tk.name || '', priority: tk.priority || 'P2', taskKey: tk.key || tk.id || '', category: categoryOf(tk) };
  }

  function statusChips(tasks) {
    var TABS = { stay: 'stay', transport: 'transport', activities: 'itinerary', food: 'food' };
    var groups = {};
    (tasks || []).forEach(function (tk) {
      var cat = categoryOf(tk); if (cat === 'other') return;
      if (!groups[cat]) groups[cat] = { warn: false };
      // warn only if a P0/P1 task is still open; P2 stragglers don't downgrade readiness chips
      if (!isDone(tk) && prioRank(tk) <= 1) groups[cat].warn = true;
    });
    return ['stay', 'transport', 'activities', 'food'].filter(function (k) { return groups[k]; })
      .map(function (k) { return { key: k, state: groups[k].warn ? 'warn' : 'ok', tab: TABS[k] }; });
  }

  root.TCOverview = { readiness: readiness, nextAction: nextAction, statusChips: statusChips, _categoryOf: categoryOf };
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/tc-overview.test.js`
Expected: PASS — `16 passed, 0 failed`.

- [ ] **Step 5: Add npm script** — `package.json`, in `"scripts"`, add:

```json
"test:overview": "node tests/tc-overview.test.js",
```

- [ ] **Step 6: Commit**

```bash
git add tc-overview.js tests/tc-overview.test.js package.json
git commit -m "feat(travel-concierge): tc-overview.js pure metrics (readiness/nextAction/statusChips) + tests"
```

---

## Task 2: i18n keys for Overview (en + vi + es, same commit)

**Files:**
- Modify: `travel-concierge.js` (the `T` object — en block ~L37, vi ~L314, es ~L581)

- [ ] **Step 1: Add the English keys** — inside the `en` table of `T`, near the other `tab_*`/`disc_*` keys, add:

```javascript
      tab_overview: 'Overview',
      ovReadyShort: 'ready', ovNext: 'Next', ovAllSet: "You're all set",
      ovHighlights: 'Highlights', ovSeeAll: 'See all',
      ovTimeline: 'Your days', ovViewItinerary: 'View full itinerary',
      ovDiscoveries: 'AI Discoveries', ovConcierge: 'Ask the concierge',
      ovCuratingHighlights: 'AI is curating highlights…', ovQuickLinks: 'Jump to',
      ovChipStay: 'Stay', ovChipTransport: 'Transport', ovChipTickets: 'Tickets', ovChipFood: 'Food',
      ovAskOptimize: 'Optimize my plan', ovAskGems: 'Find hidden gems', ovAskBook: 'What should I book next?',
```

- [ ] **Step 2: Add the Vietnamese keys** — inside the `vi` table, add:

```javascript
      tab_overview: 'Tổng quan',
      ovReadyShort: 'sẵn sàng', ovNext: 'Tiếp theo', ovAllSet: 'Mọi thứ đã sẵn sàng',
      ovHighlights: 'Điểm nổi bật', ovSeeAll: 'Xem tất cả',
      ovTimeline: 'Lịch trình của bạn', ovViewItinerary: 'Xem lịch trình đầy đủ',
      ovDiscoveries: 'AI Khám phá', ovConcierge: 'Hỏi trợ lý',
      ovCuratingHighlights: 'AI đang tuyển chọn điểm nổi bật…', ovQuickLinks: 'Chuyển đến',
      ovChipStay: 'Lưu trú', ovChipTransport: 'Di chuyển', ovChipTickets: 'Vé', ovChipFood: 'Ẩm thực',
      ovAskOptimize: 'Tối ưu lịch trình', ovAskGems: 'Tìm điểm độc đáo', ovAskBook: 'Tôi nên đặt gì tiếp theo?',
```

- [ ] **Step 3: Add the Spanish keys** — inside the `es` table, add:

```javascript
      tab_overview: 'Resumen',
      ovReadyShort: 'listo', ovNext: 'Siguiente', ovAllSet: 'Todo listo',
      ovHighlights: 'Lo más destacado', ovSeeAll: 'Ver todo',
      ovTimeline: 'Tus días', ovViewItinerary: 'Ver itinerario completo',
      ovDiscoveries: 'Descubrimientos IA', ovConcierge: 'Pregunta al concierge',
      ovCuratingHighlights: 'La IA está seleccionando lo más destacado…', ovQuickLinks: 'Ir a',
      ovChipStay: 'Alojamiento', ovChipTransport: 'Transporte', ovChipTickets: 'Entradas', ovChipFood: 'Comida',
      ovAskOptimize: 'Optimizar mi plan', ovAskGems: 'Encontrar joyas ocultas', ovAskBook: '¿Qué debo reservar ahora?',
```

- [ ] **Step 4: Verify keys load in all 3 languages**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('travel-concierge.js','utf8');['en','vi','es'].forEach(l=>{const re=new RegExp('ovConcierge');});['tab_overview','ovNext','ovHighlights','ovTimeline','ovDiscoveries','ovConcierge'].forEach(k=>{const n=(s.match(new RegExp(k+':','g'))||[]).length;console.log(k,n);});"`
Expected: each key prints `3` (one per language table).

- [ ] **Step 5: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 Overview i18n keys (en/vi/es)"
```

---

## Task 3: `renderOverview(plan)` — Trip Hero block

**Files:**
- Modify: `travel-concierge.js` — add `renderOverview` function immediately before the plan-screen `render()` body's tab dispatch (place it next to `liveHighlightsBlock`, ~L3959, so all reused helpers are in scope).

- [ ] **Step 1: Add `renderOverview` with the Hero block only**

Insert this function (the rails/timeline/discoveries/quick-links are appended in later tasks; this step establishes the container + hero):

```javascript
  // ── V4 Overview — immersive, image-first landing surface. Composes existing computed data
  //    (tasks, costs, attractions, liveHighlights) into a 5-second-understandable hub. No new
  //    data is fetched here; honest-image rule via placeMedia. ──
  function ovLeadPlace(tr) {
    var dests = (tr.attractions && tr.attractions.length) ? tr.attractions : [];
    var rej = rejectedNameSet(tr);
    for (var i = 0; i < dests.length; i++) {
      var atts = consensusSort((dests[i].attractions || []).filter(function (a) { return a && a.name && !rej[(a.name || '').trim().toLowerCase()]; }), function (a) { return a.name; });
      if (atts.length) return { place: atts[0], city: dests[i].city };
    }
    return null;
  }
  function renderOverview(plan) {
    var tr = state.trip;
    var wrap = el('div', 'tc-ov');

    // ── Block 1: Trip Hero ──
    var tasks = []; try { tasks = deriveTripTasks(tr) || []; } catch (e) { tasks = tr.bookings || []; }
    var rd = root.TCOverview.readiness(tasks);
    var na = root.TCOverview.nextAction(tasks);
    var chips = root.TCOverview.statusChips(tasks);

    var hero = el('section', 'tc-ov-hero');
    var lead = ovLeadPlace(tr);
    var bg = placeMedia(lead ? lead.place : { name: plan.destination || tr.destination }, 'tc-ov-hero__media');
    hero.appendChild(bg);
    var inner = el('div', 'tc-ov-hero__inner');
    inner.appendChild(el('span', 'tc-ov-hero__chip', plan.destination || tr.destination || ''));
    inner.appendChild(el('h1', 'tc-ov-hero__title', plan.groupName || tr.groupName || ''));
    var famN = (tr.families || []).length, travN = (function () { try { return totalTravelers(); } catch (e) { return 0; } })();
    var sub = (plan.dateRange || tr.dateRange || '');
    if (famN) sub += ' · ' + famN + ' ' + t(famN === 1 ? 'familyOne' : 'familyMany');
    if (travN) sub += ' · ' + travN + ' ' + t('travelers');
    inner.appendChild(el('p', 'tc-ov-hero__sub', sub));

    // Readiness ring (SVG) + budget chip, side-by-side ≥768px
    var stat = el('div', 'tc-ov-hero__stat');
    stat.appendChild(ovRing(rd.pct));
    var costs = (function () { try { return computeTripCosts(tr); } catch (e) { return null; } })();
    if (costs) {
      var bbtn = el('button', 'tc-ov-hero__budget'); bbtn.type = 'button';
      bbtn.appendChild(el('span', 'tc-ov-hero__budget-k', '💰 ' + t('costEstTotal')));
      bbtn.appendChild(el('strong', 'tc-ov-hero__budget-v', money(costs.total.expected)));
      bbtn.addEventListener('click', function () { state.activeTab = 'costs'; render(); });
      stat.appendChild(bbtn);
    }
    inner.appendChild(stat);

    // Status chips
    if (chips.length) {
      var chrow = el('div', 'tc-ov-hero__chips');
      var LBL = { stay: 'ovChipStay', transport: 'ovChipTransport', activities: 'ovChipTickets', food: 'ovChipFood' };
      chips.forEach(function (c) {
        var cb = el('button', 'tc-ov-chip tc-ov-chip--' + c.state); cb.type = 'button';
        cb.appendChild(el('span', 'tc-ov-chip__ic', c.state === 'ok' ? '✓' : '⚠'));
        cb.appendChild(el('span', 'tc-ov-chip__lbl', t(LBL[c.key] || c.key)));
        cb.addEventListener('click', function () { state.activeTab = c.tab; render(); });
        chrow.appendChild(cb);
      });
      inner.appendChild(chrow);
    }

    // Next-Action CTA (or all-set state)
    if (na) {
      var cta = el('button', 'tc-ov-hero__cta'); cta.type = 'button';
      cta.textContent = t('ovNext') + ': ' + na.title;
      cta.addEventListener('click', function () {
        var tabFor = { stay: 'stay', transport: 'transport', activities: 'bookings', food: 'food' };
        state.activeTab = tabFor[na.category] || 'bookings'; render();
      });
      inner.appendChild(cta);
    } else {
      inner.appendChild(el('p', 'tc-ov-hero__allset', '✓ ' + t('ovAllSet')));
    }

    hero.appendChild(inner);
    if (tr._fallback || (plan.dataSource && /pending/.test(plan.dataSource))) hero.appendChild(el('p', 'tc-unverified', t('unverified')));
    wrap.appendChild(hero);
    return wrap;
  }
  // SVG readiness ring — gold progress arc on a navy track; % text + aria-label (color is not
  // the only signal). Pure DOM, no animation dependency.
  function ovRing(pct) {
    pct = Math.max(0, Math.min(100, pct | 0));
    var R = 26, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
    var NS = 'http://www.w3.org/2000/svg';
    var box = el('div', 'tc-ov-ring'); box.setAttribute('role', 'img');
    box.setAttribute('aria-label', pct + '% ' + t('ovReadyShort'));
    var svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'tc-ov-ring__svg');
    function circle(cls, dash) { var c = doc.createElementNS(NS, 'circle'); c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', String(R)); c.setAttribute('class', cls); if (dash != null) { c.setAttribute('stroke-dasharray', String(C)); c.setAttribute('stroke-dashoffset', String(dash)); } return c; }
    svg.appendChild(circle('tc-ov-ring__track'));
    svg.appendChild(circle('tc-ov-ring__prog', off));
    box.appendChild(svg);
    var lbl = el('div', 'tc-ov-ring__lbl');
    lbl.appendChild(el('strong', 'tc-ov-ring__pct', pct + '%'));
    lbl.appendChild(el('span', 'tc-ov-ring__cap', t('ovReadyShort')));
    box.appendChild(lbl);
    return box;
  }
```

> **Note on `familyOne`/`familyMany`/`travelers` i18n keys:** if these exact keys don't already
> exist in `T`, reuse whatever the existing hero/group code uses for "families"/"travelers"
> (grep `t('travelers')` / `families` usage). Do NOT introduce a hardcoded string — find the
> existing key. If none exists, add `familyOne`/`familyMany`/`travelers` to all 3 tables in this task.

- [ ] **Step 2: Verify the file still parses**

Run: `node -e "new Function('window', require('fs').readFileSync('travel-concierge.js','utf8'))" && echo "PARSE OK"`
Expected: `PARSE OK` (no SyntaxError).

- [ ] **Step 3: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 renderOverview Trip Hero (readiness ring, budget, chips, CTA)"
```

---

## Task 4: Highlights rail (Block 2)

**Files:**
- Modify: `travel-concierge.js` — append to `renderOverview` before `return wrap;`; add `ovHighlightCard`.

- [ ] **Step 1: Append the Highlights rail** — inside `renderOverview`, just before `return wrap;`:

```javascript
    // ── Block 2: Highlights rail (top attractions, image-first, horizontal scroll) ──
    var rej = rejectedNameSet(tr);
    var flat = [];
    ((tr.attractions && tr.attractions.length) ? tr.attractions : []).forEach(function (d) {
      (d.attractions || []).forEach(function (a) { if (a && a.name && !rej[(a.name || '').trim().toLowerCase()]) flat.push({ a: a, city: d.city }); });
    });
    var top = consensusSort(flat, function (x) { return x.a.name; }).slice(0, 6);
    if (top.length || (state._cResearch && state._cResearch.attractions)) {
      var hsec = el('section', 'tc-ov-sec');
      var hhead = el('div', 'tc-ov-sec__head');
      hhead.appendChild(el('h2', 'tc-ov-sec__t', t('ovHighlights')));
      var seeAll = el('button', 'tc-ov-sec__more', t('ovSeeAll')); seeAll.type = 'button';
      seeAll.addEventListener('click', function () { state.activeTab = 'itinerary'; render(); });
      hhead.appendChild(seeAll);
      hsec.appendChild(hhead);
      if (top.length) {
        var rail = el('div', 'tc-ov-rail');
        top.forEach(function (x) { rail.appendChild(ovHighlightCard(x.a, x.city)); });
        hsec.appendChild(rail);
      } else {
        hsec.appendChild(researchBanner('ovCuratingHighlights'));
      }
      wrap.appendChild(hsec);
    }
```

- [ ] **Step 2: Add `ovHighlightCard`** — next to `renderOverview`:

```javascript
  // Compact, image-first Highlights card. Real photo via placeMedia (honest fallback otherwise).
  // Tap opens the existing detail modal — no duplicated detail logic.
  function ovHighlightCard(a, city) {
    var c = el('article', 'tc-ov-card');
    c.appendChild(placeMedia(a, 'tc-ov-card__media'));
    var body = el('div', 'tc-ov-card__body');
    if (a.tier) body.appendChild(el('span', 'tc-ov-card__tier tc-attr__tier--' + a.tier, t('tier_' + a.tier) || ''));
    body.appendChild(el('strong', 'tc-ov-card__name', a.name));
    if (a.why) body.appendChild(el('p', 'tc-ov-card__why', a.why));
    var foot = el('div', 'tc-ov-card__foot');
    if (a.ticketed) foot.appendChild(el('span', 'tc-ov-card__tix', '🎟 ' + t('ticketed')));
    if (a.ageFit) foot.appendChild(el('span', 'tc-ov-card__fit', t('fit_' + a.ageFit) || a.ageFit));
    if (foot.children.length) body.appendChild(foot);
    c.appendChild(body);
    c.addEventListener('click', function () { try { openPlaceModal(Object.assign({ city: city }, a)); } catch (e) {} });
    return c;
  }
```

> **Note:** `Object.assign` is fine in this codebase's browser target; if a lint/parse issue
> arises, build the merged object literally. `openPlaceModal` already handles vote/learn-more
> inside the modal, so the card stays compact.

- [ ] **Step 3: Verify parse**

Run: `node -e "new Function('window', require('fs').readFileSync('travel-concierge.js','utf8'))" && echo "PARSE OK"`
Expected: `PARSE OK`.

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 Overview Highlights rail (image-first, opens detail modal)"
```

---

## Task 5: Daily Timeline preview (Block 3)

**Files:**
- Modify: `travel-concierge.js` — append to `renderOverview`; add `ovTimelineRow`.

- [ ] **Step 1: Append the Timeline preview** — before `return wrap;`:

```javascript
    // ── Block 3: Daily Timeline preview (collapsed; deep-links into Itinerary) ──
    var days = (plan.days || []);
    if (days.length) {
      var tsec = el('section', 'tc-ov-sec');
      var thead = el('div', 'tc-ov-sec__head');
      thead.appendChild(el('h2', 'tc-ov-sec__t', t('ovTimeline')));
      var viewIt = el('button', 'tc-ov-sec__more', t('ovViewItinerary')); viewIt.type = 'button';
      viewIt.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = 0; render(); });
      thead.appendChild(viewIt);
      tsec.appendChild(thead);
      var tl = el('div', 'tc-ov-tl');
      days.slice(0, 5).forEach(function (d, i) { tl.appendChild(ovTimelineRow(d, i)); });
      if (days.length > 5) {
        var moreRow = el('button', 'tc-ov-tl__more', '+' + (days.length - 5) + ' ' + t('day').toLowerCase()); moreRow.type = 'button';
        moreRow.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = 5; render(); });
        tl.appendChild(moreRow);
      }
      tsec.appendChild(tl);
      wrap.appendChild(tsec);
    }
```

- [ ] **Step 2: Add `ovTimelineRow`** — collapsed day row; reuses the day's headline places, honors travel days:

```javascript
  // One compact day row: Day N · city · up to 3 headline place chips. Tap → Itinerary at day i.
  // Travel/transfer days show their travel label (never fabricated activities).
  function ovTimelineRow(d, i) {
    var row = el('button', 'tc-ov-tl__row'); row.type = 'button';
    var head = el('div', 'tc-ov-tl__head');
    head.appendChild(el('span', 'tc-ov-tl__d', t('day') + ' ' + (i + 1)));
    if (d.city) head.appendChild(el('span', 'tc-ov-tl__city', d.city));
    if (d.isTravelDay || d.transferDay) head.appendChild(el('span', 'tc-ov-tl__travel', '🚗 ' + (t('travelDay') || '')));
    row.appendChild(head);
    var names = [];
    (d.sections || []).forEach(function (s) { (s.places || []).forEach(function (p) { if (p && p.name && names.length < 3) names.push(p.name); }); });
    if (names.length) {
      var chipw = el('div', 'tc-ov-tl__chips');
      names.forEach(function (n) { chipw.appendChild(el('span', 'tc-ov-tl__chip', n)); });
      row.appendChild(chipw);
    }
    row.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = i; render(); });
    return row;
  }
```

> **Note on `travelDay` key:** if `t('travelDay')` doesn't exist, grep the itinerary renderer for
> the existing travel-day label key and reuse it. Do not hardcode.

- [ ] **Step 3: Verify parse** — `node -e "new Function('window', require('fs').readFileSync('travel-concierge.js','utf8'))" && echo "PARSE OK"` → `PARSE OK`.

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 Overview Daily Timeline preview (collapsed, deep-links into Itinerary)"
```

---

## Task 6: AI Discoveries rail (Block 4) + Quick Links (Block 5)

**Files:**
- Modify: `travel-concierge.js` — append to `renderOverview`; add `ovDiscoveryCard`.

- [ ] **Step 1: Append Discoveries rail + Quick Links** — before `return wrap;`:

```javascript
    // ── Block 4: AI Discoveries rail (live highlights; image-first) ──
    var hl = (plan && plan.liveHighlights && plan.liveHighlights.length) ? plan.liveHighlights : ((tr && tr.liveHighlights) || []);
    if (hl.length) {
      var dsec = el('section', 'tc-ov-sec');
      var dhead = el('div', 'tc-ov-sec__head');
      dhead.appendChild(el('h2', 'tc-ov-sec__t', t('ovDiscoveries')));
      if (tr.liveSourceNote) dhead.appendChild(el('span', 'tc-ov-sec__src', tr.liveSourceNote));
      dsec.appendChild(dhead);
      var drail = el('div', 'tc-ov-rail');
      hl.slice(0, 8).forEach(function (x) { drail.appendChild(ovDiscoveryCard(x)); });
      dsec.appendChild(drail);
      wrap.appendChild(dsec);
    }

    // ── Block 5: Quick links to the remaining tabs (true hub) ──
    var qsec = el('section', 'tc-ov-sec tc-ov-quick');
    qsec.appendChild(el('span', 'tc-ov-quick__k', t('ovQuickLinks')));
    [['group', 'tab_group'], ['stay', 'tab_stay'], ['food', 'tab_food'], ['costs', 'tab_costs'], ['bookings', 'tab_bookings']].forEach(function (p) {
      var b = el('button', 'tc-ov-quick__b', t(p[1])); b.type = 'button';
      b.addEventListener('click', function () { state.activeTab = p[0]; render(); });
      qsec.appendChild(b);
    });
    wrap.appendChild(qsec);
```

- [ ] **Step 2: Add `ovDiscoveryCard`** — mirrors the live-highlights card (honest image; opens its link):

```javascript
  // Image-first discovery card from a liveHighlights entry. Real image via placeMedia; honest
  // fallback otherwise. Tap opens the existing detail modal (search links live inside it).
  function ovDiscoveryCard(x) {
    var c = el('article', 'tc-ov-card tc-ov-card--disc');
    c.appendChild(placeMedia(x, 'tc-ov-card__media'));
    var body = el('div', 'tc-ov-card__body');
    body.appendChild(el('span', 'tc-ov-card__tier', liveCatIcon(x.category) + ' ' + (x.category ? String(x.category).replace(/_/g, ' ') : '')));
    body.appendChild(el('strong', 'tc-ov-card__name', x.name || ''));
    if (x.note || x.why) body.appendChild(el('p', 'tc-ov-card__why', x.note || x.why));
    c.appendChild(body);
    c.addEventListener('click', function () { try { openPlaceModal(x); } catch (e) {} });
    return c;
  }
```

- [ ] **Step 3: Verify parse** — `PARSE OK`.

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 Overview AI Discoveries rail + quick-links hub"
```

---

## Task 7: Wire Overview into the tab system + make it the default landing tab

**Files:**
- Modify: `travel-concierge.js` — `TAB_PAIRS` (L3917), dispatch (L3926), heal (L3918), 7 init sites (`2056, 2083, 2640, 3534, 3587, 5827, 7583`).

- [ ] **Step 1: Prepend Overview to `TAB_PAIRS`** (L3917):

Change:
```javascript
    var TAB_PAIRS = [['itinerary', 'tab_itinerary'], ['journey', 'tab_journey'], …];
```
to start with Overview:
```javascript
    var TAB_PAIRS = [['overview', 'tab_overview'], ['itinerary', 'tab_itinerary'], ['journey', 'tab_journey'], ['transport', 'tab_transport'], ['stay', 'tab_stay'], ['food', 'tab_food'], ['events', 'tab_events'], ['stopovers', 'tab_stopovers'], ['costs', 'tab_costs'], ['bookings', 'tab_bookings'], ['album', 'tab_album'], ['clips', 'tab_clips'], ['group', 'tab_group']];
```

- [ ] **Step 2: Update the heal fallback** (L3918) — change `state.activeTab = 'itinerary'` to `'overview'`:

```javascript
    if (!TAB_PAIRS.some(function (p) { return p[0] === state.activeTab; })) state.activeTab = 'overview';
```

- [ ] **Step 3: Add the dispatch branch** (L3926) — make Overview the first branch:

Change:
```javascript
    if (state.activeTab === 'itinerary') s.appendChild(renderItinerary(plan));
```
to:
```javascript
    if (state.activeTab === 'overview') s.appendChild(renderOverview(plan));
    else if (state.activeTab === 'itinerary') s.appendChild(renderItinerary(plan));
```

- [ ] **Step 4: Change the 7 default-tab init sites** — at lines `2056, 2083, 2640, 3534, 3587, 5827, 7583`, each currently sets `state.activeTab = 'itinerary';` on a freshly opened/created trip. Change each to `state.activeTab = 'overview';`. **Do this with a verified, scoped replace** (these are the only `= 'itinerary'` assignments — the tab dispatch uses `=== 'itinerary'`, which must NOT change):

```bash
# Inspect first — confirm exactly 7 assignment matches (not the === comparisons):
grep -n "activeTab = 'itinerary'" travel-concierge.js
```
Then replace each occurrence of `state.activeTab = 'itinerary'` with `state.activeTab = 'overview'` (assignment only). Re-run the grep — expect `0` assignment matches remaining and the single `=== 'itinerary'` dispatch comparison still present.

- [ ] **Step 5: Verify parse + counts**

Run:
```bash
node -e "new Function('window', require('fs').readFileSync('travel-concierge.js','utf8'))" && echo "PARSE OK"
grep -c "activeTab = 'overview'" travel-concierge.js   # expect 8 (7 init + heal)
grep -c "activeTab === 'itinerary'" travel-concierge.js # expect 1 (dispatch comparison)
grep -c "'overview', 'tab_overview'" travel-concierge.js # expect 1 (TAB_PAIRS)
```
Expected: `PARSE OK`, `8`, `1`, `1`.

- [ ] **Step 6: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): make Overview the default landing tab (TAB_PAIRS + dispatch + 7 init sites)"
```

---

## Task 8: Floating AI Concierge FAB

**Files:**
- Modify: `travel-concierge.js` — add `conciergeFab()`; append it once in the plan-screen `render()` container (outside the tab body, near the action bar, ~L3950) so it persists across tabs.

- [ ] **Step 1: Add `conciergeFab` + sheet** — reuses `commandBar(tr)` so the same `interpretCommand`/`editPlanPreview`/`applyEditPlan` engine runs:

```javascript
  // Floating concierge entry point — persists across all tabs. Opens a sheet that reuses the
  // existing commandBar engine (interpretCommand → editPlanPreview → applyEditPlan). Quick-intent
  // chips pre-fill the utterance. Read-only viewers get the disabled commandBar state it already
  // renders. No new AI path.
  function conciergeFab(tr) {
    var fab = el('button', 'tc-ov-fab'); fab.type = 'button';
    fab.setAttribute('aria-label', t('ovConcierge'));
    fab.appendChild(el('span', 'tc-ov-fab__ic', '🤖'));
    fab.appendChild(el('span', 'tc-ov-fab__lbl', t('ovConcierge')));
    fab.addEventListener('click', function () { openConciergeSheet(tr); });
    return fab;
  }
  function openConciergeSheet(tr) {
    if (doc.querySelector('.tc-ov-sheet')) return;
    var ov = el('div', 'tc-ov-sheet');
    var card = el('div', 'tc-ov-sheet__card');
    var head = el('div', 'tc-ov-sheet__head');
    head.appendChild(el('strong', 'tc-ov-sheet__t', t('ovConcierge')));
    var x = el('button', 'tc-ov-sheet__x', '✕'); x.type = 'button';
    x.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); });
    head.appendChild(x);
    card.appendChild(head);
    // Quick-intent chips pre-fill the command bar's input.
    var quick = el('div', 'tc-ov-sheet__quick');
    [['ovAskOptimize'], ['ovAskGems'], ['ovAskBook']].forEach(function (q) {
      var qb = el('button', 'tc-ov-sheet__chip', t(q[0])); qb.type = 'button';
      qb.addEventListener('click', function () {
        var inp = card.querySelector('.tc-cmd__in, input, textarea'); if (inp) { inp.value = t(q[0]); inp.focus(); }
      });
      quick.appendChild(qb);
    });
    card.appendChild(quick);
    card.appendChild(commandBar(tr)); // reuse the existing engine + read-only gating
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov && ov.parentNode) ov.parentNode.removeChild(ov); });
    doc.body.appendChild(ov);
  }
```

> **Note:** confirm the command-bar input's class via `grep "tc-cmd" travel-concierge.js` (or the
> input selector inside `commandBar`); adjust the `querySelector` in the quick-chip handler to
> match the real input element. The chips are a convenience — if the selector misses, the chip
> simply doesn't prefill (no breakage).

- [ ] **Step 2: Mount the FAB in the plan screen** — in `render()`, inside the `if (!tr._demo) { … }` block where the action bar is appended (~L3950), after `s.appendChild(bar);` add:

```javascript
      s.appendChild(conciergeFab(tr));
```
(Outside the tab-body branch so it shows on every tab. Demo trips keep their current behavior — no FAB — which is acceptable; if the FAB is wanted on demo too, append it before the `if (!tr._demo)` guard instead.)

- [ ] **Step 3: Verify parse** — `PARSE OK`.

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): V4 floating AI Concierge FAB (reuses commandBar engine)"
```

---

## Task 9: CSS — `tc-ov*` mobile-first + 768/1200 breakpoints

**Files:**
- Modify: `travel-concierge.css` — append a `/* ── V4 Overview ── */` section.

- [ ] **Step 1: Append the Overview styles** — mobile-first base, then `@media (min-width:768px)` and `@media (min-width:1200px)`. Use the project's navy/gold tokens and existing `.tc-place__media--ph` fallback. Key rules:

```css
/* ── V4 Overview ───────────────────────────────────────────── */
.tc-ov { display:flex; flex-direction:column; gap:1.25rem; }

/* Hero */
.tc-ov-hero { position:relative; border-radius:18px; overflow:hidden; min-height:340px; display:flex; }
.tc-ov-hero__media { position:absolute; inset:0; width:100%; height:100%; }
.tc-ov-hero__media img, .tc-ov-hero__media.tc-place__media { width:100%; height:100%; object-fit:cover; }
.tc-ov-hero__inner { position:relative; z-index:2; margin-top:auto; width:100%; padding:1.25rem;
  background:linear-gradient(to top, rgba(8,18,36,.92) 0%, rgba(8,18,36,.55) 55%, rgba(8,18,36,0) 100%);
  color:var(--cream,#f6efe2); display:flex; flex-direction:column; gap:.6rem; }
.tc-ov-hero__chip { align-self:flex-start; font:500 .72rem/1 var(--font-b,Jost); letter-spacing:.08em; text-transform:uppercase; color:var(--gold,#d8b46a); }
.tc-ov-hero__title { font:400 1.9rem/1.05 var(--font-d,'Bodoni Moda'); margin:0; }
.tc-ov-hero__sub { font:400 .95rem/1.4 var(--font-b,Jost); opacity:.92; margin:0; }
.tc-ov-hero__stat { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
.tc-ov-hero__budget { display:flex; flex-direction:column; align-items:flex-start; gap:.1rem; background:rgba(255,255,255,.08); border:1px solid rgba(216,180,106,.4); border-radius:12px; padding:.5rem .8rem; color:inherit; cursor:pointer; }
.tc-ov-hero__budget-k { font:500 .68rem/1 var(--font-b,Jost); opacity:.8; text-transform:uppercase; letter-spacing:.05em; }
.tc-ov-hero__budget-v { font:400 1.15rem/1 var(--font-d,'Bodoni Moda'); }
.tc-ov-hero__chips { display:flex; flex-wrap:wrap; gap:.4rem; }
.tc-ov-chip { display:inline-flex; align-items:center; gap:.3rem; border-radius:999px; padding:.32rem .7rem; font:500 .8rem/1 var(--font-b,Jost); cursor:pointer; border:1px solid transparent; }
.tc-ov-chip--ok { background:rgba(72,160,108,.18); color:#bfe6cf; border-color:rgba(72,160,108,.5); }
.tc-ov-chip--warn { background:rgba(212,160,80,.18); color:#f0d39a; border-color:rgba(212,160,80,.55); }
.tc-ov-hero__cta { align-self:flex-start; background:var(--gold,#d8b46a); color:#1a1206; border:none; border-radius:12px; padding:.7rem 1.1rem; font:600 .95rem/1 var(--font-b,Jost); cursor:pointer; min-height:44px; }
.tc-ov-hero__allset { font:500 .95rem/1 var(--font-b,Jost); color:#bfe6cf; margin:0; }

/* Readiness ring */
.tc-ov-ring { position:relative; width:64px; height:64px; flex:0 0 auto; }
.tc-ov-ring__svg { width:64px; height:64px; transform:rotate(-90deg); }
.tc-ov-ring__track { fill:none; stroke:rgba(255,255,255,.18); stroke-width:6; }
.tc-ov-ring__prog { fill:none; stroke:var(--gold,#d8b46a); stroke-width:6; stroke-linecap:round; transition:stroke-dashoffset .4s ease; }
.tc-ov-ring__lbl { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.tc-ov-ring__pct { font:400 1rem/1 var(--font-d,'Bodoni Moda'); color:var(--cream,#f6efe2); }
.tc-ov-ring__cap { font:500 .5rem/1 var(--font-b,Jost); text-transform:uppercase; letter-spacing:.05em; opacity:.7; }

/* Sections + rails */
.tc-ov-sec { display:flex; flex-direction:column; gap:.6rem; }
.tc-ov-sec__head { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; }
.tc-ov-sec__t { font:400 1.3rem/1 var(--font-d,'Bodoni Moda'); margin:0; color:var(--navy,#0c1a30); }
.tc-ov-sec__more { background:none; border:none; color:var(--gold-dk,#b08a3a); font:500 .85rem/1 var(--font-b,Jost); cursor:pointer; padding:.2rem; }
.tc-ov-sec__src { font:400 .72rem/1.2 var(--font-b,Jost); opacity:.7; }
.tc-ov-rail { display:flex; gap:.75rem; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:.2rem .1rem .6rem; scrollbar-width:thin; }
.tc-ov-rail::-webkit-scrollbar { height:6px; }
.tc-ov-card { scroll-snap-align:start; flex:0 0 78%; max-width:280px; background:#fff; border:1px solid rgba(12,26,48,.1); border-radius:14px; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; }
.tc-ov-card__media, .tc-ov-card__media.tc-place__media { height:150px; width:100%; }
.tc-ov-card__media img { width:100%; height:150px; object-fit:cover; }
.tc-ov-card__body { padding:.7rem .8rem; display:flex; flex-direction:column; gap:.35rem; }
.tc-ov-card__tier { align-self:flex-start; font:500 .68rem/1 var(--font-b,Jost); text-transform:uppercase; letter-spacing:.04em; color:var(--gold-dk,#b08a3a); }
.tc-ov-card__name { font:400 1.05rem/1.15 var(--font-d,'Bodoni Moda'); color:var(--navy,#0c1a30); }
.tc-ov-card__why { font:400 .85rem/1.4 var(--font-b,Jost); color:#3a4660; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.tc-ov-card__foot { display:flex; flex-wrap:wrap; gap:.4rem; }
.tc-ov-card__tix, .tc-ov-card__fit { font:500 .74rem/1 var(--font-b,Jost); color:#5a6478; }

/* Timeline */
.tc-ov-tl { display:flex; flex-direction:column; gap:.5rem; }
.tc-ov-tl__row { text-align:left; background:#fff; border:1px solid rgba(12,26,48,.1); border-radius:12px; padding:.7rem .85rem; cursor:pointer; display:flex; flex-direction:column; gap:.4rem; }
.tc-ov-tl__head { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.tc-ov-tl__d { font:500 .8rem/1 var(--font-b,Jost); color:var(--gold-dk,#b08a3a); text-transform:uppercase; letter-spacing:.04em; }
.tc-ov-tl__city { font:400 1rem/1 var(--font-d,'Bodoni Moda'); color:var(--navy,#0c1a30); }
.tc-ov-tl__travel { font:500 .75rem/1 var(--font-b,Jost); color:#5a6478; }
.tc-ov-tl__chips { display:flex; flex-wrap:wrap; gap:.35rem; }
.tc-ov-tl__chip { font:400 .78rem/1 var(--font-b,Jost); background:rgba(12,26,48,.06); border-radius:6px; padding:.25rem .5rem; color:#3a4660; }
.tc-ov-tl__more { background:none; border:1px dashed rgba(12,26,48,.25); border-radius:10px; padding:.5rem; font:500 .82rem/1 var(--font-b,Jost); color:#5a6478; cursor:pointer; }

/* Quick links */
.tc-ov-quick { flex-direction:row; flex-wrap:wrap; align-items:center; gap:.5rem; }
.tc-ov-quick__k { font:500 .78rem/1 var(--font-b,Jost); text-transform:uppercase; letter-spacing:.05em; color:#5a6478; }
.tc-ov-quick__b { background:rgba(12,26,48,.06); border:none; border-radius:999px; padding:.4rem .8rem; font:500 .82rem/1 var(--font-b,Jost); color:var(--navy,#0c1a30); cursor:pointer; }

/* Floating concierge FAB + sheet */
.tc-ov-fab { position:fixed; right:1rem; bottom:5.5rem; z-index:40; display:inline-flex; align-items:center; gap:.45rem; background:var(--gold,#d8b46a); color:#1a1206; border:none; border-radius:999px; padding:.7rem 1.1rem; min-height:44px; box-shadow:0 6px 20px rgba(8,18,36,.35); cursor:pointer; font:600 .9rem/1 var(--font-b,Jost); }
.tc-ov-fab__ic { font-size:1.1rem; }
.tc-ov-sheet { position:fixed; inset:0; z-index:60; background:rgba(8,18,36,.55); display:flex; align-items:flex-end; justify-content:center; }
.tc-ov-sheet__card { background:#fff; width:100%; max-width:620px; border-radius:18px 18px 0 0; padding:1rem 1rem 1.4rem; max-height:80vh; overflow-y:auto; }
.tc-ov-sheet__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem; }
.tc-ov-sheet__t { font:400 1.25rem/1 var(--font-d,'Bodoni Moda'); color:var(--navy,#0c1a30); }
.tc-ov-sheet__x { background:none; border:none; font-size:1.2rem; cursor:pointer; min-width:44px; min-height:44px; color:#5a6478; }
.tc-ov-sheet__quick { display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:.8rem; }
.tc-ov-sheet__chip { background:rgba(216,180,106,.15); border:1px solid rgba(216,180,106,.4); border-radius:999px; padding:.4rem .8rem; font:500 .82rem/1 var(--font-b,Jost); color:var(--navy,#0c1a30); cursor:pointer; }

@media (prefers-reduced-motion: reduce) {
  .tc-ov-ring__prog { transition:none; }
  .tc-ov-rail { scroll-behavior:auto; }
}

@media (min-width:768px) {
  .tc-ov-hero { min-height:420px; }
  .tc-ov-hero__title { font-size:2.6rem; }
  .tc-ov-hero__inner { padding:2rem; }
  .tc-ov-card { flex-basis:46%; }
}
@media (min-width:1200px) {
  .tc-ov-card { flex-basis:30%; max-width:320px; }       /* approved: rail still scrolls, no wrap */
  .tc-ov-hero { min-height:480px; }
  .tc-ov-fab { right:2rem; bottom:2rem; }
  .tc-ov-sheet { align-items:center; }
  .tc-ov-sheet__card { border-radius:18px; }
}
```

> **Note on tokens:** the codebase uses CSS variables in `:root` (navy palette, `--gold`,
> `--cream`, `--font-d`, `--font-b`). The fallbacks above are defensive; confirm the real token
> names via `grep -n "\-\-gold\|\-\-cream\|\-\-navy\|\-\-font-d" travel-concierge.css style.css`
> and prefer the existing names. The `.tc-actionbar` is the mobile bottom bar — `bottom:5.5rem`
> on the FAB clears it; verify the actual action-bar height and adjust if needed.

- [ ] **Step 2: Commit**

```bash
git add travel-concierge.css
git commit -m "style(travel-concierge): V4 Overview CSS (hero/ring/rails/timeline/fab, 768+1200 breakpoints)"
```

---

## Task 10: HTML script tag + version bumps

**Files:**
- Modify: `travel-concierge.html`

- [ ] **Step 1: Confirm the next unused version string**

Run:
```bash
git log --all -p -- '*.html' | grep -oE 'travel-concierge\.js\?v=[0-9]{8}[a-z]*' | sort -u | tail -3
```
Expected highest is `20260622f`. Use `20260622g` (verify it is NOT already present).

- [ ] **Step 2: Add the `tc-overview.js` script tag** — in `travel-concierge.html`, immediately before the `tc-tasks.js` / `travel-concierge.js` lines (so `window.TCOverview` exists before the main IIFE runs):

```html
<script src="/tc-overview.js?v=20260622g"></script>
```
Place it right after the `tc-tasks.js` line (L76) and before `travel-concierge.js` (L77).

- [ ] **Step 3: Bump `travel-concierge.js` + `travel-concierge.css`**

- `travel-concierge.js?v=20260622f` → `?v=20260622g` (L77)
- `travel-concierge.css?v=20260621m` → `?v=20260622g` (L18)

- [ ] **Step 4: Verify**

Run:
```bash
grep -nE "tc-overview\.js|travel-concierge\.js\?v=|travel-concierge\.css\?v=" travel-concierge.html
```
Expected: `tc-overview.js?v=20260622g` present before `travel-concierge.js?v=20260622g`; css at `20260622g`.

- [ ] **Step 5: Commit**

```bash
git add travel-concierge.html
git commit -m "chore(travel-concierge): load tc-overview.js + bump js/css to v=20260622g"
```

---

## Task 11: Regression suite + PASS/FAIL report (HOLD deploy)

**Files:** none (verification only)

- [ ] **Step 1: Run all pure-node tests**

Run:
```bash
node tests/tc-overview.test.js
node tests/tc-tasks.test.js
node tests/journey-days.test.js 2>/dev/null || npm run test:journeydays
npm run test:media
npm run test:userplace
```
Expected: every suite ends `N passed, 0 failed`.

- [ ] **Step 2: Rules unchanged → must stay green**

Run: `npm run test:rules`
Expected: rules tests pass (no schema/rule changes were made).

- [ ] **Step 3: Full system dry run**

Run: `scripts/ai/full_system_dry_run.sh`
Expected: ends with `FINAL: PASS`. (If the codex-loop emulator emits a bogus trailing
`FINAL: FAIL` from stale artifacts, verify independently per the project note: the pure tests +
`test:rules` are the source of truth.)

- [ ] **Step 4: Manual mobile/desktop matrix** — serve locally (`python3 -m http.server 8080`) and open `/travel-concierge.html`:
  - Demo trip: Overview lands first; hero ring/budget/chips render; rails scroll at 375px and 1280px; tabs all reachable.
  - Real shared trip (open, then refresh): refresh lands back on Overview (not a stale tab).
  - Switch language EN/VI/ES: every Overview string changes (no hardcoded text).
  - Concierge FAB opens the sheet; a command runs through the existing engine.

- [ ] **Step 5: Write the PASS/FAIL report** to `.ai_runs/latest/` (or report inline) using the project's Required Report Format. **Do NOT deploy** — hold per the user's V4 directive; report the next command as the deploy step awaiting user confirmation.

---

## Self-Review (completed before handoff)

- **Spec coverage:** Hero ✓ (T3), Highlights ✓ (T4), Timeline ✓ (T5), Discoveries+QuickLinks ✓ (T6), default-tab wiring ✓ (T7), Concierge FAB ✓ (T8), CSS ✓ (T9), honest images ✓ (placeMedia throughout), i18n ✓ (T2, all 3 langs), tests ✓ (T1, T11), version bump ✓ (T10).
- **Placeholders:** none — every code step has full code; the three "Note" callouts are real-codebase verification steps (confirm an existing i18n key / token / selector), not deferred work.
- **Type consistency:** `TCOverview.readiness/nextAction/statusChips` signatures match between T1 (module + tests) and T3 (caller). `renderOverview(plan)` consistent across T3–T6. `ovHighlightCard(a, city)` / `ovDiscoveryCard(x)` / `ovTimelineRow(d, i)` / `ovRing(pct)` / `conciergeFab(tr)` referenced exactly as defined.
- **Scope:** P0 only; P1/P2 explicitly deferred.
