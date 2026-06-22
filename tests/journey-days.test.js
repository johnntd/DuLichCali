'use strict';
// node tests/journey-days.test.js — pure-module test (no DOM, no emulator).
// Repro + fix for the P0 "Journey Builder skips Day 3" bug. Loads the browser IIFE the
// same way tests/pricing.test.js loads pricing.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-journey-days.js'), 'utf8') + '\nreturn window.TCJourneyDays;';
const w = {}; const J = new Function('window', src)(w);
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ── Fix 1: fillStayWindows — backfill a missing OC stay date from its inbound leg ──
// Acceptance trip: San Diego stay dated Jul 1; Orange County overnight UNDATED (the parser
// legitimately emits date:'' because the user never restated "July 3"); the SD->OC transfer
// (the leg arriving INTO OC) is dated Jul 3.
var stays = [{ city: 'San Diego', date: '2026-07-01' }, { city: 'Orange County', date: '' }];
var inbound = { 'orange county': '2026-07-03' };
var filled = J.fillStayWindows(stays, '2026-07-01', '2026-07-04', inbound);
ok('SD window Jul1->Jul3', filled[0].arrivalIso === '2026-07-01' && filled[0].departureIso === '2026-07-03');
ok('OC window Jul3->Jul4', filled[1].arrivalIso === '2026-07-03' && filled[1].departureIso === '2026-07-04');
ok('every window parseable, arrival<departure (no buildSegmentDayPlan null-bail)',
  filled.every(function (s) { return s.arrivalIso && s.departureIso && s.arrivalIso < s.departureIso; }));
// A lone undated stay spans the whole trip (start->end) rather than collapsing to 0 nights.
var f2 = J.fillStayWindows([{ city: 'X', date: '' }], '2026-07-01', '2026-07-04', {});
ok('lone undated stay spans startIso->endIso', f2[0].arrivalIso === '2026-07-01' && f2[0].departureIso === '2026-07-04');

// ── Fix 2: reconcileCalendarDays — insert the MISSING MIDDLE day (the Day-3 bug) ──
var expected = [
  { iso: '2026-07-01', date: 'Jul 1', isTravelDay: true, destinationIndex: 0 },
  { iso: '2026-07-02', date: 'Jul 2', isTravelDay: false, destinationIndex: 0 },
  { iso: '2026-07-03', date: 'Jul 3', isTravelDay: true, destinationIndex: 1 },
  { iso: '2026-07-04', date: 'Jul 4', isTravelDay: true, isReturnDay: true, destinationIndex: 1 },
];
// The buggy plan the legacy skeleton produces: July 3 dropped → Day 1 / Day 2 / Day 4.
var buggy = [
  { iso: '2026-07-01', date: 'Jul 1', sections: [{ places: [] }] },
  { iso: '2026-07-02', date: 'Jul 2', sections: [{ places: [{ name: 'San Diego Zoo' }] }] },
  { iso: '2026-07-04', date: 'Jul 4', isReturnDay: true, sections: [] },
];
var r = J.reconcileCalendarDays(buggy, expected);
ok('reconcile yields 4 days', r.days.length === 4);
ok('reconcile reports exactly 1 repaired (Jul 3 inserted)', r.repaired === 1);
ok('days are contiguous Jul1..Jul4', eq(r.days.map(function (d) { return d.iso; }), ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']));
ok('inserted Jul 3 is a placeholder needing detail', r.days[2]._placeholder === true && r.days[2]._needsDetail === true);
ok('inserted Jul 3 carries the segment type hint (transfer, destIdx 1)', r.days[2].isTravelDay === true && r.days[2].destinationIndex === 1);
ok('dayNumbers are sequential 1..4', eq(r.days.map(function (d) { return d.dayNumber; }), [1, 2, 3, 4]));
ok('existing Jul 2 content preserved (Zoo)', r.days[1].sections[0].places[0].name === 'San Diego Zoo');

// Matches existing days by DISPLAY DATE when ISO is absent (skeleton days lack .iso).
var noIso = [{ date: 'Jul 1' }, { date: 'Jul 2' }, { date: 'Jul 4' }];
var r2 = J.reconcileCalendarDays(noIso, expected);
ok('date-string match inserts Jul 3 even without .iso', r2.days.length === 4 && r2.days[2]._placeholder === true && r2.days[2].iso === '2026-07-03');

// Drops out-of-range extras, preserves order.
var extra = [
  { iso: '2026-07-01', date: 'Jul 1' }, { iso: '2026-07-02', date: 'Jul 2' },
  { iso: '2026-07-03', date: 'Jul 3' }, { iso: '2026-07-04', date: 'Jul 4' }, { iso: '2026-07-05', date: 'Jul 5' },
];
var r3 = J.reconcileCalendarDays(extra, expected);
ok('reconcile truncates out-of-range day', r3.days.length === 4 && r3.days[3].iso === '2026-07-04');

// Legacy safety: no expected sequence → leave the plan untouched.
var r4 = J.reconcileCalendarDays(buggy, []);
ok('empty expected leaves days unchanged', r4.days.length === buggy.length && r4.repaired === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
