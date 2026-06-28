'use strict';
/* Pure unit tests for tc-decisions.js — the family DECISION-vote math + honest
 * display helpers. Node-only (no DOM/network). Run: node tests/tc-decisions.test.js
 * Covers the spec's required cases: 2/3 majority applies, 50/50 tie keeps original,
 * one vote per family, changing a vote re-tallies, original preserved until complete. */
const TC = require('../tc-decisions.js');
let pass = 0, fail = 0;
function ok(name, cond) { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL ') + name); }
function eq(name, a, b) { ok(name + ' (got ' + JSON.stringify(a) + ')', JSON.stringify(a) === JSON.stringify(b)); }

// Helper: build a 2-option decision (original = Zoo, alt = Disneyland) and a 3-option one.
function decision2() {
  return { id: 'd1', originalOptionId: 'zoo', options: [{ id: 'zoo', name: 'San Diego Zoo' }, { id: 'dis', name: 'Disneyland' }], votes: {} };
}
function decision3() {
  return { id: 'd2', originalOptionId: 'jp', options: [{ id: 'jp', name: 'Anjin (Japanese)' }, { id: 'kr', name: 'Mo Ran Gak (Korean)' }, { id: 'su', name: 'Ohshima (Sushi)' }], votes: {} };
}

// ── 1) 2 of 3 majority CHANGES the plan ──────────────────────────────────
(function () {
  var d = decision3(); // original = Japanese (jp)
  d.votes = { f1: 'kr', f2: 'kr', f3: 'jp' }; // 2 Korean, 1 Japanese
  var t = TC.tally(d, 3);
  ok('2/3 → all voted', t.allVoted === true);
  ok('2/3 → outcome majority', t.outcome === 'majority');
  eq('2/3 → winner is Korean', t.winner, 'kr');
  ok('2/3 → applies (winner != original)', t.applies === true);
  eq('2/3 → spread is 2–1', TC.tallySpread(t), [2, 1, 0]);
})();

// ── 2) 50/50 (and 3-way) TIE keeps the original ──────────────────────────
(function () {
  var d = decision2(); // original = Zoo
  d.votes = { f1: 'zoo', f2: 'dis' }; // 1–1 with 2 families
  var t = TC.tally(d, 2);
  ok('50/50 → all voted', t.allVoted === true);
  ok('50/50 → outcome tie', t.outcome === 'tie');
  ok('50/50 → no winner', t.winner === null);
  ok('50/50 → does NOT apply (original kept)', t.applies === false);

  var d3 = decision3();
  d3.votes = { f1: 'jp', f2: 'kr', f3: 'su' }; // 1–1–1
  var t3 = TC.tally(d3, 3);
  ok('3-way tie → outcome tie', t3.outcome === 'tie');
  ok('3-way tie → original kept', t3.applies === false);
})();

// ── 3) one vote per family per decision (votes is a map keyed by familyId) ─
(function () {
  var d = decision3();
  d.votes = { f1: 'kr' };
  d.votes['f1'] = 'jp'; // same family votes again → overwrites, not appends
  var t = TC.tally(d, 3);
  eq('one-per-family → f1 counted once for jp', t.counts.jp, 1);
  eq('one-per-family → kr has 0 (overwritten)', t.counts.kr, 0);
  eq('one-per-family → votedFamilies = 1', t.votedFamilies, 1);
})();

// ── 4) changing a vote updates the result correctly ──────────────────────
(function () {
  var d = decision2(); // original = Zoo
  d.votes = { f1: 'dis', f2: 'dis', f3: 'zoo' }; // 2 Disneyland → would apply Disneyland
  var t1 = TC.tally(d, 3);
  eq('change-vote → before: winner Disneyland', t1.winner, 'dis');
  ok('change-vote → before: applies', t1.applies === true);
  d.votes.f2 = 'zoo'; // f2 changes to Zoo → now 1 Disneyland, 2 Zoo
  var t2 = TC.tally(d, 3);
  eq('change-vote → after: winner Zoo (original)', t2.winner, 'zoo');
  ok('change-vote → after: does NOT apply (winner is original)', t2.applies === false);
})();

// ── 5) original plan preserved UNTIL vote is complete ────────────────────
(function () {
  var d = decision3();
  d.votes = { f1: 'kr', f2: 'kr' }; // 2 of 3 voted Korean, but f3 hasn't voted
  var t = TC.tally(d, 3);
  ok('incomplete → not all voted', t.allVoted === false);
  ok('incomplete → outcome pending', t.outcome === 'pending');
  ok('incomplete → does NOT apply yet', t.applies === false);
  eq('incomplete → remaining 1', t.remaining, 1);
  eq('incomplete → status waiting', t.status, 'waiting');
  // Only when the last family votes does it resolve:
  d.votes.f3 = 'kr';
  var t2 = TC.tally(d, 3);
  ok('complete → applies Korean now', t2.applies === true && t2.winner === 'kr');
})();

// ── Progress messaging inputs (UI builds the string from these) ──────────
(function () {
  var d = decision3(); d.votes = { f1: 'jp' };
  var t = TC.tally(d, 3);
  eq('progress → 1 of 3 voted', [t.votedFamilies, t.totalFamilies], [1, 3]);
  eq('progress → remaining 2', t.remaining, 2);
})();

// ── Winner-is-original with a clear majority → keep, do not "change" ──────
(function () {
  var d = decision2(); d.votes = { f1: 'zoo', f2: 'zoo', f3: 'dis' }; // 2 Zoo (original) vs 1
  var t = TC.tally(d, 3);
  eq('winner=original → winner zoo', t.winner, 'zoo');
  ok('winner=original → majority but applies=false', t.outcome === 'majority' && t.applies === false);
})();

// ── Votes for stale/removed options are ignored ──────────────────────────
(function () {
  var d = decision2(); d.votes = { f1: 'zoo', f2: 'GONE', f3: 'dis' };
  var t = TC.tally(d, 3);
  eq('stale vote ignored → votedFamilies 2', t.votedFamilies, 2);
  ok('stale vote → not all voted (only 2 valid of 3)', t.allVoted === false);
})();

// ── Membership-aware: votes from REMOVED families must NOT count (P0 fix) ─
(function () {
  // Scenario A: a removed family's vote must not prematurely complete the vote.
  var d = decision3(); // original = Japanese (jp)
  d.votes = { f1: 'kr', f2: 'kr', fGONE: 'jp' }; // fGONE was removed from the trip
  var legacy = TC.tally(d, 3);                    // legacy COUNT mode counts the phantom → 3/3
  ok('legacy count mode counts phantom (old behavior)', legacy.votedFamilies === 3);
  var fixed = TC.tally(d, ['f1', 'f2', 'f3']);     // CURRENT ids → fGONE ignored, f3 hasn't voted
  eq('membership: phantom ignored → votedFamilies 2', fixed.votedFamilies, 2);
  ok('membership: not all voted (f3 pending)', fixed.allVoted === false);
  ok('membership: does NOT apply yet', fixed.applies === false);

  // Scenario B: the only current family chose the original, but two removed families
  // had voted for an alternative → must NOT flip the plan.
  var d2 = decision2(); // original = Zoo
  d2.votes = { fA: 'zoo', fB_gone: 'dis', fC_gone: 'dis' };
  var f2 = TC.tally(d2, ['fA']); // only fA remains
  ok('membership: sole current voter chose original → winner zoo', f2.winner === 'zoo');
  ok('membership: removed-family votes cannot flip the plan', f2.applies === false && f2.allVoted === true);
})();

// ── Honest display helpers ───────────────────────────────────────────────
(function () {
  var g = TC.ageGroups('8, 12');
  ok('ageGroups 8,12 → kid true', g.kid === true);
  ok('ageGroups 8,12 → toddler false', g.toddler === false);
  ok('ageGroups 8,12 → teen false', g.teen === false);
  var g2 = TC.ageGroups('2, 15');
  ok('ageGroups 2,15 → toddler+teen', g2.toddler === true && g2.teen === true && g2.kid === false);

  var fit = TC.fitHints('beach', '8, 12');
  ok('fit beach → kid good', fit.kid === 'good');
  var fitNb = TC.fitHints('nightlife', '2');
  ok('fit nightlife → toddler limited', fitNb.toddler === 'limited');

  eq('visitBucket themepark → full day', TC.visitBucket('theme park'), 'fd');
  eq('visitBucket zoo → half day', TC.visitBucket('zoo'), 'hd');
  eq('visitBucket restaurant → ~1-2h', TC.visitBucket('restaurant'), 'h1');

  eq('costSymbol 3 → $$$', TC.costSymbol(3), '$$$');
  eq('costSymbol null → empty (verify)', TC.costSymbol(null), '');
  eq('costSymbol 0 → $', TC.costSymbol(0), '$');

  var pc = TC.prosCons({ rating: '4.6', reviewCount: '2,300', closed: false });
  ok('prosCons → highly_rated + popular', pc.pros.indexOf('highly_rated') >= 0 && pc.pros.indexOf('popular') >= 0);
  ok('prosCons → no cons for great place', pc.cons.length === 0);
  var pc2 = TC.prosCons({ rating: '3.2', closed: true });
  ok('prosCons → low_rated + closed_now', pc2.cons.indexOf('low_rated') >= 0 && pc2.cons.indexOf('closed_now') >= 0);
  var pc3 = TC.prosCons({}); // no real data → no fabricated pros/cons
  ok('prosCons → empty when no real data (no fabrication)', pc3.pros.length === 0 && pc3.cons.length === 0);
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
