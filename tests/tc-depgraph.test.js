'use strict';
// node tests/tc-depgraph.test.js — pure dependency-graph engine (no DOM), eval pattern like tc-tasks.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-depgraph.js'), 'utf8') + '\nreturn window.TCDepGraph;';
const G = new Function('window', src)({});
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// The success-test trip (status='research_needed' = not done; 'booked' = done).
function trip() {
  return [
    { id: 't_bus1',     kind: 'transport', city: 'OC', journeyIndex: 0, status: 'research_needed', title: 'Bus Hoang SJ→OC' },
    { id: 't_michael1', kind: 'transport', city: 'SD', journeyIndex: 1, status: 'research_needed', title: 'Michael OC→SD' },
    { id: 'h_sd',       kind: 'lodging',   city: 'SD', journeyIndex: 1, status: 'research_needed', title: 'San Diego Hotel' },
    { id: 'a_zoo',      kind: 'ticket',    city: 'SD', journeyIndex: 1, status: 'research_needed', title: 'Zoo' },
    { id: 'a_seal',     kind: 'ticket',    city: 'SD', journeyIndex: 1, status: 'research_needed', title: 'Seal Tour' },
    { id: 't_michael2', kind: 'transport', city: 'OC', journeyIndex: 2, status: 'research_needed', title: 'Michael SD→OC' },
    { id: 'h_hb',       kind: 'lodging',   city: 'OC', journeyIndex: 2, status: 'research_needed', title: 'Huntington Beach Hotel' },
    { id: 'f_pho',      kind: 'food',      city: 'OC', journeyIndex: 2, status: 'research_needed', title: 'Pho 79 Dinner' },
    { id: 't_bus2',     kind: 'transport', city: 'SJ', journeyIndex: 3, status: 'research_needed', title: 'Bus Hoang OC→SJ', legType: 'return' },
  ];
}
function byId(r, id) { return r.nodes.filter(function (n) { return n.id === id; })[0]; }
function mark(nodes, id, st) { nodes.forEach(function (n) { if (n.id === id) n.status = st; }); return nodes; }

// ── next-action advances through the journey in the right order ──
var n = trip();
ok('1st action = Book Bus (first transport)', G.build(n).nextAction.id === 't_bus1');
mark(n, 't_bus1', 'booked');
ok('after bus → Confirm Michael', G.build(n).nextAction.id === 't_michael1');
mark(n, 't_michael1', 'booked');
ok('after michael → Book SD Hotel', G.build(n).nextAction.id === 'h_sd');
mark(n, 'h_sd', 'booked');
ok('after SD hotel → Zoo or Seal ticket', ['a_zoo', 'a_seal'].indexOf(G.build(n).nextAction.id) !== -1);

// ── blocked propagation ──
var r0 = G.build(trip());
ok('h_sd blocked when its inbound transport not done', byId(r0, 'h_sd').blocked === true && byId(r0, 'h_sd').blockedReason === 'missing_transport');
ok('a_zoo blocked (transport+stay missing)', byId(r0, 'a_zoo').blocked === true);
var n2 = mark(trip(), 't_michael1', 'booked'); // transport done, hotel not
var r1 = G.build(n2);
ok('a_zoo now blocked on the HOTEL (missing_stay)', byId(r1, 'a_zoo').blocked === true && byId(r1, 'a_zoo').blockedReason === 'missing_stay');
ok('h_sd unblocked once its transport is booked', byId(r1, 'h_sd').blocked === false);
ok('t_michael2 blocked on the prior leg', byId(r0, 't_michael2').blocked === true && byId(r0, 't_michael2').blockedReason === 'missing_prior_leg');
ok('t_bus1 (chain root) never blocked', byId(r0, 't_bus1').blocked === false);

// ── dependencies derived ──
ok('h_sd depends on its inbound transport', byId(r0, 'h_sd').dependencies.indexOf('t_michael1') !== -1);
ok('a_zoo depends on transport AND hotel', byId(r0, 'a_zoo').dependencies.indexOf('t_michael1') !== -1 && byId(r0, 'a_zoo').dependencies.indexOf('h_sd') !== -1);
ok('return bus depends on the prior leg (transitive chain)', byId(r0, 't_bus2').dependencies.indexOf('t_michael2') !== -1);

// ── priority: transport outranks food; pinned bumps ──
ok('transport scores above food', byId(r0, 't_bus1').priorityScore > byId(r0, 'f_pho').priorityScore);

// ── progress ──
var rp = G.build(mark(mark(trip(), 't_bus1', 'booked'), 't_michael1', 'booked'));
ok('transport progress 2/4 = 50%', rp.progress.transport === 50);
ok('overall progress computed', rp.progress.overall === Math.round(2 / 9 * 100));

// ── robustness: unscheduled node (no city / Infinity index) never blocks others, never crashes ──
var n3 = trip(); n3.push({ id: 'x_custom', kind: 'optional', city: '', journeyIndex: Infinity, status: 'research_needed', title: 'Friend rec' });
var r3 = G.build(n3);
ok('unscheduled custom node is not blocked', byId(r3, 'x_custom').blocked === false);
ok('unscheduled node does not become next action over the chain root', r3.nextAction.id === 't_bus1');

// ── all done → no next action ──
var nAll = trip().map(function (x) { x.status = 'booked'; return x; });
ok('all done → nextAction null', G.build(nAll).nextAction === null && G.build(nAll).progress.overall === 100);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
