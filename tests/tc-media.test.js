'use strict';
// node tests/tc-media.test.js — pure-module test (no DOM). Loads the browser IIFE like pricing.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-media.js'), 'utf8') + '\nreturn window.TCMedia;';
const w = {}; const M = new Function('window', src)(w);
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }
function types(arr) { return arr.map(function (x) { return x.type; }); }

// Deterministic baseline links are honest by construction: every item is a SEARCH link.
function allSearch(arr) { return arr.length && arr.every(function (x) { return x.verificationStatus === 'search' && x.url && x.title; }); }
function noWatch(arr) { return arr.every(function (x) { return !/watch\?v=|youtu\.be|\/embed\//.test(x.url); }); }

// RESTAURANT — menu first; includes reviews + yelp + youtube food review; honest.
var r = M.build({ name: 'Pho 79' }, 'restaurant', 'Garden Grove');
ok('restaurant leads with menu', r[0].type === 'menu');
ok('restaurant has google_reviews + yelp + youtube_search', types(r).indexOf('google_reviews') !== -1 && types(r).indexOf('yelp_reviews') !== -1 && types(r).indexOf('youtube_search') !== -1);
ok('restaurant all search-links + no watch urls', allSearch(r) && noWatch(r));
ok('restaurant youtube is a results search', r.filter(function (x) { return x.type === 'youtube_search'; })[0].url.indexOf('youtube.com/results?search_query=') !== -1);
ok('restaurant menu url is name+city menu search', /google\.com\/search/.test(r[0].url) && /menu/i.test(decodeURIComponent(r[0].url)));

// TOUR — official + ticket + youtube + reviews.
var to = M.build({ name: 'San Diego SEAL Tour' }, 'tour', 'San Diego');
ok('tour has official_site + ticket + youtube_search + google_reviews', ['official_site', 'ticket', 'youtube_search', 'google_reviews'].every(function (t) { return types(to).indexOf(t) !== -1; }));
ok('tour all search-links', allSearch(to) && noWatch(to));

// SCENIC/STOPOVER — map first + travel-guide youtube.
var sc = M.build({ name: 'La Jolla Cove' }, 'scenic', 'San Diego');
ok('scenic leads with map', sc[0].type === 'map');
ok('scenic has youtube travel guide', sc.filter(function (x) { return x.type === 'youtube_search'; })[0].url.toLowerCase().indexOf('travel') !== -1 || /guide/i.test(decodeURIComponent(sc.filter(function (x) { return x.type === 'youtube_search'; })[0].url)));

// EVENT with a safe eventUrl → official_site becomes ai_suggested with that real url.
var ev = M.build({ name: 'July 4 Fireworks', eventUrl: 'https://www.portofsandiego.org/fireworks' }, 'event', 'San Diego');
var off = ev.filter(function (x) { return x.type === 'official_site'; })[0];
ok('event official_site uses safe eventUrl as ai_suggested', off && off.url === 'https://www.portofsandiego.org/fireworks' && off.verificationStatus === 'ai_suggested');
// EVENT with no/unsafe url → official_site is a search link.
var ev2 = M.build({ name: 'Night Market' }, 'event', 'San Diego');
ok('event without url → official_site is search', ev2.filter(function (x) { return x.type === 'official_site'; })[0].verificationStatus === 'search');

// HOTEL — reviews + tripadvisor + photos + map.
var h = M.build({ name: 'Hotel del Coronado' }, 'hotel', 'San Diego');
ok('hotel has google_reviews + tripadvisor', ['google_reviews', 'tripadvisor'].every(function (t) { return types(h).indexOf(t) !== -1; }));

// Unknown type still yields a safe minimal set (map + reviews + youtube), never empty/crash.
var u = M.build({ name: 'Somewhere' }, 'mystery', 'Nowhere');
ok('unknown type → non-empty honest fallback', u.length > 0 && allSearch(u) && noWatch(u));

// ytSearch / tiktokSearch exposed + correct.
ok('ytSearch builds results url', M.ytSearch('a b').indexOf('youtube.com/results?search_query=') === 0 || M.ytSearch('a b').indexOf('https://www.youtube.com/results?search_query=') === 0);
ok('tiktokSearch builds search url', /tiktok\.com\/search\?q=/.test(M.tiktokSearch('x')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
