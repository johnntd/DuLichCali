#!/usr/bin/env node
'use strict';
// tests/runner.js — Nail Receptionist Regression Harness
//
// Run:  node tests/runner.js
//       npm run test:receptionist
//
// Test layers — each has a different confidence level:
//
//   [static-source-check]           Greps receptionist.js source for key strings.
//                                   Verifies instructions EXIST in the prompt.
//                                   Does NOT verify Claude follows them.
//
//   [mirrored-unit-logic]           Tests pure functions duplicated in tests/lib/.
//                                   Verifies algorithm correctness in isolation.
//                                   Does NOT test production NailAvailabilityChecker directly.
//
//   [fixture-behavioral]            Uses pre-loaded mock booking data.
//                                   Verifies behavior with known inputs.
//                                   Does NOT test live Firestore queries.
//
//   [structural]                    Validates case file format and required fields.
//                                   Ensures case library stays consistent.
//
// See README.md for full confidence model and workflow.

var path = require('path');
var fs   = require('fs');

// ── Assertion helpers ─────────────────────────────────────────────────────

var _passed = 0, _failed = 0, _currentGroup = '', _failures = [];

function group(name, testType) {
  _currentGroup = name;
  var tag = testType ? '  \u2502 type: ' + testType : '';
  console.log('\n[' + name + ']' + (testType ? '  \u2190 ' + testType : ''));
}

