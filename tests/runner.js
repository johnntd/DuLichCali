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

var path       = require('path');
var fs         = require('fs');
var execSync   = require('child_process').execSync;

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
var mkSrc    = fs.readFileSync(path.join(__dirname, '../marketplace/marketplace.js'), 'utf8');
var vmSrc    = fs.readFileSync(path.join(__dirname, '../nailsalon/voice-mode.js'), 'utf8');

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

test('RX-022: AVAILABILITY CRITICAL RULE — BANNED PHRASES list present in prompt [RX-022]', function() {
  assertContains(src, "BANNED PHRASES — never say these to a customer",
    'RX-022: banned phrases rule must be present in _buildPrompt() AVAILABILITY section');
});

test('RX-022: AVAILABILITY CRITICAL RULE — no longer leaks "NOT real-time booking data" to Claude [RX-022]', function() {
  // The old prompt told Claude it lacked real-time data — Claude echoed this to customers.
  // Verify the leaked-fact phrasing is gone.
  var oldLeakedFact = 'You have staff SCHEDULE data (when technicians work) but NOT real-time booking data.';
  assert(src.indexOf(oldLeakedFact) < 0,
    'RX-022: old availability phrasing that told Claude it lacked real-time data must be removed — it caused Claude to say "I can\'t see real-time availability" to customers');
});

test('RX-022: Step E — does NOT instruct Claude to write premature confirmation text [RX-022]', function() {
  // Old Step E said "Write ONE warm, premium-receptionist confirmation" before availability check.
  assertContains(src, "DO NOT write a confirmation or claim the booking is confirmed",
    'RX-022: Step E must NOT instruct Claude to write premature confirmation text before availability check');
});

test('RX-022: Step E — old permissive confirmation instruction removed from prompt [RX-022]', function() {
  // The old Step E said "Write ONE warm, premium-receptionist confirmation" — must be gone.
  // The NEW Step E may reference these phrases in a NEVER/BANNED context, which is correct.
  assert(src.indexOf("Write ONE warm, premium-receptionist confirmation") < 0,
    'RX-022: old step E confirmation instruction ("Write ONE warm, premium-receptionist confirmation") must be removed from prompt');
  // Verify the new forbidding instruction is present
  assertContains(src, 'NEVER say "Your spot is reserved"',
    'RX-022: NEVER rule forbidding premature confirmation phrases must be present in step E');
});

test('RX-022: _validateResponseQuality — banned phrase detection wired in [RX-022]', function() {
  assertContains(src, "_bannedPhrases",
    'RX-022: _validateResponseQuality must contain banned phrase detection array');
  assertContains(src, "BANNED PHRASE detected in Claude response",
    'RX-022: _validateResponseQuality must console.warn when banned phrase detected');
});

// ── RX-023: _sanitizeResponse — permanent non-bypassable execution guard ─────
// Verifies the hard enforcement layer that blocks banned phrases before any
// display path. This is the non-bypassable system-level fix.

test('RX-023: _sanitizeResponse function defined in source [RX-023]', function() {
  assertContains(src, 'function _sanitizeResponse',
    'RX-023: _sanitizeResponse must be defined — it is the non-bypassable execution guard');
});

test('RX-023: _sanitizeResponse called as FIRST operation in send() .then() [RX-023]', function() {
  // Must appear immediately after _hideTyping in the .then() handler.
  // The call must precede earlyCheckReady and _appendMessage to be truly non-bypassable.
  assertContains(src, 'result = _sanitizeResponse(biz, result)',
    'RX-023: _sanitizeResponse must be called in send() and its result must replace result');
});

test('RX-023: _sanitizeResponse GUARD log message present [RX-023]', function() {
  assertContains(src, '[GUARD] _sanitizeResponse',
    'RX-023: _sanitizeResponse must log [GUARD] warning when a banned phrase is blocked');
});

test('RX-023: _sanitizeResponse corrects _aiHistory after sanitization [RX-023]', function() {
  // Without history correction, future Claude turns would see and build on the bad text.
  // The function must overwrite the last assistant entry in history with safe text.
  assertContains(src, '_wasSanitized',
    'RX-023: _sanitizeResponse must set _wasSanitized flag on result to signal sanitization occurred');
});

test('RX-023: _sanitizeResponse contains regex patterns for banned phrases [RX-023]', function() {
  assertContains(src, '_guardPatterns',
    'RX-023: _sanitizeResponse must use _guardPatterns regex array for broader phrase matching');
  assertContains(src, "can'?t\\s+see\\s+real",
    'RX-023: _guardPatterns must include regex for "can\'t see real-time"');
  assertContains(src, "limited\\s+to\\s+schedule\\s+data",
    'RX-023: _guardPatterns must include paraphrase patterns like "limited to schedule data"');
});

