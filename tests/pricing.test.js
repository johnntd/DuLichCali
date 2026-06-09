#!/usr/bin/env node
'use strict';
// tests/pricing.test.js — Ride / Airport pricing regression harness
//
// Run:  node tests/pricing.test.js   (or: npm run test:pricing)
//
// Guards the fix for the "$120 for a 10-mile / 3-passenger airport pickup" bug.
// Root cause was the flat dlcMin floors ($100/$120/$140) in pricing.js. This
// harness loads the REAL pricing.js (pure functions) and asserts competitive,
// non-multiplying, once-per-trip-airport-fee behavior.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Load the real DLCPricing module (browser IIFE, no module.exports) ──
function loadPricing() {
  const src = fs.readFileSync(path.join(ROOT, 'pricing.js'), 'utf8') + '\nreturn DLCPricing;';
  // window passed as undefined → region guards fall back to SoCal defaults
  return new Function('window', src)(undefined);
}
const P = loadPricing();

// ── Tiny assert framework ──
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else      { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.5 : tol); }

// Maps-equivalent duration: ride-intake gets real durations; we model ~35 mph.
const dur = miles => Math.round((miles / 35) * 60);
const q   = (miles, pax, opts) =>
  P.quoteRide(miles, dur(miles), Object.assign({ passengers: pax }, opts || {}));

console.log('\nRide / Airport pricing tests\n');

// 1) 10-mile airport pickup, 1 passenger → competitive sedan price (not $100+)
const t1 = q(10, 1, { airport: true });
ok('1. 10mi airport pickup, 1 pax → Tesla, competitive (<=$50)',
   t1.vehicleName === 'Tesla Model Y' && t1.dlcPrice <= 50 && t1.dlcPrice < 100,
   'got $' + t1.dlcPrice + ' / ' + t1.vehicleName);

// 2) 10-mile airport pickup, 3 passengers → THE REPRO. Must NOT be $120/$100.
const t2 = q(10, 3, { airport: true });
ok('2. 10mi airport pickup, 3 pax (SoCal) → NOT $120 and NOT $100',
   t2.dlcPrice !== 120 && t2.dlcPrice !== 100 && t2.dlcPrice <= 50,
   'got $' + t2.dlcPrice + ' / ' + t2.vehicleName);

// 2b) Bay Area variant — was forced to Sienna ($120/$70); now picks Model Y like SoCal
const t2b = q(10, 3, { airport: true, regionId: 'bayarea' });
ok('2b. 10mi airport pickup, 3 pax (Bay Area) → Model Y, competitive (<=$40, not $120)',
   t2b.vehicleName === 'Tesla Model Y' && t2b.dlcPrice !== 120 && t2b.dlcPrice <= 40,
   'got $' + t2b.dlcPrice + ' / ' + t2b.vehicleName);

// 3) 10-mile airport pickup, 4 passengers → bumps to Sienna (modest surcharge)
const t3 = q(10, 4, { airport: true });
ok('3. 10mi airport pickup, 4 pax → Toyota Sienna, competitive (<=$60)',
   t3.vehicleName === 'Toyota Sienna' && t3.dlcPrice <= 60 && t3.dlcPrice !== 120,
   'got $' + t3.dlcPrice + ' / ' + t3.vehicleName);

// 4) 10-mile airport pickup, 5 passengers → Sienna, same tier as 4 pax
const t4 = q(10, 5, { airport: true });
ok('4. 10mi airport pickup, 5 pax → Toyota Sienna, competitive (<=$60)',
   t4.vehicleName === 'Toyota Sienna' && t4.dlcPrice <= 60,
   'got $' + t4.dlcPrice + ' / ' + t4.vehicleName);

// 5) 20-mile airport pickup, 3 passengers → metered scales with distance
const t5 = q(20, 3, { airport: true });
ok('5. 20mi airport pickup, 3 pax → distance-scaled, > 10mi price, competitive (<=$80)',
   t5.dlcPrice > t2.dlcPrice && t5.dlcPrice <= 80,
   'got $' + t5.dlcPrice + ' (10mi was $' + t2.dlcPrice + ')');

// 6) Shared ride vs private ride → shared must be cheaper
const t6 = q(10, 3, { airport: true });
ok('6. Shared ride < private ride',
   t6.sharedPrice < t6.dlcPrice && t6.sharedPrice > 0,
   'private $' + t6.dlcPrice + ' / shared $' + t6.sharedPrice);

// 7) Passenger count does NOT multiply the full fare
const p1 = q(10, 1, { airport: true }).dlcPrice;
const p3 = q(10, 3, { airport: true }).dlcPrice;
const p4 = q(10, 4, { airport: true }).dlcPrice;
ok('7a. Same vehicle: 1 pax == 3 pax (no per-passenger multiply)',
   p1 === p3, '1pax $' + p1 + ' vs 3pax $' + p3);