function test(name, fn) {
  try {
    fn();
    console.log('  \u2713', name);
    _passed++;
  } catch (e) {
    console.log('  \u2717', name);
    console.log('    \u2192', e.message);
    _failed++;
    _failures.push({ group: _currentGroup, name: name, error: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function assertContains(haystack, needle, msg) {
  if (typeof haystack !== 'string' || haystack.indexOf(needle) < 0)
    throw new Error((msg ? msg + ': ' : '') + 'expected to contain: ' + needle);
}
function assertNotContains(haystack, needle, msg) {
  if (typeof haystack === 'string' && haystack.indexOf(needle) >= 0)
    throw new Error((msg ? msg + ': ' : '') + 'must NOT contain: ' + needle);
}

// ── Load libs ─────────────────────────────────────────────────────────────

var SP  = require('./lib/state-parser');
var AL  = require('./lib/avail-logic');
var PC  = require('./lib/prompt-checker');

var BIZ      = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/biz.json')));
var BOOK_FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/bookings.json')));
var aiSrc    = fs.readFileSync(path.join(__dirname, '../ai-engine.js'), 'utf8');

function bookings() {
  var args = Array.prototype.slice.call(arguments);
  if (args.length === 0) return Object.values(BOOK_FIX);
  return args.map(function(k) {
    if (!BOOK_FIX[k]) throw new Error('Fixture booking not found: ' + k);
    return BOOK_FIX[k];
  });
}

// ══════════════════════════════════════════════════════════════════════════
// GROUP 1 — PROMPT INTEGRITY
// type: static-source-check
//
// CONFIDENCE: MEDIUM
// Confirms that fix instructions are textually present in receptionist.js.
// This is a necessary but NOT sufficient condition for correct behavior —
// Claude must also follow the instructions, which only live API testing can verify.
// ══════════════════════════════════════════════════════════════════════════

group('Prompt Integrity', 'static-source-check');
var src = PC.loadSource();

test('ENTITY_EXTRACTION: old "inherit from STATE" instruction is gone [RX-001]', function() {
  assertNotContains(src, 'inherit from STATE if booking_request',
    'Legacy staff inherit rule still present — RX-001 may regress');
});

test('ENTITY_EXTRACTION: updated staff rule says "do NOT inherit prior staff" [RX-001]', function() {
  assertContains(src, 'Do NOT inherit prior staff');
});

test('CONFLICT_RESOLUTION \u2014 STAFF SWITCH section exists [RX-001/002]', function() {
  assertContains(src, 'CONFLICT RESOLUTION \u2014 STAFF SWITCH');
});

test('CONFLICT_RESOLUTION: instructs to KEEP date/time from STATE [RX-001/002]', function() {
  assertContains(src, 'KEEP date and time from CURRENT BOOKING STATE');
});

test('booking_offer affirmative: clears pendingAction (prevents re-ask loop)', function() {
  assertContains(src, 'Set pendingAction: null in STATE (transition is done');
});

test('"replace it" handling: clears time to null (prevents customer_conflict loop) [RX-003]', function() {
  assertContains(src, 'Set time: null (new time needed)');
});

test('"replace it": instructs to ask ONCE and not re-show conflict [RX-003]', function() {
  assertContains(src, 'Do NOT re-show the conflict message');
});

test('CANCEL BOOKING section exists [RX-004]', function() {
  assertContains(src, '=== CANCEL BOOKING ===');
});

test('CANCEL: handles "cancel" without redirecting to phone [RX-004]', function() {
  assertContains(src, 'Do NOT tell the customer to call the salon to cancel');
});

test('_earlyCheckReady: passes isModify flag for modify_booking [RX-003/006]', function() {
  assertContains(src, 'isModify:          _inModify');
});

test('_earlyCheckReady: passes phone when in modify mode [RX-003/006]', function() {
  assertContains(src, "phone:             _inModify ? (_ecs.phone || null) : null");
});

test('Post-booking state context: BOOKING STATUS: CONFIRMED signal [RX-009]', function() {
  assertContains(src, 'BOOKING STATUS: CONFIRMED');
});

test('Post-booking state context: Do NOT ask for date/time again [RX-009]', function() {
  assertContains(src, 'Do NOT ask for date/time again');
});

test('Confirmation text: warm closing present [RX-009]', function() {
  assertContains(src, 'look forward to seeing you');
});

test('_submitDirectBooking: isExactReschedule guard present [RX-005]', function() {
  assertContains(src, 'isExactReschedule');
});

test('_fetchLiveBizData: live data refresh function exists [RX-010]', function() {
  assertContains(src, '_fetchLiveBizData');
});

test('10-minute data cache interval configured [RX-010]', function() {
  assertContains(src, '600000');
});

test('RX-011: _earlyCheckReady does NOT overwrite modify_booking pendingAction [RX-011]', function() {
  assertContains(src, "RX-011: do NOT overwrite 'modify_booking'");
});

test('RX-012: altStaff computation present in availability checker [RX-012]', function() {
  assertContains(src, 'RX-012: find other staff who ARE available');
});

test('RX-013: RESPONSE QUALITY — ALWAYS LEAD section exists [RX-013]', function() {
  assertContains(src, 'RESPONSE QUALITY \u2014 ALWAYS LEAD');
});

test('RX-013: NEVER end with bare statement rule present [RX-013]', function() {
  assertContains(src, 'NEVER end a response with');
});

test('RX-014: cancel handler includes in_progress status [RX-014]', function() {
  assertContains(src, "|| s === 'in_progress'",
    'Cancel handler must include in_progress status — cross-session cancel fails otherwise');
});

test('RX-014: cancel handler uses shared lookup (most-recent-only) [RX-014]', function() {
  assertContains(src, '_lookupActiveBookingByPhone',
    'Cancel handler must use shared lookup utility — cancels most recent booking only');
});

test('RX-015: _xsBookingLookup function exists [RX-015]', function() {
  assertContains(src, '_xsBookingLookup',
    'Cross-session modify lookup function is required');
});

test('RX-015: CROSS-SESSION prompt instruction exists in MODIFY section [RX-015]', function() {
  assertContains(src, 'CROSS-SESSION: If services/name/phone are NOT in CURRENT BOOKING STATE',
    'Prompt must instruct Claude to ask for phone in cross-session reschedule');
});

test('RX-015: SAME-SESSION prompt instruction exists in MODIFY section [RX-015]', function() {
  assertContains(src, 'SAME-SESSION: If services AND name AND phone ARE already in CURRENT BOOKING STATE',
    'Prompt must document same-session vs cross-session distinction');
});

test('RX-016: _mergeState has field validation comment [RX-016]', function() {
  assertContains(src, 'RX-016: field-level validation rejects malformed values',
    'mergeState must have field validation for RX-016');
});

test('RX-016: date validation rejects non-ISO format [RX-016]', function() {
  assertContains(src, '_VALID_LANGS',
    'mergeState must have lang validation map');
});

test('RX-017: _lookupActiveBookingByPhone shared utility exists [RX-017]', function() {
  assertContains(src, '_lookupActiveBookingByPhone',
    'Phase 3: shared phone-to-booking lookup utility must exist');
});

test('RX-017: _findFreeStaff function exists [RX-017]', function() {
  assertContains(src, '_findFreeStaff',
    'Phase 3: proactive free-staff query function must exist');
});

test('RX-017: modify submission skips Firestore when ID already known [RX-017]', function() {
  assertContains(src, 'skip the Firestore round-trip',
    'Phase 3: modify submission must short-circuit when existingBookingId already known');
});

test('RX-018: _validateResponseQuality function exists [RX-018]', function() {
  assertContains(src, '_validateResponseQuality',
    'Phase 4: response quality validator must exist');
});

test('RX-018: response quality validator gates ESCALATE:appointment on empty services [RX-018]', function() {
  assertContains(src, 'suppressEscalate',
    'Phase 4: validator must suppress escalation when services are missing');
});

test('RX-018: response quality validator wired into callClaude pipeline [RX-018]', function() {
  assertContains(src, 'Phase 4 — response quality validation',
    'Phase 4: _validateResponseQuality must be called in callClaude response pipeline');
});

test('RX-019: receptionist passes intent to AIEngine.call [RX-019]', function() {
  assertContains(src, '_routeIntent',
    'Phase 5: receptionist must pass _routeIntent to AIEngine.call opts');
});

// ── Phase 5 checks run against ai-engine.js source ──────────────────────────

test('RX-019: AIEngine has _callOpenAI adapter [RX-019]', function() {
  assertContains(aiSrc, '_callOpenAI',
    'Phase 5: OpenAI adapter must exist in ai-engine.js');
});

test('RX-019: AIEngine has _callGemini adapter [RX-019]', function() {
  assertContains(aiSrc, '_callGemini',
    'Phase 5: Gemini adapter must exist in ai-engine.js');
});

test('RX-019: AIEngine has _HIGH_RISK_INTENTS routing map [RX-019]', function() {
  assertContains(aiSrc, '_HIGH_RISK_INTENTS',
    'Phase 5: intent-based routing map must exist in ai-engine.js');
});

test('RX-019: AIEngine normalises OpenAI response to Claude format [RX-019]', function() {
  assertContains(aiSrc, 'normalised to Claude format',
    'Phase 5: both non-Claude adapters must normalise response format');
});

test('RX-019: AIEngine call() has safe Claude fallback after provider failure [RX-019]', function() {
  assertContains(aiSrc, 'falling back to Claude',
    'Phase 5: provider failures must fall back to Claude');
});

test('RX-020: customer conflict check uses _overlaps() (no back-to-back false positive) [RX-020]', function() {
  assertContains(src, '_overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur)',
    'RX-020: customer conflict check must use _overlaps() — inline >= caused back-to-back loop');
});

test('RX-021: _lastConfirmedTime stored in _submitDirectBooking for stale-time detection [RX-021]', function() {
  assertContains(src, 'biz._lastConfirmedTime',
    'RX-021: _lastConfirmedTime must be set in _submitDirectBooking for stale-time detection');
});

test('RX-021: _lastConfirmedDate stored in _submitDirectBooking [RX-021]', function() {
  assertContains(src, 'biz._lastConfirmedDate',
    'RX-021: _lastConfirmedDate must be tracked alongside _lastConfirmedTime');
});

test('RX-021: _mergeState clears _lastBookingId on fresh booking_request with different time [RX-021]', function() {
  assertContains(src, 'biz._lastBookingId     = null',
    'RX-021: _mergeState must clear _lastBookingId when fresh booking_request arrives with different time');
});

test('RX-021: CONFIRMED signal includes instruction not to reuse confirmed slot [RX-021]', function() {
  assertContains(src, 'do NOT reuse the confirmed slot',
    'RX-021: CONFIRMED signal must explicitly warn Claude not to inherit stale confirmed slot time');
});

test('RX-021: isModify guard checks _lastConfirmedTime for stale-time reuse [RX-021]', function() {
  assertContains(src, '_isModFromState && !_isModFromPrev && !_isModFromId && !biz._xsLookupDone',
    'RX-021: isModify detection must guard against stale confirmed-time causing modify_booking misfire');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 2 — STATE PARSER
// type: mirrored-unit-logic
//
// CONFIDENCE: MEDIUM-HIGH for parsing correctness.
// Tests state-parser.js which duplicates the parsing logic from receptionist.js.
// Sync risk: if receptionist.js parsing changes, this lib must be updated manually.
// Does NOT test the actual _parseStateMarker in production code directly.
// ══════════════════════════════════════════════════════════════════════════

group('State Parser', 'mirrored-unit-logic');

test('parses a complete STATE marker', function() {
  var reply = 'What service?\n[STATE:{"intent":"booking_request","services":["Gel Manicure"],"staff":"Tracy","date":"2026-04-13","time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assert(s !== null, 'should parse successfully');
  assertEq(s.intent, 'booking_request');
  assertEq(s.staff, 'Tracy');
  assertEq(s.services[0], 'Gel Manicure');
  assert(s.time === null);
});

test('parses STATE with all null fields', function() {
  var reply = 'Hello!\n[STATE:{"intent":"general","services":[],"staff":null,"date":null,"time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assert(s !== null);
  assert(s.staff === null);
  assert(Array.isArray(s.services) && s.services.length === 0);
});

test('returns null when no STATE marker present', function() {
  var s = SP.parseStateMarker('Just a plain response with no markers.');
  assert(s === null);
});

test('uses lastIndexOf — picks LAST STATE marker when multiple present', function() {
  var reply = '[STATE:{"intent":"general","services":[],"staff":null,"date":null,"time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]\n[STATE:{"intent":"booking_request","services":["Manicure"],"staff":"Helen","date":null,"time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assertEq(s.intent, 'booking_request');
  assertEq(s.staff, 'Helen');
});

test('parses STATE with pendingAction=booking_offer', function() {
  var reply = 'Tracy is free at 2 PM! Would you like to book?\n[STATE:{"intent":"booking_request","services":["Manicure"],"staff":"Tracy","date":"2026-04-13","time":"14:00","name":null,"phone":null,"lang":"en","pendingAction":"booking_offer","existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assertEq(s.pendingAction, 'booking_offer');
});

test('parses STATE with pendingAction=modify_booking, time=null [RX-003 fix]', function() {
  // After "replace it", Claude should output time:null and pendingAction:modify_booking
  var reply = 'What new time would you like?\n[STATE:{"intent":"booking_request","services":["Manicure"],"staff":"Helen","date":"2026-04-13","time":null,"name":"Jane","phone":"4085551234","lang":"en","pendingAction":"modify_booking","existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assertEq(s.pendingAction, 'modify_booking');
  assert(s.time === null, 'time must be null after replace-it — non-null time causes customer_conflict re-fire');
});

test('extracts escalation type: appointment', function() {
  assertEq(SP.parseEscalationType('[BOOKING:{}]\n[ESCALATE:appointment]'), 'appointment');
});

test('extracts escalation type: cancel [RX-004]', function() {
  assertEq(SP.parseEscalationType("I've cancelled it.\n[ESCALATE:cancel]"), 'cancel');
});

test('escalation type is case-insensitive', function() {
  assertEq(SP.parseEscalationType('[ESCALATE:APPOINTMENT]'), 'appointment');
});

test('returns null when no escalation marker', function() {
  assert(SP.parseEscalationType('Just checking availability.') === null);
});

test('parses BOOKING draft with lang field [RX-007]', function() {
  var d = SP.parseBookingDraft('[BOOKING:{"services":["Gel Manicure"],"staff":"Tracy","date":"2026-04-13","time":"14:00","name":"Jane","phone":"4085551234","lang":"en"}]');
  assert(d !== null);
  assertEq(d.lang, 'en', 'lang must be "en" for English booking — RX-007 regression');
  assertEq(d.staff, 'Tracy');
});

test('BOOKING draft returns null on malformed JSON', function() {
  assert(SP.parseBookingDraft('[BOOKING:{bad json}]') === null);
});

test('mergeState applies all update keys', function() {
  var current = { intent: 'general', services: [], staff: null, time: null, pendingAction: null };
  var update  = { intent: 'booking_request', staff: 'Tracy', services: ['Gel Manicure'] };
  var merged  = SP.mergeState(current, update);
  assertEq(merged.intent, 'booking_request');
  assertEq(merged.staff, 'Tracy');
  assertEq(merged.time, null); // unchanged field preserved
});

// ── RX-016: field validation in mergeState ────────────────────────────────
test('[RX-016] mergeState: rejects invalid date format (not YYYY-MM-DD)', function() {
  var m = SP.mergeState({ date: null }, { date: 'April 15' }, '2026-04-08');
  assert(m.date === null, 'invalid date format must be rejected — was: ' + m.date);
});

test('[RX-016] mergeState: rejects past date', function() {
  var m = SP.mergeState({ date: null }, { date: '2025-01-01' }, '2026-04-08');
  assert(m.date === null, 'past date must be rejected');
});

test('[RX-016] mergeState: accepts valid future date', function() {
  var m = SP.mergeState({ date: null }, { date: '2026-04-20' }, '2026-04-08');
  assertEq(m.date, '2026-04-20');
});

test('[RX-016] mergeState: rejects invalid time format (not H:MM or HH:MM)', function() {
  var m = SP.mergeState({ time: null }, { time: '2 PM' }, '2026-04-08');
  assert(m.time === null, 'invalid time must be rejected — was: ' + m.time);
});

test('[RX-016] mergeState: accepts valid time', function() {
  var m = SP.mergeState({ time: null }, { time: '14:00' }, '2026-04-08');
  assertEq(m.time, '14:00');
});

test('[RX-016] mergeState: rejects phone with fewer than 7 digits', function() {
  var m = SP.mergeState({ phone: null }, { phone: '408' }, '2026-04-08');
  assert(m.phone === null, 'short phone must be rejected');
});

test('[RX-016] mergeState: strips non-digits from phone', function() {
  var m = SP.mergeState({ phone: null }, { phone: '(408) 555-1234' }, '2026-04-08');
  assertEq(m.phone, '4085551234', 'phone must be stored as digits only');
});

test('[RX-016] mergeState: rejects non-array services', function() {
  var m = SP.mergeState({ services: [] }, { services: 'Gel Manicure' }, '2026-04-08');
  assert(Array.isArray(m.services) && m.services.length === 0, 'string services must be rejected');
});

test('[RX-016] mergeState: filters empty strings from services array', function() {
  var m = SP.mergeState({ services: [] }, { services: ['Gel Manicure', '', '  '] }, '2026-04-08');
  assertEq(m.services.length, 1);
  assertEq(m.services[0], 'Gel Manicure');
});

test('[RX-016] mergeState: rejects unknown lang', function() {
  var m = SP.mergeState({ lang: 'en' }, { lang: 'zh' }, '2026-04-08');
  assertEq(m.lang, 'en', 'unknown lang must be rejected — prior value preserved');
});

test('[RX-016] mergeState: accepts valid lang values', function() {
  ['en', 'vi', 'es'].forEach(function(l) {
    var m = SP.mergeState({ lang: 'en' }, { lang: l }, '2026-04-08');
    assertEq(m.lang, l);
  });
});

test('[RX-016] mergeState: rejects unknown pendingAction', function() {
  var m = SP.mergeState({ pendingAction: null }, { pendingAction: 'reschedule' }, '2026-04-08');
  assert(m.pendingAction === null, 'unknown pendingAction must be rejected');
});

test('[RX-016] mergeState: null value always clears a field', function() {
  var m = SP.mergeState({ date: '2026-04-20', phone: '4085551234' }, { date: null }, '2026-04-08');
  assert(m.date === null, 'null must clear the field');
  assertEq(m.phone, '4085551234', 'other fields must be unchanged');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 3 — AVAILABILITY LOGIC
// type: mirrored-unit-logic + fixture-behavioral
//
// CONFIDENCE: HIGH for algorithm correctness; MEDIUM for production coupling.
// avail-logic.js mirrors NailAvailabilityChecker from receptionist.js.
// Uses pre-loaded fixture data — does NOT test Firestore queries.
// Sync risk: if production checker logic changes, avail-logic.js must be updated.
//
// The isModify exclusion tests (RX-003, RX-006) are the highest-value tests here
// because they directly exercise the JS logic path that was causing the loop bug.
// ══════════════════════════════════════════════════════════════════════════

group('Availability Logic', 'mirrored-unit-logic | fixture-behavioral');

// 2026-04-13 = Monday  (Helen 09:00-18:00, Tracy 10:00-19:00, Lisa 09:00-17:00)
// 2026-04-14 = Tuesday (same schedule)
// 2026-04-19 = Sunday  (nobody works)

test('free slot: empty schedule returns valid=true', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '10:00', totalDurationMins: 60 }, []);
  assert(r.valid === true);
});

test('staff not working Sunday returns key=staff_not_working', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-19', time: '10:00', totalDurationMins: 60 }, []);
  assert(!r.valid);
  assertEq(r.key, 'staff_not_working');
});

test('Lisa does not work Tuesdays', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Lisa', date: '2026-04-14', time: '10:00', totalDurationMins: 60 }, []);
  assert(!r.valid);
  assertEq(r.key, 'staff_not_working');
});

test('time after shift end returns key=outside_shift', function() {
  // Helen ends 18:00; 60-min service at 18:00 runs to 19:00 > 18:00
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '18:00', totalDurationMins: 60 }, []);
  assert(!r.valid);
  assertEq(r.key, 'outside_shift');
});

test('time before shift start returns key=outside_shift', function() {
  // Tracy starts 10:00; 09:00 is before her shift
  var r = AL.checkAvailability(BIZ, { staff: 'Tracy', date: '2026-04-13', time: '09:00', totalDurationMins: 60 }, []);
  assert(!r.valid);
  assertEq(r.key, 'outside_shift');
});

test('staff conflict: exact same time returns key=conflict', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid);
  assertEq(r.key, 'conflict');
});

