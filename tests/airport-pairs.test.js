'use strict';
// node tests/airport-pairs.test.js — pure unit test for CA airport-pair flight links.
const A = require('../functions/lib/airportPairs.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// Region resolution from free-text city strings.
ok('San Jose, CA → bayarea', A.regionForCity('San Jose, CA') === 'bayarea');
ok('San Diego, CA → sandiego (not socal)', A.regionForCity('San Diego, CA') === 'sandiego');
ok('Anaheim → socal', A.regionForCity('Anaheim, CA') === 'socal');
ok('Little Saigon / Westminster → socal', A.regionForCity('Westminster, CA') === 'socal');
ok('Sacramento → sacramento', A.regionForCity('Sacramento, CA') === 'sacramento');
ok('unknown city → ""', A.regionForCity('Tokyo, Japan') === '' && A.regionForCity('') === '');

// Airports for a city, ordered primary-first.
var bay = A.airportsForCity('San Jose');
ok('Bay Area primary airport is SJC', bay[0] && bay[0].code === 'SJC');
ok('Bay Area includes SFO + OAK alternates', bay.map((x) => x.code).join(',') === 'SJC,SFO,OAK');

// The SJ → San Diego test trip: airport-PAIR links (not a generic city query).
var pairs = A.airportPairLinks('San Jose, CA', 'San Diego, CA');
ok('SJ→SD yields SJC→SAN as the primary pair', pairs[0] && pairs[0].from === 'SJC' && pairs[0].to === 'SAN');
ok('primary pair label is "SJC → SAN"', pairs[0] && pairs[0].label === 'SJC → SAN');
ok('primary pair is the closest hub', pairs[0] && pairs[0].bestForKey === 'apf_closest');
ok('each link is a Google Flights airport-pair URL', pairs.every((p) => /travel\/flights/.test(p.url) && p.url.indexOf(p.from) !== -1 && p.url.indexOf(p.to) !== -1));

// SJ → Orange County: multiple destination airports (SNA closest, LGB/LAX alternates), capped.
var sjOc = A.airportPairLinks('San Jose, CA', 'Anaheim, CA', { maxPairs: 3 });
ok('SJ→OC primary is SJC→SNA', sjOc[0] && sjOc[0].from === 'SJC' && sjOc[0].to === 'SNA');
ok('SJ→OC offers alternate dest airports', sjOc.length === 3 && sjOc.some((p) => p.to === 'LGB' || p.to === 'LAX'));
ok('SJ→OC has a budget-labeled alternate', sjOc.some((p) => p.bestForKey === 'apf_budget'));
ok('no duplicate pairs', new Set(sjOc.map((p) => p.from + '>' + p.to)).size === sjOc.length);
ok('respects maxPairs cap', A.airportPairLinks('San Jose, CA', 'Anaheim, CA', { maxPairs: 2 }).length === 2);

// Unknown metro on either end → [] (caller keeps the generic city link).
ok('unknown origin → []', A.airportPairLinks('Reno, NV', 'San Diego, CA').length === 0);
ok('unknown dest → []', A.airportPairLinks('San Jose, CA', 'Portland, OR').length === 0);

// Same-region same-airport never pairs with itself (San Diego has only SAN).
ok('SD→SD (single airport) → no self pair', A.airportPairLinks('San Diego', 'San Diego').length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
