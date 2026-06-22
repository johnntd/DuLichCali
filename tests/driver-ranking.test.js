'use strict';
// node tests/driver-ranking.test.js — pure unit test for ride-dispatch capacity ranking.
const R = require('../functions/lib/driverRanking.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

const big = { id: 'michael', vehicle: { seats: 12 } };   // 12-seat van
const small = { id: 'small', vehicle: { seats: 4 } };    // 4-seat car
const unknown = { id: 'unk', vehicle: {} };              // unknown capacity
const mid = { id: 'mid', vehicle: { seats: 6 } };

ok('seatsOf reads vehicle.seats', R.seatsOf(big) === 12 && R.seatsOf(unknown) === 0);

// 10-passenger ride: the 12-seat van must be offered FIRST; the 4-seat car LAST; never excluded.
var r1 = R.rankDriversByFit([small, big], 10);
ok('10 pax → 12-seat van ranked before 4-seat car', r1[0].id === 'michael' && r1[1].id === 'small');
ok('never excludes — both still present', r1.length === 2);

// unknown capacity sits between known-fit and known-too-small.
var r2 = R.rankDriversByFit([small, unknown, big], 10);
ok('order: fit > unknown > too-small', r2[0].id === 'michael' && r2[1].id === 'unk' && r2[2].id === 'small');

// among fitting vehicles, larger first (closer fit for big parties).
var r3 = R.rankDriversByFit([mid, big], 5);
ok('5 pax, two fit → larger vehicle first', r3[0].id === 'michael' && r3[1].id === 'mid');

// small party: a 4-seat car fits and is eligible (not penalized).
var r4 = R.rankDriversByFit([small, big], 2);
ok('2 pax → 4-seat car fits (tier 0)', R.seatsOf(r4[0]) >= 2 && r4.length === 2);

// the bug case: a 12-seat van WRONGLY recorded as 4 seats is NOT excluded for 10 pax (graceful
// fallback) — it just ranks last until the admin corrects the seat count to 12.
var r5 = R.rankDriversByFit([{ id: 'michael-bad', vehicle: { seats: 4 } }], 10);
ok('lone too-small driver still offered (never dead-ends a valid booking)', r5.length === 1 && r5[0].id === 'michael-bad');

// empty / missing input is safe.
ok('empty input → []', R.rankDriversByFit([], 4).length === 0 && R.rankDriversByFit(null, 4).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
