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

// ── smart warnings ──
var rW = G.build(mark(trip(), 't_michael1', 'booked')); // SD transport done, hotel not → tickets blocked on stay
var w1 = G.warnings(rW.nodes);
ok('warn: hotel before tickets (once per city)', w1.filter(function (x) { return x.key === 'warn_hotel_first' && x.city === 'SD'; }).length === 1);
var soon = trip(); soon.forEach(function (x) { if (x.id === 'a_zoo') x.daysUntilDue = 3; });
var w2 = G.warnings(G.build(soon).nodes);
ok('warn: book soon (due ≤7d ticket)', w2.some(function (x) { return x.key === 'warn_book_soon'; }));
var unsT = trip(); unsT.push({ id: 'x', kind: 'optional', city: '', journeyIndex: Infinity, status: 'research_needed', title: 'loose' });
ok('warn: unscheduled item', G.warnings(G.build(unsT).nodes).some(function (x) { return x.key === 'warn_unscheduled' && x.count === 1; }));
ok('no warnings when all done', G.warnings(G.build(trip().map(function (x) { x.status = 'booked'; return x; })).nodes).filter(function (x) { return x.level === 'warn'; }).length === 0);

// ── no journey legs at all (every node unscheduled) → still surface a next action ──
var loose = [
  { id: 'l_hotel', kind: 'lodging', city: '', journeyIndex: Infinity, status: 'research_needed', title: 'Hotel' },
  { id: 'l_food', kind: 'food', city: '', journeyIndex: Infinity, status: 'research_needed', title: 'Dinner' },
];
var rl = G.build(loose);
ok('all-unscheduled trip still has a next action (highest priority)', rl.nextAction && rl.nextAction.id === 'l_hotel');

// ── all done → no next action ──
var nAll = trip().map(function (x) { x.status = 'booked'; return x; });
ok('all done → nextAction null', G.build(nAll).nextAction === null && G.build(nAll).progress.overall === 100);

// ── DIRECTION-AWARE journey mapping + the SJ↔OC↔SD acceptance scenario ──
var ACC_LEGS = [
  { index: 0, fromCity: 'San Jose, CA', toCity: 'Orange County, CA', date: '2026-07-01' },
  { index: 1, fromCity: 'Orange County, CA', toCity: 'San Diego, CA', date: '2026-07-02' },
  { index: 2, fromCity: 'San Diego, CA', toCity: 'Orange County, CA', date: '2026-07-03' },
  { index: 3, fromCity: 'Orange County, CA', toCity: 'San Jose, CA', date: '2026-07-04' },
];
ok('routeOf parses an "A → B" title', (function () { var r = G.routeOf({ title: 'Confirm ride Michael · San Diego → Orange County' }); return r.from === 'san diego' && r.to === 'orange county'; })());
ok('routeOf parses a "From>To" linkedSegmentId', (function () { var r = G.routeOf({ linkedSegmentId: 'San Diego, CA>Orange County, CA' }); return r.from === 'san diego' && r.to === 'orange county'; })());
// the bug: SD→OC ride (dest OC) must NOT collide with the SJ→OC bus (also dest OC)
ok('Michael OC→SD ride → leg 1', G.journeyIndexFor({ kind: 'transport', city: 'San Diego', title: 'Confirm ride Michael · Orange County → San Diego', dueDate: '2026-07-02' }, ACC_LEGS) === 1);
ok('Michael SD→OC ride → leg 2 (NOT leg 0)', G.journeyIndexFor({ kind: 'transport', city: 'Orange County', title: 'Confirm ride Michael · San Diego → Orange County', dueDate: '2026-07-03' }, ACC_LEGS) === 2);
ok('Bus OC→SJ → leg 3', G.journeyIndexFor({ kind: 'transport', city: 'San Jose', linkedSegmentId: 'Orange County, CA>San Jose, CA', dueDate: '2026-07-04' }, ACC_LEGS) === 3);
ok('SD hotel → leg 1 (arrival city)', G.journeyIndexFor({ kind: 'lodging', city: 'San Diego', dueDate: '2026-07-02' }, ACC_LEGS) === 1);
ok('OC return hotel → leg 2 (dueDate disambiguates city-visited-twice)', G.journeyIndexFor({ kind: 'lodging', city: 'Orange County', dueDate: '2026-07-03' }, ACC_LEGS) === 2);

// Build the full trip with Bus SJ→OC COMPLETED → next action must be Michael OC→SD.
function accNode(id, kind, city, route, dueDate, status) { return { id: id, kind: kind, city: city, title: route, journeyIndex: G.journeyIndexFor({ kind: kind, city: city, title: route, dueDate: dueDate }, ACC_LEGS), dueDate: dueDate, daysUntilDue: 30, status: status || 'research_needed' }; }
var accNodes = [
  accNode('bus_out', 'transport', 'Orange County', 'Book Xe Đò Hoàng · San Jose → Orange County', '2026-07-01', 'completed'),
  accNode('mich_ocsd', 'transport', 'San Diego', 'Confirm ride Michael · Orange County → San Diego', '2026-07-02', 'research_needed'),
  accNode('sd_hotel', 'lodging', 'San Diego', 'Hotel — San Diego', '2026-07-02', 'research_needed'),
  accNode('sd_zoo', 'ticket', 'San Diego', 'San Diego Zoo', '2026-07-02', 'research_needed'),
  accNode('mich_sdoc', 'transport', 'Orange County', 'Confirm ride Michael · San Diego → Orange County', '2026-07-03', 'research_needed'),
  accNode('oc_hotel', 'lodging', 'Orange County', 'Hotel — Orange County', '2026-07-03', 'research_needed'),
  accNode('oc_dinner', 'food', 'Orange County', 'Vietnamese dinner', '2026-07-03', 'research_needed'),
  accNode('bus_home', 'transport', 'San Jose', 'Book Xe Đò Hoàng · Orange County → San Jose', '2026-07-04', 'research_needed'),
];
var accBuilt = G.build(accNodes);
ok('next action after outbound bus done = Michael OC→SD', accBuilt.nextAction && accBuilt.nextAction.id === 'mich_ocsd');
var incomplete = accBuilt.nodes.filter(function (n) { return !G.isDone(n); }).sort(function (a, b) { return G.seqOf(a) - G.seqOf(b); }).map(function (n) { return n.id; });
ok('incomplete tasks sort in itinerary/dependency order', incomplete.join(',') === 'mich_ocsd,sd_hotel,sd_zoo,mich_sdoc,oc_hotel,oc_dinner,bus_home');
var adv = accNodes.map(function (n) { return Object.assign({}, n, n.id === 'mich_ocsd' ? { status: 'booked' } : {}); });
ok('completing Michael OC→SD advances next action to SD hotel', G.build(adv).nextAction && G.build(adv).nextAction.id === 'sd_hotel');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
