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
 * Mirrors the validated _mergeState() from receptionist.js (RX-016).
 * Returns new merged object (does not mutate input).
 */
var _VALID_LANGS    = { en: 1, vi: 1, es: 1 };
var _VALID_PENDING  = { booking_offer: 1, modify_booking: 1 };

function mergeState(current, update, todayISO) {
  if (!update) return Object.assign({}, current);
  var merged = Object.assign({}, current);
  var today = todayISO || new Date().toISOString().slice(0, 10);

  Object.keys(update).forEach(function(k) {
    var val = update[k];
    if (val === null) { merged[k] = null; return; }

    if (k === 'date') {
      if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
      if (val < today) return; // past date rejected
      var cutoff = today.slice(0, 4) - 0 + 1 + '-' + today.slice(5);
      merged[k] = val; return;
    }
    if (k === 'time') {
      if (typeof val !== 'string' || !/^\d{1,2}:\d{2}$/.test(val)) return;
      merged[k] = val; return;
    }
    if (k === 'phone') {
      var digits = String(val).replace(/\D/g, '');
      if (digits.length < 7) return;
      merged[k] = digits; return;
    }
    if (k === 'services') {
      if (!Array.isArray(val)) return;
      merged[k] = val.filter(function(s) { return typeof s === 'string' && s.trim().length > 0; });
      return;
    }
    if (k === 'lang') {
      if (!_VALID_LANGS[val]) return;
      merged[k] = val; return;
    }
    if (k === 'pendingAction') {
      if (!_VALID_PENDING[val]) return;
      merged[k] = val; return;
    }
    if (k === 'name') {
      if (typeof val !== 'string' || val.trim().length < 1 || !/[a-zA-ZÀ-ỹ]/.test(val)) return;
      merged[k] = val.trim(); return;
    }
    merged[k] = val;
  });
  return merged;
}

module.exports = { parseStateMarker, parseEscalationType, parseBookingDraft, mergeState };
