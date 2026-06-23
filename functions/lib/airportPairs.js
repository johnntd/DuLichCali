'use strict';
// Map a California metro (free-text city string) → candidate airports, and build airport-PAIR
// flight search links (e.g. SJC → SAN) instead of a single generic city query — so the traveler
// compares real origin×destination airport combinations. Prices stay ESTIMATES / search links
// (there is NO live fare API), and "best-for" is an HONEST airport characteristic — closest hub,
// low-cost/budget alternate, or most-flights hub — NEVER a fabricated price ranking.
//
// Used by tcBuildTransportLegs (functions/index.js) to enrich the flight option's bookingLinks.
// Region keys mirror AIRPORT_REGION_CF in functions/index.js.

// region → airports, ordered: primary (closest/most convenient) first, then alternates.
// bestFor is an honest descriptor key resolved to UI text on the frontend (apf_*).
var REGION_AIRPORTS = {
  bayarea:     [ { code: 'SJC', name: 'San Jose', bestFor: 'closest' }, { code: 'SFO', name: 'San Francisco', bestFor: 'mostflights' }, { code: 'OAK', name: 'Oakland', bestFor: 'budget' } ],
  socal:       [ { code: 'SNA', name: 'Santa Ana (John Wayne)', bestFor: 'closest' }, { code: 'LGB', name: 'Long Beach', bestFor: 'budget' }, { code: 'LAX', name: 'Los Angeles', bestFor: 'mostflights' }, { code: 'BUR', name: 'Burbank', bestFor: 'budget' }, { code: 'ONT', name: 'Ontario', bestFor: 'budget' } ],
  sandiego:    [ { code: 'SAN', name: 'San Diego', bestFor: 'closest' } ],
  sacramento:  [ { code: 'SMF', name: 'Sacramento', bestFor: 'closest' } ],
  palmsprings: [ { code: 'PSP', name: 'Palm Springs', bestFor: 'closest' } ],
};

// city keyword → region. Most specific regions first so e.g. "San Diego" doesn't fall into SoCal.
var CITY_REGION = [
  [/\bsan diego\b|\bla jolla\b|\bchula vista\b|\bcoronado\b|\bcarlsbad\b|\boceanside\b|\bescondido\b/i, 'sandiego'],
  [/\bsacramento\b|\bdavis\b|\broseville\b|\bfolsom\b|\belk grove\b/i, 'sacramento'],
  [/\bpalm springs\b|\bcoachella\b|\bindio\b|\bla quinta\b/i, 'palmsprings'],
  [/\bsan jose\b|\bsan francisco\b|\boakland\b|\bsanta clara\b|\bsunnyvale\b|\bfremont\b|\bsan mateo\b|\bberkeley\b|\bmilpitas\b|\bcupertino\b|\bpalo alto\b|\bmountain view\b|\bsanta cruz\b|\bbay area\b|\bsilicon valley\b/i, 'bayarea'],
  [/\bsanta ana\b|\banaheim\b|\borange county\b|\birvine\b|\bgarden grove\b|\bwestminster\b|\blittle saigon\b|\bhuntington beach\b|\bcosta mesa\b|\bfullerton\b|\blong beach\b|\blos angeles\b|\bhollywood\b|\bburbank\b|\bglendale\b|\bpasadena\b|\bontario\b|\briverside\b|\bsan bernardino\b|\btorrance\b|\bsanta monica\b|\bsocal\b|\bl\.?a\.?\b/i, 'socal'],
];

function regionForCity(city) {
  var s = String(city || '');
  for (var i = 0; i < CITY_REGION.length; i++) { if (CITY_REGION[i][0].test(s)) return CITY_REGION[i][1]; }
  return '';
}

function airportsForCity(city) {
  var r = regionForCity(city);
  return (r && REGION_AIRPORTS[r]) ? REGION_AIRPORTS[r].slice() : [];
}

function flightUrlFor(fromCode, toCode) {
  return 'https://www.google.com/travel/flights?q=' + encodeURIComponent('flights from ' + fromCode + ' to ' + toCode);
}

// Up to opts.maxPairs (default 3) airport-pair links: primary×primary first (closest/most
// convenient), then alternate destination airports, then alternate origin airports. Each link
// carries a code-pair label ("SJC → SAN") + a bestForKey (apf_closest|apf_budget|apf_mostflights).
// Returns [] when EITHER city isn't a known California metro — the caller keeps the generic link.
function airportPairLinks(fromCity, toCity, opts) {
  opts = opts || {};
  var max = opts.maxPairs || 3;
  var froms = airportsForCity(fromCity), tos = airportsForCity(toCity);
  if (!froms.length || !tos.length) return [];
  var pairs = [], seen = {};
  function add(f, tt) {
    if (!f || !tt || f.code === tt.code) return;
    var k = f.code + '>' + tt.code; if (seen[k]) return; seen[k] = 1;
    // Prefer the destination's characteristic; fall back to the origin's, else "closest".
    var bf = (tt.bestFor && tt.bestFor !== 'closest') ? tt.bestFor : (f.bestFor || tt.bestFor || 'closest');
    pairs.push({ from: f.code, to: tt.code, label: f.code + ' → ' + tt.code, bestForKey: 'apf_' + bf, url: flightUrlFor(f.code, tt.code) });
  }
  add(froms[0], tos[0]);
  for (var ti = 1; ti < tos.length && pairs.length < max; ti++) add(froms[0], tos[ti]);
  for (var fi = 1; fi < froms.length && pairs.length < max; fi++) add(froms[fi], tos[0]);
  return pairs.slice(0, max);
}

module.exports = {
  regionForCity: regionForCity,
  airportsForCity: airportsForCity,
  airportPairLinks: airportPairLinks,
  flightUrlFor: flightUrlFor,
  REGION_AIRPORTS: REGION_AIRPORTS,
};