test('RX-023: _sanitizeResponse is wired before earlyCheckReady in send() [RX-023]', function() {
  // Verify call order: _sanitizeResponse must appear before _earlyCheckReady in source.
  // Both live in the same .then() callback in send().
  var sanitizePos = src.indexOf('result = _sanitizeResponse(biz, result)');
  var earlyPos    = src.indexOf('var _earlyCheckReady = (');
  assert(sanitizePos > 0, 'RX-023: _sanitizeResponse call must exist in source');
  assert(sanitizePos < earlyPos,
    'RX-023: _sanitizeResponse must appear BEFORE _earlyCheckReady in send() — it is the outermost gate');
});

test('RX-023: _sanitizeResponse clears escalationType on sanitized response [RX-023]', function() {
  // A sanitized response must not trigger the escalation handler.
  assertContains(src, '{ text: safe, escalationType: null, _wasSanitized: true }',
    'RX-023: _sanitizeResponse must return escalationType:null to prevent bad escalations');
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

// ══════════════════════════════════════════════════════════════════════════
// GROUP 5 — AVAILABILITY-FIRST HARDENING (RX-024)
// type: static-source-check
// Verifies: _staffAvailWithTime covers both intents, greeting rule uses real
// clock, SCHEDULE ≠ SLOT AVAILABILITY critical rule present in prompt.
// ══════════════════════════════════════════════════════════════════════════

test('RX-024: _staffAvailWithTime guard defined in source [RX-024]', function() {
  assertContains(src, 'var _staffAvailWithTime = (',
    'RX-024: _staffAvailWithTime guard must be defined — it is the safety net for schedule-vs-slot contradictions');
});

test('RX-024: _staffAvailWithTime covers staff_availability intent [RX-024]', function() {
  assertContains(src, "_ecs.intent === 'staff_availability' ||",
    'RX-024: _staffAvailWithTime must cover staff_availability intent');
});

test('RX-024: _staffAvailWithTime covers booking_request + no services gap [RX-024]', function() {
  assertContains(src, "_ecs.intent === 'booking_request' && (!_ecs.services || _ecs.services.length === 0)",
    'RX-024: _staffAvailWithTime must also fire for booking_request + no services — this is the earlyCheckReady gap');
});

test('RX-024: _staffAvailWithTime excluded when earlyCheckReady fires [RX-024]', function() {
  assertContains(src, '!_earlyCheckReady &&  // don\'t double-fire if already caught above',
    'RX-024: _staffAvailWithTime must NOT fire when _earlyCheckReady already handles the check');
});

test('RX-024: _staffAvailWithTime requires named staff (not "any") [RX-024]', function() {
  assertContains(src, "_ecs.staff.toLowerCase() !== 'any'",
    'RX-024: _staffAvailWithTime must not fire for "any" staff — slot check requires a named tech');
});

test('RX-024: _staffAvailWithTime requires time to be present [RX-024]', function() {
  // Guard must require _ecs.time — without a specific time there is nothing to validate
  var guardBlock = src.slice(src.indexOf('var _staffAvailWithTime = ('), src.indexOf(');', src.indexOf('var _staffAvailWithTime = (')));
  assert(guardBlock.indexOf('_ecs.time') >= 0,
    'RX-024: _staffAvailWithTime must require _ecs.time — no time means no specific slot to validate');
});

test('RX-024: _timeOfDay variable computed from real clock [RX-024]', function() {
  assertContains(src, "var _timeOfDay  = _hour < 12 ? 'morning' : _hour < 18 ? 'afternoon' : 'evening'",
    'RX-024: _timeOfDay must be computed from browser clock hours — morning/afternoon/evening buckets');
});

test('RX-024: GREETING RULE section present in prompt [RX-024]', function() {
  assertContains(src, "'=== GREETING RULE ==='",
    'RX-024: GREETING RULE section must be present in _buildPrompt()');
});

test('RX-024: Greeting rule forbids "Good day" [RX-024]', function() {
  assertContains(src, 'NEVER use "Good day" — it does not reflect the actual time of day.',
    'RX-024: prompt must explicitly forbid "Good day" greeting');
});

test('RX-024: Greeting rule injects _timeOfDay into prompt [RX-024]', function() {
  assertContains(src, "'Current time of day: ' + _timeOfDay + '.'",
    'RX-024: prompt must inject _timeOfDay value so Claude knows the correct greeting bucket');
});

test('RX-024: SCHEDULE ≠ SLOT AVAILABILITY critical rule in prompt [RX-024]', function() {
  assertContains(src, 'CRITICAL — SCHEDULE ≠ SLOT AVAILABILITY:',
    'RX-024: prompt must contain the SCHEDULE ≠ SLOT AVAILABILITY critical rule');
});

test('RX-024: Shift start ≠ slot open rule explicit in prompt [RX-024]', function() {
  assertContains(src, 'A staff shift start time is NOT proof that a slot is open.',
    'RX-024: prompt must state shift start time is NOT proof slot is open');
});

test('RX-024: Specific time → booking_request classification rule in prompt [RX-024]', function() {
  assertContains(src, 'If the customer names a SPECIFIC TIME',
    'RX-024: prompt must instruct Claude to classify specific-time questions as booking_request, not staff_availability');
});

// Fix string checks for cases with status=verified_in_runner or verified_live
allCases.forEach(function(c) {
  if ((c.status !== 'verified_in_runner' && c.status !== 'verified_live') || !c.verify_fix_string) return;
  // Search receptionist.js, ai-engine.js, marketplace.js, and voice-mode.js
  var combinedSrc = src + '\n' + aiSrc + '\n' + mkSrc + '\n' + vmSrc;
  test(c.id + ' [' + c.status + ']: fix detectable in source \u2014 ' + c.title.slice(0, 48), function() {
    assertContains(combinedSrc, c.verify_fix_string,
      c.id + ' fix string not found in any source file.\n    String: "' + c.verify_fix_string + '"\n    The fix may have been accidentally reverted.');
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
// GROUP 6 — UI OVERLAY REGRESSION (marketplace.js)
// type: static-source-check
//
// CONFIDENCE: MEDIUM — confirms fix code is present in marketplace.js.
// Does NOT verify runtime behavior on a real iOS device.
//
// RX-025: iOS fullscreen chat bleed-through.
// Root cause: position:fixed inside a stacking-context ancestor positions
// relative to the ancestor, not the viewport. Fix: move container to
// document.body on _fsOpen so it is always viewport-relative.
// ══════════════════════════════════════════════════════════════════════════

group('UI Overlay Regression (marketplace.js)', 'static-source-check');

test('RX-025: _origParent saved before container is moved to body [RX-025]', function() {
  assertContains(mkSrc, '_origParent  = container.parentNode',
    'RX-025: _origParent must be saved before body-move — required to restore on close');
});

test('RX-025: _origNextSib saved before container is moved to body [RX-025]', function() {
  assertContains(mkSrc, '_origNextSib = container.nextSibling',
    'RX-025: _origNextSib must be saved — insertBefore(null) appends to end, may break re-open');
});

test('RX-025: container moved to document.body on _fsOpen [RX-025]', function() {
  assertContains(mkSrc, 'document.body.appendChild(container)',
    'RX-025: container must be appended to body — stacking-context fix requires body-child position:fixed');
});

test('RX-025: mp-ai-open-root added to documentElement (html) on open [RX-025]', function() {
  assertContains(mkSrc, "document.documentElement.classList.add('mp-ai-open-root')",
    "RX-025: html element needs mp-ai-open-root class — iOS Safari ignores overflow:hidden on body alone");
});

test('RX-025: container restored to original DOM position on _fsClose [RX-025]', function() {
  assertContains(mkSrc, '_origParent.insertBefore(container, _origNextSib)',
    'RX-025: container must be restored via insertBefore on close — prevents widget disappearing after chat closes');
});

test('RX-025: mp-ai-open-root removed from documentElement on close [RX-025]', function() {
  assertContains(mkSrc, "document.documentElement.classList.remove('mp-ai-open-root')",
    'RX-025: mp-ai-open-root must be removed on close — leaving it would lock page scroll permanently');
});

test('RX-025: body.style.position NOT used for scroll lock (causes iOS viewport bugs) [RX-025]', function() {
  // The old broken approach set body.style.position = 'fixed' for scroll lock.
  // This interferes with visualViewport.resize on iOS and causes coordinate bugs.
  // The fix uses overflow:hidden via CSS class instead.
  // Check the _fsOpen function specifically — it must NOT set body.style.position.
  var fsOpenStart = mkSrc.indexOf('function _fsOpen()');
  var fsOpenEnd   = mkSrc.indexOf('function _fsClose()', fsOpenStart);
  var fsOpenBody  = fsOpenStart >= 0 && fsOpenEnd > fsOpenStart
    ? mkSrc.slice(fsOpenStart, fsOpenEnd)
    : '';
  assert(fsOpenBody.length > 0, 'RX-025: _fsOpen function not found in marketplace.js');
  assert(fsOpenBody.indexOf("body.style.position = 'fixed'") < 0,
    "RX-025: body.style.position='fixed' must NOT be in _fsOpen — it breaks visualViewport.resize on iOS");
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 7 — VOICE MODE REGRESSION (voice-mode.js)
// type: static-source-check
//
// CONFIDENCE: MEDIUM — confirms fix code present in voice-mode.js source.
// Does NOT verify runtime STT/TTS behavior on a real iOS device.
//
// RX-026: Mic button stuck disabled during processing (input delay every turn)
// RX-027: No way to skip TTS during processing (must wait for full reply)
// ══════════════════════════════════════════════════════════════════════════

group('Voice Mode Regression (voice-mode.js)', 'static-source-check');

test('RX-026: mic disabled only during listening (not processing) [RX-026]', function() {
  assertContains(vmSrc, "mic.disabled = (s === 'listening')",
    "RX-026: mic.disabled must gate on 'listening' state only — gating on 'processing' blocked user input for 1-3s every turn");
});

test('RX-026: mic NOT disabled during processing state [RX-026]', function() {
  assertNotContains(vmSrc, "mic.disabled = (s === 'processing')",
    "RX-026: mic must NOT be disabled during processing — the old gate that caused the input delay must be gone");
});

test('RX-027: _interruptNext flag defined in module state [RX-027]', function() {
  assertContains(vmSrc, '_interruptNext',
    'RX-027: _interruptNext flag must exist — it is the mechanism to skip TTS when mic tapped during processing');
});

test('RX-027: mic tap during processing sets _interruptNext instead of silently dropping [RX-027]', function() {
  assertContains(vmSrc, '_interruptNext = true',
    'RX-027: processing state tap must set _interruptNext=true — silent discard was the pre-fix behavior');
});

test('RX-027: _interruptNext flag checked in bot-reply callback [RX-027]', function() {
  assertContains(vmSrc, 'if (_interruptNext)',
    'RX-027: bot-reply callback must check _interruptNext — this is where TTS skip decision is made');
});

test('RX-027: _interruptNext cleared after use and on close [RX-027]', function() {
  // Count occurrences — must appear at least twice: in the callback AND in close()
  var count = 0, idx = 0, needle = '_interruptNext = false';
  while ((idx = vmSrc.indexOf(needle, idx)) >= 0) { count++; idx++; }
  assert(count >= 2,
    'RX-027: _interruptNext must be cleared in at least two places (after use + in close()) — found ' + count);
});

test('RX-027: biz._isVoiceMode set when voice overlay opens [RX-027]', function() {
  assertContains(vmSrc, 'biz._isVoiceMode = true',
    'RX-027: biz._isVoiceMode must be set on open — receptionist uses it to shorten AI responses for speech');
});

test('RX-027: biz._isVoiceMode cleared when voice overlay closes [RX-027]', function() {
  assertContains(vmSrc, '_biz._isVoiceMode = false',
    'RX-027: biz._isVoiceMode must be cleared on close — leaving it set would force short responses in text mode too');
});

test('Voice mode prompt block: receptionist shortens responses in voice mode [RX-027]', function() {
  assertContains(src, 'biz._isVoiceMode',
    'Voice mode prompt: receptionist._buildPrompt must check biz._isVoiceMode to switch to short spoken-language responses');
});

test('Voice mode prompt block: maximum 25 words per response rule [RX-027]', function() {
  assertContains(src, 'Maximum 25 words',
    'Voice mode: prompt must cap response length at 25 words for TTS delivery');
});

// RX-028: OpenAI + Gemini TTS chain broken by risky additions (abort controller, voice overrides)
// Both fell through to browser TTS silently. Fix: revert TTS functions to committed baseline.
test('RX-028: OpenAI TTS uses hardcoded nova voice (no Firestore override) [RX-028]', function() {
  assertContains(vmSrc, "voice: 'nova'",
    "RX-028: OpenAI TTS voice must be hardcoded 'nova' — pulling from Firestore ttsVoice caused 400 errors when field had invalid value");
});

test('RX-028: No AbortController in _speakViaOpenAi (caused silent TTS failure) [RX-028]', function() {
  assertNotContains(vmSrc, 'AbortController',
    'RX-028: AbortController must not be present in voice-mode.js — it caused OpenAI TTS to fail silently and fall through to browser TTS');
});

test('RX-028: _speakReply uses original nested-if callback structure [RX-028]', function() {
  assertContains(vmSrc, 'if (!s1 && _state === \'speaking\')',
    "RX-028: _speakReply must use original '!s1 && _state' form — restructured early-return form introduced risk");
});

test('RX-028: Gemini TTS uses hardcoded voice (no Firestore geminiVoice override) [RX-028]', function() {
  assertNotContains(vmSrc, 'geminiVoice)',
    "RX-028: Gemini TTS must not pull voice from biz.aiReceptionist.geminiVoice — invalid Firestore values caused Gemini TTS to fail");
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 9 — VOICE MODE: AUTO-RESTART LISTENING DELAY
// RX-031: After TTS ends, the mic took 700ms + SpeechRecognition init time
// (~200ms) = ~900ms before the user's voice was captured. Users consistently
// missed the first 1-2 words of their responses.
// Fix: reduce auto-restart delay from 700ms → 300ms.
// The 300ms delay is enough to prevent audio bleed (TTS audio feeding the mic)
// while matching natural conversational turn-taking cadence.
// type: static-source-check
// ══════════════════════════════════════════════════════════════════════════

group('Voice Mode: Auto-Restart Listening Delay (RX-031)', 'static-source-check');

test('RX-031: _autoRestartListening delay is ≤ 400ms (was 700ms — caused first words to be cut off) [RX-031]', function() {
  var fnStart = vmSrc.indexOf('function _autoRestartListening(');
  assert(fnStart >= 0, 'RX-031: _autoRestartListening function not found');
  var fnSlice = vmSrc.slice(fnStart, fnStart + 300);
  var delayMatch = fnSlice.match(/setTimeout\s*\([^,]+,\s*(\d+)\s*\)/);
  assert(delayMatch, 'RX-031: setTimeout not found in _autoRestartListening — function structure changed');
  var delay = parseInt(delayMatch[1], 10);
  assert(delay <= 400,
    'RX-031: auto-restart delay is ' + delay + 'ms — must be ≤ 400ms. ' +
    'The original 700ms + SpeechRecognition init (~200ms) = ~900ms dead zone where first words are lost. ' +
    '300ms is the natural conversational turn-taking gap and prevents audio bleed from the TTS ending.');
});

test('RX-031: _autoRestartListening delay is > 100ms (prevents audio bleed from TTS tail) [RX-031]', function() {
  var fnStart = vmSrc.indexOf('function _autoRestartListening(');
  assert(fnStart >= 0, 'RX-031: _autoRestartListening function not found');
  var fnSlice = vmSrc.slice(fnStart, fnStart + 300);
  var delayMatch = fnSlice.match(/setTimeout\s*\([^,]+,\s*(\d+)\s*\)/);
  assert(delayMatch, 'RX-031: setTimeout not found in _autoRestartListening');
  var delay = parseInt(delayMatch[1], 10);
  assert(delay > 100,
    'RX-031: auto-restart delay is ' + delay + 'ms — must be > 100ms. ' +
    'Too short causes the mic to open while TTS audio is still ringing, producing echo/bleed artifacts.');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 10 — VOICE MODE: API KEY FALLBACK CHAIN
// RX-029: OpenAI/Gemini TTS fell through to browser voice because vendor doc
// had no openaiKey/geminiKey and the code went straight to stale localStorage.
// Platform-level keys (_platformOpenAiKey / _platformGeminiKey) must be tried
// before localStorage so vendors without their own keys still get quality TTS.
// type: static-source-check
// ══════════════════════════════════════════════════════════════════════════

group('Voice Mode: API Key Fallback Chain (RX-029)', 'static-source-check');

test('RX-029: _speakViaOpenAi tries platform key before localStorage [RX-029]', function() {
  assertContains(vmSrc, "_biz._platformOpenAiKey",
    "RX-029: _speakViaOpenAi must include _platformOpenAiKey in fallback chain — vendors without their own openaiKey fall through to browser TTS without it");
});

test('RX-029: _speakViaOpenAi platform key fallback comes before localStorage [RX-029]', function() {
  // Check that _platformOpenAiKey appears in the key= line BEFORE the localStorage.getItem call
  var speakFnStart = vmSrc.indexOf('function _speakViaOpenAi(');
  assert(speakFnStart >= 0, 'RX-029: _speakViaOpenAi function not found');
  var fnSlice = vmSrc.slice(speakFnStart, speakFnStart + 500);
  var platformIdx = fnSlice.indexOf('_platformOpenAiKey');
  var localStorageIdx = fnSlice.indexOf('localStorage.getItem');
  assert(platformIdx >= 0,    'RX-029: _platformOpenAiKey not found in _speakViaOpenAi');
  assert(localStorageIdx >= 0, 'RX-029: localStorage.getItem not found in _speakViaOpenAi');
  assert(platformIdx < localStorageIdx,
    'RX-029: _platformOpenAiKey must appear BEFORE localStorage.getItem in _speakViaOpenAi — otherwise stale local key shadows valid platform key');
});

test('RX-029: _speakViaGemini tries platform key before localStorage [RX-029]', function() {
  assertContains(vmSrc, "_biz._platformGeminiKey",
    "RX-029: _speakViaGemini must include _platformGeminiKey in fallback chain — vendors without their own geminiKey fall through to browser TTS without it");
});

test('RX-029: _speakViaGemini platform key fallback comes before localStorage [RX-029]', function() {
  var speakFnStart = vmSrc.indexOf('function _speakViaGemini(');
  assert(speakFnStart >= 0, 'RX-029: _speakViaGemini function not found');
  var fnSlice = vmSrc.slice(speakFnStart, speakFnStart + 500);
  var platformIdx = fnSlice.indexOf('_platformGeminiKey');
  var localStorageIdx = fnSlice.indexOf('localStorage.getItem');
  assert(platformIdx >= 0,    'RX-029: _platformGeminiKey not found in _speakViaGemini');
  assert(localStorageIdx >= 0, 'RX-029: localStorage.getItem not found in _speakViaGemini');
  assert(platformIdx < localStorageIdx,
    'RX-029: _platformGeminiKey must appear BEFORE localStorage.getItem in _speakViaGemini — otherwise stale local key shadows valid platform key');
});

test('RX-029: _prefetchWelcome tries platform key before localStorage [RX-029]', function() {
  var fnStart = vmSrc.indexOf('function _prefetchWelcome(');
  assert(fnStart >= 0, 'RX-029: _prefetchWelcome function not found');
  var fnSlice = vmSrc.slice(fnStart, fnStart + 500);
  var platformIdx = fnSlice.indexOf('_platformOpenAiKey');
  var localStorageIdx = fnSlice.indexOf('localStorage.getItem');
  assert(platformIdx >= 0,    'RX-029: _platformOpenAiKey not found in _prefetchWelcome — prefetch would 401 for vendors without their own key');
  assert(localStorageIdx >= 0, 'RX-029: localStorage.getItem not found in _prefetchWelcome');
  assert(platformIdx < localStorageIdx,
    'RX-029: _platformOpenAiKey must appear BEFORE localStorage.getItem in _prefetchWelcome');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 10 — RECEPTIONIST.JS SYNTAX STABILITY
// RX-030: receptionist.js _buildPrompt had a missing ) that caused the entire
// file to fail to load silently — all AI and voice functionality stopped working.
// Root cause: `return voiceModeBlock.concat([` added without a matching `)`
// at the end, leaving the return statement with an unbalanced paren.
// type: static-source-check + parse-check
// ══════════════════════════════════════════════════════════════════════════

group('Receptionist.js Syntax Stability (RX-030)', 'static-source-check');

test('RX-030: receptionist.js parses without syntax errors [RX-030]', function() {
  var recPath = path.join(__dirname, '../nailsalon/receptionist.js');
  try {
    execSync('node --check "' + recPath + '"', { stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      'RX-030: receptionist.js has a syntax error — the entire file fails to load when this happens, ' +
      'silently breaking all AI and voice functionality. Error: ' + (e.stderr || e.message).toString().trim()
    );
  }
});

test('RX-030: _buildPrompt returns voiceModeBlock.concat with balanced closing paren [RX-030]', function() {
  // When `return voiceModeBlock.concat([` was added, the closing `)` was missing.
  // The correct closing sequence is `])).join('\n')` — two `)` close the inner
  // .concat( and the outer voiceModeBlock.concat( before the .join chains.
  assertContains(src, "])).join('\\n')",
    "RX-030: _buildPrompt must close voiceModeBlock.concat( with ])).join — a single ] would leave the outer concat( unclosed, causing a parse error that silently kills the whole file");
});

test('RX-030: _buildPrompt uses voiceModeBlock.concat (not bare array return) [RX-030]', function() {
  assertContains(src, 'return voiceModeBlock.concat([',
    'RX-030: _buildPrompt must prepend voiceModeBlock via concat — voice mode prompt shortening requires this');
});

test('RX-030: voice-mode.js parses without syntax errors [RX-030]', function() {
  var vmPath = path.join(__dirname, '../nailsalon/voice-mode.js');
  try {
    execSync('node --check "' + vmPath + '"', { stdio: 'pipe' });
  } catch (e) {
    throw new Error(
      'RX-030: voice-mode.js has a syntax error — the file fails to load silently. Error: ' +
      (e.stderr || e.message).toString().trim()
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 11 — PHONE INTAKE helper (phone-intake.js)
// type: mirrored-unit-logic
// Tests normalizeSpokenPhoneNumber word-parsing only.
// These tests cover the HELPER, not booking finalization.
// _mergeState accepts only full US numbers (10 digits, or 11 starting with 1).
// Helper results of 6–9 digits are valid partial parses here but are NOT stored by _mergeState.
// ══════════════════════════════════════════════════════════════════════════

group('Phone Intake helper (phone-intake.js)', 'mirrored-unit-logic');

var PhoneIntake;
try {
  PhoneIntake = require('../nailsalon/phone-intake.js');
} catch (e) {
  PhoneIntake = null;
}

function piTest(id, desc, input, lang, expected) {
  test(id + ': ' + desc, function () {
    assert(PhoneIntake, id + ': phone-intake.js could not be loaded');
    var result = PhoneIntake.normalizeSpokenPhoneNumber(input, lang);
    if (expected === null) {
      assert(result === null, id + ': expected null but got "' + result + '"');
    } else {
      assert(result === expected,
        id + ': expected "' + expected + '" but got "' + result + '"');
    }
  });
}

piTest('PI-001', 'Vietnamese digit words → digit string',
  'không một hai ba bốn năm sáu bảy tám chín', 'vi', '0123456789');
piTest('PI-002', 'English digit words → digit string',
  'four zero eight nine one six three four three nine', 'en', '4089163439');
piTest('PI-003', 'Mixed Vietnamese/English — helper returns partial (6 digits; not stored by _mergeState)',
  'không một hai ba four five', 'vi', '012345');
piTest('PI-004', 'Already-digit string passes through',
  '4089163439', 'en', '4089163439');
piTest('PI-005', 'Digit string with dashes',
  '408-916-3439', 'en', '4089163439');
piTest('PI-006', 'Digit string with dots',
  '408.916.3439', 'en', '4089163439');
piTest('PI-007', 'Filler word "số" skipped — helper returns partial (7 digits; not stored by _mergeState)',
  'số không một hai ba bốn năm sáu', 'vi', '0123456');
piTest('PI-008', 'Filler word "phone" skipped — helper returns partial (6 digits; not stored by _mergeState)',
  'phone four zero eight nine one six', 'en', '408916');
piTest('PI-009', 'Too short → null',
  'một hai ba', 'vi', null);
piTest('PI-010', 'Too long (>11 digits) → null',
  'một hai ba bốn năm sáu bảy tám chín không một hai', 'vi', null);
piTest('PI-011', 'Null input → null',
  null, 'en', null);
piTest('PI-012', 'Empty string → null',
  '', 'en', null);
piTest('PI-013', 'Unknown token → null',
  'hello world', 'en', null);
piTest('PI-014', 'Filler "là" skipped, result valid',
  'là bốn không tám chín một sáu ba bốn ba chín', 'vi', '4089163439');

// ══════════════════════════════════════════════════════════════════════════
// GROUP 12 — SHARED SALON RETURNING CUSTOMER MEMORY
// type: unit
// Covers shared nails/hair customer memory helper and static receptionist wiring.
// ══════════════════════════════════════════════════════════════════════════

group('Shared Salon Returning Customer Memory', 'unit');

var SalonCustomerMemory;
try {
  SalonCustomerMemory = require('../nailsalon/customer-memory.js');
} catch (e) {
  SalonCustomerMemory = null;
}

var cmSrc = fs.existsSync(path.join(__dirname, '../nailsalon/customer-memory.js'))
  ? fs.readFileSync(path.join(__dirname, '../nailsalon/customer-memory.js'), 'utf8')
  : '';
var nailHtml = fs.readFileSync(path.join(__dirname, '../nailsalon/index.html'), 'utf8');
var hairHtml = fs.readFileSync(path.join(__dirname, '../hairsalon/index.html'), 'utf8');

function memoryRecords() {
  return [
    {
      vendorId: 'luxurious-nails',
      customerName: 'Jane Nguyen',
      customerPhone: '4085551234',
      services: ['Gel Manicure'],
      staff: 'Tracy',
      requestedDate: '2026-04-20',
      createdAt: 100
    },
    {
      vendorId: 'beauty-hair-oc',
      customerName: 'Minh Tran',
      customerPhone: '(714) 555-1212',
      services: ['Women\'s Haircut'],
      staff: 'Michele',
      requestedDate: '2026-04-21',
      createdAt: 200
    },
    {
      vendorId: 'other-vendor',
      customerName: 'Private Customer',
      customerPhone: '4085551234',
      services: ['Private Service'],
      staff: 'Hidden',
      createdAt: 300
    }
  ];
}

test('Phone-first booking intent prompts for phone before name/service', function() {
  assertContains(src, '_isPhoneFirstBookingIntent');
  assertContains(src, '_buildPhoneFirstPrompt');
  assertContains(src, 'look up your customer record');
  assert(src.indexOf('_maybeHandleSalonCustomerMemory') < src.indexOf('AIEngine.call'),
    'memory/phone-first intercept must run before AIEngine.call');
});

test('Returning customer lookup uses normalized phone', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var phone = SalonCustomerMemory.normalizePhone('+1 (408) 555-1234');
  assertEq(phone, '4085551234');
  var found = SalonCustomerMemory.findReturningSalonCustomerInRecords(
    memoryRecords(),
    { id: 'luxurious-nails' },
    '+1 (408) 555-1234'
  );
  assertEq(found.name, 'Jane Nguyen');
  assertContains(cmSrc, 'customerPhoneNormalized');
  assertContains(cmSrc, 'phoneNormalized');
  assertContains(cmSrc, 'scanVendorBookings');
});

test('Returning customer greeting English includes name/service/staff', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var msg = SalonCustomerMemory.buildReturningCustomerGreeting({
    name: 'Jane Nguyen',
    lastService: 'Gel Manicure',
    lastStaff: 'Tracy'
  }, 'en');
  assertContains(msg, 'Jane Nguyen');
  assertContains(msg, 'Gel Manicure');
  assertContains(msg, 'Tracy');
});

test('Returning customer greeting Vietnamese includes name/service/staff and “lần trước”', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var msg = SalonCustomerMemory.buildReturningCustomerGreeting({
    name: 'Jane Nguyen',
    lastService: 'Gel Manicure',
    lastStaff: 'Tracy'
  }, 'vi');
  assertContains(msg, 'Jane Nguyen');
  assertContains(msg, 'Gel Manicure');
  assertContains(msg, 'Tracy');
  assertContains(msg, 'lần trước');
});

test('Returning customer greeting Spanish includes name/service/staff and “La última vez”', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var msg = SalonCustomerMemory.buildReturningCustomerGreeting({
    name: 'Jane Nguyen',
    lastService: 'Gel Manicure',
    lastStaff: 'Tracy'
  }, 'es');
  assertContains(msg, 'Jane Nguyen');
  assertContains(msg, 'Gel Manicure');
  assertContains(msg, 'Tracy');
  assertContains(msg, 'La última vez');
});

test('Name-only returning customer does not invent service/staff', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var msg = SalonCustomerMemory.buildReturningCustomerGreeting({ name: 'Jane Nguyen' }, 'en');
  assertContains(msg, 'Welcome back, Jane Nguyen');
  assertNotContains(msg, 'Last time');
  assertNotContains(msg, 'with Tracy');
  assertContains(src, '_serviceStillExistsAtVendor');
  assertContains(src, '_staffStillWorksAtVendor');
});

test('No record found falls back to normal new-customer flow', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var found = SalonCustomerMemory.findReturningSalonCustomerInRecords(
    memoryRecords(),
    { id: 'luxurious-nails' },
    '4085559999'
  );
  assertEq(found, null);
});

test('Vendor scoping prevents cross-vendor leakage', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  var found = SalonCustomerMemory.findReturningSalonCustomerInRecords(
    memoryRecords(),
    { id: 'luxurious-nails' },
    '4085551234'
  );
  assertEq(found.name, 'Jane Nguyen');
  assertNotContains(found.lastService, 'Private Service');
  assertContains(cmSrc, "collection('vendors').doc(vendorId).collection('bookings')");
});

test('Lookup failure is safe and does not break booking flow', function() {
  assert(SalonCustomerMemory, 'customer-memory.js could not be loaded');
  assertContains(cmSrc, '.catch(function () { return null; })');
  assertContains(src, '.catch(function ()');
});

test('Memory suggestions do not bypass booking validation', function() {
  assertContains(src, 'All booking details must still be validated before confirming');
  assertContains(src, 'NailAvailabilityChecker');
  assertContains(src, '_validateResponseQuality');
  assertContains(src, 'ESCALATE:appointment');
});

test('Both nails and hair contexts are covered', function() {
  assertContains(nailHtml, '/nailsalon/customer-memory.js');
  assertContains(hairHtml, '/nailsalon/customer-memory.js');
  assertContains(nailHtml, '/nailsalon/receptionist.js');
  assertContains(hairHtml, '/nailsalon/receptionist.js');
  assertContains(cmSrc, 'lookupReturningSalonCustomer');
  assertContains(cmSrc, 'buildReturningCustomerGreeting');
});

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
console.log('  Layer 5 (UI Overlay)          static-source-check    MEDIUM  — fix code present in marketplace.js; iOS runtime unverified');
console.log('  Layer 6 (Voice Mode)          static-source-check    MEDIUM  — fix code present in voice-mode.js; device runtime unverified');

console.log('\nWhat this harness does NOT guarantee:');
console.log('  \u2014 Claude follows prompt instructions (requires live API testing)');
console.log('  \u2014 NailAvailabilityChecker matches avail-logic.js (requires manual sync check)');
console.log('  \u2014 End-to-end booking correctness on production Firestore');
console.log('  \u2014 Correct behavior under real customer input variation');
console.log('  \u2014 Regression-free after Claude model updates');

console.log('='.repeat(62) + '\n');

if (_failed > 0) process.exit(1);
