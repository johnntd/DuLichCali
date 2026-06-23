'use strict';
// node tests/ticket-deals.test.js — pure unit test for the Ticket Deal Hunter sanitizer.
const T = require('../functions/lib/ticketDeals.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// Happy path: a well-formed deal survives, fields are kept.
var out = T.sanitizeTicketDeals({ deals: [
  { attraction: 'San Diego Zoo', city: 'San Diego', note: 'Multi-day is the smart play for a family', items: [
    { dealType: 'multi_day', title: '2-Visit Pass', description: 'Two days for a little more than one', savingsEstimate: '~20%', bookBy: 'buy online ahead', conditions: 'use within 7 days' },
    { dealType: 'family_bundle', title: 'Family 4-pack', description: 'Bundle for 2 adults + 2 kids', savingsEstimate: '$15–$30/ticket', bookBy: '', conditions: '' },
  ] },
] });
ok('valid deal kept', out.length === 1 && out[0].attraction === 'San Diego Zoo');
ok('items kept in order', out[0].items.length === 2 && out[0].items[0].dealType === 'multi_day');
ok('savingsEstimate preserved', out[0].items[0].savingsEstimate === '~20%');

// dealType not in the whitelist → coerced to 'other'.
var coerce = T.sanitizeTicketDeals({ deals: [{ attraction: 'X', items: [{ dealType: 'flash_sale', title: 'T' }] }] });
ok('unknown dealType → other', coerce[0].items[0].dealType === 'other');

// savingsEstimate defaults to "pending verification" when missing (never blank, never a fake price).
var noSave = T.sanitizeTicketDeals({ deals: [{ attraction: 'X', items: [{ dealType: 'early_bird', title: 'Advance' }] }] });
ok('missing savings → pending verification', noSave[0].items[0].savingsEstimate === 'pending verification');
ok('dataSource stamped pending', noSave[0].items[0].dataSource === 'ai_researched_pending_verification');

// Empty items (no title + no description) are dropped; a deal with no surviving items is dropped.
var empty = T.sanitizeTicketDeals({ deals: [
  { attraction: 'A', items: [{ dealType: 'group' }] },                       // item has neither title nor desc → dropped → deal dropped
  { attraction: 'B', items: [{ dealType: 'combo', description: 'Bundle' }] }, // survives on description alone
] });
ok('item with no title/desc dropped → deal dropped', empty.length === 1 && empty[0].attraction === 'B');

// A deal with no attraction is dropped.
ok('no-attraction deal dropped', T.sanitizeTicketDeals({ deals: [{ items: [{ title: 'x' }] }] }).length === 0);

// Caps: ≤12 deals, ≤4 items each.
var many = { deals: [] };
for (var i = 0; i < 20; i++) { var its = []; for (var j = 0; j < 8; j++) its.push({ dealType: 'other', title: 'T' + j }); many.deals.push({ attraction: 'Z' + i, items: its }); }
var capped = T.sanitizeTicketDeals(many);
ok('caps to 12 deals', capped.length === 12);
ok('caps to 4 items', capped[0].items.length === 4);

// Length clamps.
var long = T.sanitizeTicketDeals({ deals: [{ attraction: 'q'.repeat(300), items: [{ dealType: 'other', title: 't'.repeat(300), description: 'd'.repeat(500) }] }] });
ok('attraction clamped to 120', long[0].attraction.length === 120);
ok('title clamped to 80, description to 200', long[0].items[0].title.length === 80 && long[0].items[0].description.length === 200);

// Garbage / empty input is safe.
ok('null/garbage → []', T.sanitizeTicketDeals(null).length === 0 && T.sanitizeTicketDeals({}).length === 0 && T.sanitizeTicketDeals({ deals: 'nope' }).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
