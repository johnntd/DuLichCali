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

// ── computeBalances(tasks, families, split, ledger) — per-family owed/paid/balance + rollup ──
var fams = [{ id: 'a', name: 'A', travelers: 2 }, { id: 'b', name: 'B', travelers: 2 }];
var bal = T.computeBalances([{ actualCost: '100', paidBy: 'a' }], fams, { mode: 'equal' }, []);
ok('equal split → owed 50/50', bal.perFamily[0].owed === 50 && bal.perFamily[1].owed === 50);
ok('payer credited 100', bal.perFamily[0].paid === 100 && bal.perFamily[1].paid === 0);
ok('balance = owed − paid', bal.perFamily[0].balance === -50 && bal.perFamily[1].balance === 50);
ok('totalPaid 100, remaining 0 when fully paid', bal.totalPaid === 100 && bal.remaining === 0);
var bal2 = T.computeBalances([{ costEstimate: '$200' }], fams, { mode: 'per_person' }, []);
ok('per_person by headcount 100/100', bal2.perFamily[0].owed === 100 && bal2.perFamily[1].owed === 100);
ok('estimate unpaid → remaining 200', bal2.remaining === 200 && bal2.totalPaid === 0);
var bal3 = T.computeBalances([{ actualCost: '120', paidBy: 'a', splitBetween: ['a'] }], fams, { mode: 'per_person' }, []);
ok('splitBetween limits to A', bal3.perFamily[0].owed === 120 && bal3.perFamily[1].owed === 0);
var bal4 = T.computeBalances([], fams, { mode: 'per_person' }, [{ familyId: 'b', amount: 50, paid: true }]);
ok('ad-hoc ledger payment credited', bal4.perFamily[1].paid === 50);
var bal5 = T.computeBalances([{ actualCost: '300', paidBy: 'a' }], fams, { mode: 'owner_pays' }, []);
ok('owner_pays → first family owes all', bal5.perFamily[0].owed === 300 && bal5.perFamily[1].owed === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
