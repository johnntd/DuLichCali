'use strict';
// node tests/place-media-sanitize.test.js — pure-function test, no emulator.
// Honesty clamp for AI-curated RecommendationMedia (Media Enrichment "Learn more").
const S = require('../functions/lib/placeMediaSanitize.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }
const seal = { name: 'San Diego SEAL Tour', city: 'San Diego' };

// VIDEO → always a YouTube SEARCH link; a specific watch/embed URL is NEVER kept.
var v = S.sanitizeMediaItems([{ type: 'youtube_official', title: 'Official video', url: 'https://www.youtube.com/watch?v=ABC123', reason: 'official clip' }], seal)[0];
ok('video forced to youtube SEARCH', v.url.indexOf('youtube.com/results?search_query=') !== -1 && v.url.indexOf('watch?v=') === -1);
ok('video verificationStatus=search', v.verificationStatus === 'search');
ok('video type normalized to youtube_search', v.type === 'youtube_search');
ok('video reason carried', v.reason === 'official clip');
var many = S.sanitizeMediaItems([{ type: 'review_video', url: 'https://youtu.be/xyz' }, { type: 'video', url: 'https://www.youtube.com/embed/zzz' }], seal);
ok('no watch/embed/youtu.be URL ever survives', many.every(function (x) { return !/watch\?v=|youtu\.be|\/embed\//.test(x.url); }));

// OFFICIAL/MENU/TICKET — safe https kept as ai_suggested; unsafe → deterministic search fallback.
var o = S.sanitizeMediaItems([{ type: 'official_site', url: 'https://www.sandiego.org/seal-tours' }], seal)[0];
ok('safe official kept as ai_suggested', o.url === 'https://www.sandiego.org/seal-tours' && o.verificationStatus === 'ai_suggested');
var o2 = S.sanitizeMediaItems([{ type: 'official_site', url: 'http://sealtour.example' }], seal)[0];
ok('insecure (http) official → search', /google\.com\/search/.test(o2.url) && o2.verificationStatus === 'search');
var o3 = S.sanitizeMediaItems([{ type: 'official_site', url: 'https://www.google.com/search?q=foo' }], seal)[0];
ok('search-engine URL mislabeled as official → rejected to search', o3.verificationStatus === 'search' && /search\?q=/.test(o3.url));
var m = S.sanitizeMediaItems([{ type: 'menu' }], { name: 'Pho 79', city: 'Garden Grove' })[0];
ok('menu with no url → name+city+menu search', /google\.com\/search/.test(m.url) && /menu/i.test(decodeURIComponent(m.url)) && m.verificationStatus === 'search');

// REVIEWS/MAP/PHOTOS — deterministic search links; an AI-supplied url is IGNORED (can't be trusted).
var g = S.sanitizeMediaItems([{ type: 'google_reviews', url: 'https://evil.example' }], { name: 'Brodard', city: 'Garden Grove' })[0];
ok('google_reviews deterministic, ignores AI url', g.url.indexOf('evil') === -1 && /google\.com\/search/.test(g.url) && /review/i.test(decodeURIComponent(g.url)));
var y = S.sanitizeMediaItems([{ type: 'yelp_reviews' }], { name: 'Brodard', city: 'Garden Grove' })[0];
ok('yelp_reviews → yelp search', /yelp\.com\/search\?find_desc=/.test(y.url) && y.verificationStatus === 'search');
var mp = S.sanitizeMediaItems([{ type: 'map' }], { name: 'La Jolla Cove', city: 'San Diego' })[0];
ok('map → google maps search', /google\.com\/maps\/search/.test(mp.url));
var tk = S.sanitizeMediaItems([{ type: 'tiktok' }], { name: 'La Jolla Cove', city: 'San Diego' })[0];
ok('tiktok → tiktok search', /tiktok\.com\/search/.test(tk.url) && tk.verificationStatus === 'search');

// Unknown type dropped; empty input safe.
ok('unknown type dropped', S.sanitizeMediaItems([{ type: 'weird_thing', url: 'https://x.example' }], seal).length === 0);
ok('empty input → []', S.sanitizeMediaItems(null, seal).length === 0);

// isSafeOfficialUrl unit checks (host-spoof + scheme).
ok('isSafeOfficialUrl: real https ok', S.isSafeOfficialUrl('https://www.legoland.com') === true);
ok('isSafeOfficialUrl: http rejected', S.isSafeOfficialUrl('http://x.com') === false);
ok('isSafeOfficialUrl: youtube rejected', S.isSafeOfficialUrl('https://youtube.com/watch?v=1') === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
