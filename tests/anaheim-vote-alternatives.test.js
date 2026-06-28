'use strict';
/* Regression for REFINEMENTS 1–3 on the Anaheim / San Diego trip, driven end-to-end through the
 * REAL browser code (not just the pure module). Login + the alternatives Cloud Function can't run
 * headlessly, so the test uses the window.TravelConcierge test seam: it makes the loaded sample an
 * owned+editable trip (state.myRole='owner'), seeds 3 families + mock alternatives into state, then
 * exercises the actual altPanel / decisionPanel / placeFacts builders and the actual vote→resolve
 * →apply pipeline. The pure vote MATH is additionally covered by tests/tc-decisions.test.js.
 *
 * Run: node tests/anaheim-vote-alternatives.test.js   (needs playwright + python3) */
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 8913;
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP: playwright not installed'); process.exit(0); }
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 1200); });
  const b = await chromium.launch();
  try {
    const pg = await b.newPage({ viewport: { width: 412, height: 915 } });
    const errs = []; pg.on('pageerror', function (e) { errs.push(String(e.message || e)); });
    await pg.goto('http://localhost:' + PORT + '/travel-concierge.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    await pg.locator('button.tc-hero__demo', { hasText: /Anaheim & San Diego/i }).first().click();
    await pg.waitForTimeout(1400);

    // Make the loaded sample an OWNED + editable trip with 3 families, and seed mock alternatives
    // for the San Diego Zoo stop (Disneyland / SeaWorld / Balboa Park) — exactly the spec example.
    const setup = await pg.evaluate(function () {
      var TC = window.TravelConcierge, s = TC._state, tr = s.trip;
      tr._demo = false; s.readonly = false; s.myRole = 'owner';
      tr.families = [{ id: 'f1', name: 'Nguyen', adults: 2, seniors: 0, childrenAges: '8, 12' },
                     { id: 'f2', name: 'Tran', adults: 2, seniors: 1, childrenAges: '3' },
                     { id: 'f3', name: 'Le', adults: 2, seniors: 0, childrenAges: '15' }];
      tr.decisions = {}; tr.placeOverrides = {};
      var key = 'san diego zoo';
      s._alts = s._alts || {};
      s._alts[key] = [
        { name: 'Disneyland', category: 'theme_park', why: 'Big-ticket day the teen will love', address: 'Anaheim, CA', dataSource: 'ai_researched_pending_verification' },
        { name: 'SeaWorld San Diego', category: 'theme_park', why: 'Marine animals + rides for mixed ages', address: 'San Diego, CA', dataSource: 'ai_researched_pending_verification' },
        { name: 'Balboa Park Museums', category: 'museum', why: 'Lower-cost, walkable, rainy-day friendly', address: 'San Diego, CA', dataSource: 'ai_researched_pending_verification' }
      ];
      return { families: tr.families.length, key: key };
    });
    ok('setup: 3 families seeded', setup.families === 3);

    // REFINEMENT 1 — render the alternatives panel for the Zoo and confirm ≥2 RICH cards.
    const alt = await pg.evaluate(function (key) {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: 'San Diego, CA' };
      var panel = TC._altPanel(p, { day: 1, slot: 'morning', pkey: key });
      var host = document.createElement('div'); host.id = 'altHost'; host.appendChild(panel); document.body.appendChild(host);
      return {
        cards: panel.querySelectorAll('.tc-altopt').length,
        hasVote: !!panel.querySelector('.tc-altopt__acts button'),
        text: panel.textContent,
      };
    }, setup.key);
    ok('REF1: ≥2 alternative cards shown (' + alt.cards + ')', alt.cards >= 2);
    ok('REF1: alternative cards offer actions (Vote/Swap/Add/Save)', alt.hasVote);
    ok('REF1: alternatives include Disneyland + SeaWorld + Balboa', /Disneyland/.test(alt.text) && /SeaWorld/.test(alt.text) && /Balboa/.test(alt.text));
    ok('REF1: cards carry honest "verify"/estimate labelling', /Verify|verify|estimate|suggested/i.test(alt.text));

    // REFINEMENT 3 — the rich place facts grid (modal) lists detailed fields and honest verify links.
    const facts = await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: '2920 Zoo Dr, San Diego, CA', city: 'San Diego' };
      var grid = TC._renderPlaceFacts(p);
      var keys = [].slice.call(grid.querySelectorAll('.tc-fact__k')).map(function (e) { return e.textContent; });
      return { rows: grid.querySelectorAll('.tc-fact').length, keys: keys, verifies: grid.querySelectorAll('.tc-fact__verify').length, text: grid.textContent };
    });
    ok('REF3: place facts grid has many detail rows (' + facts.rows + ')', facts.rows >= 12);
    ok('REF3: includes Rating/Hours/Parking/Family fit/Accessibility/Safety', /Rating/.test(facts.text) && /Hours/.test(facts.text) && /Parking/.test(facts.text) && /Family fit/.test(facts.text) && /Accessibility/.test(facts.text) && /Safety/.test(facts.text));
    ok('REF3: missing data shown as "Verify before going" (' + facts.verifies + ' links)', facts.verifies >= 4);

    // REFINEMENT 2 — family voting: 2 of 3 majority CHANGES the plan (Disneyland over Zoo).
    const major = await pg.evaluate(function (key) {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: 'San Diego, CA' };
      TC._ensureDecision(p, { day: 1, slot: 'morning' });
      var d = TC._getDecision(p);
      var dis = d.options.filter(function (o) { return /Disneyland/.test(o.name); })[0];
      var orig = d.options.filter(function (o) { return o.original; })[0];
      // f1 + f2 vote Disneyland, f3 votes Zoo (original) → 2–1 Disneyland.
      TC._setMe('f1'); TC._castDecisionVote(p, dis.id);
      var midStatus = (function () { var dd = TC._getDecision(p); var ta = window.TCDecisions.tally(dd, TC._decisionFamilyCount()); return { allVoted: ta.allVoted, voted: ta.votedFamilies }; })();
      TC._setMe('f2'); TC._castDecisionVote(p, dis.id);
      TC._setMe('f3'); TC._castDecisionVote(p, orig.id);
      var dd = TC._getDecision(p);
      var ov = TC._getOverride(p);
      return { midAllVoted: midStatus.allVoted, status: dd.status, outcome: dd.outcome, applied: dd.appliedOptionId === dis.id, audit: dd.auditNote, swapped: !!(ov && ov.action === 'replaced' && ov.replacement && /Disneyland/.test(ov.replacement.name)), byVote: !!(ov && ov.byVote) };
    }, setup.key);
    ok('REF2: original preserved until ALL voted (mid-vote not resolved)', major.midAllVoted === false);
    ok('REF2: 2-of-3 majority resolves', major.status === 'resolved' && major.outcome === 'majority');
    ok('REF2: majority APPLIES the swap (Disneyland into the plan)', major.swapped === true && major.byVote === true && major.applied === true);
    ok('REF2: audit note records "Disneyland … over … 2–1"', /Disneyland/.test(major.audit || '') && /2/.test(major.audit || '') && /1/.test(major.audit || ''));

    // REFINEMENT 2 — TIE keeps the original (1–1–1 across 3 options, 3 families).
    const tie = await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: 'San Diego, CA' };
      TC._reopenDecision(p);                       // undoes the prior swap + re-opens
      var d = TC._getDecision(p); d.votes = {};    // fresh ballots for the tie scenario
      var o = d.options; // [orig Zoo, Disneyland, SeaWorld, Balboa] → vote 3 different ones
      TC._setMe('f1'); TC._castDecisionVote(p, o[0].id);
      TC._setMe('f2'); TC._castDecisionVote(p, o[1].id);
      TC._setMe('f3'); TC._castDecisionVote(p, o[2].id);
      var dd = TC._getDecision(p); var ov = TC._getOverride(p);
      return { outcome: dd.outcome, audit: dd.auditNote, noSwap: !ov || ov.action !== 'replaced', appliedOrig: dd.appliedOptionId === dd.originalOptionId };
    });
    ok('REF2: tie → outcome tie', tie.outcome === 'tie');
    ok('REF2: tie → original plan KEPT (no swap)', tie.noSwap === true && tie.appliedOrig === true);
    ok('REF2: tie → "original plan kept" audit', /kept|original/i.test(tie.audit || ''));

    // One vote per family: re-voting the same family overwrites (not appends).
    const onePer = await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: 'San Diego, CA' };
      TC._reopenDecision(p); var d = TC._getDecision(p); d.votes = {}; var o = d.options;
      TC._setMe('f1'); TC._castDecisionVote(p, o[1].id); TC._castDecisionVote(p, o[0].id); // f1 changes mind
      var dd = TC._getDecision(p);
      return { f1: dd.votes.f1, voteCount: Object.keys(dd.votes).length };
    });
    ok('REF2: one vote per family (re-vote overwrites)', onePer.voteCount === 1 && onePer.f1 === 'orig');

    ok('no page errors during the flow', errs.length === 0);
    if (errs.length) console.log('  errors:', errs.slice(0, 5).join(' | '));
  } finally {
    await b.close();
    try { srv.kill(); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('TEST ERROR', e && e.message); process.exit(2); });
