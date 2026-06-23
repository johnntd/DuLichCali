'use strict';
// Pure sanitizer for the Ticket Deal Hunter (researchTicketDeals). Clamps the grounded model
// output to a safe shape: known dealType only, length-capped text, savingsEstimate defaults to
// "pending verification", and empty items/deals are dropped. NO price or URL is ever accepted from
// the model — the frontend builds official + search links deterministically. Node-testable.
var DEAL_TYPES = ['multi_day', 'family_bundle', 'early_bird', 'combo', 'membership', 'group', 'free_day', 'resident', 'military_senior_student', 'other'];

function s(x, n) { return String(x == null ? '' : x).slice(0, n); }

function sanitizeTicketDeals(parsed) {
  var deals = (parsed && Array.isArray(parsed.deals)) ? parsed.deals : [];
  return deals.filter(function (d) { return d && d.attraction; }).slice(0, 12).map(function (d) {
    return {
      attraction: s(d.attraction, 120),
      city: s(d.city, 80),
      note: s(d.note, 160),
      items: (Array.isArray(d.items) ? d.items : []).slice(0, 4).map(function (it) {
        it = it || {};
        return {
          dealType: DEAL_TYPES.indexOf(String(it.dealType)) !== -1 ? it.dealType : 'other',
          title: s(it.title, 80),
          description: s(it.description, 200),
          savingsEstimate: s(it.savingsEstimate || 'pending verification', 60),
          bookBy: s(it.bookBy, 80),
          conditions: s(it.conditions, 90),
          dataSource: 'ai_researched_pending_verification',
        };
      }).filter(function (it) { return it.title || it.description; }),
    };
  }).filter(function (d) { return d.items.length; });
}

module.exports = { sanitizeTicketDeals: sanitizeTicketDeals, DEAL_TYPES: DEAL_TYPES };
