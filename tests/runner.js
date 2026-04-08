#!/usr/bin/env node
'use strict';
// tests/runner.js — Nail Receptionist Regression Harness
// Run: node tests/runner.js
//
// Tests are grouped into 4 layers:
//   1. Prompt Integrity  — verify key instructions exist in receptionist.js source
//   2. State Parser      — pure function tests for STATE/BOOKING/ESCALATE parsing
//   3. Availability Logic— unit tests for the slot-conflict algorithm (no Firebase)
//   4. Case Library      — structure validation + fix verification for all known bugs

var path = require('path');
var fs   = require('fs');

// ── Assertion helpers ─────────────────────────────────────────────────────

var _passed = 0, _failed = 0, _currentGroup = '', _failures = [];

function group(name) {
  _currentGroup = name;
  console.log('\n[' + name + ']');
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

// ── Helper: array of fixture bookings by key ─────────────────────────────

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
// Verify that critical fix instructions are present in receptionist.js.
// If any of these fail, a known bug may have been silently regressed.
// ══════════════════════════════════════════════════════════════════════════

group('Prompt Integrity');
var src = PC.loadSource();

test('ENTITY_EXTRACTION: old "inherit from STATE" instruction is gone', function() {
  assertNotContains(src, 'inherit from STATE if booking_request',
    'Legacy inherit-from-STATE staff rule still present — CASE-001 may regress');
});

test('ENTITY_EXTRACTION: updated staff rule says "do NOT inherit prior staff"', function() {
  assertContains(src, 'Do NOT inherit prior staff',
    'CASE-001/002 fix: staff entity extraction must not inherit conflicting staff from STATE');
});

test('CONFLICT_RESOLUTION — STAFF SWITCH section exists', function() {
  assertContains(src, 'CONFLICT RESOLUTION \u2014 STAFF SWITCH',
    'CASE-001/002 fix: CONFLICT_RESOLUTION section must exist for staff-switch handling');
});

test('CONFLICT_RESOLUTION: instructs to KEEP date/time from STATE', function() {
  assertContains(src, 'KEEP date and time from CURRENT BOOKING STATE',
    'CONFLICT_RESOLUTION must preserve date/time during staff switch');
});

test('booking_offer affirmative: clears pendingAction (prevents re-ask loop)', function() {
  assertContains(src, 'Set pendingAction: null in STATE (transition is done',
    'booking_offer loop fix: affirmative response must clear pendingAction');
});

test('"replace it" handling: clears time to null (prevents customer_conflict loop)', function() {
  assertContains(src, 'Set time: null (new time needed)',
    'CASE-003 fix: "replace it" response must clear time to null so old slot is not re-checked');
});

test('"replace it": instructs to ask ONCE and not re-show conflict', function() {
  assertContains(src, 'Do NOT re-show the conflict message',
    'CASE-003 fix: replace-it path must suppress re-showing conflict message');
});

test('CANCEL BOOKING section exists', function() {
  assertContains(src, '=== CANCEL BOOKING ===',
    'CASE-004 fix: CANCEL BOOKING section must exist in system prompt');
});

test('CANCEL: handles "cancel" without telling customer to call salon', function() {
  assertContains(src, 'Do NOT tell the customer to call the salon to cancel',
    'CASE-004 fix: AI must handle cancel directly, not redirect to phone');
});

test('_earlyCheckReady: passes isModify flag for modify_booking state', function() {
  assertContains(src, 'isModify:          _inModify',
    'CASE-003/006 fix: isModify must be passed to availability check in earlyCheckReady');
});

test('_earlyCheckReady: passes phone when in modify mode', function() {
  assertContains(src, "phone:             _inModify ? (_ecs.phone || null) : null",
    'CASE-003/006 fix: phone must be passed with isModify so own booking is excluded');
});

test('Post-booking state context: BOOKING STATUS: CONFIRMED signal', function() {
  assertContains(src, 'BOOKING STATUS: CONFIRMED',
    'CASE-009 fix: state context must signal confirmed booking so Claude knows not to re-collect fields');
});

test('Post-booking state context: Do NOT ask for date/time again', function() {
  assertContains(src, 'Do NOT ask for date/time again',
    'CASE-009 fix: explicitly tells Claude not to re-ask date/time after booking confirmed');
});

test('Confirmation text: "no further action needed" (prevents ambiguous close)', function() {
  assertContains(src, 'no further action needed',
    'CASE-009 fix: confirmation must be unambiguous and final');
});

test('_submitDirectBooking: isExactReschedule logic present (update-in-place)', function() {
  assertContains(src, 'isExactReschedule',
    'CASE-005 fix: must use .update() for reschedule with known booking ID');
});

test('_fetchLiveBizData: live data refresh exists (stale hours mitigation)', function() {
  assertContains(src, '_fetchLiveBizData',
    'CASE-010: live data refresh function must exist');
});

test('10-minute data cache interval present', function() {
  assertContains(src, '600000',
    'CASE-010: 10-minute cache window should be configured');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 2 — STATE PARSER
// Verify the parseStateMarker / parseEscalationType / parseBookingDraft
// functions work correctly. These are the decoding layer between Claude
// and the JS state machine.
// ══════════════════════════════════════════════════════════════════════════

group('State Parser');

test('parses a complete STATE marker', function() {
  var reply = 'What service would you like?\n[STATE:{"intent":"booking_request","services":["Gel Manicure"],"staff":"Tracy","date":"2026-04-13","time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]';
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
  var reply = 'Tracy is free at 2 PM! Would you like to book that?\n[STATE:{"intent":"booking_request","services":["Manicure"],"staff":"Tracy","date":"2026-04-13","time":"14:00","name":null,"phone":null,"lang":"en","pendingAction":"booking_offer","existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assertEq(s.pendingAction, 'booking_offer');
});

test('parses STATE with pendingAction=modify_booking', function() {
  var reply = 'What new time would you like?\n[STATE:{"intent":"booking_request","services":["Manicure"],"staff":"Helen","date":"2026-04-13","time":null,"name":"Jane","phone":"4085551234","lang":"en","pendingAction":"modify_booking","existingBookingId":null}]';
  var s = SP.parseStateMarker(reply);
  assertEq(s.pendingAction, 'modify_booking');
  assert(s.time === null, 'time should be null after "replace it"');
});

test('extracts escalation type: appointment', function() {
  var t = SP.parseEscalationType('Perfect!\n[BOOKING:{}]\n[ESCALATE:appointment]');
  assertEq(t, 'appointment');
});

test('extracts escalation type: cancel', function() {
  var t = SP.parseEscalationType("Of course, I've cancelled it.\n[ESCALATE:cancel]");
  assertEq(t, 'cancel');
});

test('escalation type is case-insensitive', function() {
  var t = SP.parseEscalationType('[ESCALATE:APPOINTMENT]');
  assertEq(t, 'appointment');
});

test('returns null when no escalation marker', function() {
  var t = SP.parseEscalationType('Just checking availability.');
  assert(t === null);
});

test('parses BOOKING draft', function() {
  var d = SP.parseBookingDraft('[BOOKING:{"services":["Gel Manicure"],"staff":"Tracy","date":"2026-04-13","time":"14:00","name":"Jane","phone":"4085551234","lang":"en"}]');
  assert(d !== null);
  assertEq(d.staff, 'Tracy');
  assertEq(d.time, '14:00');
  assertEq(d.lang, 'en');
});

test('BOOKING draft returns null on malformed JSON', function() {
  var d = SP.parseBookingDraft('[BOOKING:{bad json}]');
  assert(d === null);
});

test('mergeState applies all update keys', function() {
  var current = { intent: 'general', services: [], staff: null, time: null, pendingAction: null };
  var update  = { intent: 'booking_request', staff: 'Tracy', services: ['Gel Manicure'] };
  var merged  = SP.mergeState(current, update);
  assertEq(merged.intent, 'booking_request');
  assertEq(merged.staff, 'Tracy');
  assertEq(merged.time, null); // unchanged
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 3 — AVAILABILITY LOGIC
// Pure algorithm tests against fixture data. No Firebase. No network.
// Uses the extracted avail-logic.js which mirrors NailAvailabilityChecker.
// ══════════════════════════════════════════════════════════════════════════

group('Availability Logic');

// 2026-04-13 = Monday (Helen works 09:00-18:00, Tracy 10:00-19:00)
// 2026-04-14 = Tuesday (same schedule)
// 2026-04-19 = Sunday  (nobody works)

test('free slot: empty schedule returns valid=true', function() {
  var draft = { staff: 'Helen', date: '2026-04-13', time: '10:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, []);
  assert(r.valid === true, 'free slot should be valid');
});

test('staff not working that day (Sunday) returns key=staff_not_working', function() {
  var draft = { staff: 'Helen', date: '2026-04-19', time: '10:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, []);
  assert(!r.valid, 'Helen does not work Sundays');
  assertEq(r.key, 'staff_not_working');
});

test('Lisa does not work Tuesdays', function() {
  var draft = { staff: 'Lisa', date: '2026-04-14', time: '10:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, []);
  assert(!r.valid, 'Lisa has null for Tuesday');
  assertEq(r.key, 'staff_not_working');
});

test('time after shift end returns key=outside_shift', function() {
  var draft = { staff: 'Helen', date: '2026-04-13', time: '18:00', totalDurationMins: 60 };
  // Helen ends at 18:00; a 60-min service starting at 18:00 ends at 19:00 > 18:00 → outside_shift
  var r = AL.checkAvailability(BIZ, draft, []);
  assert(!r.valid, 'Service would run past Helens shift end');
  assertEq(r.key, 'outside_shift');
});

test('time before shift start returns key=outside_shift', function() {
  var draft = { staff: 'Tracy', date: '2026-04-13', time: '09:00', totalDurationMins: 60 };
  // Tracy starts at 10:00; 09:00 is before her shift
  var r = AL.checkAvailability(BIZ, draft, []);
  assert(!r.valid, 'Tracy does not start until 10:00');
  assertEq(r.key, 'outside_shift');
});

test('staff conflict: exact same time returns key=conflict', function() {
  var draft = { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid, 'Helen has another booking at 14:00');
  assertEq(r.key, 'conflict');
});

test('staff conflict: overlapping (not exact) time returns key=conflict', function() {
  // Helen booked 14:00-15:00; new request 14:30-15:30 overlaps
  var draft = { staff: 'Helen', date: '2026-04-13', time: '14:30', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_helen_monday_2pm'));
  assert(!r.valid, 'Overlapping appointment should conflict');
  assertEq(r.key, 'conflict');
});

test('staff conflict: suggests alternative slots', function() {
  var draft = { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_helen_monday_2pm'));
  assert(Array.isArray(r.altSlots) && r.altSlots.length > 0, 'Should suggest alternatives');
  // 13:00 and 15:00 should both be free
  assert(r.altSlots.indexOf('13:00') >= 0 || r.altSlots.indexOf('15:00') >= 0, 'Expected 13:00 or 15:00 as alternatives');
});

test('adjacent booking (back-to-back) does NOT conflict', function() {
  // Existing: Helen 13:00-14:00; new: Helen 14:00-15:00 — start == prior end, no overlap
  var existing = [{
    status: 'confirmed', requestedDate: '2026-04-13', requestedTime: '13:00',
    staff: 'Helen', totalDurationMins: 60,
    customerName: 'Bob', customerPhone: '4085550001'
  }];
  var draft = { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, existing);
  assert(r.valid, 'Back-to-back should not overlap');
});

test('"any" staff booking always skips named-staff conflict check', function() {
  var draft = { staff: 'any', date: '2026-04-13', time: '14:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_helen_monday_2pm'));
  assert(r.valid, '"any" staff bypasses named-staff conflict check');
});

test('cancelled booking does NOT block the slot', function() {
  var draft = { staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60 };
  var r = AL.checkAvailability(BIZ, draft, bookings('cancelled_helen_monday_2pm'));
  assert(r.valid === true, 'Cancelled booking must not block the slot');
});

test('customer conflict: same phone, overlapping time returns key=customer_conflict', function() {
  // Jane Smith (4085551234) has Tracy at 14:00 Mon; Jane books Helen at 14:00 same day
  var draft = {
    staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60,
    name: 'Jane', phone: '4085551234'
  };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_jane_monday_2pm'));
  assert(!r.valid, 'Same customer double-booked same time');
  assertEq(r.key, 'customer_conflict');
});

test('customer conflict: same name (no phone) triggers conflict', function() {
  var draft = {
    staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60,
    name: 'Jane Smith'
  };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_jane_monday_2pm'));
  assert(!r.valid, 'Name match alone should trigger customer_conflict');
  assertEq(r.key, 'customer_conflict');
});

test('CASE-003 regression: isModify=true excludes own booking (no customer_conflict loop)', function() {
  // Jane wants to reschedule her existing booking at 14:00 to a new time.
  // With isModify=true, her own booking should be excluded — no false customer_conflict.
  var draft = {
    staff: 'Tracy', date: '2026-04-13', time: '14:00', totalDurationMins: 45,
    name: 'Jane', phone: '4085551234',
    isModify: true
  };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_jane_monday_2pm'));
  assert(r.valid === true, 'isModify should exclude own booking; no customer_conflict should fire');
});

test('CASE-003 regression: isModify=true, different staff still checks staff conflict', function() {
  // Jane reschedules to a slot that Helen (different person) has booked — should still conflict on staff
  var draft = {
    staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60,
    name: 'Jane', phone: '4085551234',
    isModify: true
  };
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_helen_monday_2pm'));
  // Helen is booked by Bob at 14:00; Jane's reschedule tries to book Helen at same time
  assert(!r.valid, 'Staff conflict should still fire even with isModify=true');
  assertEq(r.key, 'conflict');
});

test('CASE-006 regression: customer can reschedule to slot their old booking occupied', function() {
  // Edge case: Jane currently at 14:00 with Tracy; wants to keep same time but switch staff.
  // Her own 14:00 booking should NOT block a booking with Helen at 14:00.
  var draft = {
    staff: 'Helen', date: '2026-04-13', time: '14:00', totalDurationMins: 60,
    name: 'Jane', phone: '4085551234',
    isModify: true
  };
  // Only Jane's existing booking exists (no Helen conflict)
  var r = AL.checkAvailability(BIZ, draft, bookings('confirmed_jane_monday_2pm'));
  assert(r.valid === true, 'Own booking excluded; Helen is free; reschedule should succeed');
});

test('no booking fields → falls through to valid=true (fail-open)', function() {
  var r = AL.checkAvailability(BIZ, null, []);
  assert(r.valid === true, 'null draft should be valid (fail-open)');
});

test('missing time field → falls through to valid=true (fail-open)', function() {
  var r = AL.checkAvailability(BIZ, { staff: 'Helen', date: '2026-04-13' }, []);
  assert(r.valid === true, 'Missing time is treated as fail-open');
});

// ══════════════════════════════════════════════════════════════════════════
// GROUP 4 — REGRESSION CASE LIBRARY
// Validate structure and content of all case files.
// For each fixed case with a verify_fix_string, confirm the fix is still
// detectable in receptionist.js source code.
// ══════════════════════════════════════════════════════════════════════════

group('Regression Case Library');

var casesDir  = path.join(__dirname, 'cases');
var caseFiles = fs.readdirSync(casesDir).filter(function(f) { return f.endsWith('.json'); }).sort();

test('at least 10 case files exist', function() {
  assert(caseFiles.length >= 10, 'Expected \u226510 case files, found ' + caseFiles.length);
});

var allCases = caseFiles.map(function(f) {
  return JSON.parse(fs.readFileSync(path.join(casesDir, f)));
});

// Structure validation for every case
allCases.forEach(function(c, i) {
  var fname = caseFiles[i];
  test('CASE ' + fname + ': required fields present', function() {
    assert(c.id,                  fname + ': missing id');
    assert(c.category,            fname + ': missing category');
    assert(c.title,               fname + ': missing title');
    assert(typeof c.fixed === 'boolean', fname + ': missing fixed (must be true/false)');
    assert(c.failing_behavior,    fname + ': missing failing_behavior');
    assert(c.root_cause,          fname + ': missing root_cause');
    assert(Array.isArray(c.code_areas) && c.code_areas.length > 0, fname + ': missing code_areas array');
    assert(Array.isArray(c.conversation) && c.conversation.length >= 1, fname + ': conversation must have \u22651 turn');
  });
});

// For fixed cases with a verify_fix_string, confirm the code fix is present in source
allCases.forEach(function(c) {
  if (!c.fixed || !c.verify_fix_string) return;
  test(c.id + ' (' + c.category + '): fix detectable in receptionist.js — ' + c.title.slice(0, 50), function() {
    assertContains(src, c.verify_fix_string,
      c.id + ' fix string not found in receptionist.js.\n    String: "' + c.verify_fix_string + '"\n    This may mean the fix was accidentally removed.');
  });
});

// Summary of case statuses
var fixedCount   = allCases.filter(function(c) { return c.fixed; }).length;
var openCount    = allCases.filter(function(c) { return !c.fixed; }).length;
var categories   = {};
allCases.forEach(function(c) { categories[c.category] = (categories[c.category] || 0) + 1; });

console.log('\n  Case summary: ' + fixedCount + ' fixed, ' + openCount + ' open');
console.log('  Categories: ' + Object.keys(categories).map(function(k) { return k + '(' + categories[k] + ')'; }).join(', '));

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(54));
if (_failed === 0) {
  console.log('\u2705  ALL TESTS PASSED: ' + _passed + ' passed, 0 failed');
} else {
  console.log('\u274C  FAILURES: ' + _passed + ' passed, ' + _failed + ' failed');
  console.log('\nFailed tests:');
  _failures.forEach(function(f) {
    console.log('  \u2717 [' + f.group + '] ' + f.name);
    console.log('    \u2192 ' + f.error);
  });
  process.exit(1);
}
console.log('='.repeat(54) + '\n');