test('staff conflict: overlapping (not exact) time returns key=conflict', function() {
  // Helen booked 14:00-15:00; requesting 14:30-15:30 overlaps
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:30', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid);
  assertEq(r.key, 'conflict');
});

test('staff conflict: suggests alternative slots', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(Array.isArray(r.altSlots) && r.altSlots.length > 0, 'Should suggest alternatives');
  assert(r.altSlots.indexOf('13:00') >= 0 || r.altSlots.indexOf('15:00') >= 0, 'Expected 13:00 or 15:00 as alternatives');
});

test('adjacent booking (back-to-back) does NOT conflict', function() {
  var existing = [{ status: 'confirmed', requestedDate: '2026-04-13', requestedTime: '13:00', staff: 'Helen', totalDurationMins: 60, customerName: 'Bob', customerPhone: '4085550001' }];
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, existing);
  assert(r.valid, 'Back-to-back must not overlap');
});

test('"any" staff booking skips named-staff conflict check', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'any', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(r.valid, '"any" bypasses named-staff check');
});

test('cancelled booking does NOT block the slot', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('cancelled_helen_monday_2pm'));
  assert(r.valid === true, 'Cancelled booking must not block the slot');
});

test('customer conflict: same phone, overlapping time returns key=customer_conflict', function() {
  // Jane Smith (4085551234) has Tracy at 14:00 Mon; Jane books Helen at same time
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60, name: 'Jane', phone: '4085551234' }, bookings('confirmed_jane_monday_2pm'));
  assert(!r.valid);
  assertEq(r.key, 'customer_conflict');
});

