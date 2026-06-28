'use strict';
// node tests/tc-package.test.js — pure-module test (no DOM). Loads the browser IIFE like tc-stays.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-package.js'), 'utf8') + '\nreturn window.TCPackage;';
const P = new Function('window', src)({});
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// ── estimateEvPlan — honest, never invents battery state ──
ok('no distance → ok:false', P.estimateEvPlan({}).ok === false);
var noRange = P.estimateEvPlan({ miles: 480 });
ok('distance but no range → rangeKnown:false (no fabricated battery)', noRange.ok === true && noRange.rangeKnown === false && noRange.stops === null);
var short = P.estimateEvPlan({ miles: 100, rangeMiles: 300 });
ok('short trip (100mi/300range) → 0 stops', short.rangeKnown === true && short.stops === 0);
ok('short trip arrival ≈ 90 − 100/300*100 ≈ 57%', short.arrivalPct === 57);
var long = P.estimateEvPlan({ miles: 500, rangeMiles: 300 });
ok('long trip (500mi/300range, 90/15/80) → 2 stops', long.stops === 2);
ok('long trip arrivalPct null when stops>0', long.arrivalPct === null);
ok('assumptions echoed (range/start/reserve/chargeTo)', long.assumptions.rangeMiles === 300 && long.assumptions.startPct === 90 && long.assumptions.reservePct === 15 && long.assumptions.chargeToPct === 80);
ok('custom reserve respected (bigger usable window → fewer/zero stops)', P.estimateEvPlan({ miles: 200, rangeMiles: 300, startPct: 100, reservePct: 5 }).stops === 0);

// ── goldenHour — real astronomical math (San Diego, July 1) ──
var gh = P.goldenHour('2026-07-01', 32.72, -117.16, -7);
ok('goldenHour returns an object for valid coords', !!gh);
ok('San Diego July sunrise is in the morning (~5–7 AM)', gh && gh.sunriseMin > 300 && gh.sunriseMin < 420);
ok('San Diego July sunset is in the evening (~7–8:30 PM)', gh && gh.sunsetMin > 1140 && gh.sunsetMin < 1270);
ok('morning golden hour starts at sunrise', gh && gh.morningGolden.indexOf(gh.sunrise) === 0);
ok('evening golden hour ends at sunset', gh && gh.eveningGolden.indexOf(gh.sunset) === gh.eveningGolden.length - gh.sunset.length);
ok('missing coords → null (no fabricated time)', P.goldenHour('2026-07-01', null, null, -7) === null);

// ── fmtMin ──
ok('fmtMin 0 → 12:00 AM', P.fmtMin(0) === '12:00 AM');
ok('fmtMin 720 → 12:00 PM', P.fmtMin(720) === '12:00 PM');
ok('fmtMin 765 → 12:45 PM', P.fmtMin(765) === '12:45 PM');
ok('fmtMin 785 → 1:05 PM', P.fmtMin(785) === '1:05 PM');

// ── verifyOrLink — honesty gate ──
ok('empty → verify marker', P.verifyOrLink('', { label: 'Verify' }).verify === true);
ok('"pending verification" → verify marker', P.verifyOrLink('pending verification').verify === true);
ok('"$$$" (no real number) → verify marker', P.verifyOrLink('$$$').verify === true);
ok('"unknown" → verify marker', P.verifyOrLink('unknown').verify === true);
ok('real value "4.5★" → passes through', P.verifyOrLink('4.5★').verify === false && P.verifyOrLink('4.5★').text === '4.5★');
ok('verify marker carries label + url', (function () { var v = P.verifyOrLink(null, { label: 'Check hours', url: 'https://x' }); return v.verify && v.label === 'Check hours' && v.url === 'https://x'; })());

// ── estLabel ──
ok('estLabel adds "(est.)"', P.estLabel('2h 30m') === '2h 30m (est.)');
ok('estLabel empty → empty', P.estLabel('') === '');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
