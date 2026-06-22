/* driverRanking.js — pure, node-testable helper for ride dispatch (see tests/driver-ranking.test.js).
 * Ranks already-eligible drivers so a vehicle that FITS the party is offered first. It NEVER
 * excludes a driver: a valid booking must always get a driver (capacity is a preference, not a
 * gate — driver seat data may be the admin default or missing). Distance/owner ranking is a future
 * phase (no reliable server-side pickup coords / owner→driver link today). No Firebase deps. */
'use strict';

function seatsOf(d) {
  var s = parseInt(d && d.vehicle && d.vehicle.seats, 10);
  return s > 0 ? s : 0; // 0 = unknown/unset capacity
}

// tier: 0 = known to fit (seats>=pax, best) · 1 = unknown capacity (neutral) · 2 = known too small
// (still eligible as a last-resort fallback so a valid booking is never dead-ended).
function _tier(d, pax) {
  var s = seatsOf(d);
  if (s === 0) return 1;
  return s >= pax ? 0 : 2;
}

function rankDriversByFit(drivers, passengers) {
  var pax = Number(passengers) || 1;
  return (drivers || []).slice().sort(function (a, b) {
    var ta = _tier(a, pax), tb = _tier(b, pax);
    if (ta !== tb) return ta - tb;
    return seatsOf(b) - seatsOf(a); // within a tier, larger vehicle first (closer fit for big parties)
  });
}

module.exports = { rankDriversByFit: rankDriversByFit, seatsOf: seatsOf };