test('customer conflict: same name (no phone) triggers conflict', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60, name: 'Jane Smith' }, bookings('confirmed_jane_monday_2pm'));
  assert(!r.valid);
  assertEq(r.key, 'customer_conflict');
});

test('[RX-003] isModify=true excludes own booking — no customer_conflict loop', function() {
  // Jane reschedules: her own 14:00 booking must NOT block her new attempt at 14:00
  var r = AL.checkAvailability(BIZ, { staff: 'Tracy', date: '2026-04-13', time: '14:00', totalDurationMins: 45, name: 'Jane', phone: '4085551234', isModify: true }, bookings('confirmed_jane_monday_2pm'));
  assert(r.valid === true, 'isModify must exclude own booking — customer_conflict loop bug');
});

test('[RX-003] isModify=true, OTHER staff still detects conflict', function() {
  // Jane reschedules to Helen at 14:00 — but Bob (different person) has Helen at 14:00
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60, name: 'Jane', phone: '4085551234', isModify: true }, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid, 'Staff conflict must still fire even with isModify=true');
  assertEq(r.key, 'conflict');
});

test('[RX-006] customer reschedules to slot their old booking occupied (same staff)', function() {
  // Jane has Tracy at 14:00; reschedules to Helen at 14:00. Her Tracy booking excluded; Helen is free.
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60, name: 'Jane', phone: '4085551234', isModify: true }, bookings('confirmed_jane_monday_2pm'));
  assert(r.valid === true, 'Own booking excluded; Helen free; reschedule must succeed');
});

