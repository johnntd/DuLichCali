'use strict';
// node tests/tc-tasks.test.js — pure-module test (no DOM). Loads the browser IIFE like pricing.test.js.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'tc-tasks.js'), 'utf8') + '\nreturn window.TCTasks;';
const w = {}; const T = new Function('window', src)(w);
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// ── priority(type) — P0 urgent / P1 important / P2 optional (the spec's tiers) ──
['flight', 'bus', 'train', 'rental_car', 'hotel', 'airbnb', 'attraction'].forEach(function (ty) {
  ok(ty + ' → P0', T.priority(ty) === 'P0');
});
['ride', 'restaurant', 'parking', 'tour'].forEach(function (ty) {
  ok(ty + ' → P1', T.priority(ty) === 'P1');
});
['packing', 'payment', 'confirmation', 'album', 'clips', 'other', 'zzz-unknown'].forEach(function (ty) {
  ok(ty + ' → P2', T.priority(ty) === 'P2');
});
ok('explicit priority override wins', T.priority('flight', { priority: 'P2' }) === 'P2');
ok('case-insensitive', T.priority('Flight') === 'P0');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
