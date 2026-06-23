'use strict';
// Pure, node-testable mapper for the Ticketmaster Discovery seam (P3). Maps ONE Discovery event
// JSON → the EVENT shape researchTripEvents emits. NO network. Only REAL fields are mapped: a price
// is labelled "(Ticketmaster)" ONLY when priceRanges[].min is actually present, else "pending
// verification" (never fabricated). eventUrl must be http(s) or is dropped. familySuitability
// defaults neutral ('all_ages') — Discovery has no reliable family flag, so we never invent
// kids/teens. whyRecommended stays empty (it's an AI editorial field; faking it on factual data
// would be dishonest). source/verificationStatus mark these as the only events allowed to drop the
// "pending verification" caption — because they come from the official ticketing source.
function tmKeyPresent(key) { return !!(key && String(key).trim().length >= 20); }

function mapTicketmasterEvent(e) {
  e = e || {};
  var cl = (e.classifications && e.classifications[0]) || {};
  var seg = String((cl.segment && cl.segment.name) || '').toLowerCase();
  var category = seg.indexOf('music') >= 0 ? 'concert'
    : (seg.indexOf('sports') >= 0 ? 'other'
      : ((seg.indexOf('arts') >= 0 || seg.indexOf('theatre') >= 0 || seg.indexOf('film') >= 0) ? 'show' : 'other'));
  var venue = (e._embedded && e._embedded.venues && e._embedded.venues[0]) || {};
  var loc = [venue.name, venue.city && venue.city.name].filter(Boolean).join(', ');
  var dStart = (e.dates && e.dates.start) || {};
  var priceRange = 'pending verification';
  if (Array.isArray(e.priceRanges) && e.priceRanges[0] && e.priceRanges[0].min != null) {
    var p = e.priceRanges[0];
    priceRange = '$' + Math.round(p.min) + (p.max != null && p.max !== p.min ? ('–$' + Math.round(p.max)) : '') + ' (Ticketmaster)';
  }
  return {
    name: String(e.name || '').slice(0, 120),
    date: String(dStart.localDate || '').slice(0, 40),
    time: String(dStart.localTime || '').slice(0, 40),
    location: String(loc).slice(0, 140),
    category: category,
    priceRange: priceRange,
    familySuitability: 'all_ages',
    ticketRequired: true,
    eventUrl: /^https?:\/\//.test(String(e.url || '')) ? String(e.url).slice(0, 300) : '',
    whyRecommended: '',
    source: 'ticketmaster_live',
    verificationStatus: 'verified',
  };
}

// Map a Discovery _embedded.events[] → EVENT[], dropping nameless + avoid-listed entries.
function sanitizeLiveEvents(arr, avoidSet) {
  avoidSet = avoidSet || {};
  return (Array.isArray(arr) ? arr : []).map(mapTicketmasterEvent)
    .filter(function (ev) { return ev.name && !avoidSet[ev.name.trim().toLowerCase()]; })
    .slice(0, 6);
}

module.exports = { mapTicketmasterEvent: mapTicketmasterEvent, tmKeyPresent: tmKeyPresent, sanitizeLiveEvents: sanitizeLiveEvents };
