'use strict';
// node tests/deal-threshold.test.js — pure unit test for the Deal Watch jitter guard.
const D = require('../functions/lib/dealThreshold.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// Real, meaningful flight deal: $400 → $350 = $50 / 12.5% drop → ALERT.
ok('big flight drop ($400→$350) alerts', D.isMeaningfulDrop(400, 350) === true);

// Estimate jitter: $300 → $295 = $5 / 1.7% → suppressed.
ok('small $ wobble ($300→$295) suppressed', D.isMeaningfulDrop(300, 295) === false);

// Big % but tiny $: $30 bus → $20 = $10 / 33%. $10 < $25 abs floor → suppressed (cheap leg noise).
ok('cheap-leg drop ($30→$20) suppressed by $ floor', D.isMeaningfulDrop(30, 20) === false);

// Big $ but tiny %: $1000 → $970 = $30 / 3%. 3% < 10% → suppressed (proportionally trivial).
ok('big-base small-% drop ($1000→$970) suppressed by % floor', D.isMeaningfulDrop(1000, 970) === false);

// Exactly on both thresholds: $250 → $225 = $25 / 10% → ALERT (>= both).
ok('exactly $25 and 10% ($250→$225) alerts', D.isMeaningfulDrop(250, 225) === true);

// Just under the % floor at the abs floor: $260 → $235 = $25 / 9.6% → suppressed.
ok('$25 drop but <10% ($260→$235) suppressed', D.isMeaningfulDrop(260, 235) === false);

// Price went UP or unchanged → never an alert.
ok('price up never alerts', D.isMeaningfulDrop(300, 360) === false);
ok('price unchanged never alerts', D.isMeaningfulDrop(300, 300) === false);

// Bad / missing input is safe (no alert, no throw).
ok('NaN / null input safe', D.isMeaningfulDrop(NaN, 100) === false && D.isMeaningfulDrop(null, null) === false && D.isMeaningfulDrop(0, 0) === false);

// Custom thresholds honored (e.g. a future per-trip sensitivity).
ok('custom thresholds honored', D.isMeaningfulDrop(100, 90, { absMin: 5, pctMin: 0.05 }) === true);

// Constants exported for the frontend mirror to match.
ok('constants exported', D.DEAL_MIN_DROP_ABS === 25 && D.DEAL_MIN_DROP_PCT === 0.10);

// parsePriceNumber — anchor a free-text hotel/ticket price; null when there's no real dollar figure.
ok('range → floor (low)', D.parsePriceNumber('$180–$240/night') === 180);
ok('single price', D.parsePriceNumber('$95') === 95);
ok('commas stripped', D.parsePriceNumber('$1,250') === 1250);
ok('$$$ → null (no number)', D.parsePriceNumber('$$$') === null);
ok('"pending verification" → null', D.parsePriceNumber('pending verification') === null);
ok('empty/null → null', D.parsePriceNumber('') === null && D.parsePriceNumber(null) === null);
ok('percent-only discount → null (not a price)', D.parsePriceNumber('~10-20%') === null);
ok('dollar discount range still parses', D.parsePriceNumber('$15–$30/ticket') === 15);
ok('absurd numbers filtered', D.parsePriceNumber('999999') === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
