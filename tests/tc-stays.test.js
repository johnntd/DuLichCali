'use strict';
// node tests/tc-stays.test.js — pure-module test (no DOM). Loads the browser IIFE like tc-tasks.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-stays.js'), 'utf8') + '\nreturn window.TCStays;';
const w = {}; const S = new Function('window', src)(w);
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// ── parsePriceMid — midpoint of a range; null when no real $ figure ──
ok('"$180–$320" → 250', S.parsePriceMid('$180–$320') === 250);
ok('"$180-$320/night" → 250', S.parsePriceMid('$180-$320/night') === 250);
ok('"$250" → 250', S.parsePriceMid('$250') === 250);
ok('"pending verification" → null', S.parsePriceMid('pending verification') === null);
ok('"$$$" → null', S.parsePriceMid('$$$') === null);
ok('"15% off" (no $) → null', S.parsePriceMid('15% off') === null);
ok('null → null', S.parsePriceMid(null) === null);

// ── computeStayTier — premium / best_value / budget by price; star fallback; server tier wins ──
var hotels = [
  { name: 'Hampton Inn', priceRange: '$180–$200' },
  { name: 'Hyatt Regency', priceRange: '$300–$340' },
  { name: 'Hotel del Coronado', priceRange: '$800–$900' },
];
ok('cheapest → budget', S.computeStayTier(hotels[0], hotels) === 'budget');
ok('mid → best_value', S.computeStayTier(hotels[1], hotels) === 'best_value');
ok('priciest → premium', S.computeStayTier(hotels[2], hotels) === 'premium');
ok('server-set tier wins', S.computeStayTier({ tier: 'premium', priceRange: '$90' }, hotels) === 'premium');
ok('no price + 4.6 star → premium (fallback)', S.computeStayTier({ starRating: '4.6' }, [{ starRating: '4.6' }]) === 'premium');
ok('no price + 3.8 star → best_value (fallback)', S.computeStayTier({ starRating: '3.8' }, [{ starRating: '3.8' }]) === 'best_value');
ok('no price + 3.0 star → budget (fallback)', S.computeStayTier({ starRating: '3.0' }, [{ starRating: '3.0' }]) === 'budget');

// ── stayPick — Alternatives lenses ──
var stay = { city: 'San Diego', hotels: [
  { name: 'Hampton Inn Mission Valley', priceRange: '$190', starRating: '4.0' },
  { name: 'Hyatt Regency Mission Bay', priceRange: '$320', starRating: '4.4', oceanDistance: 'Bayfront', familySuite: true, pool: true },
  { name: 'Hotel del Coronado', priceRange: '$850', starRating: '4.6', attractionDistances: [{ name: 'Beach', distance: '0.1 mi' }] },
  { name: 'Cozy Inn', priceRange: '$150', attractionDistances: [{ name: 'Zoo', distance: '8 mi' }] },
] };
ok('budget → cheapest ($150)', (S.stayPick(stay, 'budget') || {}).name === 'Cozy Inn');
ok('luxury → priciest ($850)', (S.stayPick(stay, 'luxury') || {}).name === 'Hotel del Coronado');
ok('points → chain brand (Hampton/Hyatt)', /Hampton|Hyatt/.test((S.stayPick(stay, 'points') || {}).name || ''));
ok('beachfront → has ocean/beach', /Hyatt|Coronado/.test((S.stayPick(stay, 'beachfront') || {}).name || ''));
ok('family → familySuite/pool', (S.stayPick(stay, 'family') || {}).name === 'Hyatt Regency Mission Bay');
ok('closest → nearest attraction (Coronado 0.1mi)', (S.stayPick(stay, 'closest') || {}).name === 'Hotel del Coronado');
ok('empty stay → null', S.stayPick({ hotels: [] }, 'budget') === null);
ok('unknown lens → null', S.stayPick(stay, 'zzz') === null);

// ── isPointsHotel / hasBeach ──
ok('Marriott → points', S.isPointsHotel({ name: 'Marriott Marquis' }) === true);
ok('"Cozy Inn" → not points', S.isPointsHotel({ name: 'Cozy Inn' }) === false);
ok('oceanDistance → beach', S.hasBeach({ name: 'X', oceanDistance: '0.2 mi' }) === true);
ok('"Bayfront Tower" → beach', S.hasBeach({ name: 'Bayfront Tower' }) === true);

// ── perNightBudget — nightly ceiling from the family's stated tier ──
ok('budget → 140', S.perNightBudget('budget') === 140);
ok('moderate → 240', S.perNightBudget('moderate') === 240);
ok('luxury → 600', S.perNightBudget('luxury') === 600);
ok('unknown → 240 (default)', S.perNightBudget('zzz') === 240);

// ── Acceptance scenario (Part 12): under a $250 cap, budget pick is the cheapest available ──
var underCap = { city: 'San Diego', hotels: [
  { name: 'Hyatt Mission Bay', priceRange: '$240' },
  { name: 'Hilton Garden Inn', priceRange: '$210' },
  { name: 'Hampton Inn', priceRange: '$190' },
] };
ok('budget pick under cap = cheapest ($190 Hampton)', (S.stayPick(underCap, 'budget') || {}).name === 'Hampton Inn');
ok('all three tiers represented under cap', (function () {
  var tiers = underCap.hotels.map(function (h) { return S.computeStayTier(h, underCap.hotels); });
  return tiers.indexOf('budget') !== -1 && tiers.indexOf('best_value') !== -1 && tiers.indexOf('premium') !== -1;
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