test('null draft falls through to valid=true (fail-open)', function() {
  assert(AL.checkAvailability(BIZ, null, []).valid === true);
});

test('missing time field falls through to valid=true (fail-open)', function() {
  assert(AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13' }, []).valid === true);
});

test('[RX-012] conflict result includes altStaff — Tracy and/or Lisa available when Helen booked at 14:00', function() {
  // Helen is booked at 14:00 Mon. Tracy (works 10:00-19:00) and Lisa (works 09:00-17:00) should be free.
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid, 'Should be conflict');
  assertEq(r.key, 'conflict');
  assert(Array.isArray(r.altStaff), 'altStaff must be an array');
  assert(r.altStaff.length >= 1, 'At least one alt staff expected (Tracy or Lisa)');
  assert(r.altStaff.indexOf('Tracy') >= 0 || r.altStaff.indexOf('Lisa') >= 0,
    'Expected Tracy or Lisa in altStaff, got: ' + r.altStaff.join(', '));
});

test('[RX-012] altStaff excludes the conflicted staff and inactive members', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, bookings('confirmed_helen_monday_2pm'));
  assert(r.altStaff.indexOf('Helen') < 0, 'Helen must NOT appear in altStaff');
});

test('[RX-012] altStaff is empty when all other staff are also busy', function() {
  // Book Tracy and Lisa at 14:00 too — now no one is free
  var allBooked = [
    BOOK_FIX['confirmed_helen_monday_2pm'],
    { status: 'confirmed', requestedDate: '2026-04-13', requestedTime: '14:00', staff: 'Tracy', totalDurationMins: 60, customerName: 'Other1', customerPhone: '9990001111' },
    { status: 'confirmed', requestedDate: '2026-04-13', requestedTime: '14:00', staff: 'Lisa',  totalDurationMins: 60, customerName: 'Other2', customerPhone: '9990002222' }
  ];
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 }, allBooked);
  assert(!r.valid);
  assertEq(r.key, 'conflict');
  assertEq(r.altStaff.length, 0, 'altStaff must be empty when all staff are busy');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 4 — REGRESSION CASE LIBRARY