ok('7b. 3 pax does NOT triple the 1-pax fare',
   p3 < p1 * 2, '1pax $' + p1 + ' → 3pax $' + p3);
ok('7c. 4 pax (bigger vehicle) is a modest surcharge, not a multiple',
   p4 < p1 * 2, '1pax $' + p1 + ' → 4pax $' + p4);

// 8) Minimum fare does not force $120 for any short (10mi) ride
const shortPrices = [1, 3, 4, 5, 7].map(n => q(10, n, { airport: true }).dlcPrice);
ok('8. No short-ride quote is forced to $120 (max <=$60)',
   shortPrices.every(p => p !== 120 && p <= 60),
   'prices: ' + shortPrices.map(p => '$' + p).join(', '));

// 9) Airport surcharge applies ONCE, not per passenger
const a1 = q(10, 1, { airport: true });
const a3 = q(10, 3, { airport: true });
const aN = q(10, 1, { airport: false });
ok('9a. airportFee is identical for 1 vs 3 passengers (once per trip)',
   a1.airportFee === a3.airportFee && a1.airportFee === 5,
   '1pax fee $' + a1.airportFee + ' / 3pax fee $' + a3.airportFee);
ok('9b. airportFee absent on non-airport ride; present on airport ride',
   aN.airportFee === 0 && a1.airportFee === 5,
   'airport $' + a1.airportFee + ' / non-airport $' + aN.airportFee);

// 10) Final booking price matches the displayed quote (static source contract)
// ride-intake.js saves estimatedPrice from the SAME _quote.dlcPrice it displays.
const intakeSrc = fs.readFileSync(path.join(ROOT, 'ride-intake.js'), 'utf8');
ok('10a. ride-intake saves estimatedPrice from _quote.dlcPrice (saved == quoted)',
   /estimatedPrice:\s*_quote\s*\?\s*_quote\.dlcPrice/.test(intakeSrc),
   'estimatedPrice mapping not found in ride-intake.js');
ok('10b. ride-intake displays the same _quote.dlcPrice it saves',
   /riPriceAmt'[^]*?_quote/.test(intakeSrc) || /\$' \+ q\.dlcPrice/.test(intakeSrc) || /q\.dlcPrice/.test(intakeSrc),
   'display of dlcPrice not found');

// Cross-engine consistency: transferCost (AI chat / wizard) is also competitive
ok('11. transferCost (AI/wizard) 10mi 3pax is competitive (<=$60, not $120/$100)',
   (() => { const c = P.transferCost(10, 3); return c <= 60 && c !== 120 && c !== 100; })(),
   'transferCost(10,3) = $' + P.transferCost(10, 3));

// 12) Deadhead (driver→pickup) is NOT billed to the customer (matches UberX).
const dh = (m, d) => P.quoteRide(m, dur(m), { passengers: 1, airport: true, deadheadMiles: d }).dlcPrice;
ok('12a. deadhead does NOT change the fare (0 vs 18mi identical)',
   dh(11, 0) === dh(11, 18), '0dh=$' + dh(11, 0) + ' / 18dh=$' + dh(11, 18));
ok('12b. a far driver (50mi away) does NOT inflate the fare',
   dh(11, 50) === dh(11, 0), '0dh=$' + dh(11, 0) + ' / 50dh=$' + dh(11, 50));

// 13) Bay Area picks the Tesla Model Y (sedan rate) for ≤3 pax — the SJ→SJC fix.
const ba1 = P.quoteRide(11, dur(11), { passengers: 1, airport: true, regionId: 'bayarea', deadheadMiles: 10 });
const sc1 = P.quoteRide(11, dur(11), { passengers: 1, airport: true });
ok('13a. Bay Area ≤3 pax → Tesla Model Y (was forced to Sienna)',
   ba1.vehicleName === 'Tesla Model Y', 'got ' + ba1.vehicleName);
ok('13b. SJ→SJC 1 pax (Bay Area) is competitive (~$35, was $70)',
   ba1.dlcPrice <= 40, 'got $' + ba1.dlcPrice);
ok('13c. Bay Area price == SoCal price for the same ride (no region penalty)',
   ba1.dlcPrice === sc1.dlcPrice, 'BA=$' + ba1.dlcPrice + ' / SoCal=$' + sc1.dlcPrice);
ok('13d. Bay Area 4–7 pax still gets the Sienna',
   P.quoteRide(10, dur(10), { passengers: 5, airport: true, regionId: 'bayarea' }).vehicleName === 'Toyota Sienna',
   'got ' + P.quoteRide(10, dur(10), { passengers: 5, airport: true, regionId: 'bayarea' }).vehicleName);

console.log('\n  RESULT: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
