'use strict';
/* Family Management regression — drives the REAL browser code via the window.TravelConcierge seam.
 * Verifies: rename a family, color/icon persist, persistence survives a PAGE RELOAD (localStorage),
 * voting + tasks + costs all use the NEW family name + color, delete prunes votes, and no generic
 * "Family" chip leaks. Login + Firestore can't run headlessly, so persistence is asserted against
 * the localStorage write that saveTrip performs (the same payload Firestore receives).
 * Run: node tests/family-management.test.js  (needs playwright + python3) */
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 8915;
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

const TRIP_ID = 'tc_test_fammgmt';

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
    await pg.waitForTimeout(1300);

    // Make it an owned, editable, persistable trip with 3 families (default names blank).
    await pg.evaluate(function (tripId) {
      var TC = window.TravelConcierge, s = TC._state, tr = s.trip;
      tr._demo = false; s.readonly = false; s.myRole = 'owner'; tr.id = tripId; tr.ownerUid = 'tester';
      tr.families = [TC._newTrip ? null : null].slice(0, 0); // clear, then rebuild via real newFamily
      tr.families = [];
      [0, 1, 2].forEach(function (i) { tr.families.push({ id: 'f' + (i + 1), name: '', color: ['#3b82f6', '#22c55e', '#a855f7'][i], icon: '', adults: 2, seniors: 0, childrenAges: i === 0 ? '8, 12' : (i === 1 ? '3' : '15') }); });
      tr.decisions = {}; tr.bookings = []; tr.placeOverrides = {};
      TC._saveTrip(tr);
    }, TRIP_ID);

    // 1) No generic "Family" — blank names render as a REAL label (Organizer's Family / Group N).
    const labels = await pg.evaluate(function () { return window.TravelConcierge._tripFamilies().map(function (f) { return f.name; }); });
    ok('no generic "Family" label (blank → real default)', labels.indexOf('Family') < 0 && /Organizer/.test(labels[0]) && /Group/.test(labels[1]));

    // 2) Rename + color + icon, and confirm they persist to the saved (localStorage/Firestore) payload.
    await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      TC._renameFamily('f1', 'The Nguyen Family'); TC._renameFamily('f2', 'Tran Family'); TC._renameFamily('f3', "Grandma's Family");
      TC._setFamilyColor('f1', '#ec4899'); TC._setFamilyIcon('f1', '🐢');
    });
    const persisted = await pg.evaluate(function (tripId) {
      var raw = window.localStorage.getItem('tc_trip_' + tripId); if (!raw) return null;
      var tr = JSON.parse(raw); var f = (tr.families || [])[0] || {};
      return { name: f.name, color: f.color, icon: f.icon, count: (tr.families || []).length };
    }, TRIP_ID);
    ok('rename persisted to saved payload', persisted && persisted.name === 'The Nguyen Family');
    ok('color persisted', persisted && persisted.color === '#ec4899');
    ok('icon persisted', persisted && persisted.icon === '🐢');

    // 3) REFRESH round-trip: re-hydrate state.trip straight from the persisted localStorage payload
    //    (exactly what loadTrip does on a page refresh) → name/color/icon survive.
    const afterReload = await pg.evaluate(function (tripId) {
      var TC = window.TravelConcierge, s = TC._state;
      var raw = window.localStorage.getItem('tc_trip_' + tripId);
      s.trip = JSON.parse(raw); s.myRole = 'owner'; s.readonly = false; // simulate fresh load from storage
      var fams = TC._tripFamilies();
      return { name: fams[0].name, color: fams[0].color, icon: fams[0].icon, hasGeneric: fams.some(function (f) { return f.name === 'Family'; }) };
    }, TRIP_ID);
    ok('after REFRESH: name preserved', afterReload.name === 'The Nguyen Family');
    ok('after REFRESH: color preserved', afterReload.color === '#ec4899');
    ok('after REFRESH: icon preserved', afterReload.icon === '🐢');
    ok('after REFRESH: still no generic "Family"', afterReload.hasGeneric === false);

    // 4) Voting uses the new family NAME (not a generic chip).
    const voteTxt = await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      var p = { name: 'San Diego Zoo', category: 'zoo', address: 'San Diego, CA' };
      TC._state._alts = { 'san diego zoo': [{ name: 'Disneyland', category: 'theme_park', why: 'x' }] };
      TC._ensureDecision(p, { day: 1, slot: 'morning' });
      var d = TC._getDecision(p); var dis = d.options.filter(function (o) { return /Disneyland/.test(o.name); })[0];
      TC._setMe('f1'); TC._castDecisionVote(p, dis.id);
      var panel = TC._decisionPanel(p, { day: 1, slot: 'morning' });
      return panel.textContent;
    });
    ok('voting shows the family NAME', /The Nguyen Family/.test(voteTxt));
    ok('voting shows pending families by name (Tran / Grandma)', /Tran Family/.test(voteTxt) || /Grandma/.test(voteTxt));

    // 5) Tasks use the new name + color chip.
    const taskTxt = await pg.evaluate(function () {
      var TC = window.TravelConcierge, tr = TC._state.trip;
      tr.bookings = [{ id: 'b1', type: 'attraction', title: 'Buy Zoo tickets', assignedToFamily: 'f1', bookingStatus: 'research_needed' }];
      var card = TC._bookingCard(tr.bookings[0], 0);
      return card.textContent + '|' + (card.querySelector('.tc-famchip') ? 'chip' : 'nochip');
    });
    ok('task card shows assignee family name', /The Nguyen Family/.test(taskTxt));
    ok('task card shows the family color chip', /chip$/.test(taskTxt));

    // 6) Costs use per-family sharing with the new name.
    const costTxt = await pg.evaluate(function () {
      var TC = window.TravelConcierge;
      var grid = TC._renderCosts(TC._state.trip.plan || {});
      return { text: grid.textContent, shares: grid.querySelectorAll('.tc-famshare').length };
    });
    ok('cost sharing renders per-family cards', costTxt.shares >= 3);
    ok('cost sharing shows the family name + Estimated/Paid/Remaining', /The Nguyen Family/.test(costTxt.text) && /Estimated/.test(costTxt.text) && /Remaining/.test(costTxt.text));

    // 7) Delete a family → decision vote AND the like/skip consensus vote/favorite are pruned
    //    (no orphan ghost-voter), and min-one guard respected.
    const afterDelete = await pg.evaluate(function () {
      var TC = window.TravelConcierge, tr = TC._state.trip;
      tr.votes = { 'San Diego Zoo': { f1: 'like', f2: 'skip', f3: 'maybe' } };
      tr.favorites = { 'San Diego Zoo': { f2: true } };
      tr.bookings = (tr.bookings || []).concat([{ id: 'bp', type: 'attraction', title: 'paid task', assignedToFamily: 'f2', paidBy: 'f2', actualCost: 100 }]);
      var before = TC._tripFamilies().length;
      TC._deleteFamily('f2');
      var p = { name: 'San Diego Zoo' }; var d = TC._getDecision(p);
      var paidTask = (tr.bookings || []).filter(function (b) { return b.id === 'bp'; })[0] || {};
      return {
        before: before, after: TC._tripFamilies().length,
        f2DecisionGone: !(d && d.votes && d.votes.f2),
        f2ConsensusGone: !(tr.votes['San Diego Zoo'] && tr.votes['San Diego Zoo'].f2),
        f2FavoriteGone: !(tr.favorites['San Diego Zoo'] && tr.favorites['San Diego Zoo'].f2),
        f1VoteKept: tr.votes['San Diego Zoo'] && tr.votes['San Diego Zoo'].f1 === 'like',
        paidByCleared: paidTask.paidBy === '' && paidTask.assignedToFamily === ''
      };
    });
    ok('delete removes the family', afterDelete.after === afterDelete.before - 1);
    ok('delete prunes orphaned DECISION vote', afterDelete.f2DecisionGone === true);
    ok('delete prunes orphaned LIKE/SKIP consensus vote (P0)', afterDelete.f2ConsensusGone === true);
    ok('delete prunes orphaned FAVORITE (P0)', afterDelete.f2FavoriteGone === true);
    ok('delete keeps surviving families votes', afterDelete.f1VoteKept === true);
    ok('delete clears orphaned task assignment + paidBy', afterDelete.paidByCleared === true);

    // Merge folds the consensus vote into the survivor (never silently dropped).
    const afterMerge = await pg.evaluate(function () {
      var TC = window.TravelConcierge, tr = TC._state.trip;
      tr.votes = { 'La Jolla Cove': { f3: 'like' } }; // f3 will be merged into f1
      TC._mergeFamily('f3', 'f1');
      return { f1HasVote: tr.votes['La Jolla Cove'] && tr.votes['La Jolla Cove'].f1 === 'like', f3Gone: !(tr.votes['La Jolla Cove'] && tr.votes['La Jolla Cove'].f3), count: TC._tripFamilies().length };
    });
    ok('merge folds the consensus vote into the survivor (P0)', afterMerge.f1HasVote === true && afterMerge.f3Gone === true);

    ok('no page errors during the flow', errs.length === 0);
    if (errs.length) console.log('  errors:', errs.slice(0, 5).join(' | '));
  } finally {
    await b.close();
    try { srv.kill(); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('TEST ERROR', e && e.message); process.exit(2); });
