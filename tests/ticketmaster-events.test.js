'use strict';
// node tests/ticketmaster-events.test.js — pure unit test for the Ticketmaster Discovery mapper.
const T = require('../functions/lib/ticketmasterEvents.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

ok('tmKeyPresent: real key', T.tmKeyPresent('abcdefghij1234567890') === true);
ok('tmKeyPresent: short/empty → false', T.tmKeyPresent('short') === false && T.tmKeyPresent('') === false && T.tmKeyPresent(null) === false);

// Full real-shaped event.
var ev = T.mapTicketmasterEvent({
  name: 'Padres vs Dodgers',
  url: 'https://www.ticketmaster.com/event/abc',
  dates: { start: { localDate: '2026-07-02', localTime: '19:10:00' } },
  priceRanges: [{ min: 25, max: 180, currency: 'USD' }],
  classifications: [{ segment: { name: 'Sports' } }],
  _embedded: { venues: [{ name: 'Petco Park', city: { name: 'San Diego' } }] },
});
ok('name mapped', ev.name === 'Padres vs Dodgers');
ok('date/time mapped', ev.date === '2026-07-02' && ev.time === '19:10:00');
ok('venue+city → location', ev.location === 'Petco Park, San Diego');
ok('Sports segment → other category', ev.category === 'other');
ok('real price → "(Ticketmaster)" label', ev.priceRange === '$25–$180 (Ticketmaster)');
ok('real https url kept', ev.eventUrl === 'https://www.ticketmaster.com/event/abc');
ok('source/verified stamped', ev.source === 'ticketmaster_live' && ev.verificationStatus === 'verified');
ok('ticketRequired true, family neutral, why empty', ev.ticketRequired === true && ev.familySuitability === 'all_ages' && ev.whyRecommended === '');

// Music segment → concert.
ok('Music → concert', T.mapTicketmasterEvent({ name: 'X', classifications: [{ segment: { name: 'Music' } }] }).category === 'concert');
ok('Arts & Theatre → show', T.mapTicketmasterEvent({ name: 'X', classifications: [{ segment: { name: 'Arts & Theatre' } }] }).category === 'show');

// No priceRanges → "pending verification" (never fabricated).
ok('no price → pending verification', T.mapTicketmasterEvent({ name: 'X' }).priceRange === 'pending verification');

// Non-http url dropped (no fabrication of links).
ok('bad url dropped', T.mapTicketmasterEvent({ name: 'X', url: 'javascript:alert(1)' }).eventUrl === '');

// sanitizeLiveEvents: drops nameless + avoid-listed, caps at 6.
var arr = [];
for (var i = 0; i < 9; i++) arr.push({ name: 'Ev' + i, classifications: [{ segment: { name: 'Music' } }] });
arr.push({ url: 'https://x' }); // nameless → dropped
var out = T.sanitizeLiveEvents(arr, { ev3: true });
ok('drops nameless + avoid-listed', out.every(function (e) { return e.name && e.name !== 'Ev3'; }));
ok('caps at 6', out.length === 6);
ok('garbage input safe', T.sanitizeLiveEvents(null).length === 0 && T.sanitizeLiveEvents('no').length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
