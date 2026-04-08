'use strict';
// tests/lib/state-parser.js
// Pure-function wrappers that mirror the parsing logic in nailsalon/receptionist.js.
// These do NOT import the browser IIFE — they duplicate only the parsing primitives.
// Kept in sync manually; grep receptionist.js for the originals when the harness breaks.

/**
 * Parse the last [STATE:{...}] marker from a Claude reply string.
 * Uses lastIndexOf to always grab the final STATE block (same as receptionist.js).
 * Returns parsed object or null.
 */
function parseStateMarker(reply) {
  if (typeof reply !== 'string') return null;
  try {
    var idx = reply.lastIndexOf('[STATE:{');
    if (idx < 0) return null;
    var end = reply.indexOf('}]', idx + 8);
    if (end < 0) return null;
    return JSON.parse(reply.slice(idx + 7, end + 1));
  } catch (e) { return null; }
}

/**
 * Extract [ESCALATE:type] from a Claude reply.
 * Matches: order | appointment | reservation | question | cancel
 * Returns lowercase type string or null.
 */
function parseEscalationType(reply) {
  if (typeof reply !== 'string') return null;
  var m = reply.match(/\[ESCALATE:(order|appointment|reservation|question|cancel)\]/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Parse [BOOKING:{...}] draft from a Claude reply.
 * Returns parsed object or null.
 */
function parseBookingDraft(reply) {
  if (typeof reply !== 'string') return null;
  try {
    var m = reply.match(/\[BOOKING:\s*(\{[\s\S]*?\})\s*\]/);
    if (!m) return null;
    return JSON.parse(m[1]);
  } catch (e) { return null; }
}

/**
 * Simulate _mergeState: merge Claude STATE output into an existing booking state object.
 * Returns new merged object (does not mutate input).
 */
function mergeState(current, update) {
  if (!update) return Object.assign({}, current);
  var merged = Object.assign({}, current);
  Object.keys(update).forEach(function(k) { merged[k] = update[k]; });
  return merged;
}

module.exports = { parseStateMarker, parseEscalationType, parseBookingDraft, mergeState };
