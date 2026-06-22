'use strict';
// Pure, dependency-free honesty sanitizer for user-added place research.
// Mirrors the .map() clamp in researchTripStays (functions/index.js): every
// ungrounded field is blanked, never guessed; AI output is always pending verification.

var PRICE_RE = /^\s*(\${1,3}|\$?\d[\d,]*\s*(?:[-–]\s*\$?\d[\d,]*)?)\s*$/; // $/$$/$$$ or an optionally $-prefixed numeric range
var OFFICIAL_HOSTS = [
  'opentable.com', 'resy.com', 'yelp.com', 'tripadvisor.com', 'google.com',
  'toasttab.com', 'exploretock.com', 'ubereats.com', 'doordash.com', 'grubhub.com',
];

function cleanStr(s, max) { return String(s == null ? '' : s).slice(0, max || 200); }

function buildMapsUrls(name, address) {
  var q = encodeURIComponent((cleanStr(name, 120) + ' ' + cleanStr(address, 160)).trim());
  return {
    googleMapsUrl: q ? ('https://www.google.com/maps/search/?api=1&query=' + q) : '',
    appleMapsUrl: q ? ('https://maps.apple.com/?q=' + q) : '',
  };
}

function isAllowedUrl(u) {
  u = String(u || '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  var host = '';
  try { host = u.replace(/^https:\/\//i, '').split('/')[0].toLowerCase(); } catch (e) { return false; }
  return OFFICIAL_HOSTS.some(function (h) { return host === h || host.indexOf('.' + h) !== -1 || host === 'www.' + h; });
}

// `parsed` = one place object from the model. `input` = the original request (reserved).
function sanitizeUserPlace(parsed, input) {
  parsed = parsed || {};
  var maps = buildMapsUrls(parsed.name, parsed.address);
  var price = String(parsed.priceRange || '').trim();
  var out = {
    name: cleanStr(parsed.name, 120),
    address: cleanStr(parsed.address, 160),
    rating: cleanStr(parsed.rating, 24),            // model may ground this; kept as-is text, blank if absent
    reviewCount: cleanStr(parsed.reviewCount, 16),
    hours: cleanStr(parsed.hours, 120),
    popularDishes: (Array.isArray(parsed.popularDishes) ? parsed.popularDishes : []).slice(0, 4).map(function (x) { return cleanStr(x, 60); }),
    priceRange: PRICE_RE.test(price) ? price.slice(0, 40) : 'pending verification',
    parkingNote: cleanStr(parsed.parkingNote, 120),
    kidSuitability: cleanStr(parsed.kidSuitability, 90),
    seniorSuitability: cleanStr(parsed.seniorSuitability, 90),
    estimatedDuration: cleanStr(parsed.estimatedDuration, 60),
    websiteUrl: isAllowedUrl(parsed.websiteUrl) ? cleanStr(parsed.websiteUrl, 240) : '',
    reservationUrl: isAllowedUrl(parsed.reservationUrl) ? cleanStr(parsed.reservationUrl, 240) : '',
    reservationNote: cleanStr(parsed.reservationNote, 120),
    googleMapsUrl: maps.googleMapsUrl,
    appleMapsUrl: maps.appleMapsUrl,
    why: cleanStr(parsed.why, 240),
    dataSource: 'ai_researched_pending_verification',
  };
  // photos are NEVER taken from the model — added separately from Google Places. (out.photos left undefined)
  // phone is never carried.
  return out;
}

module.exports = { sanitizeUserPlace: sanitizeUserPlace, buildMapsUrls: buildMapsUrls, isAllowedUrl: isAllowedUrl, PRICE_RE: PRICE_RE, OFFICIAL_HOSTS: OFFICIAL_HOSTS };
