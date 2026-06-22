'use strict';
// node tests/tc-overview.test.js — pure-module test (no DOM). Loads the browser IIFE like tc-tasks.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-overview.js'), 'utf8') + '\nreturn window.TCOverview;';
const O = new Function('window', src)({});
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// ── readiness(tasks) — done/total → pct; DONE = booked|paid|skipped|not_needed|completed ──
ok('empty → 100%', O.readiness([]).pct === 100);
ok('all done → 100%', O.readiness([{ status: 'booked' }, { status: 'paid' }]).pct === 100);
ok('half done → 50%', O.readiness([{ status: 'booked' }, { status: 'todo' }]).pct === 50);
ok('skipped/not_needed count as done', O.readiness([{ status: 'skipped' }, { status: 'not_needed' }]).pct === 100);
ok('rounds 1/3 → 33%', O.readiness([{ status: 'booked' }, { status: 'todo' }, { status: 'todo' }]).pct === 33);
var r = O.readiness([{ status: 'booked' }, { status: 'todo' }]);
ok('reports counts', r.doneCount === 1 && r.totalCount === 2);
// REAL tasks carry bookingStatus (not status) — readiness MUST read it (was a field-mismatch bug)
ok('bookingStatus=completed counts done', O.readiness([{ bookingStatus: 'completed' }]).pct === 100);
ok('bookingStatus=research_needed not done', O.readiness([{ bookingStatus: 'research_needed' }]).pct === 0);
ok('mixed bookingStatus 1/2', O.readiness([{ bookingStatus: 'booked' }, { bookingStatus: 'research_needed' }]).pct === 50);
ok('nextAction skips completed bookingStatus', O.nextAction([{ bookingStatus: 'completed', priority: 'P0', title: 'X' }]) === null);

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
ok('P2-only incomplete does NOT warn', O.statusChips([{ category: 'other', status: 'todo', priority: 'P2' }])[0] === undefined || O.statusChips([{ category: 'food', status: 'todo', priority: 'P2' }])[0].state === 'ok');

// ── heroTitle(dateRange) — season + year for the cinematic hero title; null when unparseable ──
ok('July 1–4, 2026 → summer 2026', (function () { var r = O.heroTitle('July 1–4, 2026'); return r && r.seasonKey === 'season_summer' && r.year === '2026'; })());
ok('Dec 2025 → winter 2025', (function () { var r = O.heroTitle('Dec 20–24, 2025'); return r && r.seasonKey === 'season_winter' && r.year === '2025'; })());
ok('2026-03-10 → spring 2026', (function () { var r = O.heroTitle('2026-03-10 to 2026-03-14'); return r && r.seasonKey === 'season_spring' && r.year === '2026'; })());
ok('9/15/2026 → fall 2026', (function () { var r = O.heroTitle('9/15/2026 - 9/18/2026'); return r && r.seasonKey === 'season_fall' && r.year === '2026'; })());
ok('no parseable date → null', O.heroTitle('sometime soon') === null);
ok('year but no month → null', O.heroTitle('our 2026 trip') === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
