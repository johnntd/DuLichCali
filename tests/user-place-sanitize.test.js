'use strict';
// node tests/user-place-sanitize.test.js  — pure-function test, no emulator.
const S = require('../functions/lib/userPlaceSanitize.js');
let pass = 0, fail = 0;
function ok(name, cond) { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL ') + name); }

// priceRange: only $/$$/$$$ or a numeric range survives; anything else → 'pending verification'
ok('price $$ kept', S.sanitizeUserPlace({ priceRange: '$$' }, {}).priceRange === '$$');
ok('price "$20" range kept', S.sanitizeUserPlace({ priceRange: '$15-$25' }, {}).priceRange === '$15-$25');
ok('price prose blanked', S.sanitizeUserPlace({ priceRange: 'about twenty bucks' }, {}).priceRange === 'pending verification');

// phone is always stripped
ok('phone stripped', S.sanitizeUserPlace({ phone: '714-555-1212', name: 'X' }, {}).phone === undefined);

// guessed URLs blanked; official-looking domain kept
ok('guessed reservationUrl blanked', S.sanitizeUserPlace({ reservationUrl: 'http://book-pho79-now.example' }, {}).reservationUrl === '');
ok('opentable reservationUrl kept', S.sanitizeUserPlace({ reservationUrl: 'https://www.opentable.com/r/pho-79' }, {}).reservationUrl === 'https://www.opentable.com/r/pho-79');

// maps URLs are BUILT, never taken from the model
const m = S.sanitizeUserPlace({ name: 'Pho 79', address: 'Garden Grove, CA', googleMapsUrl: 'http://evil.example' }, {});
ok('googleMapsUrl rebuilt', m.googleMapsUrl.indexOf('google.com/maps') !== -1 && m.googleMapsUrl.indexOf('evil') === -1);

// dataSource forced to the pending tag so the client honesty marker fires
ok('dataSource forced pending', S.sanitizeUserPlace({ name: 'X', dataSource: 'verified' }, {}).dataSource === 'ai_researched_pending_verification');

// no photos field can come from the model (photos are added separately, deterministically)
ok('model photos dropped', S.sanitizeUserPlace({ name: 'X', photos: [{ url: 'http://ai.example/img' }] }, {}).photos === undefined);

// rating/reviewCount: only grounded-looking values survive; prose blanked
ok('rating star kept', S.sanitizeUserPlace({ rating: '4.6★' }, {}).rating === '4.6★');
ok('rating prose blanked', S.sanitizeUserPlace({ rating: '5.0★ BEST IN OC' }, {}).rating === '');
ok('reviewCount 2k+ kept', S.sanitizeUserPlace({ reviewCount: '2k+' }, {}).reviewCount === '2k+');
ok('reviewCount prose blanked', S.sanitizeUserPlace({ reviewCount: 'millions of reviews' }, {}).reviewCount === '');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
