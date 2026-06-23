'use strict';
// Shared deal-drop significance test — suppresses estimate JITTER so Deal Watch only alerts on a
// MEANINGFUL price drop, not the run-to-run noise of grounded estimate ranges. A drop qualifies only
// when it is BOTH a substantial dollar amount AND a substantial proportion of the prior price (so a
// ~$3 wobble on a $30 bus never alerts, while a $40 drop on a $400 flight does). These are ESTIMATES
// (grounded research / future fare API), never fabricated — the guard just decides when a move is
// worth surfacing. Mirrored inline in travel-concierge.js `checkDealDrops` — keep the two in sync.
var DEAL_MIN_DROP_ABS = 25;   // dollars — minimum absolute saving worth an alert
var DEAL_MIN_DROP_PCT = 0.10; // fraction of the prior price — minimum proportional saving

function isMeaningfulDrop(prevCost, newCost, opts) {
  opts = opts || {};
  var absMin = (opts.absMin != null) ? opts.absMin : DEAL_MIN_DROP_ABS;
  var pctMin = (opts.pctMin != null) ? opts.pctMin : DEAL_MIN_DROP_PCT;
  var prev = Number(prevCost), cur = Number(newCost);
  if (!isFinite(prev) || !isFinite(cur) || prev <= 0 || cur < 0) return false;
  var drop = prev - cur;
  if (drop <= 0) return false;
  return drop >= absMin && drop >= prev * pctMin;
}

// Parse a representative dollar figure from a free-text price/range. Returns null when there is NO
// number to anchor on ("$$$" / "pending verification" / "" → null) or when the figure is a percent
// discount (e.g. "~10-20%") rather than a price. For a "$lo–$hi" range we take the LOW (floor) so a
// drop is judged conservatively on the cheapest observed price. Mirrored inline in
// travel-concierge.js next to meaningfulDrop — keep the two in sync.
function parsePriceNumber(text) {
  if (text == null) return null;
  var s = String(text).replace(/,/g, '');
  if (/%/.test(s) && !/\$/.test(s)) return null; // percent-only = a discount, not a price
  var nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(function (n) { return isFinite(n) && n > 0 && n < 100000; });
  if (!nums.length) return null;
  return Math.min.apply(null, nums);
}

module.exports = {
  isMeaningfulDrop: isMeaningfulDrop,
  parsePriceNumber: parsePriceNumber,
  DEAL_MIN_DROP_ABS: DEAL_MIN_DROP_ABS,
  DEAL_MIN_DROP_PCT: DEAL_MIN_DROP_PCT,
};
