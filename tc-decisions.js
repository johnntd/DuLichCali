/* ════════════════════════════════════════════════════════════════════════
 *  tc-decisions.js — PURE decision-vote math + honest display helpers.
 *
 *  A "decision" is a GROUP CHOICE: each family picks ONE of N options (the
 *  selected place + its alternatives). This is DISTINCT from the existing
 *  like/maybe/skip consensus engine (which votes a single place up/down) — so
 *  it is deliberately kept in its own model (trip.decisions) and its own module.
 *
 *  Resolution rules (match the product spec exactly):
 *   - One vote per family. Changing a vote overwrites the previous one.
 *   - The result is applied ONLY when ALL families have voted.
 *   - A UNIQUE plurality winner wins ("2 of 3 → that option").
 *   - A tie (>1 option shares the top count) keeps the ORIGINAL unchanged.
 *   - If the winner IS the original, the plan is unchanged (nothing to apply).
 *
 *  No DOM, no network, no Date.now(): everything here is deterministic so it can
 *  be unit-tested in node (tests/tc-decisions.test.js) and reused in the browser
 *  via window.TCDecisions. The browser layer (travel-concierge.js) owns option
 *  seeding, applying the override, audit-note i18n, and persistence.
 * ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  // Resolve the id of the ORIGINAL (currently-selected) option for a decision.
  function originalId(decision) {
    if (!decision) return null;
    if (decision.originalOptionId) return decision.originalOptionId;
    var opts = decision.options || [];
    return opts.length ? opts[0].id : null;
  }

  // Tally a decision: per-option counts, vote progress, winner, outcome, and
  // whether the plan should change. `families` is EITHER the array of CURRENT
  // family ids (preferred — votes from families no longer on the trip are ignored
  // so a removed/merged family can't prematurely complete or flip a vote) OR a
  // legacy number (the count, with no membership filtering — back-compat only).
  function tally(decision, families) {
    decision = decision || {};
    var options = decision.options || [];
    var votes = decision.votes || {};
    var validIds = {};
    options.forEach(function (o) { if (o && o.id) validIds[o.id] = true; });
    var idMode = Array.isArray(families);
    var currentSet = null;
    if (idMode) { currentSet = {}; families.forEach(function (id) { if (id != null) currentSet[id] = true; }); }
    var total = idMode ? Math.max(0, families.length) : Math.max(0, families | 0);

    var counts = {};
    options.forEach(function (o) { if (o && o.id) counts[o.id] = 0; });
    var votedFamilies = 0;
    Object.keys(votes).forEach(function (fid) {
      var oid = votes[fid];
      if (oid && validIds[oid] && (!idMode || currentSet[fid])) { counts[oid]++; votedFamilies++; } // only CURRENT families count
    });

    var allVoted = total > 0 && votedFamilies >= total;
    var topCount = 0;
    Object.keys(counts).forEach(function (oid) { if (counts[oid] > topCount) topCount = counts[oid]; });
    var leaders = Object.keys(counts).filter(function (oid) { return counts[oid] === topCount && topCount > 0; });

    var orig = originalId(decision);
    var winner = null, outcome = 'pending', applies = false;
    if (allVoted) {
      if (leaders.length === 1) {
        winner = leaders[0];
        outcome = 'majority';
        applies = !!(winner && winner !== orig);
      } else {
        // No votes at all is impossible once allVoted && total>0; >1 leader = tie.
        outcome = 'tie';
      }
    }

    return {
      counts: counts,
      votedFamilies: votedFamilies,
      totalFamilies: total,
      remaining: Math.max(0, total - votedFamilies),
      allVoted: allVoted,
      leaders: leaders,
      topCount: topCount,
      winner: winner,
      outcome: outcome,        // 'pending' | 'majority' | 'tie'
      applies: applies,        // true → swap original for winner
      status: allVoted ? 'complete' : 'waiting',
      originalOptionId: orig,
    };
  }

  // Sorted [count, count, …] descending — used to render the audit tally "2–1".
  function tallySpread(t) {
    if (!t || !t.counts) return [];
    return Object.keys(t.counts).map(function (k) { return t.counts[k]; }).sort(function (a, b) { return b - a; });
  }

  // Has a given family already voted in this decision?
  function familyVoted(decision, familyId) {
    return !!(decision && decision.votes && decision.votes[familyId]);
  }

  // ── Honest display helpers (used for alternative cards) ──────────────────
  // Family-fit SUGGESTION from category + kids' ages. These are heuristics, NOT
  // facts — the UI must label them "suggested, verify". Levels: good|ok|limited.
  function parseAges(childrenAges) {
    return String(childrenAges == null ? '' : childrenAges)
      .split(/[,\s/]+/).map(function (x) { return parseInt(x, 10); })
      .filter(function (n) { return !isNaN(n) && n >= 0 && n <= 17; });
  }
  function catClass(category) {
    var c = String(category || '').toLowerCase();
    if (/zoo|aquarium|safari|wildlife/.test(c)) return 'zoo';
    if (/theme ?park|amusement|fun ?zone|legoland|seaworld|disney|knott|universal/.test(c)) return 'themepark';
    if (/beach|cove|pier|bay|shore|boardwalk|harbor/.test(c)) return 'beach';
    if (/park|garden|scenic|view|nature|trail|lookout|island/.test(c)) return 'scenic';
    if (/museum|gallery|science|exhibit|cultural|historic/.test(c)) return 'museum';
    if (/restaurant|food|cafe|dining|eatery|bbq|buffet|dessert|bakery|seafood/.test(c)) return 'food';
    if (/night|bar|club|lounge|pub|cocktail/.test(c)) return 'nightlife';
    if (/hike|hiking|climb|kayak|surf|bike/.test(c)) return 'active';
    if (/shop|mall|outlet|market|store/.test(c)) return 'shopping';
    return 'other';
  }
  // Returns { toddler, kid, teen } each 'good'|'ok'|'limited' — only meaningful
  // for the age groups actually present (caller decides which to show).
  function fitHints(category, childrenAges) {
    var k = catClass(category);
    var T = { toddler: 'ok', kid: 'ok', teen: 'ok' };
    switch (k) {
      case 'zoo':       T = { toddler: 'good', kid: 'good', teen: 'ok' }; break;
      case 'themepark': T = { toddler: 'ok',   kid: 'good', teen: 'good' }; break;
      case 'beach':     T = { toddler: 'good', kid: 'good', teen: 'good' }; break;
      case 'scenic':    T = { toddler: 'ok',   kid: 'ok',   teen: 'ok' }; break;
      case 'museum':    T = { toddler: 'limited', kid: 'ok', teen: 'good' }; break;
      case 'food':      T = { toddler: 'ok',   kid: 'ok',   teen: 'good' }; break;
      case 'nightlife': T = { toddler: 'limited', kid: 'limited', teen: 'limited' }; break;
      case 'active':    T = { toddler: 'limited', kid: 'ok', teen: 'good' }; break;
      case 'shopping':  T = { toddler: 'ok',   kid: 'ok',   teen: 'good' }; break;
      default:          T = { toddler: 'ok',   kid: 'ok',   teen: 'ok' };
    }
    return T;
  }
  // Which age groups a family actually has (drives which fit hints to show).
  function ageGroups(childrenAges) {
    var ages = parseAges(childrenAges);
    return {
      toddler: ages.some(function (a) { return a <= 4; }),
      kid: ages.some(function (a) { return a >= 5 && a <= 12; }),
      teen: ages.some(function (a) { return a >= 13 && a <= 17; }),
    };
  }

  // Rough visit-time BUCKET from category (UI maps to a localized "≈ … (estimate)").
  function visitBucket(category) {
    var k = catClass(category);
    if (k === 'themepark') return 'fd';        // full day
    if (k === 'zoo' || k === 'museum') return 'hd'; // half day
    if (k === 'beach' || k === 'scenic' || k === 'shopping' || k === 'active') return 'h2'; // 2–3 hrs
    if (k === 'food' || k === 'nightlife') return 'h1'; // ~1–2 hrs
    return 'h1';
  }

  // Google Places priceLevel (0–4) → cost symbol. '' when unknown (UI → "Verify").
  function costSymbol(priceLevel) {
    if (priceLevel == null || priceLevel === '' || isNaN(+priceLevel)) return '';
    var n = Math.max(0, Math.min(4, Math.round(+priceLevel)));
    return ['$', '$', '$$', '$$$', '$$$$'][n];
  }

  // Derive HONEST pros/cons from REAL signals only (Google rating/hours). Returns
  // {pros:[], cons:[]} of neutral tokens the UI localizes; empty when no real data.
  function prosCons(real) {
    real = real || {};
    var pros = [], cons = [];
    var rating = parseFloat(real.rating);
    var reviews = parseInt(String(real.reviewCount || '').replace(/[^\d]/g, ''), 10);
    if (!isNaN(rating)) {
      if (rating >= 4.4) pros.push('highly_rated');
      else if (rating < 3.6) cons.push('low_rated');
    }
    if (!isNaN(reviews) && reviews >= 1000) pros.push('popular');
    if (real.closed === true) cons.push('closed_now');
    return { pros: pros, cons: cons };
  }

  var api = {
    tally: tally,
    tallySpread: tallySpread,
    familyVoted: familyVoted,
    originalId: originalId,
    fitHints: fitHints,
    ageGroups: ageGroups,
    parseAges: parseAges,
    catClass: catClass,
    visitBucket: visitBucket,
    costSymbol: costSymbol,
    prosCons: prosCons,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TCDecisions = api;
})(typeof window !== 'undefined' ? window : this);