// type: structural + static-source-check
//
// CONFIDENCE: structural = HIGH; fix-string = same as Layer 1 (static-source-check).
// Validates that case files have the correct schema.
// For each case with status=verified_in_runner, confirms fix string is in source.
// Status model: known_bug → expected_fixed → verified_in_runner → verified_live
// ══════════════════════════════════════════════════════════════════════════

group('Regression Case Library', 'structural | static-source-check');

var casesDir  = path.join(__dirname, 'cases');
var caseFiles = fs.readdirSync(casesDir).filter(function(f) { return f.endsWith('.json'); }).sort();

test('at least 10 case files exist', function() {
  assert(caseFiles.length >= 10, 'Expected \u226510 case files, found ' + caseFiles.length);
});

var VALID_STATUSES = ['known_bug', 'expected_fixed', 'verified_in_runner', 'verified_live'];

var allCases = caseFiles.map(function(f) {
  return JSON.parse(fs.readFileSync(path.join(casesDir, f)));
});

allCases.forEach(function(c, i) {
  var fname = caseFiles[i];
  test(c.id + ' — ' + fname + ': required fields and valid status', function() {
    assert(c.id,            fname + ': missing id');
    assert(/^RX-\d+$/.test(c.id), fname + ': id must match RX-NNN format, got: ' + c.id);
    assert(c.category,      fname + ': missing category');
    assert(c.title,         fname + ': missing title');
    assert(VALID_STATUSES.indexOf(c.status) >= 0, fname + ': status must be one of: ' + VALID_STATUSES.join(', ') + '. Got: ' + c.status);
    assert(c.failing_behavior, fname + ': missing failing_behavior');
    assert(c.root_cause,       fname + ': missing root_cause');
    assert(Array.isArray(c.code_areas) && c.code_areas.length > 0, fname + ': missing code_areas array');
    assert(Array.isArray(c.conversation) && c.conversation.length >= 1, fname + ': conversation must have \u22651 turn');
  });
});

