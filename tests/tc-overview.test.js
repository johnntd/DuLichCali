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
ok('P2-only incomplete does NOT warn', O.statusChips([{ category: 'other', status: 'todo', priority: 'P2' }])[0] === undefined || O.statusChips([{ category: 'food', status: 'todo', priority: 'P2' }])[0].state === 'ok');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
