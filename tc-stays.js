/* Stay Intelligence — pure helpers (browser IIFE + node-testable, like tc-tasks.js).
 * parsePriceMid(text)            — midpoint of a "$lo–$hi"/"$n" range; null when no real $ figure.
 * computeStayTier(h, hotels)     — premium | best_value | budget (by price, star-rating fallback).
 * stayPick(stay, criterion)      — best hotel for an Alternatives lens.
 * perNightBudget(budgetTier)     — rough nightly ceiling/room from the family's stated budget tier.
 * NO DOM / Firebase / network deps. Prices are ESTIMATES — these helpers never fabricate a price. */
(function (root) {
  'use strict';

  // Midpoint of a price range. "%"-only (a discount) and non-numeric ("pending", "$$$") → null.
  function parsePriceMid(text) {
    if (text == null) return null;
    var s = String(text).replace(/,/g, '');
    if (/%/.test(s) && !/\$/.test(s)) return null;
    var nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number).filter(function (n) { return isFinite(n) && n > 0 && n < 100000; });
    if (!nums.length) return null;
    if (nums.length === 1) return Math.round(nums[0]);
    return Math.round((Math.min.apply(null, nums) + Math.max.apply(null, nums)) / 2);
  }

  // Bucket a hotel into premium / best_value / budget relative to its city's set. Server-set
  // h.tier wins. With <2 priced hotels, fall back to star rating so a tier ALWAYS renders.
  function computeStayTier(h, hotels) {
    h = h || {};
    if (h.tier === 'premium' || h.tier === 'best_value' || h.tier === 'budget') return h.tier;
    var priced = (hotels || []).map(function (x) { return parsePriceMid(x && x.priceRange); }).filter(function (p) { return p != null; });
    var mine = parsePriceMid(h.priceRange);
    if (mine == null || priced.length < 2) { var r = parseFloat(h.starRating) || 0; return r >= 4.5 ? 'premium' : (r >= 3.7 ? 'best_value' : 'budget'); }
    // RANK-based tertiles (position among priced hotels) so a luxury OUTLIER (e.g. $850 del Coronado)
    // doesn't drag the rest into "budget" — matches the spec example: $180=budget, $320=best value,
    // $850=premium. Bottom third → budget, top third → premium, middle → best value.
    var below = priced.filter(function (p) { return p < mine; }).length;
    var pct = below / (priced.length - 1);
    return pct <= (1 / 3 + 1e-9) ? 'budget' : (pct >= (2 / 3 - 1e-9) ? 'premium' : 'best_value');
  }

  // "Points-friendly" = a real chain-brand name match (no fabricated loyalty data).
  var STAY_CHAINS = /(marriott|courtyard|residence inn|fairfield|ritz|sheraton|westin|hilton|hampton|embassy|doubletree|hyatt|holiday inn|\bihg\b|kimpton|crowne|best western|wyndham|days inn|la quinta|comfort inn|radisson|hyatt place|aloft|ac hotel)/i;
  function isPointsHotel(h) { return STAY_CHAINS.test((h && h.name) || ''); }
  function hasBeach(h) { return !!(h && (h.oceanDistance || /beach|ocean|bay|harbor|coast|seaside|waterfront|pier/i.test(((h.name || '') + ' ' + (h.area || ''))))); }
  function nearestAttractionMi(h) { var best = Infinity; ((h && h.attractionDistances) || []).forEach(function (a) { var m = parseFloat(String((a && a.distance) || '').replace(/[^\d.]/g, '')); if (isFinite(m) && m < best) best = m; }); return best; }
  function familyFitScore(h) { h = h || {}; var s = 0; if (h.familySuite) s += 2; if (h.pool) s += 1; if (h.breakfast) s += 1; if (h.kitchen) s += 1; if (/family|kid|child/i.test((h.bestFor || '') + ' ' + (h.category || ''))) s += 2; return s; }

  // Best hotel in a stay for an Alternatives-panel lens. null when no match (caller shows "no match").
  function stayPick(stay, criterion) {
    var hs = ((stay && stay.hotels) || []).slice(); if (!hs.length) return null;
    function byPrice(asc) { return hs.slice().sort(function (a, b) { var pa = parsePriceMid(a.priceRange), pb = parsePriceMid(b.priceRange); pa = (pa == null) ? (asc ? Infinity : -1) : pa; pb = (pb == null) ? (asc ? Infinity : -1) : pb; return asc ? pa - pb : pb - pa; })[0]; }
    switch (criterion) {
      case 'best_value': { var bv = hs.filter(function (h) { return computeStayTier(h, hs) === 'best_value'; }); return bv[0] || byPrice(true); }
      case 'budget': return byPrice(true);
      case 'luxury': return byPrice(false);
      case 'closest': return hs.slice().sort(function (a, b) { return nearestAttractionMi(a) - nearestAttractionMi(b); })[0];
      case 'beachfront': { var bf = hs.filter(hasBeach); return bf.length ? bf.sort(function (x, y) { return (parseFloat(y.starRating) || 0) - (parseFloat(x.starRating) || 0); })[0] : null; }
      case 'family': return hs.slice().sort(function (a, b) { return familyFitScore(b) - familyFitScore(a); })[0];
      case 'points': { var pf = hs.filter(isPointsHotel); return pf.length ? pf[0] : null; }
      default: return null;
    }
  }

  // Rough nightly ceiling per room from the family's STATED budget tier (allocation math on the
  // user's own input — an estimate basis, NEVER a fabricated market price).
  function perNightBudget(budgetTier) { return ({ budget: 140, economy: 140, moderate: 240, comfortable: 320, luxury: 600 })[String(budgetTier || 'moderate')] || 240; }

  root.TCStays = {
    parsePriceMid: parsePriceMid, computeStayTier: computeStayTier, stayPick: stayPick,
    isPointsHotel: isPointsHotel, hasBeach: hasBeach, nearestAttractionMi: nearestAttractionMi,
    familyFitScore: familyFitScore, perNightBudget: perNightBudget,
  };
})(typeof window !== 'undefined' ? window : this);
