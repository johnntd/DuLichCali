'use strict';

// Pinning tests for the "Book this service" → manual booking form path.
// This bug was caused by the Book CTA sharing a handler with the AI chat
// panel. These tests assert the three flows are wired to three distinct
// helpers so they cannot collapse back into a single handler.

var fs = require('fs');
var path = require('path');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberManualBookingTests(test) {

  test('M1. renderSelectedService wires three SEPARATE handlers', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function renderSelectedService');
    assert(startIdx > 0, 'renderSelectedService must exist');
    var fn = src.slice(startIdx, startIdx + 3000);

    // book handler must call openManualBookingForm (manual flow)
    var bookBlock = fn.slice(fn.indexOf('book.addEventListener'), fn.indexOf('chat.addEventListener'));
    assert(bookBlock.indexOf('openManualBookingForm') >= 0,
      'Book handler MUST open manual booking form. Got: ' + bookBlock.slice(0, 200));
    assert(bookBlock.indexOf('openAssistantPanel') < 0,
      'Book handler MUST NOT open AI assistant panel. Got: ' + bookBlock.slice(0, 200));
    assert(bookBlock.indexOf('openVoiceAssistant') < 0,
      'Book handler MUST NOT open voice assistant. Got: ' + bookBlock.slice(0, 200));
    assert(bookBlock.indexOf('promptForLocation') < 0,
      'Book handler MUST NOT call promptForLocation (which redirects to AI).');

    // chat handler must open assistant
    var chatBlock = fn.slice(fn.indexOf('chat.addEventListener'), fn.indexOf('voice.addEventListener'));
    assert(chatBlock.indexOf("openAssistantPanel('general')") >= 0,
      'Chat handler must open the AI assistant panel.');
    assert(chatBlock.indexOf('openVoiceAssistant') < 0,
      'Chat handler must not open voice.');

    // voice handler must open voice
    var voiceBlock = fn.slice(fn.indexOf('voice.addEventListener'));
    assert(voiceBlock.indexOf('openVoiceAssistant') >= 0,
      'Voice handler must open voice assistant.');
  });

  test('M2. Per-card "Select Service" CTA does NOT auto-open the AI chat', function() {
    var src = read('mobile-barber/mobile-barber.js');
    // Locate the per-card CTA click handler inside renderServices()
    var startIdx = src.indexOf('cta.textContent = t(\'selectService\');');
    assert(startIdx > 0, 'select-service CTA must exist');
    var handler = src.slice(startIdx, startIdx + 1200);
    assert(handler.indexOf('selectService(service)') >= 0, 'Select still selects the service');
    assert(handler.indexOf('promptForLocation') < 0,
      'Select Service MUST NOT call promptForLocation — that opens the AI panel.');
    assert(handler.indexOf('openAssistantPanel') < 0,
      'Select Service MUST NOT directly open the AI panel.');
  });

  test('M3. openManualBookingForm + renderManualBookingPanel + submitManualBooking exist', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('function openManualBookingForm') >= 0, 'openManualBookingForm must exist');
    assert(src.indexOf('function renderManualBookingPanel') >= 0, 'renderManualBookingPanel must exist');
    assert(src.indexOf('function submitManualBooking') >= 0, 'submitManualBooking must exist');
    assert(src.indexOf('state.manualBooking') >= 0, 'manualBooking state slice must exist');
  });

  test('M4. submitManualBooking goes direct (no chat agent)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitManualBooking');
    var fn = src.slice(startIdx, startIdx + 7000);
    assert(fn.indexOf('BOOKING.findVendorForAddress') >= 0, 'must route via findVendorForAddress');
    assert(fn.indexOf('BOOKING.checkAvailability') >= 0, 'must call checkAvailability');
    assert(fn.indexOf('BOOKING.buildBooking') >= 0, 'must call buildBooking');
    assert(fn.indexOf('BOOKING.saveBooking') >= 0, 'must call saveBooking');
    assert(fn.indexOf('requireDatabase: true') >= 0, 'must require Firestore write');
    assert(fn.indexOf('AGENT.handleMessage') < 0, 'must NOT route through chat agent');
    assert(fn.indexOf('openAssistantPanel') < 0, 'must NOT open the AI panel');
  });

  test('M5. Manual booking attaches selected AI hairstyle if present', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitManualBooking');
    var fn = src.slice(startIdx, startIdx + 7000);
    assert(fn.indexOf('state.aiPreview') >= 0, 'must read AI preview state');
    assert(fn.indexOf('selectedAiStyleId') >= 0, 'must attach selectedAiStyleId');
    assert(fn.indexOf('selectedAiStyleName') >= 0, 'must attach selectedAiStyleName');
    assert(fn.indexOf('selectedAiStyleImage') >= 0, 'must attach selectedAiStyleImage');
    assert(fn.indexOf('selectedAiBarberNotes') >= 0, 'must attach selectedAiBarberNotes');
  });

  test('M6. i18n: manualBooking* keys present in en, vi, es', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var keys = [
      'manualBookingFormTitle', 'manualBookingPhone', 'manualBookingName',
      'manualBookingAddress', 'manualBookingCity', 'manualBookingZip',
      'manualBookingDate', 'manualBookingTime', 'manualBookingNotes',
      'manualBookingSubmit', 'manualBookingSuccess', 'manualBookingMissing',
      'manualBookingNoVendor', 'manualBookingCancel'
    ];
    keys.forEach(function(k) {
      // each key should appear at least 3 times (en + vi + es definitions)
      var count = src.split(k + ':').length - 1;
      assert(count >= 3, 'i18n key ' + k + ' must be defined in all 3 languages (found ' + count + ')');
    });
  });

  test('M7. CSS ships manual booking panel + expand animation', function() {
    var css = read('mobile-barber/mobile-barber.css');
    assert(css.indexOf('.mb-manual-booking') >= 0, 'manual-booking selector must exist');
    assert(css.indexOf('.mb-manual-booking__submit') >= 0, 'submit class must exist');
    assert(css.indexOf('.mb-manual-booking__success') >= 0, 'success class must exist');
    assert(css.indexOf('mbManualBookingExpand') >= 0, 'expand keyframe must exist');
    assert(css.indexOf('prefers-reduced-motion') >= 0, 'must respect reduced motion');
  });

  test('M8. Hero/CTA chat/voice triggers still open AI assistants', function() {
    // Regression check: do not accidentally rewire the legitimate AI CTAs.
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf("openVoiceAssistant()") >= 0, 'voice CTA wiring must remain');
    assert(src.indexOf("openAssistantPanel('general')") >= 0, 'chat CTA wiring must remain');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberManualBookingTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber manual booking tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberManualBookingTests: runMobileBarberManualBookingTests };