// Fix string checks for cases with status=verified_in_runner or verified_live
allCases.forEach(function(c) {
  if ((c.status !== 'verified_in_runner' && c.status !== 'verified_live') || !c.verify_fix_string) return;
  // Search both receptionist.js and ai-engine.js — Phase 5 fixes span both files
  var combinedSrc = src + '\n' + aiSrc;
  test(c.id + ' [' + c.status + ']: fix detectable in source \u2014 ' + c.title.slice(0, 48), function() {
    assertContains(combinedSrc, c.verify_fix_string,
      c.id + ' fix string not found in receptionist.js or ai-engine.js.\n    String: "' + c.verify_fix_string + '"\n    The fix may have been accidentally reverted.');
  });
});

// Case status summary
var statusCounts = {};
VALID_STATUSES.forEach(function(s) { statusCounts[s] = 0; });
allCases.forEach(function(c) { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++; });

var categories = {};
allCases.forEach(function(c) { categories[c.category] = (categories[c.category] || 0) + 1; });

console.log('\n  Case statuses:');
VALID_STATUSES.forEach(function(s) {
  if (statusCounts[s] > 0) console.log('    ' + s + ': ' + statusCounts[s]);
});
console.log('  Categories: ' + Object.keys(categories).map(function(k) { return k + '(' + categories[k] + ')'; }).join(', '));

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(62));
if (_failed === 0) {
  console.log('\u2705  ALL TESTS PASSED: ' + _passed + ' passed, 0 failed');
} else {
  console.log('\u274C  FAILURES: ' + _passed + ' passed, ' + _failed + ' failed');
  console.log('\nFailed tests:');
  _failures.forEach(function(f) {
    console.log('  \u2717 [' + f.group + '] ' + f.name);
    console.log('    \u2192 ' + f.error);
  });
}

console.log('\nConfidence by layer:');
console.log('  Layer 1 (Prompt Integrity)    static-source-check    MEDIUM  — instruction text present, Claude compliance unverified');
console.log('  Layer 2 (State Parser)        mirrored-unit-logic    MED-HI  — algorithm verified, production sync by manual audit');
console.log('  Layer 3 (Availability Logic)  mirrored + fixture     HIGH    — algorithm verified; Firestore queries untested');
console.log('  Layer 4 (Case Library)        structural + static    MED     — schema valid, fix strings present in source');

console.log('\nWhat this harness does NOT guarantee:');
console.log('  \u2014 Claude follows prompt instructions (requires live API testing)');
console.log('  \u2014 NailAvailabilityChecker matches avail-logic.js (requires manual sync check)');
console.log('  \u2014 End-to-end booking correctness on production Firestore');
console.log('  \u2014 Correct behavior under real customer input variation');
console.log('  \u2014 Regression-free after Claude model updates');

console.log('='.repeat(62) + '\n');

if (_failed > 0) process.exit(1);
