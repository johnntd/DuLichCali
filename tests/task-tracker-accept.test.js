'use strict';
// node tests/task-tracker-accept.test.js — Task Tracker P1 acceptance.
// Evals the real travel-concierge.js IIFE (like the Day-3 integration test) and runs the
// deterministic generator on the spec's Bus Hoang + Michael trip; asserts the 8 expected tasks.
const fs = require('fs');
const noopEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {}, append() {}, hidden: false });
const stub = { document: { readyState: 'loading', addEventListener() {}, createElement: noopEl, getElementById: () => null, body: noopEl(), querySelector: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: { language: 'en' }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), location: { search: '', href: '' }, setTimeout: setTimeout, clearTimeout: clearTimeout };
['tc-journey-days.js', 'tc-media.js', 'tc-tasks.js', 'travel-concierge.js'].forEach(function (f) { new Function('window', fs.readFileSync(f, 'utf8'))(stub); });
const TC = stub.TravelConcierge;
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

const trip = {
  id: 'trip-accept', destination: 'San Diego, Orange County', departureCity: 'San Jose', dateRange: '2026-07-01 - 2026-07-04',
  families: [{ id: 'fam1', name: 'Smith' }], votes: {}, favorites: {}, bookings: [],
  destinations: [
    { id: 'd_sd', city: 'San Diego', hotelNeeded: true, arrivalDate: '2026-07-01', departureDate: '2026-07-03' },
    { id: 'd_oc', city: 'Orange County', hotelNeeded: true, arrivalDate: '2026-07-03', departureDate: '2026-07-04' },
  ],
  lockedLegs: [
    { fromCity: 'San Jose', toCity: 'Orange County', transportMode: 'bus', provider: 'Bus Hoang', date: '2026-07-01', segmentType: 'transport' },
    { fromCity: 'Orange County', toCity: 'San Diego', transportMode: 'private_ride', provider: 'Michael', date: '2026-07-01', segmentType: 'transfer' },
    { fromCity: 'San Diego', toCity: 'Orange County', transportMode: 'private_ride', provider: 'Michael', date: '2026-07-03', segmentType: 'transfer' },
    { fromCity: 'Orange County', toCity: 'San Jose', transportMode: 'bus', provider: 'Bus Hoang', date: '2026-07-04', segmentType: 'return' },
  ],
  pinnedActivities: [{ id: 'pin1', title: 'Vietnamese food', destination: 'Orange County', preferredTimeOfDay: 'dinner', priority: 'preferred' }],
  plan: { destinations: [{ city: 'San Diego' }, { city: 'Orange County' }], days: [{ destinationIndex: 0, sections: [{ places: [{ id: 'p_zoo', name: 'San Diego Zoo', category: 'zoo' }] }] }] },
};
TC._state.trip = trip; TC._state.lang = 'en';
const tasks = TC._deriveTripTasks(trip);
function has(pred) { return tasks.filter(pred)[0]; }
function titleHas() { var a = arguments; return function (t) { var s = (t.title || '').toLowerCase(); for (var i = 0; i < a.length; i++) if (s.indexOf(a[i].toLowerCase()) === -1) return false; return true; }; }

var t1 = has(function (t) { return t.type === 'bus' && titleHas('bus hoang', 'san jose', 'orange county')(t); });
ok('1. Book Bus Hoang outbound (bus, P0)', !!t1 && t1.priority === 'P0');
var t2 = has(function (t) { return t.type === 'ride' && titleHas('michael', 'orange county', 'san diego')(t); });
ok('2. Confirm Michael OC→SD ride (ride, P1)', !!t2 && t2.priority === 'P1');
var t3 = has(function (t) { return t.type === 'hotel' && titleHas('san diego')(t); });
ok('3. Book San Diego hotel (hotel, P0)', !!t3 && t3.priority === 'P0');
var t4 = has(function (t) { return t.type === 'attraction' && titleHas('san diego zoo')(t); });
ok('4. Buy San Diego Zoo tickets (attraction, P0)', !!t4 && t4.priority === 'P0');
var t5 = has(function (t) { return t.type === 'ride' && titleHas('michael', 'san diego', 'orange county')(t); });
ok('5. Confirm Michael SD→OC ride (ride, P1)', !!t5 && t5.priority === 'P1');
var t6 = has(function (t) { return t.type === 'hotel' && titleHas('orange county')(t); });
ok('6. Book Orange County hotel (hotel, P0)', !!t6 && t6.priority === 'P0');
var t7 = has(function (t) { return t.type === 'restaurant' && titleHas('vietnamese')(t); });
ok('7. Choose/vote Vietnamese dinner (restaurant, P1)', !!t7 && t7.priority === 'P1');
var t8 = has(function (t) { return t.type === 'bus' && titleHas('bus hoang', 'orange county', 'san jose')(t); });
ok('8. Book Bus Hoang return (bus, P0)', !!t8 && t8.priority === 'P0');

// Every task carries priority + status + (transport tasks) a linked segment.
ok('all tasks have a priority', tasks.every(function (t) { return /^P[012]$/.test(t.priority); }));
ok('all tasks have a status', tasks.every(function (t) { return !!t.bookingStatus; }));
ok('locked-leg tasks carry linkedSegmentId', [t1, t2, t5, t8].every(function (t) { return t && t.linkedSegmentId; }));
ok('re-run is idempotent (no duplicates)', (function () { var n = tasks.length; TC._deriveTripTasks(trip); return trip.bookings.length === n; })());

console.log('\n' + pass + ' passed, ' + fail + ' failed  (generated ' + tasks.length + ' tasks)');
process.exit(fail ? 1 : 0);
