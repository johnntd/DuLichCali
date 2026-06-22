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

module.exports = {
  isMeaningfulDrop: isMeaningfulDrop,
  DEAL_MIN_DROP_ABS: DEAL_MIN_DROP_ABS,
  DEAL_MIN_DROP_PCT: DEAL_MIN_DROP_PCT,
};
